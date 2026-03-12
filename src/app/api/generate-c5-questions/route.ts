import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Google Doc Text Extraction ─────────────────────
async function fetchGoogleDocText(url: string): Promise<string> {
    try {
        // Extract Google Doc ID from URL
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) return '';
        const docId = match[1];

        // Fetch as plain text via Google's export URL
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const response = await fetch(exportUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STEAMBot/1.0)' },
            redirect: 'follow',
        });

        if (!response.ok) return '';
        const text = await response.text();
        // Limit to ~15000 chars to stay within token limits
        return text.slice(0, 15000);
    } catch (e) {
        console.error('Failed to fetch Google Doc text:', e);
        return '';
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { projectData } = body;

        if (!projectData) {
            return NextResponse.json(
                { success: false, error: 'Project data is required.' },
                { status: 400 }
            );
        }

        // 1. Fetch Google Doc Content if available
        let docContent = '';
        if (projectData.google_doc_url) {
            docContent = await fetchGoogleDocText(projectData.google_doc_url);
        }

        // 2. Build the Document Context
        let projectAbstactObj: any = {};
        try {
            if (projectData.abstract) {
                projectAbstactObj = JSON.parse(projectData.abstract);
            }
        } catch (e) { }

        let contextString = `
PROJECT TITLE: ${projectData.title}
PROJECT PROBLEM: ${projectAbstactObj.problem || 'Not specified'}
PROJECT SOLUTION: ${projectAbstactObj.solution || 'Not specified'}
KEY CONCEPTS INVOLVED: ${JSON.stringify(projectAbstactObj.keyConcepts || [])}
`;

        if (docContent) {
            contextString += `\n\n--- EXTRACTED GOOGLE DOC CONTENT ---\n${docContent}\n--- END OF DOC CONTENT ---\n`;
        }

        // 3. System Instructions based on user's c5_prompt
        const systemInstruction = `
**Role & Objective**
You are a sharp, analytical STEAM Education Expert acting as a Q&A Assistant for a teacher. Your job is to review a group of students' STEAM project data (presentation slides, notes, or project summaries) and generate **10 rigorous, inquiry-based questions** for the teacher to ask during the live presentation Q&A session. You are not grading the students; you are providing the assessor with the ammunition to test the students' true understanding. You must not sugarcoat the questions—they should be challenging, objective, and force the students to defend their work.

**Input Data Expectation**
You will receive student presentation data, which may include:
* Their defined problem, target audience, and constraints.
* The scientific theories, mathematical data, and STEAM links they claim to use.
* Their solution architecture, design iterations, and aesthetic choices.

**Question Generation Framework**
Your 10 questions must directly target the core dimensions of a STEAM presentation. Break the 10 questions down into these specific angles:
1. **Problem Articulation (2 Questions):** Challenge their real-world context. Ask them to defend why their target audience actually needs this, or how specific constraints (like budget or location) limit their solution.
2. **Scientific & Mathematical Foundation (2 Questions):** Probe the data. Ask them to explain a specific scientific law they used or challenge the accuracy/reliability of the mathematical measurements supporting their claims.
3. **Engineering & Iteration (2 Questions):** Focus on the struggle. Ask about a specific sketch or draft that failed, why it failed, and how the Engineering Design Process (EDP) forced them to pivot.
4. **STEAM Integration (2 Questions):** Demand proof of interdisciplinary connection. Ask how the Art/Aesthetic elements directly improve the function of the solution, or how the Technology and Science aspects rely on each other to work.
5. **Critical Weakness & Critique (2 Questions):** Expose the gaps. Identify a potential flaw, missing data point, or weak link in their architecture and ask them how they would defend against or fix it.

**Strict Output Constraints**
1. **The Summary:** You MUST begin your output with a **single, casual paragraph** summarizing the overall theoretical strengths and potential logical gaps you noticed in the project data. Do not use bullet points or line breaks for this summary paragraph.
2. **The Q&A List:** Immediately following the summary paragraph, provide the 10 questions in a clean, numbered list. The questions must be direct, phrased exactly as the teacher should ask them to the students, and free of any introductory fluff.
        `;

        // 4. Call Gemini
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction
        });

        // We use string generation, no JSON schema required for C5.
        const prompt = `Analyze the following STEAM project data and generate 10 rigorous Q&A questions for the final presentation based on the provided framework.\n\nPROJECT DATA:\n${contextString}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({
            success: true,
            generatedQuestions: responseText
        });

    } catch (error: any) {
        console.error('Error in /api/generate-c5-questions:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error while generating questions' },
            { status: 500 }
        );
    }
}
