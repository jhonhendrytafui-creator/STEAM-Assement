import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Rubric criteria from c1_prompt.md — gives the AI specific scoring guidance per category
function buildRubricContext(categoryName: string): string {
    const lowerCat = categoryName.toLowerCase();

    if (lowerCat.includes('title') || lowerCat.includes('judul')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Indicator: Meaning & Purpose
  1 (Beginning): Vague; hard to tell what the project is about.
  2 (Developing): Tells the topic, but the goal is slightly unclear.
  3 (Proficient): Clearly states what the project is and its goal.
  4 (Exemplary): Creative and immediately tells the "Why" and "What."

Indicator: Originality
  1 (Beginning): Very common/generic (e.g., 'The Volcano').
  2 (Developing): A standard topic with a small personal twist.
  3 (Proficient): An uncommon approach to a known problem.
  4 (Exemplary): Highly original; a unique perspective or niche topic.

Indicator: Concise & Core
  1 (Beginning): Too long or uses unnecessary jargon.
  2 (Developing): A bit wordy; contains extra info.
  3 (Proficient): Short and punchy; hits the main point.
  4 (Exemplary): Perfectly concise; uses a "hook" effectively.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    if (lowerCat.includes('problem') || lowerCat.includes('solution') || lowerCat.includes('masalah') || lowerCat.includes('solusi')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Indicator: Theme Connection
  1 (Beginning): No clear link to the assigned theme.
  2 (Developing): Loose link; requires some guessing.
  3 (Proficient): Solid connection; mentions the theme directly.
  4 (Exemplary): Seamless integration; the theme is the project's heart.

Indicator: Real-Life Context
  1 (Beginning): Abstract; no clear use for real people.
  2 (Developing): Hypothetical; could happen but feels distant.
  3 (Proficient): Directly linked to a common real-world issue.
  4 (Exemplary): Solves a specific, relatable "pain point" in their community.

Indicator: Conceptual Understanding
  1 (Beginning): Mentions subjects but no clear application.
  2 (Developing): Uses a concept but doesn't explain the "how."
  3 (Proficient): Shows a good grasp of the underlying subject theory.
  4 (Exemplary): Demonstrates deep understanding through a clever application.

Indicator: STEAM Integration
  1 (Beginning): Only uses 1 field (e.g., just Science).
  2 (Developing): Uses 2 fields but they feel separate.
  3 (Proficient): Naturally blends 2-3 STEAM fields together.
  4 (Exemplary): Truly interdisciplinary; fields work together for the solution.

Indicator: Ability & Grade Level
  1 (Beginning): Far too simple or way too complex for their age.
  2 (Developing): Slightly off-target for their current level.
  3 (Proficient): Appropriately challenging for their grade level.
  4 (Exemplary): Perfectly balanced; shows growth within their grade level.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    // Fallback for other categories — use generic 1-4 guidance
    return `RUBRIC GUIDANCE FOR "${categoryName}":
Use the 1-4 scoring scale. Match each indicator's score to the level that best describes the student's work:
  1 (Beginning): Minimal effort, missing core requirements.
  2 (Developing): Some understanding shown but needs significant improvement.
  3 (Proficient): Meets expectations with solid, clear work.
  4 (Exemplary): Exceptional, creative, goes above and beyond.`;
}

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
                            description: "A single, casual, friendly feedback paragraph written directly to the student. Must mention one specific strength and one specific suggestion for improvement."
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

        // ===== RUBRIC-BASED PROMPT (from c1_prompt.md) =====
        // Build the rubric context string based on the category being assessed
        const rubricContext = buildRubricContext(categoryName);

        // Extract problem, solution, and key concepts from project abstract
        let problemDesc = project.problem_description || '';
        let solutionDesc = project.solution_description || '';
        let keyConcepts = project.key_concepts || {};

        if (project.abstract) {
            try {
                const parsedAbstract = typeof project.abstract === 'string' ? JSON.parse(project.abstract) : project.abstract;
                if (parsedAbstract.problem) problemDesc = parsedAbstract.problem;
                if (parsedAbstract.solution) solutionDesc = parsedAbstract.solution;
                if (parsedAbstract.keyConcepts) keyConcepts = parsedAbstract.keyConcepts;
            } catch (e) {
                console.error("Failed to parse project abstract:", e);
            }
        }

        const prompt = `You are an encouraging STEAM educator assistant. Your task is to review a student's STEAM project based on a specific rubric and provide scores and a single, casual feedback paragraph.

You are assessing the category: "${categoryName}".

CORE ASSESSMENT FOCUS:
- Interdisciplinary Purpose: How well are Science, Tech, Engineering, Art, and Math combined?
- Real-World Context: Is this a problem people actually face?
- Prototype Potential: Is there a clear path to building a physical or digital model?

SCORING SCALE (1-4):
- 1 (Beginning): Minimal effort, missing core requirements, vague or unclear.
- 2 (Developing): Shows some understanding but lacks depth or clarity. Needs significant improvement.
- 3 (Proficient): Meets expectations. Solid work that covers the requirements clearly.
- 4 (Exemplary): Exceptional work. Creative, thorough, and goes above and beyond.

${rubricContext}

STUDENT PROJECT DATA:
<TITLE>
${project.title}
</TITLE>
<PROBLEM>
${problemDesc || 'Not provided.'}
</PROBLEM>
<SOLUTION>
${solutionDesc || 'Not provided.'}
</SOLUTION>
<KEY_CONCEPTS>
${JSON.stringify(keyConcepts || {})}
</KEY_CONCEPTS>

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

FEEDBACK GUIDELINES:
1. Analyze the project data against EACH indicator using the rubric criteria above.
2. Provide an integer score (1-4) for EVERY indicator ID in your 'scores' map.
3. Be kind and supportive in tone, but honest and objective in scoring.
4. Your 'teacher_comment' MUST be a single casual, friendly paragraph. Always prioritize suggestions for improvement over just pointing out flaws. Mention ONE specific strength and ONE specific area to improve with a concrete suggestion.
5. Your 'suggested_status' should be:
   - 'approved' if most scores are 3 or 4
   - 'revision' if most scores are 2 or below
   - 'disapproved' only if most scores are 1

Provide your output exactly matching the JSON schema.
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
