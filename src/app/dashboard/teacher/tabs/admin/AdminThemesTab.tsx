'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Palette, Plus, Pencil, Trash2, Check, X, Archive, RotateCcw, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetchAll';
import { logAdminAction } from '@/lib/admin';
import { GRADE_LEVELS } from '@/lib/grade';
import { academicYear } from '@/lib/academic-year';
import type { ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Themes, per grade, per year.
//
// Until now themes could only be created in SQL, which is how a whole academic
// year came to have none for grades 7-9 with no way to fix it from inside the
// app. A grade with no themes cannot submit a project at all, because submission
// requires a theme_id.
//
// Admin -> Academic Year can copy a whole year's themes across in one go; this
// screen is the one-at-a-time editor, and the only place a theme can be renamed,
// archived or deleted.
//
// Two constraints shape this screen:
//
//   - projects.theme_id references themes(id) with no ON DELETE, so deleting a
//     theme a project uses fails outright. Retiring such a theme means archiving
//     it -- moving its academic_year to 'Archived-<year>', the convention
//     override_themes_grade_10_11_12.sql established -- which takes it out of
//     the student picker while the projects keep pointing at it.
//   - there is a unique index on (theme_name, grade, academic_year), so the same
//     name twice in one grade and year is rejected by the database.
//
// Both produce Postgres error codes rather than anything a teacher could read,
// so both are translated here.
// ─────────────────────────────────────────────────────────────

const ARCHIVE_PREFIX = 'Archived-';

const isArchivedYear = (year: string) => year.startsWith(ARCHIVE_PREFIX);
const archivedYearFor = (year: string) => `${ARCHIVE_PREFIX}${year}`;
const liveYearOf = (year: string) =>
    isArchivedYear(year) ? year.slice(ARCHIVE_PREFIX.length) : year;

interface ThemeRow {
    id: string;
    theme_name: string;
    grade: string;
    academic_year: string;
}

interface AdminThemesTabProps {
    adminEmail: string | null;
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

const inputClass =
    'bg-[#1c1b14] border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 '
    + 'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

export default function AdminThemesTab({ adminEmail, showToast, showConfirm }: AdminThemesTabProps) {
    const activeYear = academicYear();

    const [themes, setThemes] = useState<ThemeRow[]>([]);
    const [usage, setUsage] = useState<Map<string, number>>(new Map());
    const [allYears, setAllYears] = useState<string[]>([]);
    const [year, setYear] = useState(activeYear);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const [newName, setNewName] = useState('');
    const [newGrade, setNewGrade] = useState<string>(GRADE_LEVELS[0]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    // The queries are awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh below adds the spinner for manual reloads.
    const fetchData = useCallback(async () => {
        const [{ data: themeRows, error: themeErr }, { data: projectRows }] = await Promise.all([
            fetchAll<ThemeRow>((from, to) => supabase
                .from('themes')
                .select('id, theme_name, grade, academic_year')
                .order('academic_year')
                .order('grade')
                .order('created_at')
                .range(from, to)),
            // Across every year: the check before a delete is whether ANY project
            // points at the row, not just one in the year on screen.
            fetchAll<{ theme_id: string | null }>((from, to) => supabase
                .from('projects')
                .select('theme_id')
                .range(from, to)),
        ]);

        if (themeErr) {
            showToast('Could not load themes: ' + themeErr.message, 'error');
            setLoading(false);
            return;
        }

        const counts = new Map<string, number>();
        (projectRows ?? []).forEach(p => {
            if (p.theme_id) counts.set(p.theme_id, (counts.get(p.theme_id) ?? 0) + 1);
        });

        setThemes(themeRows);
        setUsage(counts);
        setAllYears(
            Array.from(new Set([activeYear, ...themeRows.map(t => t.academic_year)]))
                .sort((a, b) => a.localeCompare(b))
                .reverse(),
        );
        setLoading(false);
    }, [showToast, activeYear]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchData();
    };

    const viewing = useMemo(
        () => themes.filter(t => t.academic_year === year),
        [themes, year],
    );

    // Grades to show: the school's grades, plus any already present in this year
    // so a grade outside 7-12 is never hidden from whoever has to manage it.
    const grades = useMemo(() => {
        const present = new Set(viewing.map(t => t.grade));
        return Array.from(new Set([...GRADE_LEVELS, ...present]))
            .sort((a, b) => (Number(a) || 99) - (Number(b) || 99) || a.localeCompare(b));
    }, [viewing]);

    const archivedCountFor = useMemo(() => {
        const archived = archivedYearFor(liveYearOf(year));
        return themes.filter(t => t.academic_year === archived).length;
    }, [themes, year]);

    // Turns the two constraints this table carries into something readable.
    const describeError = (message: string, code: string | undefined, name: string): string => {
        if (code === '23505' || /duplicate key|unique/i.test(message)) {
            return `There is already a theme called "${name}" for that grade and year.`;
        }
        if (code === '23503' || /foreign key|violates/i.test(message)) {
            return 'Some projects still use this theme, so it cannot be deleted. Archive it instead.';
        }
        return message;
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newName.trim().replace(/\s+/g, ' ');
        if (!name) {
            showToast('Enter a theme name.', 'warning');
            return;
        }
        if (isArchivedYear(year)) {
            showToast('Pick a live year to add a theme to, not an archive.', 'warning');
            return;
        }

        setBusy(true);
        const { error } = await supabase
            .from('themes')
            .insert({ theme_name: name, grade: newGrade, academic_year: year });
        setBusy(false);

        if (error) {
            showToast(describeError(error.message, error.code, name), 'error');
            return;
        }
        await logAdminAction(adminEmail, 'theme.create', `${year} / Grade ${newGrade}`, { theme_name: name });
        showToast(`Added "${name}" to Grade ${newGrade}.`, 'success');
        setNewName('');
        fetchData();
    };

    const handleRename = async (theme: ThemeRow) => {
        const name = editName.trim().replace(/\s+/g, ' ');
        if (!name) {
            showToast('A theme needs a name.', 'warning');
            return;
        }
        if (name === theme.theme_name) {
            setEditingId(null);
            return;
        }

        setBusy(true);
        const { error } = await supabase.from('themes').update({ theme_name: name }).eq('id', theme.id);
        setBusy(false);

        if (error) {
            showToast(describeError(error.message, error.code, name), 'error');
            return;
        }
        await logAdminAction(adminEmail, 'theme.rename', `${theme.academic_year} / Grade ${theme.grade}`, {
            from: theme.theme_name, to: name,
        });
        // Renaming reaches every project already using it, since they point at
        // the row rather than carrying a copy of the name.
        const used = usage.get(theme.id) ?? 0;
        showToast(
            used > 0
                ? `Renamed. ${used} project(s) using it now show the new name.`
                : 'Theme renamed.',
            'success',
        );
        setEditingId(null);
        fetchData();
    };

    const handleArchive = (theme: ThemeRow) => {
        const used = usage.get(theme.id) ?? 0;
        showConfirm(
            'Archive theme',
            `Archive "${theme.theme_name}" for Grade ${theme.grade}? Students will no longer be able to `
            + `choose it.${used > 0 ? ` The ${used} project(s) already using it keep it and are not affected.` : ''}`
            + ' You can restore it from the archived year at any time.',
            async () => {
                setBusy(true);
                const { error } = await supabase
                    .from('themes')
                    .update({ academic_year: archivedYearFor(theme.academic_year) })
                    .eq('id', theme.id);
                setBusy(false);
                if (error) {
                    showToast('Could not archive the theme: ' + error.message, 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'theme.archive', `${theme.academic_year} / Grade ${theme.grade}`, {
                    theme_name: theme.theme_name, projects_using: used,
                });
                showToast(`"${theme.theme_name}" archived.`, 'success');
                fetchData();
            },
            'Archive',
        );
    };

    const handleRestore = (theme: ThemeRow) => {
        const target = liveYearOf(theme.academic_year);
        showConfirm(
            'Restore theme',
            `Put "${theme.theme_name}" back into ${target} for Grade ${theme.grade}? Students will be able to choose it again.`,
            async () => {
                setBusy(true);
                const { error } = await supabase
                    .from('themes')
                    .update({ academic_year: target })
                    .eq('id', theme.id);
                setBusy(false);
                if (error) {
                    showToast(describeError(error.message, error.code, theme.theme_name), 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'theme.restore', `${target} / Grade ${theme.grade}`, {
                    theme_name: theme.theme_name,
                });
                showToast(`"${theme.theme_name}" restored to ${target}.`, 'success');
                fetchData();
            },
            'Restore',
        );
    };

    const handleDelete = (theme: ThemeRow) => {
        const used = usage.get(theme.id) ?? 0;
        if (used > 0) {
            showToast(
                `${used} project(s) use "${theme.theme_name}", so it cannot be deleted. Archive it instead.`,
                'warning',
            );
            return;
        }
        showConfirm(
            'Delete theme',
            `Delete "${theme.theme_name}" from Grade ${theme.grade}, ${theme.academic_year}? `
            + 'No project uses it, so nothing else changes. This cannot be undone.',
            async () => {
                setBusy(true);
                const { error } = await supabase.from('themes').delete().eq('id', theme.id);
                setBusy(false);
                if (error) {
                    showToast(describeError(error.message, error.code, theme.theme_name), 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'theme.delete', `${theme.academic_year} / Grade ${theme.grade}`, {
                    theme_name: theme.theme_name,
                });
                showToast(`"${theme.theme_name}" deleted.`, 'success');
                fetchData();
            },
            'Delete',
        );
    };

    const archived = isArchivedYear(year);
    const emptyGrades = grades.filter(g => viewing.filter(t => t.grade === g).length === 0);

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Palette className="text-amber-500" />
                        Project Themes
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Students pick a theme when they submit. A grade with no themes cannot submit at all.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label htmlFor="th-year" className="text-xs text-slate-500 shrink-0">Year</label>
                    <select
                        id="th-year"
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        className={inputClass}
                    >
                        {allYears.map(y => (
                            <option key={y} value={y}>
                                {y}{y === activeYear ? ' (active)' : ''}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        aria-label="Reload themes"
                        className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className={'w-4 h-4' + (loading ? ' animate-spin' : '')} />
                    </button>
                </div>
            </div>

            {archived && (
                <div className="bg-slate-500/10 border border-slate-600/30 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <Archive className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300">
                        This is the archive for {liveYearOf(year)}. Students cannot choose these. Restore
                        one to put it back.
                    </p>
                </div>
            )}

            {/* Add */}
            {!archived && (
                <form onSubmit={handleAdd} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6">
                    <p className="text-sm font-semibold text-slate-300 mb-3">Add a theme to {year}</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <select
                            value={newGrade}
                            onChange={e => setNewGrade(e.target.value)}
                            aria-label="Grade for the new theme"
                            className={inputClass + ' sm:w-36'}
                        >
                            {grades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            aria-label="Name of the new theme"
                            placeholder="Theme name, for example Clean Water & Sanitation"
                            className={inputClass + ' flex-1'}
                        />
                        <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl py-2.5 px-4 text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                </form>
            )}

            {/* Grades with nothing at all -- the state that blocks submission */}
            {!archived && !loading && emptyGrades.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">
                        Grade {emptyGrades.join(', ')} {emptyGrades.length === 1 ? 'has' : 'have'} no themes
                        for {year}. Groups in {emptyGrades.length === 1 ? 'that grade' : 'those grades'}{' '}
                        cannot submit a project until at least one is added.
                    </p>
                </div>
            )}

            {loading ? (
                <p className="text-slate-500 text-sm py-8 text-center">Loading themes...</p>
            ) : (
                <div className="space-y-6">
                    {grades.map(grade => {
                        const rows = viewing.filter(t => t.grade === grade);
                        return (
                            <div key={grade}>
                                <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                                    Grade {grade}
                                    <span className="text-xs font-normal text-slate-600">
                                        {rows.length === 0 ? 'no themes' : `${rows.length} theme(s)`}
                                    </span>
                                </h3>
                                {rows.length === 0 ? (
                                    <p className="text-xs text-slate-600 border border-dashed border-slate-800 rounded-xl px-4 py-3">
                                        Nothing yet{archived ? '.' : ' — add one above.'}
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {rows.map(theme => {
                                            const used = usage.get(theme.id) ?? 0;
                                            const editing = editingId === theme.id;
                                            return (
                                                <li
                                                    key={theme.id}
                                                    className="bg-[#1c1b14] border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
                                                >
                                                    {editing ? (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={editName}
                                                                onChange={e => setEditName(e.target.value)}
                                                                aria-label={`New name for ${theme.theme_name}`}
                                                                className={inputClass + ' flex-1 min-w-[200px]'}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRename(theme)}
                                                                disabled={busy}
                                                                aria-label="Save the new name"
                                                                className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingId(null)}
                                                                aria-label="Cancel renaming"
                                                                className="p-2 text-slate-500 hover:bg-slate-500/10 rounded-lg transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-slate-200 text-sm flex-1 min-w-[180px]">
                                                                {theme.theme_name}
                                                            </span>
                                                            <span
                                                                title={used > 0
                                                                    ? `${used} project(s) chose this theme`
                                                                    : 'No project uses this theme'}
                                                                className={
                                                                    'text-xs px-2 py-0.5 rounded-full border shrink-0 '
                                                                    + (used > 0
                                                                        ? 'bg-amber-500/10 text-amber-300/90 border-amber-900/40'
                                                                        : 'bg-slate-800/60 text-slate-500 border-slate-800')
                                                                }
                                                            >
                                                                {used > 0 ? `${used} project(s)` : 'unused'}
                                                            </span>

                                                            {archived ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRestore(theme)}
                                                                    disabled={busy}
                                                                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                                                                >
                                                                    <RotateCcw className="w-3.5 h-3.5" /> Restore
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setEditingId(theme.id);
                                                                            setEditName(theme.theme_name);
                                                                        }}
                                                                        aria-label={`Rename ${theme.theme_name}`}
                                                                        className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                                                    >
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleArchive(theme)}
                                                                        aria-label={`Archive ${theme.theme_name}`}
                                                                        title="Take it out of the student picker, keeping it on the projects that chose it"
                                                                        className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-500/10 rounded-lg transition-colors"
                                                                    >
                                                                        <Archive className="w-4 h-4" />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDelete(theme)}
                                                                        aria-label={`Delete ${theme.theme_name}`}
                                                                        title={used > 0
                                                                            ? 'In use — archive it instead'
                                                                            : 'Delete permanently'}
                                                                        className={
                                                                            'p-2 rounded-lg transition-colors '
                                                                            + (used > 0
                                                                                ? 'text-slate-700 cursor-not-allowed'
                                                                                : 'text-slate-400 hover:text-red-400 hover:bg-red-500/10')
                                                                        }
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {!archived && archivedCountFor > 0 && (
                <button
                    type="button"
                    onClick={() => setYear(archivedYearFor(liveYearOf(year)))}
                    className="mt-6 text-xs text-slate-500 hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors"
                >
                    <Archive className="w-3.5 h-3.5" />
                    View {archivedCountFor} archived theme(s) for {liveYearOf(year)}
                </button>
            )}
        </div>
    );
}
