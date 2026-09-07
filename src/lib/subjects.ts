// ─────────────────────────────────────────────────────────────
// The STEAM subject vocabulary — one source of truth.
//
// This list was copy-pasted into three places: src/lib/constants.ts (with
// lucide icons attached), src/app/api/precheck/route.ts (id -> label only) and
// the classifier prompt. Students pick from one copy and the AI matched
// against another, so any edit had to be made three times or the ids drifted
// apart silently.
//
// Kept free of React and lucide imports on purpose: the assignment algorithm
// and the API routes need the data, not the icons. constants.ts attaches those.
// ─────────────────────────────────────────────────────────────

export type SteamGroup =
    | 'Science (S)'
    | 'Technology (T)'
    | 'Engineering (E)'
    | 'Arts (A)'
    | 'Mathematics (M)';

export interface SubjectDef {
    id: string;
    label: string;
    group: SteamGroup;
}

export const SUBJECT_DEFS: SubjectDef[] = [
    { id: 'biology_marine', label: 'Biology & Marine Biology', group: 'Science (S)' },
    { id: 'chemistry', label: 'Chemistry', group: 'Science (S)' },
    { id: 'physics', label: 'Physics', group: 'Science (S)' },
    { id: 'environmental_science', label: 'Environmental Science', group: 'Science (S)' },
    { id: 'astronomy', label: 'Astronomy', group: 'Science (S)' },
    { id: 'geology_meteorology', label: 'Geology & Meteorology', group: 'Science (S)' },
    { id: 'psychology', label: 'Psychology', group: 'Science (S)' },

    { id: 'cs_programming', label: 'Computer Science & Programming', group: 'Technology (T)' },
    { id: 'it', label: 'Information Technology (IT)', group: 'Technology (T)' },
    { id: 'cybersecurity_data', label: 'Cybersecurity & Data Science', group: 'Technology (T)' },
    { id: 'ai_ml', label: 'Artificial Intelligence & Machine Learning', group: 'Technology (T)' },
    { id: 'robotics', label: 'Robotics', group: 'Technology (T)' },
    { id: 'web_development', label: 'Web Development', group: 'Technology (T)' },

    { id: 'civil_structural', label: 'Civil & Structural Engineering', group: 'Engineering (E)' },
    { id: 'mechanical', label: 'Mechanical Engineering', group: 'Engineering (E)' },
    { id: 'aerospace', label: 'Aerospace Engineering', group: 'Engineering (E)' },
    { id: 'electrical_electronic', label: 'Electrical & Electronic Engineering', group: 'Engineering (E)' },
    { id: 'chemical', label: 'Chemical Engineering', group: 'Engineering (E)' },
    { id: 'biomedical', label: 'Biomedical Engineering', group: 'Engineering (E)' },

    { id: 'visual_design', label: 'Visual Arts & Design', group: 'Arts (A)' },
    { id: 'graphic_digital', label: 'Graphic Design & Digital Media', group: 'Arts (A)' },
    { id: 'industrial_product', label: 'Industrial/Product Design', group: 'Arts (A)' },
    { id: 'architecture', label: 'Architecture', group: 'Arts (A)' },
    { id: 'creative_language', label: 'Creative Arts & Language Arts', group: 'Arts (A)' },
    { id: 'performing_arts', label: 'Performing Arts', group: 'Arts (A)' },

    { id: 'calculus_linear', label: 'Calculus & Linear Algebra', group: 'Mathematics (M)' },
    { id: 'statistics_probability', label: 'Statistics & Probability', group: 'Mathematics (M)' },
    { id: 'differential_equations', label: 'Differential Equations', group: 'Mathematics (M)' },
    { id: 'discrete_mathematics', label: 'Discrete Mathematics', group: 'Mathematics (M)' },
    { id: 'financial_mathematics', label: 'Financial Mathematics', group: 'Mathematics (M)' },
];

export const STEAM_GROUPS: SteamGroup[] = [
    'Science (S)', 'Technology (T)', 'Engineering (E)', 'Arts (A)', 'Mathematics (M)',
];

const BY_ID = new Map(SUBJECT_DEFS.map(s => [s.id, s]));

/** Readable name for a subject id, falling back to the id itself. */
export function subjectLabel(id: string): string {
    return BY_ID.get(id)?.label ?? id;
}

/** Which STEAM letter a subject belongs to, or null for an unknown id. */
export function subjectGroup(id: string): SteamGroup | null {
    return BY_ID.get(id)?.group ?? null;
}

export function isKnownSubject(id: string): boolean {
    return BY_ID.has(id);
}

/** Subjects bucketed by STEAM letter, for grouped pickers. */
export function subjectsByGroup(): Array<{ group: SteamGroup; subjects: SubjectDef[] }> {
    return STEAM_GROUPS.map(group => ({
        group,
        subjects: SUBJECT_DEFS.filter(s => s.group === group),
    }));
}
