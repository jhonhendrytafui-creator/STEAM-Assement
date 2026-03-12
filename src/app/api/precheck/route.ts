import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Subject constants for mapping IDs to readable names
const SUBJECTS = [
    { id: 'matematika', label: 'Matematika' },
    { id: 'fisika', label: 'Fisika' },
    { id: 'biologi', label: 'Biologi' },
    { id: 'kimia', label: 'Kimia' },
    { id: 'informatika', label: 'Informatika' },
    { id: 'seni', label: 'Seni Rupa/Musik' },
    { id: 'ekonomi', label: 'Ekonomi' },
    { id: 'sosiologi', label: 'Sosiologi' },
    { id: 'geografi', label: 'Geografi' },
    { id: 'sejarah', label: 'Sejarah' },
    { id: 'bahasa_indo', label: 'Bahasa Indonesia' },
    { id: 'bahasa_inggris', label: 'Bahasa Inggris' },
    { id: 'bahasa_mandarin', label: 'Bahasa Mandarin' },
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

Your goal is to provide a brief "Pre-Check" that highlights what they are doing well, and gives 1-2 constructive hints on how they could strengthen their problem statement, solution, or interdisciplinary connections. 

CRITICAL RULES:
1. **DO NOT give them direct answers or write the project for them.** Only ask guiding questions or suggest areas to think deeper about (e.g. "Have you considered how much this might cost?" or "Your problem is good, but who exactly is suffering from it?").
2. Be encouraging and use a supportive tone.
3. Keep it brief. 

STUDENT DRAFT DATA:
### Problem Statement:
${problem}

### Proposed Solution:
${solution}

### Key Concepts (STEAM Integration):
${conceptsString}

Format your response in simple Markdown. Use 2 sections:
### 🌟 What's Looking Good
Provide 1-2 short bullet points praising specific elements of their idea.

### 💡 Points to Consider
Provide 1-2 short bullet points with guiding questions or hints to improve their depth, problem definition, or STEAM integration before submission.
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
