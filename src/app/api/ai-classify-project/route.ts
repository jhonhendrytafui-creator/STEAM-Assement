import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Initialize Supabase client for server-side
// We use the service role key if available to bypass RLS for background jobs, 
// otherwise fallback to anon key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectId } = body;

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

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
        const { data: teachers, error: teacherError } = await supabase
            .from('profiles')
            .select('email, full_name, expertise')
            .eq('role', 'teacher');

        if (teacherError || !teachers || teachers.length === 0) {
            console.error("Failed to fetch teachers:", teacherError);
            return NextResponse.json({ error: 'No teachers found' }, { status: 404 });
        }

        // Filter out teachers without expertise (or we can just include them and let AI decide)
        const teachersWithExpertise = teachers.filter(t => t.expertise && t.expertise.trim().length > 0);
        
        if (teachersWithExpertise.length === 0) {
            return NextResponse.json({ error: 'No teachers with defined expertise found. Cannot classify.' }, { status: 400 });
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

        const responseSchemaProperties: Record<string, any> = {
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

        const generationConfig = {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: responseSchemaProperties,
                required: ["recommendations"]
            }
        };

        const fallbackModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
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
        // Delete old recommendations for this project first
        await supabase
            .from('project_teacher_recommendations')
            .delete()
            .eq('project_id', projectId);

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

        const { error: insertError } = await supabase
            .from('project_teacher_recommendations')
            .insert(insertData);

        if (insertError) {
             console.error("Failed to insert recommendations:", insertError);
             return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 });
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
