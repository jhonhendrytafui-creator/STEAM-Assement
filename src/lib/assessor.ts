// ─────────────────────────────────────────────────────────────
// Who gave a mark.
//
// Teachers work in a team and the rubric is saved per indicator, so the rows
// behind one category can carry more than one assessor — a second teacher
// revisiting a single indicator is a normal thing to happen, not a bug. Every
// screen that names the assessor therefore has to summarize a set, not read a
// field, and they should all summarize it the same way.
//
// assessed_by_name is NULL on marks given before it was recorded. Those read
// "Not Recorded" rather than being attributed to a guess.
// ─────────────────────────────────────────────────────────────

/** Shown wherever the assessor genuinely is not known. */
export const NOT_RECORDED = 'Not Recorded';

interface AssessedRow {
    assessed_by_name?: string | null;
    assessed_at?: string | null;
}

export interface AssessorSummary {
    /** Distinct assessor names, in first-seen order. Empty when none are known. */
    names: string[];
    /** Ready to render: one name, "A and B", "A, B and C", or "Not Recorded". */
    label: string;
    /** True when nothing is attributable — the label is NOT_RECORDED. */
    unknown: boolean;
    /** True when some rows name an assessor and others do not. */
    partial: boolean;
    /** Most recent assessed_at across the rows, or null. */
    lastAssessedAt: string | null;
}

/** Join names the way a sentence would: "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Summarize the assessors behind a set of score rows — typically every row of
 * one rubric category for one group.
 */
export function summarizeAssessors(rows: AssessedRow[]): AssessorSummary {
    const names: string[] = [];
    let missing = 0;
    let lastAssessedAt: string | null = null;

    for (const row of rows) {
        const name = row.assessed_by_name?.trim();
        if (name) {
            if (!names.includes(name)) names.push(name);
        } else {
            missing += 1;
        }

        const at = row.assessed_at;
        if (at && (!lastAssessedAt || at > lastAssessedAt)) lastAssessedAt = at;
    }

    return {
        names,
        label: names.length > 0 ? joinNames(names) : NOT_RECORDED,
        unknown: names.length === 0,
        partial: names.length > 0 && missing > 0,
        lastAssessedAt,
    };
}
