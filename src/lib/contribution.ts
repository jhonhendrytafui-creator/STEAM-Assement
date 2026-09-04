// ─────────────────────────────────────────────────────────────
// Individual contribution weighting
//
// Group work produces one set of rubric scores for the whole group, so without
// this every member receives an identical mark and the peer assessment data —
// six indicators per teammate, collected from every student — never reaches a
// grade. The free-rider problem the peer assessment exists to catch stays
// invisible in the numbers.
//
// The multiplier compares how a student was rated BY THEIR TEAMMATES against
// the group average, then clamps the result to a narrow band so it nudges a
// mark rather than deciding it. Self-assessment is deliberately excluded: a
// student's own rating should not move their own grade.
//
// Whether an individual mark may deviate from the group mark at all, and by how
// much, is a school assessment-policy decision. WEIGHTING_DEFAULTS holds the
// starting point; teachers can turn it off or change the band in the UI.
// ─────────────────────────────────────────────────────────────

export interface PeerAssessmentRow {
    assessor_email: string;
    assessed_email: string;
    q1_score: number;
    q2_score: number;
    q3_score: number;
    q4_score: number;
    q5_score: number;
    q6_score: number;
}

export interface WeightingConfig {
    enabled: boolean;
    /** Lowest multiplier a student can receive, e.g. 0.9 = at most 10% below. */
    floor: number;
    /** Highest multiplier a student can receive, e.g. 1.1 = at most 10% above. */
    ceiling: number;
    /** Ratings needed before the multiplier is trusted at all. */
    minRatings: number;
}

export const WEIGHTING_DEFAULTS: WeightingConfig = {
    enabled: false,   // off until the school decides the policy
    floor: 0.9,
    ceiling: 1.1,
    minRatings: 2,
};

export interface ContributionResult {
    /** Multiplier to apply to the group score. 1 means no adjustment. */
    multiplier: number;
    /** Mean peer rating out of 4, or null when nobody rated this student. */
    meanRating: number | null;
    /** Mean rating across the whole group, for context in the UI. */
    groupMean: number | null;
    /** How many teammates rated this student. */
    ratingCount: number;
    /** Why the multiplier is 1, when it is. */
    reason?: 'disabled' | 'not-enough-ratings' | 'no-group-data';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const meanOf = (rows: PeerAssessmentRow[]): number => {
    const total = rows.reduce(
        (sum, r) => sum + r.q1_score + r.q2_score + r.q3_score + r.q4_score + r.q5_score + r.q6_score,
        0,
    );
    return total / (rows.length * 6);
};

/**
 * Contribution multiplier for one student, from the peer assessments of their
 * own group. `groupRows` should be every peer assessment for that group.
 */
export function contributionMultiplier(
    studentEmail: string,
    groupRows: PeerAssessmentRow[],
    config: WeightingConfig = WEIGHTING_DEFAULTS,
): ContributionResult {
    // Exclude self-assessments in both directions.
    const peerRows = groupRows.filter(r => r.assessor_email !== r.assessed_email);
    const aboutStudent = peerRows.filter(r => r.assessed_email === studentEmail);

    const base: ContributionResult = {
        multiplier: 1,
        meanRating: aboutStudent.length > 0 ? meanOf(aboutStudent) : null,
        groupMean: peerRows.length > 0 ? meanOf(peerRows) : null,
        ratingCount: aboutStudent.length,
    };

    if (!config.enabled) return { ...base, reason: 'disabled' };
    if (aboutStudent.length < config.minRatings) return { ...base, reason: 'not-enough-ratings' };
    if (peerRows.length === 0 || base.groupMean === null || base.groupMean === 0) {
        return { ...base, reason: 'no-group-data' };
    }

    // Ratio against the group, clamped to the configured band.
    const ratio = (base.meanRating as number) / base.groupMean;
    return { ...base, multiplier: clamp(ratio, config.floor, config.ceiling) };
}

/** Apply a multiplier to a raw score, never exceeding the maximum available. */
export function applyMultiplier(score: number, max: number, multiplier: number): number {
    return Math.min(max, Math.round(score * multiplier));
}
