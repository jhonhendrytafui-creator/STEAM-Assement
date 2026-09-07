import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import { ACADEMIC_YEAR } from '@/lib/constants';
import { GeminiGenerationError, generateWithFallback } from '@/lib/gemini';
import { subjectLabel } from '@/lib/subjects';

export const maxDuration = 60;

// Wall-clock cap on the Gemini walk, kept under maxDuration so the route
// always returns JSON. If the host caps functions lower than this (Netlify's
// synchronous default is well under 60s), lower it to match — a killed
// function returns an HTML gateway error the browser cannot parse.
const GENERATION_BUDGET_MS = 45_000;

// Kept in sync with MAX_PRECHECKS in SubmitProjectTab. The limit is enforced
// here, on the server, because the browser copy can be edited by the student.
const MAX_PRECHECKS = 5;



export async function POST(req: Request) {
    try {
        const auth = await requireUser(req);
        if ('response' in auth) return auth.response;

        const { problem, solution, keyConcepts } = await req.json();

        if (!problem || !solution) {
            return NextResponse.json(
                { error: 'Missing required parameters: problem and solution are required.' },
                { status: 400 }
            );
        }

        // ── Configuration, checked before any quota is spent ──
        // Both keys used to be read after the counter was already incremented,
        // so a deployment missing one burned a group's allowance on every
        // click without ever calling Gemini.
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is missing — cannot run the AI Pre-Check.');
            return NextResponse.json(
                { error: 'AI Pre-Check is not set up yet. Please tell your teacher.' },
                { status: 503 }
            );
        }

        // ── Quota: derived from the caller's own roster row ──
        // The group is never taken from the request body, so a student cannot
        // spend another group's allowance or claim a fresh one.
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY is missing — cannot enforce the pre-check quota.');
            return NextResponse.json(
                { error: 'AI Pre-Check is temporarily unavailable. Please tell your teacher.' },
                { status: 503 }
            );
        }

        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

        const { data: roster } = await admin
            .from('student_master')
            .select('class_name, group_number')
            .eq('email', auth.user.email)
            .eq('academic_year', ACADEMIC_YEAR)
            .single();

        if (!roster) {
            return NextResponse.json(
                { error: `You are not registered in a group for ${ACADEMIC_YEAR}. Please contact your teacher.` },
                { status: 403 }
            );
        }

        const quotaKey = {
            class_name: roster.class_name,
            group_number: roster.group_number,
            academic_year: ACADEMIC_YEAR,
        };

        const { data: quotaRow } = await admin
            .from('ai_precheck_usage')
            .select('usage_count')
            .match(quotaKey)
            .maybeSingle();

        const usedSoFar = quotaRow?.usage_count ?? 0;
        if (usedSoFar >= MAX_PRECHECKS) {
            return NextResponse.json(
                {
                    error: `Your group has used all ${MAX_PRECHECKS} AI Pre-checks for this year.`,
                    usageCount: usedSoFar,
                },
                { status: 429 }
            );
        }

        // Reserve the slot before calling Gemini. Two students clicking at the
        // same moment then consume two slots instead of racing to one.
        const { error: reserveError } = await admin
            .from('ai_precheck_usage')
            .upsert(
                { ...quotaKey, usage_count: usedSoFar + 1 },
                { onConflict: 'class_name,group_number,academic_year' }
            );

        if (reserveError) {
            console.error('Failed to reserve pre-check quota:', reserveError.message);
            return NextResponse.json(
                { error: 'Could not start the AI Pre-Check. Please try again.' },
                { status: 500 }
            );
        }

        // If generation fails below, hand the slot back so a failed attempt
        // does not cost the group one of their five.
        const refundQuota = async () => {
            await admin
                .from('ai_precheck_usage')
                .update({ usage_count: usedSoFar })
                .match(quotaKey);
        };

        // Map key concepts to readable string
        const conceptsString = (keyConcepts || [])
            .map((c: any) => {
                return `- **${subjectLabel(c.subject)}**: ${c.concept}`;
            })
            .join('\n');

        const prompt = `
You are a friendly, encouraging STEAM Education Expert reviewing a high school student's STEAM project draft *before* they officially submit it to their teacher. 

Your goal is to provide a detailed, holistic "Pre-Check" that highlights what they are doing well, gives constructive feedback for each specific part of their abstract (Problem, Solution, Key Concepts), and reviews how everything connects together.

CRITICAL RULES:
1. **DO NOT give them direct answers or write the project for them.** Only ask guiding questions or suggest areas to think deeper about (e.g. "Have you considered how much this might cost?" or "Your problem is good, but who exactly is suffering from it?").
2. Be encouraging and use a supportive tone, but be thorough.
3. Provide feedback on EVERY part of their submitted abstract.
4. **LANGUAGE: Write in simple, clear English. Use short sentences. Avoid difficult words. This is for students and teachers who use English as a second language (ESL). Make it easy to understand but still professional for a school setting.**
5. **DO NOT use any emojis in your response.**

STUDENT DRAFT DATA:
### Problem Statement:
${problem}

### Proposed Solution:
${solution}

### Key Concepts (STEAM Integration):
${conceptsString}

Format your response in simple Markdown. Use the following sections:
### Problem Statement Feedback
Evaluate their problem statement. Is it clear? Is it a real-world problem? Give them specific questions to deepen their problem definition.

### Proposed Solution Feedback
Evaluate their solution. Does it actually solve the problem? Is it feasible? Suggest areas where they can improve their prototype idea.

### STEAM Integration & Key Concept Review
Review the key concepts the student listed above. For each concept, write about how well it connects to their problem and solution.
- If any listed concept feels **unrelated or forced**, say so gently and explain why it may not fit.
- If there is an important STEAM field **missing** that would strengthen the project, suggest it with a brief reason.
- Highlight how well they integrated different subjects.

### Overall Next Steps
Provide 1-2 clear, actionable next steps for them to take before submitting their final abstract.
        `;

        let responseText: string;
        try {
            const generated = await generateWithFallback({
                apiKey,
                prompt,
                label: 'Precheck',
                budgetMs: GENERATION_BUDGET_MS,
            });
            responseText = generated.text;
        } catch (generationError) {
            // A failed check must not cost the group one of their five.
            await refundQuota();

            if (generationError instanceof GeminiGenerationError) {
                const { failure } = generationError;
                return NextResponse.json(
                    { error: failure.message, reason: failure.kind, usageCount: usedSoFar },
                    { status: failure.status }
                );
            }
            throw generationError;
        }

        return NextResponse.json({ result: responseText, usageCount: usedSoFar + 1 });

    } catch (error: any) {
        console.error('Error generating pre-check:', error);
        return NextResponse.json(
            { error: 'Failed to generate pre-check review. Please try again later.' },
            { status: 500 }
        );
    }
}
