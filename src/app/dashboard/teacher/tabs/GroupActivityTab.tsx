'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { academicYear } from '@/lib/academic-year';
import { fetchAll } from '@/lib/supabase/fetchAll';
import { gradeOf } from '@/lib/grade';
import GroupActivityFeed from '@/components/ui/GroupActivityFeed';
import { tallyByMember, type ActivityEntry } from '@/lib/activity';
import type { ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// A group's activity, for the teacher.
//
// Same timeline the group sees, so a conversation about who did what is about
// the same record on both screens. The grade list comes first because that is
// how every other teacher screen here is navigated.
//
// The overview deliberately leads with the groups that have been quiet: a group
// nobody has touched for a fortnight is the one worth asking about, and it is
// invisible on every other screen.
// ─────────────────────────────────────────────────────────────

interface GroupActivityTabProps {
    allStudents: { class_name: string; group_number: number; email: string; full_name: string }[];
    showToast: (message: string, type: ToastType) => void;
}

interface GroupRow {
    class_name: string;
    group_number: number;
    entries: number;
    lastAt: string | null;
}

const selectClass =
    'bg-[#1c1b14] border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 '
    + 'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

export default function GroupActivityTab({ allStudents, showToast }: GroupActivityTabProps) {
    const [grade, setGrade] = useState('');
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<{ class_name: string; group_number: number } | null>(null);

    const availableGrades = useMemo(
        () => Array.from(new Set(allStudents.map(s => gradeOf(s.class_name))))
            .sort((a, b) => (Number(a) || 0) - (Number(b) || 0)),
        [allStudents],
    );

    const fetchForGrade = useCallback(async (g: string) => {
        if (!g) return;
        const { data, error } = await fetchAll<ActivityEntry>((from, to) => supabase
            .from('group_activity_log')
            .select('*')
            .eq('academic_year', academicYear())
            .ilike('class_name', `${g}.%`)
            .order('created_at', { ascending: false })
            .range(from, to));

        if (error) {
            showToast('Could not load activity: ' + error.message, 'error');
            setLoading(false);
            return;
        }
        setEntries(data);
        setSelected(null);
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        if (!grade) return;
        fetchForGrade(grade);
    }, [grade, fetchForGrade]);

    // Every group in the grade, including those with no activity at all —
    // which are the ones this screen exists to surface.
    const groups = useMemo<GroupRow[]>(() => {
        const rows = new Map<string, GroupRow>();
        for (const s of allStudents) {
            if (gradeOf(s.class_name) !== grade) continue;
            const key = `${s.class_name}|${s.group_number}`;
            if (!rows.has(key)) {
                rows.set(key, { class_name: s.class_name, group_number: s.group_number, entries: 0, lastAt: null });
            }
        }
        for (const e of entries) {
            const row = rows.get(`${e.class_name}|${e.group_number}`);
            if (!row) continue;
            row.entries += 1;
            if (!row.lastAt || e.created_at > row.lastAt) row.lastAt = e.created_at;
        }
        // Quietest first: no activity, then longest since anything happened.
        return [...rows.values()].sort((a, b) => {
            if (!a.lastAt && !b.lastAt) {
                return a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number;
            }
            if (!a.lastAt) return -1;
            if (!b.lastAt) return 1;
            return a.lastAt.localeCompare(b.lastAt);
        });
    }, [allStudents, entries, grade]);

    const selectedEntries = useMemo(
        () => (selected
            ? entries.filter(e => e.class_name === selected.class_name && e.group_number === selected.group_number)
            : []),
        [entries, selected],
    );

    const selectedMembers = useMemo(
        () => (selected
            ? allStudents
                .filter(s => s.class_name === selected.class_name && s.group_number === selected.group_number)
                .map(s => ({ email: s.email, full_name: s.full_name }))
            : []),
        [allStudents, selected],
    );

    const silentGroups = groups.filter(g => g.entries === 0);

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-amber-500" />
                        Group Activity
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Who in each group has actually done the work. The same record the group sees.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="ga-grade" className="text-xs text-slate-500">Grade</label>
                    <select
                        id="ga-grade"
                        value={grade}
                        // Spinner set on the click rather than in the effect, so
                        // choosing a grade gives immediate feedback.
                        onChange={e => { setLoading(Boolean(e.target.value)); setGrade(e.target.value); }}
                        className={selectClass}
                    >
                        <option value="">Choose...</option>
                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                    {grade && (
                        <button
                            type="button"
                            onClick={() => { setLoading(true); fetchForGrade(grade); }}
                            aria-label="Reload activity"
                            className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                            <RefreshCw className={'w-4 h-4' + (loading ? ' animate-spin' : '')} />
                        </button>
                    )}
                </div>
            </div>

            {!grade ? (
                <p className="text-slate-500 text-sm py-8 text-center">
                    Choose a grade to see how its groups are working.
                </p>
            ) : loading ? (
                <p className="text-slate-500 text-sm py-8 text-center">Loading activity...</p>
            ) : selected ? (
                <div>
                    <button
                        type="button"
                        onClick={() => setSelected(null)}
                        className="text-xs text-slate-400 hover:text-amber-400 mb-4 transition-colors"
                    >
                        &larr; All groups in Grade {grade}
                    </button>
                    <h3 className="text-lg font-bold text-white mb-4">
                        {selected.class_name} — Group {selected.group_number}
                    </h3>
                    <GroupActivityFeed
                        entries={selectedEntries}
                        members={selectedMembers}
                        loading={false}
                        emptyMessage="This group has done nothing that the system records yet."
                    />
                </div>
            ) : (
                <>
                    {silentGroups.length > 0 && (
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mb-5 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-sm text-amber-100">
                                <strong>{silentGroups.length} group(s) in Grade {grade} have no recorded
                                activity at all.</strong>{' '}
                                They have not submitted, written a logbook entry or linked a document.
                            </p>
                        </div>
                    )}

                    <p className="text-xs text-slate-500 mb-3">
                        Quietest first. Select a group to see its timeline and who did what.
                    </p>
                    <ul className="space-y-2">
                        {groups.map(g => {
                            const memberCount = allStudents.filter(
                                s => s.class_name === g.class_name && s.group_number === g.group_number).length;
                            const contributors = tallyByMember(
                                entries.filter(e => e.class_name === g.class_name && e.group_number === g.group_number),
                            ).filter(m => m.count > 0).length;
                            return (
                                <li key={`${g.class_name}-${g.group_number}`}>
                                    <button
                                        type="button"
                                        onClick={() => setSelected({ class_name: g.class_name, group_number: g.group_number })}
                                        className="w-full text-left bg-[#1c1b14] border border-slate-800 hover:border-amber-500/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 transition-colors"
                                    >
                                        <span className="text-sm font-semibold text-slate-200 min-w-[130px]">
                                            {g.class_name} — Group {g.group_number}
                                        </span>
                                        <span className={'text-xs ' + (g.entries === 0 ? 'text-red-400' : 'text-slate-400')}>
                                            {g.entries} action{g.entries === 1 ? '' : 's'}
                                        </span>
                                        <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5" />
                                            {contributors} of {memberCount} member(s) active
                                        </span>
                                        <span className="text-xs text-slate-500 ml-auto">
                                            {g.lastAt
                                                ? `last ${new Date(g.lastAt).toLocaleDateString()}`
                                                : 'never'}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
