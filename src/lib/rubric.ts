// ─────────────────────────────────────────────────────────────
// Rubric scoring and ordering rules, in one place.
//
// Every screen that shows a score (Student Score, the student's own results,
// Analytics, the assessment form) used to add the criterion scores up and
// divide by the maximum, so every criterion counted the same. The English and
// Bahasa Indonesia rubrics weight their criteria differently (Clarity 30%,
// Paraphrasing 10%, ...), so the arithmetic lives here and every screen calls it.
//
// Weights sit on the criteria (rubric_indicators.weight), the rows a teacher
// scores. NULL means "equal share", and a rubric uses its weights only when
// every criterion has one. So a rubric nobody has weighted, which is every
// rubric that existed before weights did, scores exactly as it always has.
// ─────────────────────────────────────────────────────────────

/** The STEAM project phases, assessed in this order after C1 is approved. */
export const STEAM_PHASE_CODES = ['C1', 'C2', 'C3', 'C4', 'C5'] as const;

export function isSteamPhase(code: string | null | undefined): boolean {
    return (STEAM_PHASE_CODES as readonly string[]).includes(String(code ?? ''));
}

/** Highest score one criterion can get: 1 for a checklist, N for 'scale_N'. */
export function maxScaleOf(rubricType: string | null | undefined): number {
    if (rubricType === 'checklist') return 1;
    const n = parseInt(String(rubricType ?? '').replace('scale_', ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
}

interface WeightedCriterion {
    id: string;
    weight?: number | string | null;
}

const usableWeight = (w: unknown): number | null => {
    if (w === null || w === undefined || w === '') return null;
    const n = Number(w);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Each criterion's share of the rubric's score, as fractions that sum to 1.
 *
 * The stored weights count only when every criterion has one and they add up
 * to more than zero; otherwise every criterion counts equally. Partly weighted
 * rubrics fall back to equal on purpose: guessing what an unweighted criterion
 * was meant to be worth would make up a policy nobody set.
 */
export function effectiveWeights(criteria: readonly WeightedCriterion[]): Map<string, number> {
    const shares = new Map<string, number>();
    if (criteria.length === 0) return shares;

    const weights = criteria.map(c => usableWeight(c.weight));
    const total = weights.reduce<number>((sum, w) => sum + (w ?? 0), 0);
    const useStored = weights.every(w => w !== null) && total > 0;

    criteria.forEach((c, i) => {
        shares.set(c.id, useStored ? (weights[i] as number) / total : 1 / criteria.length);
    });
    return shares;
}

/** True when the rubric's weights differ from an equal split, so they are worth showing. */
export function hasCustomWeights(criteria: readonly WeightedCriterion[]): boolean {
    const shares = Array.from(effectiveWeights(criteria).values());
    return shares.some(s => Math.abs(s - shares[0]) > 1e-9);
}

export interface WeightedScore {
    /** 0 to 100, unrounded. Unscored criteria count as 0. */
    percentage: number;
    /** Criteria that have a score. */
    scoredCount: number;
    /** Plain sum of the scores and its maximum: the old "points" view. */
    points: number;
    maxPoints: number;
}

/**
 * Score of one group on one rubric: Σ (score ÷ max × weight), as a percentage.
 *
 * With the English Infographic weights (25, 15, 30, 20, 10) and levels
 * 3, 4, 3, 3, 2 this is 76.25, the worked example in the school's rubric.
 */
export function weightedScore(
    criteria: readonly WeightedCriterion[],
    scores: Readonly<Record<string, number | null | undefined>>,
    maxScale: number,
): WeightedScore {
    const shares = effectiveWeights(criteria);
    let percentage = 0;
    let scoredCount = 0;
    let points = 0;

    for (const c of criteria) {
        const raw = scores[c.id];
        if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) continue;
        const score = Math.min(Math.max(Number(raw), 0), maxScale);
        scoredCount++;
        points += score;
        percentage += (shares.get(c.id) ?? 0) * (score / maxScale) * 100;
    }
    return { percentage, scoredCount, points, maxPoints: criteria.length * maxScale };
}

/** Score rows keyed by criterion, the shape weightedScore takes. */
export function scoresByCriterion(rows: ReadonlyArray<{ indicator_id: string; score: number }>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.indicator_id] = r.score;
    return out;
}

/** For display: at most two decimals, trailing zeros dropped (76.25, 75, 77.78). */
export function formatScore(value: number): string {
    return String(Math.round(value * 100) / 100);
}

/** A share (0 to 1) as a percentage label, e.g. 0.25 -> '25%', 1/9 -> '11.11%'. */
export function formatWeight(share: number): string {
    return `${formatScore(share * 100)}%`;
}

/** Why a rubric cannot be used yet for a group, or null when it can. */
export type RubricLock = 'c1-not-approved' | 'previous-phase' | null;

/**
 * The order rubrics may be used in. C1 is the top of the hierarchy: nothing
 * else opens until C1 has been scored and the project approved. After that,
 * C2 to C5 open one at a time in order, while every other rubric (BCM, English,
 * Bahasa Indonesia, ...) is open at once and in any order.
 *
 * With no project yet there is nothing to protect, so nothing is locked.
 */
export function rubricLock(
    category: { code: string } | null | undefined,
    categories: ReadonlyArray<{ id: string; code: string }>,
    completedCategoryIds: ReadonlySet<string>,
    project: { status?: string | null } | null | undefined,
): RubricLock {
    if (!category || !project) return null;
    if (category.code === 'C1') return null;

    const c1 = categories.find(c => c.code === 'C1');
    if (!c1 || !completedCategoryIds.has(c1.id) || project.status !== 'approved') return 'c1-not-approved';

    if (isSteamPhase(category.code)) {
        const target = STEAM_PHASE_CODES.indexOf(category.code as (typeof STEAM_PHASE_CODES)[number]);
        for (let i = 1; i < target; i++) {
            const previous = categories.find(c => c.code === STEAM_PHASE_CODES[i]);
            if (previous && !completedCategoryIds.has(previous.id)) return 'previous-phase';
        }
    }
    return null;
}

/** Categories split for display: the ordered STEAM phases, then everything else. */
export function groupRubrics<T extends { code: string; sort_order?: number }>(categories: readonly T[]): {
    phases: T[];
    others: T[];
} {
    const sorted = [...categories].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return {
        phases: sorted.filter(c => isSteamPhase(c.code)),
        others: sorted.filter(c => !isSteamPhase(c.code)),
    };
}
