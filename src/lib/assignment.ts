import { subjectGroup } from '@/lib/subjects';

// ─────────────────────────────────────────────────────────────
// Sharing projects out between guide teachers.
//
// The AI scores how relevant each STEAM subject is to a project. That alone
// does not produce a workable roster: left to itself it hands every physics
// project to the one physics teacher and leaves the rest idle. This turns
// those scores into an assignment where every teacher carries within one
// project of every other, and, inside that constraint, teachers get the
// projects they actually match.
//
// Six science projects and three science teachers gives two each — the cap is
// ceil(6/3) = 2, so no teacher can take a third.
//
// Pure and synchronous, so it can be reasoned about and tested on its own.
// ─────────────────────────────────────────────────────────────

export interface TeacherCandidate {
    email: string;
    name: string;
    /** Subject ids this teacher can guide, from SUBJECT_DEFS. */
    subjects: string[];
    /** Grades they teach, as bare numerals: ['7', '8']. */
    grades: string[];
}

export interface SubjectScore {
    subjectId: string;
    /** 0–100, from the AI. */
    relevance: number;
}

export interface ProjectNeed {
    projectId: string;
    /** The grade this project's group is in, as a bare numeral. */
    grade: string;
    /** Subject relevance for this project, best first. */
    subjects: SubjectScore[];
}

/** How a teacher came to be matched, in decreasing order of confidence. */
export type MatchBasis = 'expertise' | 'discipline' | 'balance';

export interface Assignment {
    projectId: string;
    teacherEmail: string;
    teacherName: string;
    /** The subject that earned the match, null when it was load only. */
    subjectId: string | null;
    /** Score this pairing achieved, 0 when assigned purely to even out load. */
    relevance: number;
    basis: MatchBasis;
}

export interface BalancedResult {
    assignments: Assignment[];
    /** Teacher email to number of projects, including teachers who got none. */
    load: Record<string, number>;
    /** Projects that could not be placed — only when there are no teachers. */
    unassigned: string[];
}

export interface GradeAwareResult extends BalancedResult {
    /**
     * Grades that had projects but nobody who teaches them. Their projects are
     * in `unassigned` rather than handed to a teacher from another grade.
     */
    gradesWithoutTeacher: string[];
}

/**
 * A teacher whose subject is not on the project, but who works in the same
 * STEAM letter, still has something useful to offer. Half credit keeps them
 * behind every exact match without ruling them out.
 */
const DISCIPLINE_CREDIT = 0.5;

interface Pairing {
    projectId: string;
    teacherEmail: string;
    score: number;
    subjectId: string | null;
    basis: MatchBasis;
}

/** Best score this teacher can claim on this project, and why. */
function scorePair(need: ProjectNeed, teacher: TeacherCandidate): Pairing {
    let best: Pairing = {
        projectId: need.projectId,
        teacherEmail: teacher.email,
        score: 0,
        subjectId: null,
        basis: 'balance',
    };

    for (const want of need.subjects) {
        for (const has of teacher.subjects) {
            let score = 0;
            let basis: MatchBasis = 'balance';

            if (has === want.subjectId) {
                score = want.relevance;
                basis = 'expertise';
            } else {
                const a = subjectGroup(has);
                const b = subjectGroup(want.subjectId);
                if (a && b && a === b) {
                    score = want.relevance * DISCIPLINE_CREDIT;
                    basis = 'discipline';
                }
            }

            if (score > best.score) {
                best = {
                    projectId: need.projectId,
                    teacherEmail: teacher.email,
                    score,
                    subjectId: want.subjectId,
                    basis,
                };
            }
        }
    }

    return best;
}

/**
 * Assign every project to exactly one teacher.
 *
 * Loads end up within one project of each other. Within that, the highest
 * scoring pairings are taken first, so the fit is as good as an even split
 * allows. Ties break on project id then teacher email, so the same input
 * always produces the same roster — a teacher re-running this should not see
 * their list reshuffle.
 */
export function balancedAssign(
    needs: ProjectNeed[],
    teachers: TeacherCandidate[],
): BalancedResult {
    if (teachers.length === 0) {
        return {
            assignments: [],
            load: {},
            unassigned: needs.map(n => n.projectId),
        };
    }

    const nameOf = new Map(teachers.map(t => [t.email, t.name]));
    const load: Record<string, number> = {};
    for (const t of teachers) load[t.email] = 0;

    const capacity = Math.ceil(needs.length / teachers.length);

    // Every pairing, best first. Deterministic ties keep reruns stable.
    const pairings: Pairing[] = [];
    for (const need of needs) {
        for (const teacher of teachers) pairings.push(scorePair(need, teacher));
    }
    pairings.sort((a, b) =>
        b.score - a.score ||
        a.projectId.localeCompare(b.projectId) ||
        a.teacherEmail.localeCompare(b.teacherEmail));

    const chosen = new Map<string, Pairing>();

    // Pass 1 — take the strongest pairings that keep everyone under the cap.
    for (const p of pairings) {
        if (chosen.has(p.projectId)) continue;
        if (load[p.teacherEmail] >= capacity) continue;
        chosen.set(p.projectId, p);
        load[p.teacherEmail]++;
    }

    // Pass 2 — anything still unplaced goes to whoever is carrying least. Only
    // reachable when the cap filled up around a project with no match at all.
    for (const need of [...needs].sort((a, b) => a.projectId.localeCompare(b.projectId))) {
        if (chosen.has(need.projectId)) continue;
        const target = [...teachers].sort((a, b) =>
            load[a.email] - load[b.email] || a.email.localeCompare(b.email))[0];
        chosen.set(need.projectId, {
            projectId: need.projectId,
            teacherEmail: target.email,
            score: 0,
            subjectId: null,
            basis: 'balance',
        });
        load[target.email]++;
    }

    // Pass 3 — level the ends. The cap bounds the busiest teacher but nothing
    // yet stops another sitting well below it, so move the assignment that
    // costs the least relevance until no two differ by more than one.
    const byPair = new Map(pairings.map(p => [`${p.projectId}|${p.teacherEmail}`, p]));
    const lookup = (projectId: string, email: string) =>
        byPair.get(`${projectId}|${email}`);

    for (let guard = 0; guard < needs.length * teachers.length + 1; guard++) {
        const sorted = [...teachers].sort((a, b) =>
            load[a.email] - load[b.email] || a.email.localeCompare(b.email));
        const lightest = sorted[0];
        const heaviest = sorted[sorted.length - 1];
        if (load[heaviest.email] - load[lightest.email] <= 1) break;

        let move: { from: Pairing; to: Pairing } | null = null;
        for (const p of chosen.values()) {
            if (p.teacherEmail !== heaviest.email) continue;
            const alt = lookup(p.projectId, lightest.email);
            if (!alt) continue;
            if (!move || (p.score - alt.score) < (move.from.score - move.to.score)) {
                move = { from: p, to: alt };
            }
        }
        if (!move) break;

        chosen.set(move.to.projectId, move.to);
        load[heaviest.email]--;
        load[lightest.email]++;
    }

    const assignments: Assignment[] = [...chosen.values()]
        .sort((a, b) => a.projectId.localeCompare(b.projectId))
        .map(p => ({
            projectId: p.projectId,
            teacherEmail: p.teacherEmail,
            teacherName: nameOf.get(p.teacherEmail) ?? p.teacherEmail,
            subjectId: p.subjectId,
            relevance: Math.round(p.score),
            basis: p.basis,
        }));

    return { assignments, load, unassigned: [] };
}

/**
 * The single subject that best describes a project, for the mode that files
 * projects by subject and ignores who teaches what.
 */
export function bestSubject(need: ProjectNeed): SubjectScore | null {
    if (need.subjects.length === 0) return null;
    return [...need.subjects].sort((a, b) =>
        b.relevance - a.relevance || a.subjectId.localeCompare(b.subjectId))[0];
}

/**
 * Assign every project to a teacher who teaches that project's grade.
 *
 * The school runs grades 7 to 12 and a teacher declares which of them they
 * teach, so a grade 7 project belonging to a grade 12 teacher is simply wrong —
 * however good the subject match. balancedAssign on its own cannot express that:
 * its load-levelling passes will hand a project to whoever is carrying least,
 * and a subject filter inside scorePair would not stop them, because those
 * passes assign on load alone with no score at all.
 *
 * So the projects are partitioned by grade and each grade is assigned among
 * only the teachers who teach it. That makes the grade a hard constraint rather
 * than a preference, and it is also the right unit for balancing: a grade 7
 * teacher's load is worth comparing against other grade 7 teachers, not against
 * the grade 12 team.
 *
 * A grade with no eligible teacher yields no assignments. Its projects come
 * back in `unassigned` and the grade in `gradesWithoutTeacher`, so the caller
 * can say which grade needs a teacher instead of quietly misfiling the work.
 *
 * Note on teachers who cover several grades: each grade is balanced on its own,
 * so someone teaching 7 and 8 takes a share of both and their total is higher
 * than a single-grade colleague's. That reflects being available for more, and
 * `load` reports the total.
 */
export function assignByGrade(
    needs: ProjectNeed[],
    teachers: TeacherCandidate[],
): GradeAwareResult {
    const byGrade = new Map<string, ProjectNeed[]>();
    for (const need of needs) {
        const list = byGrade.get(need.grade);
        if (list) list.push(need);
        else byGrade.set(need.grade, [need]);
    }

    const assignments: Assignment[] = [];
    const load: Record<string, number> = {};
    for (const t of teachers) load[t.email] = 0;
    const unassigned: string[] = [];
    const gradesWithoutTeacher: string[] = [];

    // Numeric where the grade is a numeral, so 7 comes before 10 rather than
    // after it, and the order stays stable across runs either way.
    const grades = [...byGrade.keys()].sort(
        (a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b),
    );

    for (const grade of grades) {
        const gradeNeeds = byGrade.get(grade)!;
        const eligible = teachers.filter(t => t.grades.includes(grade));

        if (eligible.length === 0) {
            gradesWithoutTeacher.push(grade);
            unassigned.push(...gradeNeeds.map(n => n.projectId).sort());
            continue;
        }

        const result = balancedAssign(gradeNeeds, eligible);
        assignments.push(...result.assignments);
        for (const [email, count] of Object.entries(result.load)) {
            load[email] = (load[email] ?? 0) + count;
        }
        unassigned.push(...result.unassigned);
    }

    return {
        assignments: assignments.sort((a, b) => a.projectId.localeCompare(b.projectId)),
        load,
        unassigned,
        gradesWithoutTeacher,
    };
}
