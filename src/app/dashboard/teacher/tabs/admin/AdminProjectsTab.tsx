'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    DatabaseZap, Trash2, RefreshCw, AlertTriangle, History, Search, RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetchAll';
import { ACADEMIC_YEAR } from '@/lib/constants';
import { logAdminAction, resetGroupData, groupLabel, gradeOf } from '@/lib/admin';
import type { GroupResetScope } from '@/lib/admin';
import type { ProjectData, ToastType } from '@/lib/types';

interface RosterEntry {
    class_name: string;
    group_number: number;
    email?: string;
    full_name?: string;
}

interface AdminProjectsTabProps {
    adminEmail: string | null;
    allStudents: RosterEntry[];
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

interface GroupRow {
    class_name: string;
    group_number: number;
    projects: ProjectData[];
}

const RESET_OPTIONS: { scope: GroupResetScope; label: string; hint: string }[] = [
    { scope: 'projects', label: 'Project submissions', hint: 'Every iteration, title, abstract and document link' },
    { scope: 'assessment_scores', label: 'Assessment scores', hint: 'All C1–C5 / BCM / ENG / IND scores and teacher comments' },
    { scope: 'logbooks', label: 'Logbook entries', hint: 'All daily entries and photos for the group' },
    { scope: 'peer_assessments', label: 'Peer & self assessments', hint: 'Peer scores and written feedback' },
    { scope: 'precheck_quota', label: 'AI Pre-Check quota', hint: 'Sets the group back to 5 available pre-checks' },
];

export default function AdminProjectsTab({
    adminEmail,
    allStudents,
    showToast,
    showConfirm,
}: AdminProjectsTabProps) {
    const [projects, setProjects] = useState<ProjectData[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [search, setSearch] = useState('');
    const [gradeFilter, setGradeFilter] = useState('');
    const [expanded, setExpanded] = useState<string | null>(null);
    const [resetScopes, setResetScopes] = useState<GroupResetScope[]>(['projects']);

    // The query is awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh below adds the spinner for manual reloads.
    const fetchProjects = useCallback(async () => {
        const { data, error } = await fetchAll((from, to) => supabase
            .from('projects')
            .select('*, themes(theme_name)')
            .eq('academic_year', ACADEMIC_YEAR)
            .order('class_name')
            .order('group_number')
            .order('iteration', { ascending: false })
            .range(from, to));
        if (error) {
            showToast('Could not load projects: ' + error.message, 'error');
        } else {
            setProjects((data ?? []) as unknown as ProjectData[]);
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchProjects();
    };

    // Every group in the roster, with whatever projects it has submitted.
    const groups: GroupRow[] = useMemo(() => {
        const map = new Map<string, GroupRow>();
        allStudents.forEach(s => {
            const key = `${s.class_name}-${s.group_number}`;
            if (!map.has(key)) {
                map.set(key, { class_name: s.class_name, group_number: s.group_number, projects: [] });
            }
        });
        projects.forEach(p => {
            const key = `${p.class_name}-${p.group_number}`;
            if (!map.has(key)) {
                map.set(key, { class_name: p.class_name, group_number: p.group_number, projects: [] });
            }
            map.get(key)!.projects.push(p);
        });
        return Array.from(map.values()).sort(
            (a, b) => a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number,
        );
    }, [allStudents, projects]);

    const grades = useMemo(
        () => Array.from(new Set(groups.map(g => gradeOf(g.class_name)))).sort((a, b) => Number(a) - Number(b)),
        [groups],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return groups.filter(g => {
            if (gradeFilter && gradeOf(g.class_name) !== gradeFilter) return false;
            if (!q) return true;
            return g.class_name.toLowerCase().includes(q)
                || `group ${g.group_number}`.includes(q)
                || g.projects.some(p => p.title?.toLowerCase().includes(q));
        });
    }, [groups, search, gradeFilter]);

    const toggleScope = (scope: GroupResetScope) => {
        setResetScopes(prev => (prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]));
    };

    // ─── Delete a single iteration ─────────────────────
    const handleDeleteIteration = (project: ProjectData) => {
        showConfirm(
            'Delete this submission',
            `Delete iteration ${project.iteration ?? 1} of "${project.title}" (${project.class_name} group ${project.group_number})? Its assessment scores stay in place. This cannot be undone.`,
            async () => {
                setBusy(true);
                const { error } = await supabase.from('projects').delete().eq('id', project.id);
                setBusy(false);
                if (error) {
                    showToast('Could not delete submission: ' + error.message, 'error');
                    return;
                }
                await logAdminAction(
                    adminEmail,
                    'project.delete_iteration',
                    `${project.class_name} / Group ${project.group_number}`,
                    { project_id: project.id, title: project.title, iteration: project.iteration },
                );
                showToast('Submission deleted.', 'success');
                fetchProjects();
            },
            'Delete',
        );
    };

    // ─── Full group reset ──────────────────────────────
    const handleResetGroup = (group: GroupRow) => {
        if (resetScopes.length === 0) {
            showToast('Choose at least one thing to reset.', 'warning');
            return;
        }
        const chosen = RESET_OPTIONS.filter(o => resetScopes.includes(o.scope)).map(o => o.label);
        showConfirm(
            `Reset ${groupLabel(group)}`,
            `This permanently deletes the following for ${ACADEMIC_YEAR}: ${chosen.join(', ')}. The group starts fresh and can submit a new project as iteration 1. This cannot be undone.`,
            async () => {
                setBusy(true);
                const { failed } = await resetGroupData(group, resetScopes);
                setBusy(false);

                await logAdminAction(adminEmail, 'project.reset_group', groupLabel(group), {
                    scopes: resetScopes,
                    failed: failed.map(f => f.scope),
                });

                if (failed.length > 0) {
                    showToast(
                        `Partly reset. Failed: ${failed.map(f => `${f.scope} (${f.message})`).join('; ')}`,
                        'error',
                    );
                } else {
                    showToast(`${groupLabel(group)} reset. They can start fresh.`, 'success');
                }
                fetchProjects();
            },
            'Reset group',
        );
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        revision: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        disapproved: 'bg-red-500/10 text-red-400 border-red-500/30',
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <DatabaseZap className="text-amber-500" />
                        Project Data
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Delete a single submission, or wipe a group&apos;s data so they can start fresh.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="text-xs bg-[#292314] text-slate-300 border border-amber-900/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-[#3d341e] transition-colors self-start"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-200">
                    <p className="font-semibold mb-1">Everything here is permanent</p>
                    <p className="opacity-80">
                        Deleted submissions, scores and logbook entries cannot be recovered from the app.
                        Every action is written to the admin audit log with your email.
                    </p>
                </div>
            </div>

            {/* What to reset */}
            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">When resetting a group, also delete:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {RESET_OPTIONS.map(opt => (
                        <label key={opt.scope} className="flex items-start gap-2.5 text-sm cursor-pointer select-none p-2 rounded-lg hover:bg-[#1a1811]">
                            <input
                                type="checkbox"
                                checked={resetScopes.includes(opt.scope)}
                                onChange={() => toggleScope(opt.scope)}
                                className="accent-amber-500 mt-0.5"
                            />
                            <span>
                                <span className="text-slate-200">{opt.label}</span>
                                <span className="block text-xs text-slate-500">{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by class, group or project title..."
                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                </div>
                <select
                    value={gradeFilter}
                    onChange={e => setGradeFilter(e.target.value)}
                    className="bg-[#1c1b14] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                    <option value="">All grades</option>
                    {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500 text-sm">Loading project data...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No groups match this filter.</div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(group => {
                        const key = `${group.class_name}-${group.group_number}`;
                        const isOpen = expanded === key;
                        const latest = group.projects[0];
                        return (
                            <div key={key} className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                <div className="flex flex-wrap items-center gap-3 p-4">
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : key)}
                                        className="flex-1 min-w-[180px] text-left"
                                    >
                                        <span className="text-slate-200 font-semibold">{groupLabel(group)}</span>
                                        <span className="block text-xs text-slate-500 mt-0.5">
                                            {group.projects.length === 0
                                                ? 'No submission yet'
                                                : `${group.projects.length} iteration(s) — ${latest.title}`}
                                        </span>
                                    </button>

                                    {latest && (
                                        <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[latest.status] ?? 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                            {latest.status}
                                        </span>
                                    )}

                                    {group.projects.length > 0 && (
                                        <button
                                            onClick={() => setExpanded(isOpen ? null : key)}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-amber-900/40 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5"
                                        >
                                            <History className="w-3.5 h-3.5" /> {isOpen ? 'Hide' : 'Iterations'}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => handleResetGroup(group)}
                                        disabled={busy}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Reset group
                                    </button>
                                </div>

                                {isOpen && group.projects.length > 0 && (
                                    <div className="border-t border-slate-800 divide-y divide-slate-800/60">
                                        {group.projects.map(p => (
                                            <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                                                <span className="text-xs bg-[#292314] text-amber-400 border border-amber-900/40 px-2 py-1 rounded-lg shrink-0">
                                                    Iteration {p.iteration ?? 1}
                                                </span>
                                                <span className="flex-1 min-w-[160px] text-slate-300">{p.title}</span>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(p.created_at).toLocaleDateString()}
                                                </span>
                                                <button aria-label="Delete this project"
                                                    onClick={() => handleDeleteIteration(p)}
                                                    disabled={busy}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Delete this iteration"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
