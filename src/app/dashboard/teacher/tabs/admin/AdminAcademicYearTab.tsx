'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    CalendarClock, AlertTriangle, CheckCircle2, RefreshCw, Copy, ArrowRight, Users, Palette,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { logAdminAction } from '@/lib/admin';
import { gradeOf } from '@/lib/grade';
import {
    academicYear, isValidAcademicYear, nextAcademicYear, saveAcademicYear,
} from '@/lib/academic-year';
import type { ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// Rolling the school over to a new academic year.
//
// The year is one row in app_settings and almost every query filters on it, so
// changing it repoints the entire app at a different slice of the data. If that
// slice is empty nothing errors: students see "Not Registered in Any Group" and
// a grade with no themes cannot submit a project at all. That is exactly how
// grades 7-9 were silently blocked when the year last moved.
//
// So this screen will not let the year be changed without first showing what is
// actually in the target year, and it can copy themes across, because there is
// no other screen in the app that can create them.
// ─────────────────────────────────────────────────────────────

interface AdminAcademicYearTabProps {
    adminEmail: string | null;
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

interface Readiness {
    year: string;
    students: number;
    classes: number;
    projects: number;
    /** Grade -> how many themes exist for it in the target year. */
    themesByGrade: { grade: string; themes: number }[];
    /** Where the grade list came from, so the reader knows what is being checked. */
    gradeSource: 'target-roster' | 'current-roster' | 'none';
}

const inputClass =
    'bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 '
    + 'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

export default function AdminAcademicYearTab({
    adminEmail, showToast, showConfirm,
}: AdminAcademicYearTabProps) {
    const current = academicYear();
    const [target, setTarget] = useState(() => nextAcademicYear(current));
    const [readiness, setReadiness] = useState<Readiness | null>(null);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copying, setCopying] = useState(false);
    const [copyFrom, setCopyFrom] = useState(current);
    const [knownYears, setKnownYears] = useState<string[]>([]);
    // Incremented per check; a response for an older token is discarded.
    const checkToken = useRef(0);

    // Years that already hold data, so a copy source can be picked rather than typed.
    useEffect(() => {
        (async () => {
            const [{ data: themeYears }, { data: rosterYears }] = await Promise.all([
                supabase.from('themes').select('academic_year'),
                supabase.from('student_master').select('academic_year'),
            ]);
            const all = new Set<string>();
            (themeYears ?? []).forEach(r => r.academic_year && all.add(r.academic_year));
            (rosterYears ?? []).forEach(r => r.academic_year && all.add(r.academic_year));
            setKnownYears(Array.from(all).sort().reverse());
        })();
    }, []);

    const check = useCallback(async (year: string) => {
        if (!isValidAcademicYear(year)) {
            setReadiness(null);
            return;
        }
        const token = ++checkToken.current;
        setChecking(true);

        const [{ data: targetRoster }, { data: currentRoster }, { count: projectCount }, { data: themeRows }] =
            await Promise.all([
                supabase.from('student_master').select('class_name').eq('academic_year', year),
                supabase.from('student_master').select('class_name').eq('academic_year', current),
                supabase.from('projects').select('id', { count: 'exact', head: true }).eq('academic_year', year),
                supabase.from('themes').select('grade').eq('academic_year', year),
            ]);

        // Which grades matter: the target year's own roster once it has one,
        // otherwise this year's, since that is what is about to be rolled over.
        let source: Readiness['gradeSource'] = 'none';
        let classNames: string[] = [];
        if (targetRoster && targetRoster.length > 0) {
            source = 'target-roster';
            classNames = targetRoster.map(r => r.class_name);
        } else if (currentRoster && currentRoster.length > 0) {
            source = 'current-roster';
            classNames = currentRoster.map(r => r.class_name);
        }

        const grades = Array.from(new Set(classNames.map(gradeOf)))
            .sort((a, b) => Number(a) - Number(b));
        const themeCounts = new Map<string, number>();
        (themeRows ?? []).forEach(r => themeCounts.set(r.grade, (themeCounts.get(r.grade) ?? 0) + 1));

        if (token !== checkToken.current) return;   // a newer check has started

        setReadiness({
            year,
            students: targetRoster?.length ?? 0,
            classes: new Set((targetRoster ?? []).map(r => r.class_name)).size,
            projects: projectCount ?? 0,
            themesByGrade: grades.map(g => ({ grade: g, themes: themeCounts.get(g) ?? 0 })),
            gradeSource: source,
        });
        setChecking(false);
    }, [current]);

    // Debounced: the year is typed a character at a time and each check is four
    // queries. This also keeps the effect body from calling setState
    // synchronously, which cascades renders.
    useEffect(() => {
        const timer = setTimeout(() => { check(target); }, 350);
        return () => clearTimeout(timer);
    }, [target, check]);

    const missingThemeGrades = (readiness?.themesByGrade ?? []).filter(g => g.themes === 0);
    const targetIsCurrent = target.trim() === current;

    const handleCopyThemes = () => {
        if (!isValidAcademicYear(target) || !isValidAcademicYear(copyFrom)) {
            showToast('Both years must be in YYYY/YYYY form.', 'warning');
            return;
        }
        if (copyFrom === target) {
            showToast('Pick a different year to copy from.', 'warning');
            return;
        }
        showConfirm(
            'Copy themes',
            `Copy the themes from ${copyFrom} into ${target}, for the grades in ${target} that have none? `
            + 'Grades that already have themes are left alone. Nothing is deleted.',
            async () => {
                setCopying(true);
                const gradesToFill = missingThemeGrades.map(g => g.grade);
                if (gradesToFill.length === 0) {
                    setCopying(false);
                    showToast('Every grade already has themes for that year.', 'info');
                    return;
                }
                const { data: source, error: readErr } = await supabase
                    .from('themes')
                    .select('theme_name, grade')
                    .eq('academic_year', copyFrom)
                    .in('grade', gradesToFill);
                if (readErr) {
                    setCopying(false);
                    showToast('Could not read the source themes: ' + readErr.message, 'error');
                    return;
                }
                if (!source || source.length === 0) {
                    setCopying(false);
                    showToast(`${copyFrom} has no themes for ${gradesToFill.join(', ')}.`, 'warning');
                    return;
                }
                const { error: insErr } = await supabase.from('themes').insert(
                    source.map(t => ({ theme_name: t.theme_name, grade: t.grade, academic_year: target })),
                );
                setCopying(false);
                if (insErr) {
                    showToast('Could not copy the themes: ' + insErr.message, 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'themes.copy_year', `${copyFrom} -> ${target}`, {
                    grades: gradesToFill, count: source.length,
                });
                showToast(`Copied ${source.length} theme(s) into ${target}.`, 'success');
                check(target);
            },
            'Copy themes',
        );
    };

    const handleSwitch = () => {
        if (!isValidAcademicYear(target)) {
            showToast('Enter the year as YYYY/YYYY with consecutive years, for example 2027/2028.', 'warning');
            return;
        }
        if (targetIsCurrent) {
            showToast(`${current} is already the active year.`, 'info');
            return;
        }

        const warnings: string[] = [];
        if (readiness && readiness.students === 0) {
            warnings.push(`No students are on the roster for ${target}, so every student will see "Not Registered in Any Group" until you import them.`);
        }
        if (missingThemeGrades.length > 0) {
            warnings.push(`No themes for grade ${missingThemeGrades.map(g => g.grade).join(', ')}, so those grades will not be able to submit a project.`);
        }

        showConfirm(
            `Switch to ${target}?`,
            [
                `Everyone — students and teachers — sees ${target} from their next page load. Work in ${current} is not deleted; it simply stops being shown.`,
                ...warnings.map(w => `WARNING: ${w}`),
                'You can switch back at any time.',
            ].join('\n\n'),
            async () => {
                setSaving(true);
                const { error } = await saveAcademicYear(target, adminEmail);
                setSaving(false);
                if (error) {
                    showToast('Could not change the academic year: ' + error, 'error');
                    return;
                }
                await logAdminAction(adminEmail, 'academic_year.change', `${current} -> ${target}`, {
                    from: current, to: target,
                    students_in_target: readiness?.students ?? null,
                    grades_without_themes: missingThemeGrades.map(g => g.grade),
                });
                showToast(`Academic year is now ${target}. Reloading...`, 'success');
                // Everything on screen was loaded for the old year. A reload is
                // the only honest way to make the whole portal agree.
                setTimeout(() => window.location.reload(), 1200);
            },
            `Switch to ${target}`,
        );
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                <CalendarClock className="text-amber-500" />
                Academic Year
            </h2>
            <p className="text-slate-400 text-sm mb-8">
                Every screen in the portal shows one academic year at a time. Changing it here
                changes it for everyone, without a new deployment.
            </p>

            <div className="bg-[#1c1b14] border border-amber-500/30 rounded-xl p-5 mb-8">
                <span className="text-xs uppercase tracking-wider text-slate-500">Active year</span>
                <p className="text-3xl font-bold text-amber-400 mt-1">{current}</p>
            </div>

            {/* Target year */}
            <label htmlFor="ay-target" className="block text-sm font-semibold text-slate-300 mb-2">
                Switch to
            </label>
            <div className="flex flex-col sm:flex-row gap-3 mb-2">
                <input
                    id="ay-target"
                    type="text"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className={inputClass + ' sm:w-48'}
                    placeholder="2027/2028"
                    aria-describedby="ay-target-help"
                />
                <button
                    type="button"
                    onClick={() => check(target)}
                    disabled={checking}
                    className="inline-flex items-center justify-center gap-2 bg-[#1c1b14] hover:bg-[#232118] border border-slate-800 hover:border-amber-500/40 text-slate-300 rounded-xl py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={'w-4 h-4' + (checking ? ' animate-spin' : '')} />
                    Re-check
                </button>
            </div>
            <p id="ay-target-help" className="text-xs text-slate-500 mb-8">
                Two consecutive years separated by a slash, as stored on every row: {current}.
            </p>

            {/* Readiness */}
            {!isValidAcademicYear(target) ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">
                        <strong>{target || '(empty)'}</strong> is not a valid academic year. Use
                        YYYY/YYYY with consecutive years, for example {nextAcademicYear(current)}.
                    </p>
                </div>
            ) : readiness && (
                <div className="mb-8">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">
                        What is already in {readiness.year}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                            <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> Students on roster
                            </span>
                            <p className={'text-2xl font-bold mt-1 ' + (readiness.students === 0 ? 'text-red-400' : 'text-emerald-400')}>
                                {readiness.students}
                            </p>
                            <span className="text-xs text-slate-600">across {readiness.classes} class(es)</span>
                        </div>
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                            <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Palette className="w-3.5 h-3.5" /> Grades without themes
                            </span>
                            <p className={'text-2xl font-bold mt-1 ' + (missingThemeGrades.length > 0 ? 'text-red-400' : 'text-emerald-400')}>
                                {missingThemeGrades.length}
                            </p>
                            <span className="text-xs text-slate-600">
                                of {readiness.themesByGrade.length} checked
                            </span>
                        </div>
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                            <span className="text-xs text-slate-500">Projects submitted</span>
                            <p className="text-2xl font-bold text-slate-300 mt-1">{readiness.projects}</p>
                            <span className="text-xs text-slate-600">already in that year</span>
                        </div>
                    </div>

                    {readiness.themesByGrade.length > 0 && (
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-4">
                            <p className="text-xs text-slate-500 mb-3">
                                Themes per grade
                                {readiness.gradeSource === 'current-roster'
                                    && ` — grades taken from the ${current} roster, since ${readiness.year} has none yet`}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {readiness.themesByGrade.map(g => (
                                    <span
                                        key={g.grade}
                                        className={
                                            'text-xs px-2.5 py-1 rounded-full border '
                                            + (g.themes === 0
                                                ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30')
                                        }
                                    >
                                        Grade {g.grade}: {g.themes === 0 ? 'none' : `${g.themes} theme(s)`}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {readiness.gradeSource === 'none' && (
                        <p className="text-xs text-slate-500 mb-4">
                            No roster in {readiness.year} or {current}, so there are no grades to check themes for.
                        </p>
                    )}

                    {/* Remediation: themes, because nothing else in the app can create them */}
                    {missingThemeGrades.length > 0 && (
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-100">
                                    Grade {missingThemeGrades.map(g => g.grade).join(', ')} would not be
                                    able to submit a project in {readiness.year}: submission requires a
                                    theme, and there are none. Copy last year&apos;s across and edit them
                                    after, or add them in SQL.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                                <label htmlFor="ay-copy-from" className="text-xs text-slate-400 shrink-0">
                                    Copy themes from
                                </label>
                                <select
                                    id="ay-copy-from"
                                    value={copyFrom}
                                    onChange={e => setCopyFrom(e.target.value)}
                                    className={inputClass + ' py-2 sm:w-44'}
                                >
                                    {(knownYears.length > 0 ? knownYears : [current])
                                        .filter(y => y !== target)
                                        .map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <button
                                    type="button"
                                    onClick={handleCopyThemes}
                                    disabled={copying}
                                    className="inline-flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    <Copy className="w-4 h-4" />
                                    {copying ? 'Copying...' : `Copy into ${readiness.year}`}
                                </button>
                            </div>
                        </div>
                    )}

                    {readiness.students === 0 && (
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mt-3 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-100">
                                No students are on the roster for {readiness.year}. Every student would see
                                &quot;Not Registered in Any Group&quot; until you add them in
                                Students &amp; Groups, which imports into whichever year is active — so
                                import after switching, or switch and import straight away.
                            </p>
                        </div>
                    )}

                    {readiness.students > 0 && missingThemeGrades.length === 0 && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-100">
                                {readiness.year} has a roster and themes for every grade. Safe to switch.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <button
                type="button"
                onClick={handleSwitch}
                disabled={saving || targetIsCurrent || !isValidAcademicYear(target)}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-3.5 px-6 rounded-xl inline-flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? (
                    <div className="w-5 h-5 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin" />
                ) : (
                    <ArrowRight className="w-5 h-5" />
                )}
                {saving
                    ? 'Switching...'
                    : targetIsCurrent
                        ? `${current} is already active`
                        : `Switch to ${isValidAcademicYear(target) ? target : '...'}`}
            </button>

            <p className="text-xs text-slate-600 mt-4">
                Nothing is deleted by switching. Each year&apos;s students, projects, logbooks and
                scores are stored against that year and come back when you switch back.
            </p>
        </div>
    );
}
