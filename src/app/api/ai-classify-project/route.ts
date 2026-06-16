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
        if (project.abstract) {
            try {
                const parsedAbstract = typeof project.abstract === 'string' ? JSON.parse(project.abstract) : project.abstract;
                if (parsedAbstract.problem) problemDesc = parsedAbstract.problem;
                if (parsedAbstract.solution) solutionDesc = parsedAbstract.solution;
            } catch (e) {
                // Ignore parsing errors, it might just be a string
                problemDesc = project.abstract;
            }
        }

        const prompt = `You are a STEAM Education Coordinator. Your task is to assign the best possible Guide Teachers for a new student STEAM project based on the project's abstract and the teachers' subject expertise.
        
PROJECT INFORMATION:
Title: ${project.title}
Problem: ${problemDesc}
Solution: ${solutionDesc}

AVAILABLE TEACHERS:
${teachersWithExpertise.map(t => `- Name: ${t.full_name}, Email: ${t.email}, Expertise: ${t.expertise}`).join('\n')}

TASK:
Analyze the project information and the expertise of all available teachers. Select exactly 3 teachers who are the most relevant to guide this project.
Classify your 3 recommendations into 'High', 'Medium', and 'Low' relevance.
- High: The teacher's expertise perfectly aligns with the core problem or solution of the project.
- Medium: The teacher's expertise covers a secondary aspect of the project.
- Low: The teacher's expertise is tangentially related or provides general STEAM guidance.

Provide a short, objective reason for why each teacher was selected and estimate a percentage of relevance (0-100%).
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

        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: responseSchemaProperties,
                    required: ["recommendations"]
                }
            }
        });

        console.log(`[AI-Classify] Analyzing project: ${project.title}`);
        const result = await model.generateContent(prompt, { timeout: 55000 });
        const responseText = result.response.text();
        const jsonPayload = JSON.parse(responseText);

        const recommendations = jsonPayload.recommendations;

        if (!recommendations || recommendations.length === 0) {
             throw new Error('AI returned no recommendations');
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
