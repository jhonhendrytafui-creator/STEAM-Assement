import { NextResponse } from 'next/server';
import { SchemaType, type Schema } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { requireTeacher } from '@/lib/api-auth';
import { ACADEMIC_YEAR } from '@/lib/constants';
import { GeminiGenerationError, generateWithFallback } from '@/lib/gemini';
import { parseAbstract, subjectLabel as abstractSubjectLabel } from '@/lib/abstract';
import { SUBJECT_DEFS, isKnownSubject, subjectLabel } from '@/lib/subjects';
import {
    balancedAssign, bestSubject,
    type ProjectNeed, type TeacherCandidate,
} from '@/lib/assignment';

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
// Classify a whole year group in one pass.
//
// Both modes ask the AI the same question — which STEAM subjects does this
// project actually draw on — because that is the only judgement a language
// model is good at here. What differs is what happens next:
//
//   mode 'subject'  file the project under its strongest subject and stop.
//   mode 'teacher'  hand it to a person, keeping every teacher's load within
//                   one project of every other. That part is arithmetic, not
//                   judgement, so src/lib/assignment.ts does it deterministically
//                   rather than asking the model to be fair.
//
// Doing it per project, the way /api/ai-classify-project does, cannot balance
// anything: fairness is a property of the whole set.
// ─────────────────────────────────────────────────────────────

/** Projects per Gemini call. Small enough to stay well inside a response. */
const CHUNK_SIZE = 8;

/** Wall clock for the whole request, under maxDuration so we always reply. */
const BUDGET_MS = 45_000;

interface ScoredProject {
    id: string;
    title: string;
    class_name: string;
    group_number: number;
    need: ProjectNeed;
    reason: string;
}

const SUBJECT_ID_LIST = SUBJECT_DEFS.map(s => `${s.id} (${s.label}, ${s.group})`).join('\n');

const responseSchema: Schema = {
    type: SchemaType.OBJECT,
    properties: {
        results: {
            type: SchemaType.ARRAY,
            description: 'One entry per project, in the order given.',
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    project_id: { type: SchemaType.STRING },
                    subjects: {
                        type: SchemaType.ARRAY,
                        description: 'Up to 3 subjects, strongest first.',
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                subject_id: { type: SchemaType.STRING, description: 'Exactly one id from the list' },
                                relevance: { type: SchemaType.INTEGER, description: '0-100' },
                                reason: { type: SchemaType.STRING, description: 'One sentence, referring to this project' },
                            },
                            required: ['subject_id', 'relevance', 'reason'],
                        },
                    },
                },
                required: ['project_id', 'subjects'],
            },
        },
    },
    required: ['results'],
};

function buildPrompt(rows: Array<{ id: string; title: string; abstract: string | null }>): string {
    const projects = rows.map(row => {
        const parsed = parseAbstract(row.abstract);
        const concepts = parsed.keyConcepts.length
            ? parsed.keyConcepts
                .map(c => `    - ${abstractSubjectLabel(c.subject)}: ${c.concept}`)
                .join('\n')
            : '    (none listed)';

        return [
            `PROJECT ID: ${row.id}`,
            `  Title: ${row.title}`,
            `  Problem: ${parsed.problem || '(not provided)'}`,
            `  Solution: ${parsed.solution || '(not provided)'}`,
            `  Key concepts the students chose:`,
            concepts,
        ].join('\n');
    }).join('\n\n');

    return `You are a STEAM Education Coordinator sorting student projects by the subject knowledge each one needs from a guide teacher.

SUBJECT IDS — use these exact strings, nothing else:
${SUBJECT_ID_LIST}

PROJECTS:
${projects}

For every project above, return up to 3 subject ids ranked by how much the project genuinely depends on that subject, with a relevance score from 0 to 100 and one sentence of reasoning that refers to this project's actual content.

RULES:
- subject_id must be copied exactly from the list. Never invent one.
- Judge what the project needs to be built and guided, not what sounds impressive.
- The students' own key concepts are a strong signal, but correct them when the problem and solution clearly point elsewhere.
- Give the strongest subject a high score only when it really is central. A project that touches a subject lightly should score it low.
- Return one entry per project id, using the id exactly as given.
- Write in simple, clear English. No emojis.`;
}

export async function POST(req: Request) {
    const startedAt = Date.now();

    try {
        const auth = await requireTeacher(req);
        if ('response' in auth) return auth.response;

        const { mode, grade } = await req.json();
        if (mode !== 'teacher' && mode !== 'subject') {
            return NextResponse.json(
                { error: "mode must be 'teacher' or 'subject'." },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY is missing — cannot classify.');
            return NextResponse.json(
                { error: 'AI classification is not set up yet. Please tell your administrator.' },
                { status: 503 }
            );
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('SUPABASE_SERVICE_ROLE_KEY is missing — cannot read the teacher directory.');
            return NextResponse.json(
                { error: 'Classification is temporarily unavailable. Please tell your administrator.' },
                { status: 503 }
            );
        }
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

        // ── The projects to sort ──────────────────────────────────────────
        let query = admin
            .from('projects')
            .select('id, title, abstract, class_name, group_number')
            .eq('academic_year', ACADEMIC_YEAR)
            .eq('status', 'approved');
        if (grade && grade !== 'All') query = query.ilike('class_name', `${grade}.%`);

        const { data: projects, error: projectError } = await query.order('id');

        if (projectError) {
            console.error('[Classify] project read failed:', projectError.message);
            return NextResponse.json({ error: 'Could not read the project list.' }, { status: 500 });
        }
        if (!projects || projects.length === 0) {
            return NextResponse.json(
                { error: 'There are no approved projects to classify yet.' },
                { status: 400 }
            );
        }

        // ── The teacher directory, only needed to assign to people ────────
        // teacher_emails is the admin-managed list, so a teacher who has never
        // signed in still counts.
        let teachers: TeacherCandidate[] = [];
        if (mode === 'teacher') {
            const { data: roster, error: rosterError } = await admin
                .from('teacher_emails')
                .select('email, full_name, expertise_subjects');

            if (rosterError) {
                console.error('[Classify] teacher read failed:', rosterError.message);
                return NextResponse.json({ error: 'Could not read the teacher list.' }, { status: 500 });
            }

            teachers = (roster ?? [])
                .map(t => ({
                    email: t.email as string,
                    name: (t.full_name as string) || (t.email as string).split('@')[0],
                    subjects: ((t.expertise_subjects as string[]) ?? []).filter(isKnownSubject),
                }))
                .filter(t => t.subjects.length > 0);

            if (teachers.length === 0) {
                return NextResponse.json({
                    error:
                        'No teacher has subjects set yet. Open Admin → Teacher Access and choose each ' +
                        'teacher’s STEAM subjects, then run this again.',
                    reason: 'no_teacher_expertise',
                }, { status: 400 });
            }
        }

        // ── Score every project against the subject list ──────────────────
        const scored: ScoredProject[] = [];
        const skipped: string[] = [];
        let chunksDone = 0;

        for (let i = 0; i < projects.length; i += CHUNK_SIZE) {
            if (Date.now() - startedAt > BUDGET_MS) break;

            const chunk = projects.slice(i, i + CHUNK_SIZE);
            let payload: { results?: Array<{ project_id?: string; subjects?: Array<{ subject_id?: string; relevance?: number; reason?: string }> }> };

            try {
                const { text } = await generateWithFallback({
                    apiKey,
                    prompt: buildPrompt(chunk),
                    label: 'Classify',
                    modelParams: {
                        generationConfig: {
                            temperature: 0.2,
                            responseMimeType: 'application/json',
                            responseSchema,
                        },
                    },
                    perAttemptTimeoutMs: 20_000,
                    budgetMs: Math.max(5_000, BUDGET_MS - (Date.now() - startedAt)),
                });
                payload = JSON.parse(text);
            } catch (e) {
                if (e instanceof GeminiGenerationError && chunksDone === 0) {
                    // Nothing succeeded at all — report the real reason rather
                    // than a half-finished run.
                    return NextResponse.json(
                        { error: e.failure.message, reason: e.failure.kind },
                        { status: e.failure.status }
                    );
                }
                console.error('[Classify] chunk failed, continuing:', (e as Error)?.message?.slice(0, 160));
                chunk.forEach(p => skipped.push(p.id));
                continue;
            }

            chunksDone++;
            const byId = new Map((payload.results ?? []).map(r => [r.project_id, r]));

            for (const project of chunk) {
                const result = byId.get(project.id);
                // Drop anything the model invented; only real ids may be stored.
                const subjects = (result?.subjects ?? [])
                    .filter(s => s.subject_id && isKnownSubject(s.subject_id))
                    .map(s => ({
                        subjectId: s.subject_id as string,
                        relevance: Math.max(0, Math.min(100, Math.round(Number(s.relevance) || 0))),
                    }));

                if (subjects.length === 0) {
                    skipped.push(project.id);
                    continue;
                }

                scored.push({
                    id: project.id,
                    title: project.title,
                    class_name: project.class_name,
                    group_number: project.group_number,
                    need: { projectId: project.id, subjects },
                    reason: result?.subjects?.[0]?.reason ?? '',
                });
            }
        }

        if (scored.length === 0) {
            return NextResponse.json(
                { error: 'The AI could not classify any project. Please try again.' },
                { status: 502 }
            );
        }

        // ── Turn scores into decisions ────────────────────────────────────
        const now = new Date().toISOString();
        let rows: Array<Record<string, unknown>>;
        let summary: Record<string, unknown>;

        if (mode === 'subject') {
            rows = scored.map(p => {
                const best = bestSubject(p.need)!;
                return {
                    project_id: p.id,
                    mode: 'subject',
                    teacher_email: null,
                    teacher_name: null,
                    subject_id: best.subjectId,
                    relevance: best.relevance,
                    basis: 'expertise',
                    reason: p.reason,
                    assigned_by: auth.user.email,
                    assigned_at: now,
                };
            });

            const perSubject: Record<string, number> = {};
            for (const r of rows) {
                const id = r.subject_id as string;
                perSubject[subjectLabel(id)] = (perSubject[subjectLabel(id)] ?? 0) + 1;
            }
            summary = { perSubject };
        } else {
            const result = balancedAssign(scored.map(p => p.need), teachers);
            const reasonOf = new Map(scored.map(p => [p.id, p.reason]));

            rows = result.assignments.map(a => ({
                project_id: a.projectId,
                mode: 'teacher',
                teacher_email: a.teacherEmail,
                teacher_name: a.teacherName,
                subject_id: a.subjectId,
                relevance: a.relevance,
                basis: a.basis,
                reason: reasonOf.get(a.projectId) ?? '',
                assigned_by: auth.user.email,
                assigned_at: now,
            }));

            const perTeacher: Record<string, number> = {};
            for (const t of teachers) perTeacher[t.name] = result.load[t.email] ?? 0;
            const counts = Object.values(result.load);
            summary = {
                perTeacher,
                spread: counts.length ? Math.max(...counts) - Math.min(...counts) : 0,
            };
        }

        const { error: writeError } = await admin
            .from('project_assignments')
            .upsert(rows, { onConflict: 'project_id' });

        if (writeError) {
            console.error('[Classify] write failed:', writeError.message);
            return NextResponse.json(
                { error: 'The classification finished but could not be saved. Please try again.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            mode,
            assigned: rows.length,
            total: projects.length,
            skipped: skipped.length,
            summary,
            // True when the time budget cut the run short; the caller can run
            // again to pick up the rest.
            partial: scored.length + skipped.length < projects.length,
        });

    } catch (error) {
        console.error('[Classify] unexpected failure:', error);
        return NextResponse.json(
            { error: 'Classification could not be completed. Please try again.' },
            { status: 500 }
        );
    }
}
