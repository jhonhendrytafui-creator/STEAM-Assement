import type { SupabaseClient } from '@supabase/supabase-js';
import { gradeOf } from '@/lib/grade';

// ─────────────────────────────────────────────────────────────
// What every AI feature is told about the school and its students.
//
// The rubrics ask the AI to judge whether a problem is "connected to students'
// real-life context" and whether the concepts "align with students' level of
// ability and grade", yet no prompt said who the students are, where they live,
// which grade the group is in or which theme it chose — the AI was guessing all
// of it. It also read "real-world" as "big and important anywhere", so a Grade 7
// group in Tangerang writing about water pollution in Papua could score well.
//
// The school's rule is the one written out in CONTEXTUAL_PROBLEM below:
// contextual means relevant to the students' own lives, judged from the
// background story they tell — not how near the place is. One copy here, used
// by the pre-check, every rubric assessment and the C5 question generator, so
// the students' screening and the teacher's assessment judge it the same way.
// ─────────────────────────────────────────────────────────────

/** Which AI feature is asking, so the knowledge can add a note for that step. */
export type KnowledgePhase = 'precheck' | 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'c5-questions' | 'other';

export interface StudentProfile {
    /** Roster class, e.g. '7.1'. The grade is derived from it. */
    className?: string | null;
    /** The name of the theme the group chose, from the themes table. */
    themeName?: string | null;
}

const SCHOOL = `### KNOWLEDGE: THE SCHOOL AND ITS STUDENTS
- School: Sekolah Terpadu Pahoa, a national-plus, trilingual school in Summarecon Serpong (Gading Serpong), Tangerang, Banten, Indonesia. It runs SMP (grades 7 to 9) and SMA (grades 10 to 12).
- Where the students live: most live in the Tangerang area (Gading Serpong, Summarecon Serpong, BSD, Kelapa Dua, Karawaci and the rest of Tangerang). Treat this area as their daily life unless their background story says otherwise.
- Their daily life: their home and family; the school (classrooms, labs, canteen, library, sports, events, and the trip to and from school); their housing area and neighborhood; places they go often (shops, malls, markets, places of worship, courses, sports clubs); and the people they meet there (family, household helpers, drivers, classmates, teachers, school staff, canteen sellers, neighbors).`;

const CONTEXTUAL_PROBLEM = `### KNOWLEDGE: WHAT A "CONTEXTUAL PROBLEM" MEANS IN THIS PROGRAM
Finding a contextual problem in their own daily life is one of the main goals of this STEAM program.
- Contextual is about relevance to the students' own lives, not about distance. Judge it from the background story the students tell: how they came to know the problem, who it affects, what they saw or experienced themselves, and where and how often it happens.
- Real is not the same as contextual. A problem can be real and important and still not be part of these students' lives. Example: a Grade 7 group in Tangerang writes about water pollution in Papua, which they only know from the news. It is real, but it is not contextual: they cannot see it, talk to the people affected, collect their own data or test a prototype there.
- Place alone does not decide it. A far-away problem is contextual when the story shows a real link, for example the family lives there and the students experience the problem on regular visits. A nearby problem is not contextual when the story is taken from a news article and the students never meet the problem themselves.
- Judge the background story with what you know about these students (their grade and age, the Tangerang area they live in, their school):
  1. Whose problem is it: theirs, or that of people they really know and meet?
  2. How do they know it: first-hand experience or observation, or only the news and the internet?
  3. Is the story specific: where, when, who, how often, and what they saw?
  4. Can they observe it, collect their own evidence (photos, counts, measurements, a survey of schoolmates or family, interviews) and try their solution with the people affected?
  5. Is the story believable for a student of this grade living in this area?
- A big issue (climate change, plastic in the ocean, disease) becomes contextual when the students show where it touches their own life, such as heat in their own classroom, plastic from their own canteen or dengue cases in their own neighborhood. Help them find that link instead of rejecting the topic.
- Some themes sound far from daily life (space, oceans, artificial intelligence). Students can still find a contextual problem inside them through their own experience. Help them find it.`;

const GRADE_LEVEL = `### KNOWLEDGE: WHAT TO EXPECT AT EACH GRADE
Use the group's grade to judge whether the concepts and the prototype fit their ability, and to pitch your feedback at their level.
- Grades 7 to 9 (SMP, Phase D of Kurikulum Merdeka, about 12 to 15 years old): they work best with concrete problems they can see. Expect science and mathematics at junior-high level, for example forces and simple machines, simple electric circuits, heat, mixtures and solutions, acids and bases with indicators, living things and ecosystems, ratios and percentages, averages and simple charts. Prototypes should use materials that are easy to get and simple tools; a small microcontroller project is ambitious but possible. Evidence comes from simple tests, counts and small surveys.
- Grades 10 to 12 (SMA, Phases E and F, about 15 to 18 years old): expect deeper analysis and more careful methods, such as repeated trials, controlled variables, measurements with units, larger surveys and interviews with experts. Senior-high concepts fit, for example sensors and microcontrollers with code, chemical reactions and concentrations, energy and power calculations, and statistics. Prototypes can be more complex but must still be buildable with school resources, budget and time.
- A project that is too easy for the grade (a demonstration rather than a design) or far too hard (it needs a lab, money or skills they do not have) fits their ability poorly.`;

const CONTEXT_SCORING = `### HOW TO SCORE CONTEXTUALITY (school rule)
Apply this to any indicator about the problem's link to the students' real life, such as "connected to students' real-life context" or "Contextuality & Relevance". In that indicator's rubric, words like "real-world", "significant" or "socially relevant" mean relevant to these students' lives as shown by their background story, not big or important somewhere else.
- 4: the story shows, with specific first-hand detail, that the problem is part of the students' daily life, and they can observe it and reach the people affected.
- 3: the problem is clearly part of their life, but the story lacks specifics (where, when, who) or evidence.
- 2: the problem is real, but the link to their life is weak, generic ("many people ...") or only claimed.
- 1: there is no link to their life: the problem is far away or abstract, known only from the news or the internet, or there is no background story at all.
If you score that indicator 1 or 2, the problem is not contextual yet. Then suggested_status must NOT be 'approved' ('revision' at most), however strong the other indicators are, and your feedback must explain why and help the students find the contextual version of their problem.`;

const CONTEXT_FEEDBACK = `### HOW TO GIVE FEEDBACK ABOUT CONTEXT
- If the problem is not contextual, say so kindly and clearly, and explain that a real problem is not enough: it has to be part of their own life.
- Then help them find their own version of it: ask 2 or 3 guiding questions about their life (Where do you see this at home, at school or in your neighborhood? Who do you know who has this problem? What could you observe, count or measure yourselves?) and point to 1 or 2 directions within the same theme.
- If the problem is contextual, name the part of their story that makes it so, and push for stronger evidence from their own surroundings.`;

const PHASE_NOTES: Record<KnowledgePhase, string> = {
    precheck:
        'This is the students\' own pre-check before they submit. Begin the problem feedback with the contextuality check. Ask questions and point to directions, but never write their problem or background story for them.',
    C1:
        'In the PROBLEM STATEMENT section, say plainly whether the problem is contextual and why, quoting their background story.',
    C2:
        'The problem description should rest on evidence from the students\' own context (their observations, measurements, surveys and interviews) as well as credible sources. National or global statistics alone, with no evidence from their own surroundings, are weaker. Constraints should come from the real users and setting in their story.',
    C3:
        'Success criteria, constraints and the test plan should fit the real place and people from the students\' problem story, and plan to test with them where possible.',
    C4:
        'Value tests done in the real setting or with the real users from the students\' problem story, but do not require it for every entry.',
    C5:
        'A strong presentation opens with the problem in the students\' own life. In the Q&A, check that the problem is really theirs: who is affected, what they saw, and how they know.',
    'c5-questions':
        'Include questions that test whether the problem is really part of the students\' lives: where exactly they saw it, who they talked to, and what they observed or measured themselves.',
    other: '',
};

/** Typical age range for a grade in an Indonesian school, e.g. '12 to 13'. */
function ageRange(grade: string): string | null {
    const n = Number(grade);
    if (!Number.isInteger(n) || n < 7 || n > 12) return null;
    return `${n + 5} to ${n + 6}`;
}

/** The lines that describe this particular group. Unknowns are said, never guessed. */
function groupLines(profile: StudentProfile): string {
    const grade = profile.className ? gradeOf(profile.className) : '';
    const age = ageRange(grade);
    const stage = Number(grade) >= 10 ? 'SMA' : 'SMP';
    const gradeLine = age
        ? `- This group: Grade ${grade} (${stage}, usually ${age} years old), class ${profile.className!.trim()}.`
        : '- This group: grade not available. Do not guess it; judge from the project itself.';
    const themeLine = profile.themeName?.trim()
        ? `- The theme this group chose: "${profile.themeName.trim()}".`
        : '- The theme this group chose: not available. Do not guess it.';
    return `${gradeLine}\n${themeLine}`;
}

/**
 * The knowledge block for a prompt.
 *
 * `scoreContext` adds the contextuality scoring levels and the no-approval
 * rule. Pass it when the rubric being scored has a context indicator, which
 * contextIndicatorIds() finds.
 */
export function schoolKnowledge(
    profile: StudentProfile,
    phase: KnowledgePhase,
    options: { scoreContext?: boolean } = {},
): string {
    const note = PHASE_NOTES[phase];
    return [
        `${SCHOOL}\n${groupLines(profile)}`,
        CONTEXTUAL_PROBLEM,
        GRADE_LEVEL,
        options.scoreContext ? CONTEXT_SCORING : '',
        CONTEXT_FEEDBACK,
        note ? `### FOR THIS STEP\n${note}` : '',
    ].filter(Boolean).join('\n\n');
}

/**
 * The rubric indicator(s) that score whether the problem is contextual.
 *
 * Matches both wordings the C1 rubric has had: "connected to students'
 * real-life context" (seed_c1_rubric.sql) and "Contextuality & Relevance"
 * (full_schema.sql). No other indicator in any rubric uses either phrase.
 */
const CONTEXT_INDICATOR = /contextual|real[\s-]?life context/i;

export function contextIndicatorIds(indicators: ReadonlyArray<{ id: string; description?: string | null }>): string[] {
    return indicators.filter(i => CONTEXT_INDICATOR.test(i.description ?? '')).map(i => i.id);
}

/**
 * Enforce the school rule on an AI assessment: a problem that is not
 * contextual (its context indicator scored 1 or 2) cannot be approved.
 *
 * The prompt states the rule too; this catches the answer that ignores it.
 * When it steps in, the status becomes 'revision' and the comment says why,
 * so the teacher and the students can see the reason rather than a status
 * that contradicts the scores.
 */
export function applyContextRule<T extends Record<string, unknown>>(assessment: T, contextIds: readonly string[]): T {
    if (assessment.suggested_status !== 'approved' || contextIds.length === 0) return assessment;

    const scores = (assessment.scores ?? {}) as Record<string, unknown>;
    const notContextual = contextIds.some(id => {
        const score = Number(scores[id]);
        return Number.isFinite(score) && score <= 2;
    });
    if (!notContextual) return assessment;

    const note = 'Status set to revision: the problem is not yet shown to be part of the students\' own lives, '
        + 'and by the school\'s rule a project cannot be approved until its problem is contextual.';
    const comment = typeof assessment.teacher_comment === 'string' && assessment.teacher_comment.trim()
        ? `${assessment.teacher_comment.trim()}\n\n${note}`
        : note;
    return { ...assessment, suggested_status: 'revision', teacher_comment: comment };
}

/** A theme's name, or null when it is unset or cannot be read. Never throws. */
export async function themeNameFor(client: SupabaseClient, themeId: unknown): Promise<string | null> {
    if (typeof themeId !== 'string' || !themeId) return null;
    const { data, error } = await client.from('themes').select('theme_name').eq('id', themeId).maybeSingle();
    if (error) {
        console.error('[ai-knowledge] Could not read the theme name:', error.message);
        return null;
    }
    return typeof data?.theme_name === 'string' ? data.theme_name : null;
}
