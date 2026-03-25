import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Subject constants for mapping IDs to readable names
const SUBJECTS = [
    { id: 'biology_marine', label: 'Biology & Marine Biology' },
    { id: 'chemistry', label: 'Chemistry' },
    { id: 'physics', label: 'Physics' },
    { id: 'environmental_science', label: 'Environmental Science' },
    { id: 'astronomy', label: 'Astronomy' },
    { id: 'geology_meteorology', label: 'Geology & Meteorology' },
    { id: 'psychology', label: 'Psychology' },
    
    { id: 'cs_programming', label: 'Computer Science & Programming' },
    { id: 'it', label: 'Information Technology (IT)' },
    { id: 'cybersecurity_data', label: 'Cybersecurity & Data Science' },
    { id: 'ai_ml', label: 'Artificial Intelligence & Machine Learning' },
    { id: 'robotics', label: 'Robotics' },
    { id: 'web_development', label: 'Web Development' },
    
    { id: 'civil_structural', label: 'Civil & Structural Engineering' },
    { id: 'mechanical', label: 'Mechanical Engineering' },
    { id: 'aerospace', label: 'Aerospace Engineering' },
    { id: 'electrical_electronic', label: 'Electrical & Electronic Engineering' },
    { id: 'chemical', label: 'Chemical Engineering' },
    { id: 'biomedical', label: 'Biomedical Engineering' },
    
    { id: 'visual_design', label: 'Visual Arts & Design' },
    { id: 'graphic_digital', label: 'Graphic Design & Digital Media' },
    { id: 'industrial_product', label: 'Industrial/Product Design' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'creative_language', label: 'Creative Arts & Language Arts' },
    { id: 'performing_arts', label: 'Performing Arts' },
    
    { id: 'calculus_linear', label: 'Calculus & Linear Algebra' },
    { id: 'statistics_probability', label: 'Statistics & Probability' },
    { id: 'differential_equations', label: 'Differential Equations' },
    { id: 'discrete_mathematics', label: 'Discrete Mathematics' },
    { id: 'financial_mathematics', label: 'Financial Mathematics' },
];

export async function POST(req: Request) {
    try {
        const { problem, solution, keyConcepts } = await req.json();

        if (!problem || !solution) {
            return NextResponse.json(
                { error: 'Missing required parameters: problem and solution are required.' },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is missing');
            return NextResponse.json(
                { error: 'AI Service is currently disabled. Please contact administrator.' },
                { status: 503 }
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Map key concepts to readable string
        const conceptsString = (keyConcepts || [])
            .map((c: any) => {
                const subjectLabel = SUBJECTS.find(s => s.id === c.subject)?.label || c.subject;
                return `- **${subjectLabel}**: ${c.concept}`;
            })
            .join('\n');

        const prompt = `
You are a friendly, encouraging STEAM Education Expert reviewing a high school student's STEAM project draft *before* they officially submit it to their teacher. 

Your goal is to provide a brief "Pre-Check" that highlights what they are doing well, gives 1-2 constructive hints, and reviews their key concepts.

CRITICAL RULES:
1. **DO NOT give them direct answers or write the project for them.** Only ask guiding questions or suggest areas to think deeper about (e.g. "Have you considered how much this might cost?" or "Your problem is good, but who exactly is suffering from it?").
2. Be encouraging and use a supportive tone.
3. Keep it brief.
4. **LANGUAGE: Write in simple, clear English. Use short sentences. Avoid difficult words. This is for students and teachers who use English as a second language (ESL). Make it easy to understand but still professional for a school setting.**

STUDENT DRAFT DATA:
### Problem Statement:
${problem}

### Proposed Solution:
${solution}

### Key Concepts (STEAM Integration):
${conceptsString}

Format your response in simple Markdown. Use 3 sections:
### 🌟 What's Looking Good
Provide 1-2 short bullet points praising specific elements of their idea.

### 💡 Points to Consider
Provide 1-2 short bullet points with guiding questions or hints to improve their depth, problem definition, or STEAM integration before submission.

### 🔬 Key Concept Review
Review the key concepts the student listed above. For each concept, write one short sentence about how well it connects to their problem and solution. Then:
- If any listed concept feels **unrelated or forced**, say so gently and explain why it may not fit.
- If there is an important STEAM field **missing** that would strengthen the project, suggest it with a brief reason.
- If all concepts are well-chosen, say so clearly.
Keep this section short and helpful. Use bullet points.
        `;


        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ result: responseText });

    } catch (error: any) {
        console.error('Error generating pre-check:', error);
        return NextResponse.json(
            { error: 'Failed to generate pre-check review. Please try again later.' },
            { status: 500 }
        );
    }
}
