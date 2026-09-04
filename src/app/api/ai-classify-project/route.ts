import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, type GenerationConfig, type Schema } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { requireTeacher } from '@/lib/api-auth';

export const maxDuration = 60;

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
    try {
        // Establish who is calling BEFORE reaching for the service role key.
        // That key bypasses every RLS policy, so an unverified caller would be
        // able to read any project and the entire teacher directory.
        const auth = await requireTeacher(req);
        if ('response' in auth) return auth.response;

        const body = await req.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // Now that the caller is a verified teacher, use the elevated client so
        // the classification can read every teacher profile. Falls back to the
        // caller's own token when no service role key is configured.
        const authHeader = req.headers.get('Authorization');
        const userToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const supabase = serviceRoleKey
            ? createClient(supabaseUrl, serviceRoleKey)
            : userToken
                ? createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${userToken}` } } })
                : createClient(supabaseUrl, anonKey);

        // 1. Fetch project data
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            console.error("Failed to fetch project:", projectError);
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // 2. Fetch all teachers and their expertise
        // Use select('*') so the query doesn't fail if the expertise column is missing from profiles.
        const { data: teachersRaw, error: teacherError } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'teacher');

        if (teacherError) {
            console.error("Failed to fetch teachers:", teacherError);
            return NextResponse.json({ error: `Failed to fetch teacher list: ${teacherError.message}` }, { status: 500 });
        }

        if (!teachersRaw || teachersRaw.length === 0) {
            return NextResponse.json({ error: 'No teacher profiles found in the system. Make sure teacher accounts exist with role="teacher".' }, { status: 400 });
        }

        // Normalize the teacher list — support expertise OR subject column names
        const teachers = teachersRaw.map((t: any) => ({
            email: t.email || '',
            full_name: t.full_name || t.name || t.email || 'Unknown',
            expertise: t.expertise || t.subject || t.subjects || ''
        }));

        const teachersWithExpertise = teachers.filter(t => t.expertise && t.expertise.trim().length > 0);

        if (teachersWithExpertise.length === 0) {
            return NextResponse.json({
                error: 'No teachers have their subject expertise configured. Please update teacher profiles with their STEAM subject (e.g. Biology, Mathematics, Music) in the "expertise" field.'
            }, { status: 400 });
        }

        // 3. Prepare data for Gemini
        let problemDesc = project.problem_description || '';
        let solutionDesc = project.solution_description || '';
        let keyConcepts: Record<string, string> = {};
        if (project.abstract) {
            try {
                const parsedAbstract = typeof project.abstract === 'string' ? JSON.parse(project.abstract) : project.abstract;
                if (parsedAbstract.problem) problemDesc = parsedAbstract.problem;
                if (parsedAbstract.solution) solutionDesc = parsedAbstract.solution;
                if (parsedAbstract.keyConcepts) keyConcepts = parsedAbstract.keyConcepts;
            } catch (e) {
                problemDesc = project.abstract;
            }
        }

        const keyConceptsText = Object.entries(keyConcepts).length > 0
            ? Object.entries(keyConcepts).map(([subject, concept]) => `  ${subject}: ${concept}`).join('\n')
            : '  (not specified)';

        const prompt = `You are an expert STEAM Education Coordinator. Your task is to recommend the 3 most suitable Guide Teachers for a student STEAM project based on the project's content and each teacher's subject expertise.

STEAM DISCIPLINES CONTEXT:
A STEAM project integrates any combination of these disciplines:
- Science: Biology, Chemistry, Physics, Earth Science, Environmental Science, Neuroscience
- Technology: Computer Science, Programming, Information Systems, Electronics, Robotics
- Engineering: Mechanical Engineering, Civil Engineering, Electrical Engineering, Biomedical Engineering, Materials Science, Product Design
- Art: Visual Art, Graphic Design, Music, Performing Arts, Architecture, Industrial Design, Animation
- Mathematics: Algebra, Statistics, Calculus, Geometry, Data Analysis, Financial Mathematics

PROJECT INFORMATION:
Title: ${project.title}
Problem Being Solved: ${problemDesc || '(not provided)'}
Proposed Solution / Prototype: ${solutionDesc || '(not provided)'}
STEAM Key Concepts Applied:
${keyConceptsText}

AVAILABLE GUIDE TEACHERS:
${teachersWithExpertise.map(t => `- Name: ${t.full_name}, Email: ${t.email}, Expertise: ${t.expertise}`).join('\n')}

TASK:
1. Carefully read the project title, problem, solution, and key STEAM concepts.
2. Identify which STEAM disciplines are MOST involved in solving this project.
3. Match those disciplines to the available teachers' expertise.
4. Select exactly 3 teachers — ranked from most to least relevant.
5. Assign rank levels:
   - 'High': This teacher's expertise directly addresses the core discipline(s) driving the project's problem or solution.
   - 'Medium': This teacher's expertise covers a secondary STEAM discipline used in the project.
   - 'Low': This teacher provides useful supplementary guidance from a tangentially related STEAM area.
6. Write a specific, objective reason (2-3 sentences) explaining EXACTLY why each teacher's expertise matches this project. Reference the project's actual content, not generic statements.
7. Estimate a relevance percentage (0–100%) based on how well the expertise aligns.

RULES:
- Only recommend teachers from the AVAILABLE GUIDE TEACHERS list above.
- Do NOT recommend a teacher whose expertise has no logical connection to the project.
- If fewer than 3 teachers have relevant expertise, still return 3 but rank the least-relevant ones as 'Low' with an honest, specific reason.
- Be precise and STEAM-discipline-aware in your reasoning.
`;

        const responseSchemaProperties: Record<string, Schema> = {
            recommendations: {
                type: SchemaType.ARRAY,
                description: "Array of exactly 3 teacher recommendations",
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        teacher_email: { type: SchemaType.STRING, description: "The email of the recommended teacher" },
                        rank_level: { type: SchemaType.STRING, description: "Must be exactly 'High', 'Medium', or 'Low'" },
                        relevance_percentage: { type: SchemaType.INTEGER, description: "Percentage of relevance (0-100)" },
                        reason: { type: SchemaType.STRING, description: "Short explanation for this recommendation" }
                    },
                    required: ["teacher_email", "rank_level", "relevance_percentage", "reason"]
                }
            }
        };

        // Annotated so SchemaType.OBJECT narrows to the literal member type the
        // SDK expects, instead of widening to the whole SchemaType enum.
        const generationConfig: GenerationConfig = {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: responseSchemaProperties,
                required: ["recommendations"]
            }
        };

        const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
        let recommendations: any[] = [];
        let lastError: any = null;

        for (let attempt = 0; attempt < fallbackModels.length; attempt++) {
            const modelName = fallbackModels[attempt];
            try {
                console.log(`[AI-Classify] Attempt ${attempt + 1}/${fallbackModels.length} with model ${modelName} for project: ${project.title}`);
                const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
                const result = await model.generateContent(prompt, { timeout: 55000 });
                const jsonPayload = JSON.parse(result.response.text());
                recommendations = jsonPayload.recommendations || [];
                if (recommendations.length > 0) break;
            } catch (e: any) {
                lastError = e;
                console.error(`[AI-Classify] Model ${modelName} failed:`, e?.message?.slice(0, 150));
            }
        }

        if (!recommendations || recommendations.length === 0) {
            throw new Error(lastError?.message || 'AI returned no recommendations after all attempts');
        }

        // 4. Save recommendations to database
        const insertData = recommendations.map((rec: any) => {
            const teacher = teachers.find(t => t.email === rec.teacher_email);
            return {
                project_id: projectId,
                teacher_email: rec.teacher_email,
                teacher_name: teacher?.full_name || 'Unknown',
                teacher_expertise: teacher?.expertise || 'Unknown',
                rank_level: rec.rank_level,
                relevance_percentage: rec.relevance_percentage,
                reason: rec.reason
            };
        });

        // Delete old recommendations first so re-classification replaces them cleanly.
        // If DELETE is blocked by RLS (no service role key), we fall back to upsert.
        const { error: deleteError } = await supabase
            .from('project_teacher_recommendations')
            .delete()
            .eq('project_id', projectId);

        if (deleteError) {
            console.warn('[AI-Classify] DELETE blocked (likely RLS without service role). Falling back to upsert:', deleteError.message);
        }

        const { error: insertError } = await supabase
            .from('project_teacher_recommendations')
            .upsert(insertData, { onConflict: 'project_id,teacher_email' });

        if (insertError) {
            console.error("Failed to save recommendations:", insertError);
            return NextResponse.json({ error: `Failed to save recommendations: ${insertError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: insertData.length });

    } catch (error: any) {
        console.error('AI Classification Error:', error);
        return NextResponse.json(
            { error: error.message || 'An error occurred during AI classification.' },
            { status: 500 }
        );
    }
}
