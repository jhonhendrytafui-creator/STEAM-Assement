'use client';

import React, { useState, useEffect } from 'react';
import {
    PenSquare, Plus, Trash2,
    ChevronDown, AlertTriangle, Award, Sparkles, Calculator, Save, RotateCcw
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { SUBJECTS, ACADEMIC_YEAR } from '@/lib/constants';
import type { ProjectData, StudentInfo, Theme, AssessmentCategory, ToastType } from '@/lib/types';

// Maximum AI pre-checks allowed per group per academic year
const MAX_PRECHECKS = 5;

// localStorage key prefix for the in-progress submission draft.
// The draft is scoped per group + academic year so two students sharing a
// browser (or a student moving between groups/years) never see each other's text.
const DRAFT_KEY_PREFIX = 'steam:submit-draft';

interface KeyConcept {
    subject: string;
    concept: string;
}

interface SubmissionDraft {
    title: string;
    theme: string;
    problem: string;
    solution: string;
    keyConcepts: KeyConcept[];
    savedAt: string;
}

const emptyConcept = (): KeyConcept => ({ subject: 'biology_marine', concept: '' });

interface SubmitProjectTabProps {
    projectData: ProjectData | null;
    studentInfo: StudentInfo;
    userEmail: string | null;
    themesList: Theme[];
    projectHistory: ProjectData[];
    assessmentCategories: AssessmentCategory[];
    showToast: (message: string, type: ToastType) => void;
    onSubmitSuccess: (newProject: ProjectData) => void;
    onStartPrecheck: () => void;
    onEndPrecheck: (result: string) => void;
    onPrecheckError: () => void;
    isPrechecking: boolean;
    onNavigateToData: () => void;
}

export default function SubmitProjectTab({
    projectData,
    studentInfo,
    userEmail,
    themesList,
    projectHistory,
    assessmentCategories,
    showToast,
    onSubmitSuccess,
    onStartPrecheck,
    onEndPrecheck,
    onPrecheckError,
    isPrechecking,
    onNavigateToData,
}: SubmitProjectTabProps) {
    // Local form state
    const [title, setTitle] = useState('');
    const [theme, setTheme] = useState(themesList.length > 0 ? themesList[0].id : '');
    const [problem, setProblem] = useState('');
    const [solution, setSolution] = useState('');
    const [keyConcepts, setKeyConcepts] = useState<KeyConcept[]>([emptyConcept()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [precheckUsage, setPrecheckUsage] = useState(0);

    // Draft persistence state
    const [draftLoaded, setDraftLoaded] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    const draftKey = studentInfo
        ? `${DRAFT_KEY_PREFIX}:${ACADEMIC_YEAR}:${studentInfo.class_name}:${studentInfo.group_number}`
        : null;

    // ─── Draft: restore on mount ───────────────────────
    // The form lives in local state and this tab is unmounted whenever the
    // student switches sidebar tabs (and wiped completely on a reload or when a
    // mobile browser discards the backgrounded tab during the ~30-60s AI
    // pre-check). Restoring from localStorage keeps their typed text safe.
    useEffect(() => {
        if (!draftKey) {
            setDraftLoaded(true);
            return;
        }
        try {
            const raw = window.localStorage.getItem(draftKey);
            if (raw) {
                const saved = JSON.parse(raw) as Partial<SubmissionDraft>;
                if (typeof saved.title === 'string') setTitle(saved.title);
                if (typeof saved.problem === 'string') setProblem(saved.problem);
                if (typeof saved.solution === 'string') setSolution(saved.solution);
                if (typeof saved.theme === 'string' && saved.theme) setTheme(saved.theme);
                if (Array.isArray(saved.keyConcepts) && saved.keyConcepts.length > 0) {
                    setKeyConcepts(saved.keyConcepts.map(c => ({
                        subject: typeof c?.subject === 'string' ? c.subject : 'biology_marine',
                        concept: typeof c?.concept === 'string' ? c.concept : '',
                    })));
                }
                if (typeof saved.savedAt === 'string') setDraftSavedAt(saved.savedAt);
                const hasContent = Boolean(saved.title?.trim() || saved.problem?.trim() || saved.solution?.trim());
                if (hasContent) setDraftRestored(true);
            }
        } catch {
            // Corrupt or unreadable draft — start clean rather than crashing the form
        }
        setDraftLoaded(true);
    }, [draftKey]);

    // Keep the selected theme valid: a restored draft (or a theme the teacher
    // later archived) can point at a theme that no longer exists for this grade.
    useEffect(() => {
        if (themesList.length === 0) return;
        if (!theme || !themesList.some(t => t.id === theme)) {
            setTheme(themesList[0].id);
        }
    }, [themesList, theme]);

    // ─── Draft: save on every change ───────────────────
    // Guarded by draftLoaded so the initial empty state can never overwrite a
    // stored draft before it has been restored.
    useEffect(() => {
        if (!draftLoaded || !draftKey) return;

        const isEmpty =
            !title.trim() && !problem.trim() && !solution.trim() &&
            keyConcepts.every(c => !c.concept.trim());

        try {
            if (isEmpty) {
                window.localStorage.removeItem(draftKey);
                setDraftSavedAt(null);
            } else {
                const savedAt = new Date().toISOString();
                const draft: SubmissionDraft = { title, theme, problem, solution, keyConcepts, savedAt };
                window.localStorage.setItem(draftKey, JSON.stringify(draft));
                setDraftSavedAt(savedAt);
            }
        } catch {
            // Storage full or blocked (private mode) — the form still works,
            // it just won't survive a reload.
        }
    }, [draftLoaded, draftKey, title, theme, problem, solution, keyConcepts]);

    const clearDraft = () => {
        if (draftKey) {
            try {
                window.localStorage.removeItem(draftKey);
            } catch {
                // ignore — nothing we can do if storage is unavailable
            }
        }
        setDraftSavedAt(null);
        setDraftRestored(false);
    };

    const resetForm = () => {
        setTitle('');
        setProblem('');
        setSolution('');
        setKeyConcepts([emptyConcept()]);
        clearDraft();
    };

    // Fetch initial precheck quota
    useEffect(() => {
        const fetchQuota = async () => {
            if (!studentInfo) return;
            const { data } = await supabase
                .from('ai_precheck_usage')
                .select('usage_count')
                .eq('class_name', studentInfo.class_name)
                .eq('group_number', studentInfo.group_number)
                .eq('academic_year', ACADEMIC_YEAR)
                .single();
            if (data) {
                setPrecheckUsage(data.usage_count);
            }
        };
        fetchQuota();
    }, [studentInfo]);

    // ─── Key Concepts Handlers ─────────────────────────
    const addConcept = () => {
        setKeyConcepts(prev => [...prev, emptyConcept()]);
    };

    const removeConcept = (index: number) => {
        setKeyConcepts(prev => prev.filter((_, i) => i !== index));
    };

    const updateConcept = (index: number, field: 'subject' | 'concept', value: string) => {
        // Replace the entry instead of mutating it in place so React always
        // sees fresh objects and never reuses a stale render.
        setKeyConcepts(prev => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
    };

    // ─── Title Case Helper ────────────────────────────
    const toTitleCase = (str: string): string => {
        const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'is', 'if', 'it', 'vs', 'via']);
        return str.trim().replace(/\s+/g, ' ').split(' ').map((word, index) => {
            if (index === 0 || !minorWords.has(word.toLowerCase())) {
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }
            return word.toLowerCase();
        }).join(' ');
    };

    // ─── AI Pre-Check ──────────────────────────────────
    const handlePreCheck = async () => {
        if (!problem.trim() || !solution.trim()) {
            showToast('Please fill in both the Problem and Solution fields before running the AI Pre-Check.', 'warning');
            return;
        }

        // Snapshot what we send so the request is never affected by later edits.
        const problemSnapshot = problem;
        const solutionSnapshot = solution;
        const conceptsSnapshot = keyConcepts.filter(c => c.concept.trim() !== '');

        onStartPrecheck();

        try {
            // The quota is counted and enforced by /api/precheck, which derives
            // the group from the signed-in student's own roster row. The browser
            // only displays the number the server reports back.
            const res = await fetch('/api/precheck', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem: problemSnapshot,
                    solution: solutionSnapshot,
                    keyConcepts: conceptsSnapshot
                })
            });

            // Never assume the body is JSON. When the hosting platform kills
            // the function for running too long it answers with an HTML
            // gateway-error page, and parsing that blindly used to surface as
            // "Unexpected token '<'" instead of something a student can act on.
            let data: { result?: string; error?: string; usageCount?: number } = {};
            try {
                data = await res.json();
            } catch {
                throw new Error(
                    res.status === 504 || res.status === 502
                        ? 'The AI Pre-Check took too long to answer. Your draft is safe — please try again.'
                        : 'The AI Pre-Check could not be completed. Your draft is safe — please try again.'
                );
            }

            if (typeof data.usageCount === 'number') {
                setPrecheckUsage(data.usageCount);
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to analyze project');
            }

            if (!data.result) {
                throw new Error('The AI Pre-Check returned no feedback. Please try again.');
            }

            onEndPrecheck(data.result);
        } catch (error: any) {
            showToast(error.message || 'An error occurred during AI Pre-Check. Your draft has been kept.', 'error');
            // Close the overlay without opening an empty results modal.
            onPrecheckError();
        }
    };

    // ─── Project Submit ────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail || !studentInfo || isSubmitting) return;

        setIsSubmitting(true);

        // Strict validation: all fields must be filled
        if (!title.trim()) {
            showToast('Please enter a project title.', 'warning');
            setIsSubmitting(false);
            return;
        }
        if (!theme) {
            showToast('Please select a theme.', 'warning');
            setIsSubmitting(false);
            return;
        }
        if (!problem.trim()) {
            showToast('Please describe the problem.', 'warning');
            setIsSubmitting(false);
            return;
        }
        if (!solution.trim()) {
            showToast('Please describe the solution.', 'warning');
            setIsSubmitting(false);
            return;
        }
        if (keyConcepts.some(c => !c.concept.trim())) {
            showToast('Please fill in all key concepts.', 'warning');
            setIsSubmitting(false);
            return;
        }

        const combinedAbstract = JSON.stringify({
            problem,
            solution,
            keyConcepts
        });

        const nextIteration = projectHistory.length > 0 ? (projectHistory[0].iteration || 1) + 1 : 1;

        const { data, error } = await supabase.from('projects').insert([
            {
                class_name: studentInfo.class_name,
                group_number: studentInfo.group_number,
                academic_year: ACADEMIC_YEAR,
                theme_id: theme || null,
                title: toTitleCase(title),
                abstract: combinedAbstract,
                status: 'pending',
                google_doc_url: projectHistory.length > 0 ? projectHistory[0].google_doc_url : null,
                iteration: nextIteration
            }
        ]).select();

        setIsSubmitting(false);

        if (error) {
            console.error(error);
            // The draft stays in localStorage so nothing typed is lost.
            showToast('Error submitting project: ' + error.message, 'error');
        } else if (data) {
            showToast(nextIteration > 1 ? 'Project resubmitted successfully!' : 'Project submitted successfully!', 'success');

            // Reset C1 assessment scores for this group so the new iteration gets a fresh start
            if (nextIteration > 1) {
                const c1Category = assessmentCategories.find(c => c.code === 'C1');
                if (c1Category) {
                    await supabase
                        .from('assessment_scores')
                        .delete()
                        .eq('class_name', studentInfo.class_name)
                        .eq('group_number', studentInfo.group_number)
                        .eq('category_id', c1Category.id)
                        .eq('academic_year', ACADEMIC_YEAR);
                }
            }

            // Reset local form and drop the saved draft — it is submitted now
            resetForm();

            // Notify parent
            onSubmitSuccess(data[0]);
        }
    };

    const precheckRemaining = Math.max(0, MAX_PRECHECKS - precheckUsage);

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <PenSquare className="text-amber-500" />
                Project Submission
            </h2>
            <p className="text-slate-400 text-sm mb-8">Fill out the details of your STEAM project below.</p>

            {projectData && ['pending', 'approved'].includes(projectData.status) ? (
                <div className="bg-[#1c1b14] border border-amber-500/30 rounded-xl p-6 text-center">
                    <Award className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-white mb-2">
                        {projectData.status === 'approved' ? 'Project Approved!' : 'Project Under Review'}
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        {projectData.status === 'approved'
                            ? 'Great job! Your project was approved by the teacher. Check the "My Project Data" tab.'
                            : 'Your group has submitted a project and it is currently being reviewed.'}
                        <br /><strong className="text-amber-400 mt-2 block">{projectData.title}</strong>
                    </p>
                    <button
                        onClick={onNavigateToData}
                        className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
                    >
                        View Project Details →
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    {projectData && ['revision', 'disapproved'].includes(projectData.status) && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-red-200">
                                <p className="font-semibold mb-1">Resubmission Required ({projectData.status})</p>
                                <p className="opacity-80">Please update your project details below and submit a new iteration for assessment.</p>
                            </div>
                        </div>
                    )}

                    {draftRestored && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                            <Save className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-emerald-200 flex-1">
                                <p className="font-semibold mb-1">Draft restored</p>
                                <p className="opacity-80">
                                    We brought back what you typed last time. Keep editing and submit when you are ready.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDraftRestored(false)}
                                className="text-emerald-400/70 hover:text-emerald-300 text-xs font-medium shrink-0"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Project Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                            placeholder="Enter your project title..."
                        />
                    </div>

                    {/* Theme Dropdown */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">Theme</label>
                        {themesList.length > 0 ? (
                            <div className="relative">
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 pr-10 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all appearance-none"
                                >
                                    {themesList.map((t) => (
                                        <option key={t.id} value={t.id}>{t.theme_name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
                            </div>
                        ) : (
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-500 text-sm">
                                No themes available for your grade. Please contact your teacher.
                            </div>
                        )}
                    </div>

                    {/* Problem & Solution */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Problem</label>
                            <textarea
                                required
                                rows={4}
                                value={problem}
                                onChange={(e) => setProblem(e.target.value)}
                                className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none"
                                placeholder="Describe the problem you are solving..."
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-300 mb-2">Solution</label>
                            <textarea
                                required
                                rows={4}
                                value={solution}
                                onChange={(e) => setSolution(e.target.value)}
                                className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none"
                                placeholder="Describe your proposed solution..."
                            />
                        </div>
                    </div>

                    {/* Key Concepts */}
                    <div className="pt-4 border-t border-slate-800/50">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-sm font-semibold text-slate-300">Key Concepts</label>
                            <button
                                type="button"
                                onClick={addConcept}
                                className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-amber-500/20 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Add Concept
                            </button>
                        </div>

                        <div className="space-y-3">
                            {keyConcepts.map((item, index) => (
                                <div key={index} className="flex gap-3 items-start">
                                    <div className="relative w-1/3 shrink-0">
                                        <select
                                            value={item.subject}
                                            onChange={(e) => updateConcept(index, 'subject', e.target.value)}
                                            className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 appearance-none"
                                        >
                                            {Array.from(new Set(SUBJECTS.map(s => s.group))).map(group => (
                                                <optgroup key={group} label={group as string}>
                                                    {SUBJECTS.filter(s => s.group === group).map((sub) => (
                                                        <option key={sub.id} value={sub.id}>{sub.label}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                            {(() => {
                                                const SelIcon = SUBJECTS.find(s => s.id === item.subject)?.icon || Calculator;
                                                return <SelIcon className="w-4 h-4" />;
                                            })()}
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        required
                                        value={item.concept}
                                        onChange={(e) => updateConcept(index, 'concept', e.target.value)}
                                        className="flex-1 bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                        placeholder="Describe the concept..."
                                    />
                                    {keyConcepts.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeConcept(index)}
                                            className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Draft status */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 pt-2">
                        <span className="flex items-center gap-1.5">
                            <Save className="w-3.5 h-3.5" />
                            {draftSavedAt
                                ? `Draft saved on this device at ${new Date(draftSavedAt).toLocaleTimeString()} — it is safe to run the AI Pre-Check or switch tabs.`
                                : 'Your typing is saved automatically on this device as you go.'}
                        </span>
                        {draftSavedAt && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors"
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> Clear form
                            </button>
                        )}
                    </div>

                    {/* Submit & PreCheck Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 mt-8">
                        <button
                            type="button"
                            onClick={handlePreCheck}
                            disabled={isPrechecking || isSubmitting || precheckUsage >= MAX_PRECHECKS}
                            className="w-full sm:w-1/2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold py-4 rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-lg shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-2">
                                {isPrechecking ? (
                                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles className="w-5 h-5" />
                                )}
                                <span>{isPrechecking ? 'Analyzing...' : 'AI Pre-Check'}</span>
                            </div>
                            <span className="text-xs font-normal opacity-80">({precheckRemaining} of {MAX_PRECHECKS} uses remaining)</span>
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting || isPrechecking}
                            className="w-full sm:w-1/2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <PenSquare className="w-5 h-5" />
                            )}
                            {isSubmitting ? 'Submitting...' : 'Submit Project Review'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
