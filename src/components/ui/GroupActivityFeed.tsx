'use client';

import React from 'react';
import {
    PenSquare, FileText, BookOpen, Users, ClipboardCheck, Activity as ActivityIcon, Clock,
} from 'lucide-react';
import {
    activityKind, groupByDay, relativeTime, tallyByMember,
    KIND_STYLES, type ActivityEntry, type ActivityKind,
} from '@/lib/activity';

// ─────────────────────────────────────────────────────────────
// One timeline, rendered the same on the student dashboard and the teacher's,
// so a conversation about "what the log says" is about the same thing on both
// screens.
//
// Entry text is rendered as plain text. It contains a project title and the
// opening words of a logbook task, both typed by a student.
// ─────────────────────────────────────────────────────────────

const KIND_ICON: Record<ActivityKind, typeof PenSquare> = {
    submission: PenSquare,
    document: FileText,
    logbook: BookOpen,
    assessment: Users,
    teacher: ClipboardCheck,
    other: ActivityIcon,
};

interface GroupActivityFeedProps {
    entries: ActivityEntry[];
    /** Roster of the group, so members who have done nothing still appear. */
    members?: { email: string; full_name: string }[];
    /** Marks the reader's own entries. Omit on the teacher dashboard. */
    currentUserEmail?: string | null;
    loading?: boolean;
    /** Shown when there is nothing yet. */
    emptyMessage?: string;
}

export default function GroupActivityFeed({
    entries,
    members = [],
    currentUserEmail,
    loading = false,
    emptyMessage = 'Nothing has been recorded for this group yet.',
}: GroupActivityFeedProps) {
    const tally = tallyByMember(entries, members);
    const days = groupByDay(entries);
    const now = new Date();

    if (loading) {
        return <p className="text-slate-500 text-sm py-8 text-center">Loading activity...</p>;
    }

    if (entries.length === 0) {
        return (
            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 text-center">
                <ActivityIcon className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-400">{emptyMessage}</p>
                <p className="text-xs text-slate-600 mt-1">
                    Submitting the project, adding a logbook entry or linking a document all appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Who has done what. The reason the log exists, so it goes first. */}
            {tally.length > 0 && (
                <div>
                    <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
                        Actions per member
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {tally.map(m => {
                            const isYou = currentUserEmail && m.email === currentUserEmail;
                            return (
                                <div
                                    key={m.email}
                                    title={m.lastAt ? `Last activity ${relativeTime(m.lastAt, now)}` : 'No activity recorded'}
                                    className={
                                        'rounded-xl border px-3 py-2 '
                                        + (m.count === 0
                                            ? 'bg-[#1c1b14] border-slate-800'
                                            : 'bg-[#292314] border-amber-900/40')
                                    }
                                >
                                    <div className="flex items-baseline gap-2">
                                        <span className={'text-lg font-bold ' + (m.count === 0 ? 'text-slate-600' : 'text-amber-300')}>
                                            {m.count}
                                        </span>
                                        <span className="text-xs text-slate-300 truncate max-w-[160px]">
                                            {m.name}
                                            {isYou && <span className="text-amber-500/80"> (you)</span>}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 block mt-0.5">
                                        {m.lastAt ? relativeTime(m.lastAt, now) : 'nothing yet'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* The timeline */}
            <div className="space-y-5">
                {days.map(({ day, entries: dayEntries }) => (
                    <div key={day}>
                        <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                            })}
                        </h3>
                        <ul className="space-y-1.5">
                            {dayEntries.map(entry => {
                                const kind = activityKind(entry.action);
                                const Icon = KIND_ICON[kind];
                                const style = KIND_STYLES[kind];
                                const isYou = currentUserEmail && entry.actor_email === currentUserEmail;
                                return (
                                    <li
                                        key={entry.id}
                                        className="bg-[#1c1b14] border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3"
                                    >
                                        <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${style.dot}`} aria-hidden="true" />
                                        <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${style.text}`} aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-slate-200">
                                                <span className="font-semibold">
                                                    {entry.actor_name || entry.actor_email || 'Someone'}
                                                </span>
                                                {isYou && <span className="text-amber-500/80 text-xs"> (you)</span>}
                                                {entry.actor_role === 'teacher' && (
                                                    <span className="ml-1.5 text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded-full">
                                                        teacher
                                                    </span>
                                                )}
                                                {' — '}
                                                <span className="text-slate-300">{entry.summary}</span>
                                            </p>
                                        </div>
                                        <time
                                            dateTime={entry.created_at}
                                            title={new Date(entry.created_at).toLocaleString()}
                                            className="text-[11px] text-slate-500 shrink-0 mt-0.5"
                                        >
                                            {new Date(entry.created_at).toLocaleTimeString(undefined, {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </time>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
}
