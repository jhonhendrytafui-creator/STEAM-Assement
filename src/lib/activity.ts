// ─────────────────────────────────────────────────────────────
// Reading the group activity log.
//
// The rows are written by database triggers (sql/group_activity_*.sql), which
// build the human sentence at write time. This module only decides how each
// kind of entry is presented, and derives the per-member tally both dashboards
// show above the timeline.
//
// `summary` is rendered as plain text and never as HTML: part of it is the
// title a student typed and the first words of a logbook task.
// ─────────────────────────────────────────────────────────────

export interface ActivityEntry {
    id: string;
    class_name: string;
    group_number: number;
    academic_year: string;
    actor_email: string | null;
    actor_name: string | null;
    actor_role: string;
    action: string;
    summary: string;
    details: Record<string, unknown> | null;
    created_at: string;
}

/** Broad kind of an action, which decides its colour and icon. */
export type ActivityKind = 'submission' | 'document' | 'logbook' | 'assessment' | 'teacher' | 'other';

export function activityKind(action: string): ActivityKind {
    if (action.startsWith('logbook.')) return 'logbook';
    if (action === 'project.status_changed') return 'teacher';
    if (action === 'project.submitted' || action === 'project.resubmitted') return 'submission';
    if (action.startsWith('project.document')) return 'document';
    if (action.startsWith('peer.')) return 'assessment';
    if (action.startsWith('precheck.')) return 'assessment';
    return 'other';
}

/** Tailwind classes per kind, so the two dashboards colour entries alike. */
export const KIND_STYLES: Record<ActivityKind, { dot: string; text: string }> = {
    submission: { dot: 'bg-amber-500', text: 'text-amber-300' },
    document: { dot: 'bg-sky-500', text: 'text-sky-300' },
    logbook: { dot: 'bg-emerald-500', text: 'text-emerald-300' },
    assessment: { dot: 'bg-violet-500', text: 'text-violet-300' },
    teacher: { dot: 'bg-rose-500', text: 'text-rose-300' },
    other: { dot: 'bg-slate-500', text: 'text-slate-300' },
};

export interface MemberTally {
    email: string;
    name: string;
    count: number;
    /** Most recent entry by this person, ISO. */
    lastAt: string | null;
}

/**
 * How much each person did, most active first.
 *
 * Only student entries count: a teacher's approval is not the group's work, and
 * counting it would flatter whichever group was marked most often. Members who
 * have done nothing are included with a zero when their emails are supplied, so
 * the gap is visible rather than merely absent.
 */
export function tallyByMember(
    entries: ActivityEntry[],
    members: { email: string; full_name: string }[] = [],
): MemberTally[] {
    const byEmail = new Map<string, MemberTally>();

    for (const m of members) {
        byEmail.set(m.email, { email: m.email, name: m.full_name || m.email, count: 0, lastAt: null });
    }

    for (const e of entries) {
        if (e.actor_role !== 'student' || !e.actor_email) continue;
        const existing = byEmail.get(e.actor_email);
        if (existing) {
            existing.count += 1;
            if (!existing.lastAt || e.created_at > existing.lastAt) existing.lastAt = e.created_at;
        } else {
            // Someone who has since moved group: their entries stay in this
            // group's history, so they stay in its tally.
            byEmail.set(e.actor_email, {
                email: e.actor_email,
                name: e.actor_name || e.actor_email,
                count: 1,
                lastAt: e.created_at,
            });
        }
    }

    return [...byEmail.values()].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
}

/** Entries grouped under a date heading, newest day first. */
export function groupByDay(entries: ActivityEntry[]): Array<{ day: string; entries: ActivityEntry[] }> {
    const days = new Map<string, ActivityEntry[]>();
    for (const e of entries) {
        const day = e.created_at.slice(0, 10);
        const list = days.get(day);
        if (list) list.push(e);
        else days.set(day, [e]);
    }
    return [...days.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([day, list]) => ({
            day,
            entries: list.sort((a, b) => b.created_at.localeCompare(a.created_at)),
        }));
}

/** "just now", "12 minutes ago", "3 days ago". */
export function relativeTime(iso: string, now: Date = new Date()): string {
    const seconds = Math.floor((now.getTime() - new Date(iso).getTime()) / 1000);
    if (!Number.isFinite(seconds) || seconds < 0) return 'just now';
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years === 1 ? '' : 's'} ago`;
}
