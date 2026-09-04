import { SUBJECTS } from '@/lib/constants';

// ─────────────────────────────────────────────────────────────
// projects.abstract holds a JSON string rather than structured columns, so
// every screen that shows a project has to parse it defensively. This is the
// single place that happens.
//
// The shape is set by SubmitProjectTab on save. Anything older, hand-edited or
// truncated falls back to treating the whole value as free text so a bad row
// renders as plain prose instead of blanking the panel.
// ─────────────────────────────────────────────────────────────

export interface KeyConcept {
    subject: string;
    concept: string;
}

export interface ParsedAbstract {
    problem: string;
    solution: string;
    keyConcepts: KeyConcept[];
    /** True when the value was not valid JSON and is shown as plain text. */
    isPlainText: boolean;
    /** The original string, for plain-text fallback rendering. */
    raw: string;
}

const empty = (raw: string, isPlainText: boolean): ParsedAbstract => ({
    problem: isPlainText ? raw : '',
    solution: '',
    keyConcepts: [],
    isPlainText,
    raw,
});

export function parseAbstract(abstract: string | null | undefined): ParsedAbstract {
    if (!abstract) return empty('', false);

    let data: unknown;
    try {
        data = JSON.parse(abstract);
    } catch {
        return empty(abstract, true);
    }

    if (typeof data !== 'object' || data === null) {
        return empty(abstract, true);
    }

    const obj = data as Record<string, unknown>;
    const concepts = Array.isArray(obj.keyConcepts) ? obj.keyConcepts : [];

    return {
        problem: typeof obj.problem === 'string' ? obj.problem : '',
        solution: typeof obj.solution === 'string' ? obj.solution : '',
        keyConcepts: concepts
            .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
            .map(c => ({
                subject: typeof c.subject === 'string' ? c.subject : '',
                concept: typeof c.concept === 'string' ? c.concept : '',
            }))
            .filter(c => c.concept.trim() !== ''),
        isPlainText: false,
        raw: abstract,
    };
}

/** Human-readable subject name for a key concept, e.g. "Physics". */
export function subjectLabel(subjectId: string): string {
    return SUBJECTS.find(s => s.id === subjectId)?.label || subjectId;
}

/** Flatten an abstract to plain text — for AI prompts and plagiarism checks. */
export function abstractToText(abstract: string | null | undefined): string {
    const parsed = parseAbstract(abstract);
    if (parsed.isPlainText) return parsed.raw;

    const concepts = parsed.keyConcepts
        .map(c => `- ${subjectLabel(c.subject)}: ${c.concept}`)
        .join('\n');

    return [
        parsed.problem && `Problem:\n${parsed.problem}`,
        parsed.solution && `Solution:\n${parsed.solution}`,
        concepts && `Key Concepts:\n${concepts}`,
    ].filter(Boolean).join('\n\n');
}
