'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { fetchAll } from '@/lib/supabase/fetchAll';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType, ProjectData, ProjectTeacherRecommendation } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Info, X, Users, AlertCircle, RefreshCw, Wand2, Zap, Search, LayoutGrid, List, UserCheck, Tag, Scale } from 'lucide-react';
import { subjectLabel } from '@/lib/subjects';

interface ProjectClassificationTabProps {
    showToast: (message: string, type: ToastType) => void;
}

interface ProjectAssignment {
    project_id: string;
    mode: 'teacher' | 'subject';
    teacher_email: string | null;
    teacher_name: string | null;
    subject_id: string | null;
    relevance: number;
    basis: string | null;
    reason: string | null;
}

interface ProjectWithRecommendations extends ProjectData {
    recommendations: ProjectTeacherRecommendation[];
    assignment?: ProjectAssignment;
}

type ViewMode = 'grid' | 'list';

/**
 * What the classifier is being asked to decide.
 *
 * 'teacher' hands each group to one person and keeps every teacher's load
 * within one project of every other. 'subject' just files the project under
 * the STEAM subject it draws on most, ignoring who teaches what.
 */
type ClassifyMode = 'teacher' | 'subject';

/** Shape of the /api/classify-batch reply, success or failure. */
interface BatchResponse {
    error?: string;
    assigned?: number;
    total?: number;
    skipped?: number;
    partial?: boolean;
    summary?: {
        perTeacher?: Record<string, number>;
        perSubject?: Record<string, number>;
        spread?: number;
    };
}

interface RunSummary {
    mode: ClassifyMode;
    assigned: number;
    skipped: number;
    partial: boolean;
    perTeacher?: Record<string, number>;
    perSubject?: Record<string, number>;
    spread?: number;
}

export default function ProjectClassificationTab({ showToast }: ProjectClassificationTabProps) {
    const [projects, setProjects] = useState<ProjectWithRecommendations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGrade, setSelectedGrade] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [classifyingProjectIds, setClassifyingProjectIds] = useState<Set<string>>(new Set());
    const [isClassifyingAll, setIsClassifyingAll] = useState(false);
    const [mode, setMode] = useState<ClassifyMode>('teacher');
    const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

    // Modal state
    const [selectedProject, setSelectedProject] = useState<ProjectWithRecommendations | null>(null);

    // silent=true skips the skeleton animation — used for background polls and post-classify refreshes
    const fetchClassifications = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const { data: approvedProjects, error: projectError } = await fetchAll((from, to) => supabase
                .from('projects')
                .select('*, themes(theme_name)')
                .eq('academic_year', ACADEMIC_YEAR)
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .range(from, to));

            if (projectError) throw projectError;

            if (!approvedProjects || approvedProjects.length === 0) {
                setProjects([]);
                return;
            }

            const projectIds = approvedProjects.map(p => p.id);
            const { data: recs, error: recsError } = await supabase
                .from('project_teacher_recommendations')
                .select('*')
                .in('project_id', projectIds);

            const safeRecs = recsError ? [] : (recs || []);

            const { data: assigns } = await supabase
                .from('project_assignments')
                .select('*')
                .in('project_id', projectIds);
            const byProject = new Map((assigns ?? []).map(a => [a.project_id, a as ProjectAssignment]));

            const merged = approvedProjects.map(p => ({
                ...p,
                recommendations: safeRecs.filter(r => r.project_id === p.id),
                assignment: byProject.get(p.id),
            }));

            setProjects(merged);
        } catch (error: any) {
            if (!silent) showToast(error.message || 'Failed to fetch classification data', 'error');
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClassifications();
    }, []);

    useEffect(() => {
        const hasPending = projects.some(p => !p.recommendations || p.recommendations.length === 0);
        if (!hasPending || isLoading) return;

        const timer = setTimeout(() => {
            fetchClassifications(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, [projects, isLoading]);

    // Extract unique grades
    const availableGrades = ['All', ...Array.from(new Set(projects.map(p => String(p.class_name).split('.')[0])))].sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return Number(a) - Number(b);
    });

    // Apply grade filter then search filter
    const gradeFiltered = selectedGrade === 'All'
        ? projects
        : projects.filter(p => String(p.class_name).split('.')[0] === selectedGrade);

    const q = searchQuery.trim().toLowerCase();
    const displayedProjects = q
        ? gradeFiltered.filter(p =>
            p.title?.toLowerCase().includes(q) ||
            String(p.class_name).toLowerCase().includes(q) ||
            String(p.group_number).includes(q) ||
            p.recommendations?.some(r => r.teacher_expertise?.toLowerCase().includes(q))
        )
        : gradeFiltered;

    const handleClassifyProject = async (projectId: string) => {
        setClassifyingProjectIds(prev => new Set(prev).add(projectId));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/ai-classify-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                },
                body: JSON.stringify({ projectId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Classification failed');
            showToast('AI classification complete!', 'success');
            await fetchClassifications(true);
        } catch (err: any) {
            showToast(err.message || 'AI classification failed. Check if teacher expertise is configured.', 'error');
        } finally {
            setClassifyingProjectIds(prev => {
                const next = new Set(prev);
                next.delete(projectId);
                return next;
            });
        }
    };

    const handleClassifyAll = async () => {
        setIsClassifyingAll(true);
        setRunSummary(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/classify-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ mode, grade: selectedGrade }),
            });

            let data: BatchResponse = {};
            try {
                data = await res.json();
            } catch {
                throw new Error('The classifier took too long to answer. Please try again.');
            }
            if (!res.ok) throw new Error(data.error || 'Classification failed');

            setRunSummary({
                mode,
                assigned: data.assigned ?? 0,
                skipped: data.skipped ?? 0,
                partial: Boolean(data.partial),
                perTeacher: data.summary?.perTeacher,
                perSubject: data.summary?.perSubject,
                spread: data.summary?.spread,
            });
            showToast(
                data.partial
                    ? `Assigned ${data.assigned} of ${data.total}. Run again to finish the rest.`
                    : `Assigned ${data.assigned} project(s).`,
                data.partial ? 'warning' : 'success',
            );
            await fetchClassifications(true);
        } catch (err) {
            showToast((err as Error)?.message || 'Classification failed.', 'error');
        } finally {
            setIsClassifyingAll(false);
        }
    };

    /** What this project was finally assigned to, in either mode. */
    const assignmentBadge = (a: ProjectAssignment | undefined) => {
        if (!a) return null;
        const isTeacher = a.mode === 'teacher';
        const label = isTeacher
            ? (a.teacher_name || a.teacher_email || 'Unassigned')
            : (a.subject_id ? subjectLabel(a.subject_id) : 'No subject');
        // 'balance' means nobody matched the subject and this teacher was
        // simply the least busy — worth showing honestly rather than dressing
        // it up as a subject match.
        const weak = a.basis === 'balance';
        return (
            <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                    weak
                        ? 'bg-slate-500/10 text-slate-400 border-slate-600/40'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'}`}
                title={weak
                    ? 'Assigned to even out workload — no subject overlap'
                    : `${a.relevance}% match on ${a.subject_id ? subjectLabel(a.subject_id) : 'subject'}`}
            >
                {isTeacher
                    ? <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    : <Tag className="w-3.5 h-3.5" aria-hidden="true" />}
                {label}
                {!weak && <span className="opacity-70 tabular-nums">{a.relevance}%</span>}
            </span>
        );
    };

    const getRankColor = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'high': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'low': return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
            default: return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
        }
    };

    const sortedRecs = (recs: ProjectTeacherRecommendation[]) =>
        [...recs].sort((a, b) => {
            const rankOrder: Record<string, number> = { 'High': 1, 'Medium': 2, 'Low': 3 };
            return (rankOrder[a.rank_level] || 4) - (rankOrder[b.rank_level] || 4);
        });

    return (
        <div className="space-y-5">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BrainCircuit className="text-amber-500" />
                        Project Classification
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        {mode === 'teacher'
                            ? 'Share approved projects out between guide teachers, evenly.'
                            : 'File each approved project under the STEAM subject it depends on most.'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div
                        role="group"
                        aria-label="What to classify by"
                        className="flex bg-[#1a1811] border border-amber-900/30 rounded-xl p-1 gap-1"
                    >
                        <button
                            onClick={() => { setMode('teacher'); setRunSummary(null); }}
                            aria-pressed={mode === 'teacher'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'teacher' ? 'bg-[#292314] text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" /> To teacher
                        </button>
                        <button
                            onClick={() => { setMode('subject'); setRunSummary(null); }}
                            aria-pressed={mode === 'subject'}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                mode === 'subject' ? 'bg-[#292314] text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Tag className="w-3.5 h-3.5" aria-hidden="true" /> To subject
                        </button>
                    </div>
                    <button
                        onClick={handleClassifyAll}
                        disabled={isClassifyingAll || isLoading || displayedProjects.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-[#1a1811] font-bold rounded-xl border border-amber-500/50 transition-colors text-sm"
                        title={mode === 'teacher'
                            ? 'Assign every approved project to a guide teacher, evenly'
                            : 'Label every approved project with its main STEAM subject'}
                    >
                        <Zap className={`w-4 h-4 ${isClassifyingAll ? 'animate-pulse' : ''}`} aria-hidden="true" />
                        {isClassifyingAll
                            ? 'Working...'
                            : mode === 'teacher' ? 'Assign to teachers' : 'Label by subject'}
                    </button>
                    <button aria-label="Refresh classifications"
                        onClick={() => fetchClassifications()}
                        className="p-2 bg-[#1c1b14] hover:bg-[#252318] text-slate-300 hover:text-amber-400 rounded-xl border border-amber-900/30 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
                    </button>
                </div>
            </div>

            {runSummary && (
                <div className="bg-[#1a1811] border border-amber-900/30 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                        <Scale className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <h3 className="text-sm font-bold text-white">
                                {runSummary.mode === 'teacher' ? 'Workload after assigning' : 'Projects per subject'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {runSummary.assigned} project(s) assigned
                                {runSummary.skipped > 0 && `, ${runSummary.skipped} skipped`}
                                {runSummary.mode === 'teacher' && typeof runSummary.spread === 'number' && (
                                    runSummary.spread <= 1
                                        ? ' — every teacher is within one project of every other.'
                                        : ` — loads differ by ${runSummary.spread}.`
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(runSummary.perTeacher ?? runSummary.perSubject ?? {})
                            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                            .map(([name, count]) => (
                                <span
                                    key={name}
                                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                                        count === 0
                                            ? 'bg-[#1c1b14] text-slate-600 border-slate-800'
                                            : 'bg-[#292314] text-amber-200 border-amber-900/40'}`}
                                >
                                    {name}
                                    <span className="ml-2 font-bold tabular-nums">{count}</span>
                                </span>
                            ))}
                    </div>
                    {runSummary.partial && (
                        <p className="text-xs text-amber-400/90 mt-3">
                            The run hit its time limit before finishing. Press the button again to
                            continue where it stopped.
                        </p>
                    )}
                </div>
            )}

            {/* ── Controls row: grade filter + search + view toggle ── */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Grade pills */}
                <div className="bg-[#1c1b14] p-1 rounded-xl border border-amber-900/30 flex flex-shrink-0">
                    {availableGrades.map((grade) => (
                        <button
                            key={grade}
                            onClick={() => setSelectedGrade(grade)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                selectedGrade === grade
                                    ? 'bg-amber-500 text-[#1a1811] font-bold shadow-lg'
                                    : 'text-slate-400 hover:text-amber-400 hover:bg-amber-900/20'
                            }`}
                        >
                            {grade === 'All' ? 'All Grades' : `Grade ${grade}`}
                        </button>
                    ))}
                </div>

                {/* Search bar */}
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by project title, class, group, or subject..."
                        className="w-full bg-[#1c1b14] border border-amber-900/30 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    {searchQuery && (
                        <button aria-label="Clear the search box"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* View mode toggle */}
                <div className="bg-[#1c1b14] p-1 rounded-xl border border-amber-900/30 flex flex-shrink-0">
                    <button aria-label="Show projects as cards"
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-amber-500 text-[#1a1811]' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-900/20'}`}
                        title="Grid view"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button aria-label="Show projects as a list"
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-amber-500 text-[#1a1811]' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-900/20'}`}
                        title="List view"
                    >
                        <List className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Result count ── */}
            {!isLoading && displayedProjects.length > 0 && (
                <p className="text-xs text-slate-500">
                    Showing {displayedProjects.length} of {projects.length} projects
                    {q ? ` matching "${searchQuery}"` : ''}
                </p>
            )}

            {/* ── Content ── */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-[#1c1b14] border border-amber-900/20 rounded-2xl h-56"></div>
                    ))}
                </div>
            ) : displayedProjects.length === 0 ? (
                <div className="bg-[#1c1b14] border border-amber-900/20 rounded-2xl p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-amber-900/60 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        {q ? 'No projects match your search' : 'No Approved Projects Found'}
                    </h3>
                    <p className="text-slate-400 text-sm">
                        {q
                            ? `Try a different keyword or clear the search.`
                            : `There are no approved projects to classify for ${selectedGrade === 'All' ? 'any grade' : `Grade ${selectedGrade}`}.`
                        }
                    </p>
                </div>
            ) : viewMode === 'grid' ? (
                /* ── GRID VIEW ── */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <AnimatePresence>
                        {displayedProjects.map((project) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={project.id}
                                className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-900/10 rounded-2xl overflow-hidden flex flex-col group"
                            >
                                {/* Card Header */}
                                <div className="p-5 border-b border-slate-800/50 bg-[#1a1811]/80">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-xs font-bold tracking-wider">
                                            {project.class_name} - G{project.group_number}
                                        </span>
                                        {project.themes && (
                                            <span className="px-2.5 py-1 bg-amber-900/20 text-amber-600/80 border border-amber-900/30 rounded-md text-xs font-medium truncate max-w-[150px]">
                                                {project.themes.theme_name}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-200 group-hover:text-amber-400 transition-colors leading-snug line-clamp-2">
                                        {project.title}
                                    </h3>
                                    {project.assignment && (
                                        <div className="mt-3">{assignmentBadge(project.assignment)}</div>
                                    )}
                                </div>

                                {/* Recommendations */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Guide Teacher Recommendations
                                    </h4>

                                    {classifyingProjectIds.has(project.id) ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-6">
                                            <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-3"></div>
                                            <p className="text-sm text-slate-400 text-center">AI is classifying this project...</p>
                                            <p className="text-xs text-slate-600 mt-1 text-center">Matching project to teacher expertise</p>
                                        </div>
                                    ) : project.recommendations && project.recommendations.length > 0 ? (
                                        <div className="space-y-3 flex-1">
                                            {sortedRecs(project.recommendations).map((rec) => (
                                                <div key={rec.id} className="flex items-center justify-between p-3 rounded-xl bg-[#1a1811] border border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankColor(rec.rank_level)}`}>
                                                            {rec.relevance_percentage}%
                                                        </div>
                                                        <p className="font-medium text-slate-200">{rec.teacher_expertise}</p>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getRankColor(rec.rank_level)}`}>
                                                        {rec.rank_level}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center py-6 gap-3">
                                            <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin"></div>
                                            <div className="text-center">
                                                <p className="text-sm text-slate-400">Waiting for AI classification...</p>
                                                <p className="text-xs text-slate-600 mt-1">Auto-checks every 5 seconds</p>
                                            </div>
                                            <button
                                                onClick={() => handleClassifyProject(project.id)}
                                                disabled={classifyingProjectIds.has(project.id)}
                                                className="mt-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Wand2 className="w-3.5 h-3.5" />
                                                Run Now
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 bg-[#1a1811] border-t border-slate-800/50 flex gap-2">
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        disabled={!project.recommendations || project.recommendations.length === 0 || classifyingProjectIds.has(project.id)}
                                        className="flex-1 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Info className="w-4 h-4" />
                                        View Reasoning
                                    </button>
                                    <button
                                        onClick={() => handleClassifyProject(project.id)}
                                        disabled={classifyingProjectIds.has(project.id) || isClassifyingAll}
                                        className="py-2.5 px-3 rounded-xl bg-[#252318] text-slate-300 hover:bg-amber-900/30 hover:text-amber-400 border border-slate-700/50 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Re-run AI classification for this project"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                        Re-classify
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            ) : (
                /* ── LIST VIEW ── */
                <div className="bg-[#1c1b14] border border-amber-900/20 rounded-2xl overflow-hidden">
                    {/* List header */}
                    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_auto_auto] gap-3 px-4 py-2.5 bg-[#1a1811]/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-amber-700/70">
                        <span className="hidden sm:block">Class / Group</span>
                        <span>Project</span>
                        <span className="hidden sm:block">Subjects</span>
                        <span>Actions</span>
                    </div>

                    <AnimatePresence>
                        {displayedProjects.map((project, idx) => {
                            const isClassifying = classifyingProjectIds.has(project.id);
                            const hasRecs = project.recommendations && project.recommendations.length > 0;
                            const sorted = hasRecs ? sortedRecs(project.recommendations) : [];

                            return (
                                <motion.div
                                    key={project.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className={`grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_auto_auto] gap-3 items-center px-4 py-3 hover:bg-amber-900/10 transition-colors ${
                                        idx !== displayedProjects.length - 1 ? 'border-b border-slate-800/60' : ''
                                    }`}
                                >
                                    {/* Class / Group */}
                                    <div className="hidden sm:flex flex-col gap-1">
                                        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-xs font-bold w-fit">
                                            {project.class_name} - G{project.group_number}
                                        </span>
                                        {project.themes && (
                                            <span className="text-[10px] text-amber-700/80 truncate max-w-[130px]">
                                                {project.themes.theme_name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Title */}
                                    <div className="min-w-0">
                                        {/* on mobile, show class badge inline with title */}
                                        <div className="flex items-center gap-2 sm:hidden mb-0.5">
                                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[10px] font-bold flex-shrink-0">
                                                {project.class_name}-G{project.group_number}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2">{project.title}</p>
                                        {project.assignment && (
                                            <div className="mt-2">{assignmentBadge(project.assignment)}</div>
                                        )}
                                    </div>

                                    {/* Subject pills */}
                                    <div className="hidden sm:flex items-center gap-1.5 flex-wrap max-w-[240px]">
                                        {isClassifying ? (
                                            <span className="text-xs text-slate-500 italic flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full border border-amber-500/40 border-t-amber-400 animate-spin"></div>
                                                Classifying...
                                            </span>
                                        ) : hasRecs ? (
                                            sorted.map(rec => (
                                                <span
                                                    key={rec.id}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getRankColor(rec.rank_level)}`}
                                                    title={`${rec.rank_level} match — ${rec.relevance_percentage}%`}
                                                >
                                                    {rec.teacher_expertise}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-600 italic">Pending...</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button aria-label="View the AI reasoning for this project"
                                            onClick={() => setSelectedProject(project)}
                                            disabled={!hasRecs || isClassifying}
                                            className="p-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="View AI reasoning"
                                        >
                                            <Info className="w-4 h-4" />
                                        </button>
                                        <button aria-label="Re-run AI classification for this project"
                                            onClick={() => handleClassifyProject(project.id)}
                                            disabled={isClassifying || isClassifyingAll}
                                            className="p-2 rounded-lg bg-[#252318] text-slate-400 hover:bg-amber-900/30 hover:text-amber-400 border border-slate-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            title="Re-run AI classification"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* ── AI Reasoning Modal ── */}
            <AnimatePresence>
                {selectedProject && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedProject(null)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-[#1a1811] w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border border-amber-900/20 overflow-hidden flex flex-col pointer-events-auto"
                            >
                                <div className="p-5 border-b border-slate-800 flex justify-between items-start bg-[#1c1b14]">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                            <BrainCircuit className="w-5 h-5 text-amber-500" />
                                            AI Classification Reasoning
                                        </h3>
                                        <p className="text-sm text-slate-400 line-clamp-1">{selectedProject.title}</p>
                                    </div>
                                    <button aria-label="Close project details"
                                        onClick={() => setSelectedProject(null)}
                                        className="p-1.5 text-slate-400 hover:text-amber-400 bg-[#1a1811] hover:bg-amber-900/20 rounded-lg border border-slate-800 hover:border-amber-900/30 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-6">
                                    {sortedRecs(selectedProject.recommendations || []).map((rec) => (
                                        <div key={rec.id} className="bg-[#1c1b14] rounded-xl border border-slate-800 overflow-hidden">
                                            <div className={`px-4 py-3 border-b flex justify-between items-center ${
                                                rec.rank_level === 'High' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                rec.rank_level === 'Medium' ? 'bg-amber-500/10 border-amber-500/20' :
                                                'bg-slate-500/10 border-slate-700/50'
                                            }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-[#1a1811] border border-slate-800 rounded-full flex items-center justify-center font-bold text-slate-200 text-sm">
                                                        {rec.relevance_percentage}%
                                                    </div>
                                                    <h4 className="font-bold text-white">{rec.teacher_expertise}</h4>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${getRankColor(rec.rank_level)}`}>
                                                    {rec.rank_level} Match
                                                </span>
                                            </div>
                                            <div className="p-4">
                                                <p className="text-slate-300 text-sm leading-relaxed">{rec.reason}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 border-t border-slate-800 bg-[#1c1b14] flex justify-end">
                                    <button
                                        onClick={() => setSelectedProject(null)}
                                        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold rounded-xl transition-colors text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
