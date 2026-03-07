import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { project, categoryName, indicators } = body;

        if (!project || !categoryName || !indicators) {
            return NextResponse.json(
                { error: 'Missing required fields (project, categoryName, or indicators)' },
                { status: 400 }
            );
        }

        // Validate API Key
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Server missing GEMINI_API_KEY configuration.' },
                { status: 500 }
            );
        }

        // Create dynamic schema properties for the scores based on indicators
        const scoreProperties: Record<string, any> = {};
        indicators.forEach((i: any) => {
            scoreProperties[i.id] = {
                type: SchemaType.INTEGER,
                description: `Score for indicator: ${i.description}`
            };
        });

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.2, // Low temperature for consistent grading
                responseMimeType: "application/json",
                // Strongly typed response schema so the LLM knows what to return
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        scores: {
                            type: SchemaType.OBJECT,
                            properties: scoreProperties,
                            description: "A map of indicator IDs as string keys mapping to their assessed integer score values."
                        },
                        teacher_comment: {
                            type: SchemaType.STRING,
                            description: "A constructive, 2-3 sentence comment written as if from the teacher directly to the student."
                        },
                        suggested_status: {
                            type: SchemaType.STRING,
                            description: "The suggested overarching status for the project based on the scores. MUST be exactly one of: 'approved', 'revision', 'disapproved'."
                        }
                    },
                    required: ["scores", "teacher_comment", "suggested_status"]
                }
            }
        });

        // Construct the Prompt Context
        const prompt = `You are a strict, fair, and encouraging Teacher grading a student STEAM project. 
You are grading the assessment category: "${categoryName}".

Project Data Payload:
<TITLE>
${project.title}
</TITLE>
<PROBLEM>
${project.problem_description}
</PROBLEM>
<SOLUTION>
${project.solution_description}
</SOLUTION>
<KEY_CONCEPTS>
${JSON.stringify(project.key_concepts || {})}
</KEY_CONCEPTS>

Assessment Indicators (You must provide an integer score for EVERY indicator ID in your 'scores' map):
${JSON.stringify(indicators, null, 2)}

Provide your output according to the JSON schema.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let jsonPayload;
        try {
            jsonPayload = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", responseText);
            return NextResponse.json({ error: 'Failed to process AI response formatting.' }, { status: 500 });
        }

        return NextResponse.json(jsonPayload);

    } catch (error: any) {
        console.error('AI Assessment Error:', error);
        return NextResponse.json(
            { error: error.message || 'An error occurred during AI assessment.' },
            { status: 500 }
        );
    }
}
