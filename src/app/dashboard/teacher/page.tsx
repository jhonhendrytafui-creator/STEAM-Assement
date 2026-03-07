'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    GraduationCap, LogOut, LayoutDashboard, BarChart2,
    ClipboardCheck, Users, FileText, CheckCircle2,
    X, AlertTriangle, LinkIcon, TrendingUp, BookOpen, Star
} from 'lucide-react';

const ACADEMIC_YEAR = '2025/2026';

// ─── Toast System ───────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastData { id: number; message: string; type: ToastType; }

const TOAST_STYLES = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};
const TOAST_ICONS = {
    success: CheckCircle2,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: FileText
};

function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[], onDismiss: (id: number) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
            {toasts.map(toast => {
                const Icon = TOAST_ICONS[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl animate-[slideIn_0.3s_ease-out] ${TOAST_STYLES[toast.type]}`}
                    >
                        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm flex-1 font-medium">{toast.message}</p>
                        <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Interfaces ─────────────────────────────────────
interface ProjectData {
    id: string;
    class_name: string;
    group_number: number;
    title: string;
    status: string;
    created_at: string;
    themes: {
        theme_name: string;
    } | null;
}

interface AssessmentCategory {
    id: string;
    code: string;
    name: string;
    rubric_type: string;
    sort_order: number;
}

interface RubricDimension {
    id: string;
    category_id: string;
    name: string;
    sort_order: number;
}

interface RubricIndicator {
    id: string;
    dimension_id: string;
    description: string;
    sort_order: number;
}

export default function TeacherDashboardPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<any>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Overview Stats
    const [totalGroups, setTotalGroups] = useState(0);
    const [totalProjects, setTotalProjects] = useState(0);
    const [recentProjects, setRecentProjects] = useState<ProjectData[]>([]);

    // Reference Data
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
    const [rubricDimensions, setRubricDimensions] = useState<RubricDimension[]>([]);
    const [rubricIndicators, setRubricIndicators] = useState<RubricIndicator[]>([]);

    // Score Tab State
    const [scoreGrade, setScoreGrade] = useState<string>('');
    const [scoreClass, setScoreClass] = useState<string>('');
    const [scoreCategory, setScoreCategory] = useState<string>('');
    const [classScores, setClassScores] = useState<any[]>([]);
    const [isFetchingScores, setIsFetchingScores] = useState(false);

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));
    const availableClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === scoreGrade).map(s => s.class_name))).sort();

    const fetchClassScores = async () => {
        if (!scoreClass || !scoreCategory) return;
        setIsFetchingScores(true);

        const groupsInClass = Array.from(new Set(allStudents.filter(s => s.class_name === scoreClass).map(s => s.group_number))).sort((a, b) => a - b);

        const { data: classProjects } = await supabase
            .from('projects')
            .select('group_number, title')
            .eq('class_name', scoreClass)
            .eq('academic_year', ACADEMIC_YEAR);

        const { data: scoresData } = await supabase
            .from('assessment_scores')
            .select('group_number, indicator_id, score, assessed_at, profiles(full_name)')
            .eq('class_name', scoreClass)
            .eq('category_id', scoreCategory)
            .eq('academic_year', ACADEMIC_YEAR);

        const cat = assessmentCategories.find(c => c.id === scoreCategory);
        const maxScale = parseInt(cat?.rubric_type.replace('scale_', '') || '1');
        const isChecklist = cat?.rubric_type === 'checklist';

        const dims = rubricDimensions.filter(d => d.category_id === scoreCategory);
        const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));
        const totalMax = isChecklist ? inds.length : inds.length * maxScale;

        const results = groupsInClass.map(groupNum => {
            const proj = classProjects?.find(p => p.group_number === groupNum);
            const groupScores = scoresData?.filter(s => s.group_number === groupNum) || [];

            const totalScore = groupScores.reduce((sum, s) => sum + s.score, 0);
            const assessedBy = groupScores.length > 0 ? (groupScores[0].profiles as any)?.full_name || 'Teacher' : null;
            const assessedAt = groupScores.length > 0 ? groupScores[0].assessed_at : null;

            return {
                group_number: groupNum,
                title: proj?.title || 'No Project Submitted',
                totalScore,
                totalMax,
                percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
                assessedBy,
                assessedAt,
                isAssessed: groupScores.length > 0
            };
        });

        setClassScores(results);
        setIsFetchingScores(false);
    };

    // Assess Tab State
    const [assessGrade, setAssessGrade] = useState<string>('');
    const [assessClass, setAssessClass] = useState<string>('');
    const [assessGroup, setAssessGroup] = useState<string>('');
    const [assessCategory, setAssessCategory] = useState<string>('');

    // Assess Form State
    const [assessProject, setAssessProject] = useState<any>(null);
    const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);

    const availableAssessClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === assessGrade).map(s => s.class_name))).sort();
    const availableAssessGroups = Array.from(new Set(allStudents.filter(s => s.class_name === assessClass).map(s => s.group_number))).sort((a, b) => a - b);

    useEffect(() => {
        const loadAssessData = async () => {
            if (!assessClass || !assessGroup || !assessCategory) {
                setAssessProject(null);
                setCurrentScores({});
                return;
            }

            // Load project
            const { data: proj } = await supabase
                .from('projects')
                .select('*')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('academic_year', ACADEMIC_YEAR)
                .single();
            setAssessProject(proj || null);

            // Load existing scores for this group + category
            const { data: scores } = await supabase
                .from('assessment_scores')
                .select('indicator_id, score')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('category_id', assessCategory)
                .eq('academic_year', ACADEMIC_YEAR);

            if (scores) {
                const scoreMap: Record<string, number> = {};
                scores.forEach(s => scoreMap[s.indicator_id] = s.score);
                setCurrentScores(scoreMap);
            }
        };
        loadAssessData();
    }, [assessClass, assessGroup, assessCategory, supabase]);

    const submitAssessment = async () => {
        if (!assessClass || !assessGroup || !assessCategory || !teacherProfile) return;
        setIsSubmittingScore(true);

        const groupNum = parseInt(assessGroup);

        await supabase
            .from('assessment_scores')
            .delete()
            .eq('class_name', assessClass)
            .eq('group_number', groupNum)
            .eq('category_id', assessCategory)
            .eq('academic_year', ACADEMIC_YEAR);

        const scoreEntries = Object.entries(currentScores).map(([indicatorId, score]) => ({
            class_name: assessClass,
            group_number: groupNum,
            academic_year: ACADEMIC_YEAR,
            category_id: assessCategory,
            indicator_id: indicatorId,
            score: score,
            assessor_id: teacherProfile.id,
        }));

        if (scoreEntries.length > 0) {
            const { error } = await supabase.from('assessment_scores').insert(scoreEntries);
            if (error) {
                showToast('Failed to save assessment: ' + error.message, 'error');
            } else {
                showToast('Assessment saved successfully!', 'success');
                if (assessProject && assessProject.status === 'pending') {
                    await supabase.from('projects')
                        .update({ status: 'assessed' })
                        .eq('id', assessProject.id);
                    setAssessProject({ ...assessProject, status: 'assessed' });
                }
            }
        } else {
            showToast('No scores provided. Please fill out the rubric.', 'warning');
        }
        setIsSubmittingScore(false);
    };

    // Toasts
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastIdRef = useRef(0);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);
    const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);



    useEffect(() => {
        const initData = async () => {
            setLoading(true);
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) {
                window.location.href = '/';
                return;
            }

            // Verify teacher role
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (!profile || profile.role !== 'teacher') {
                window.location.href = '/';
                return;
            }
            setTeacherProfile({ ...profile, email: authData.user.email });

            // Fetch Overview Data
            // 1. Get unique groups
            const { data: students } = await supabase
                .from('student_master')
                .select('class_name, group_number')
                .eq('academic_year', ACADEMIC_YEAR);

            if (students) {
                setAllStudents(students);
                const uniqueGroups = new Set(students.map(s => `${s.class_name}-${s.group_number}`));
                setTotalGroups(uniqueGroups.size);
            }

            // 1b. Fetch Assessment Maps
            const { data: cats } = await supabase.from('assessment_categories').select('*').order('sort_order');
            if (cats) setAssessmentCategories(cats);

            const { data: dims } = await supabase.from('rubric_dimensions').select('*').order('sort_order');
            if (dims) setRubricDimensions(dims);

            const { data: inds } = await supabase.from('rubric_indicators').select('*').order('sort_order');
            if (inds) setRubricIndicators(inds);

            // 2. Get submitted projects
            const { data: projects } = await supabase
                .from('projects')
                .select('id, class_name, group_number, title, status, created_at, themes(theme_name)')
                .eq('academic_year', ACADEMIC_YEAR)
                .order('created_at', { ascending: false });

            if (projects) {
                setTotalProjects(projects.length);
                setRecentProjects(projects as unknown as ProjectData[]);
            }

            setLoading(false);
        };

        initData();
    }, [supabase]);

    if (loading) return (
        <div className="min-h-screen bg-[#1c1b14] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm">Loading Teacher Portal...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] font-sans">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Navbar */}
            <nav className="bg-[#1a1811] border-b border-amber-900/40 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <GraduationCap className="text-amber-400 w-6 h-6" />
                    <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500">
                        PAHOA STEAM
                    </span>
                    <span className="ml-2 bg-amber-900/30 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/20 hidden sm:inline-block">
                        Teacher Portal
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400 hidden sm:block">{teacherProfile?.email}</div>
                    <button
                        onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-red-950/30"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-8">
                {/* Sidebar */}
                <aside
                    className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 sticky top-20 md:top-24 h-fit z-40 bg-[#1c1b14] pt-2 md:pt-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                    {[
                        { id: 'overview', label: 'Projects Overview', icon: LayoutDashboard },
                        { id: 'score', label: 'Student Score', icon: BarChart2 },
                        { id: 'assess', label: 'Project Assessment', icon: ClipboardCheck },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-shrink-0 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border whitespace-nowrap ${activeTab === tab.id
                                ? 'bg-[#292314] text-amber-500 border-amber-500/50 shadow-lg shadow-amber-900/10'
                                : 'bg-[#1a1811] text-slate-400 hover:bg-[#25221b] hover:text-amber-400 border-amber-900/20'
                                }`}
                        >
                            <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                            {tab.label}
                        </button>
                    ))}
                </aside>

                {/* Content Area */}
                <div className="flex-1 w-full min-w-0">

                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <LayoutDashboard className="text-amber-500" />
                                Projects Overview
                            </h2>

                            {/* Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-6 hover:border-amber-900/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-2 text-slate-400">
                                        <Users className="w-5 h-5 text-blue-400" />
                                        <span className="text-sm font-semibold">Total Groups</span>
                                    </div>
                                    <div className="text-3xl font-bold text-white">{totalGroups}</div>
                                </div>
                                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-6 hover:border-amber-900/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-2 text-slate-400">
                                        <BookOpen className="w-5 h-5 text-emerald-400" />
                                        <span className="text-sm font-semibold">Submitted Projects</span>
                                    </div>
                                    <div className="text-3xl font-bold text-white">{totalProjects}</div>
                                </div>
                                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-6 hover:border-amber-900/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-2 text-slate-400">
                                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                                        <span className="text-sm font-semibold">Not Yet Submitted</span>
                                    </div>
                                    <div className="text-3xl font-bold text-amber-400">{Math.max(0, totalGroups - totalProjects)}</div>
                                </div>
                            </div>

                            {/* Recent Projects Table */}
                            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl shadow-xl overflow-hidden mt-8">
                                <div className="p-6 border-b border-slate-800/50">
                                    <h3 className="text-lg font-bold text-white">Recent Submissions</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#1c1b14] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                <th className="p-4 font-semibold">Group</th>
                                                <th className="p-4 font-semibold">Project Title</th>
                                                <th className="p-4 font-semibold">Theme</th>
                                                <th className="p-4 font-semibold">Date</th>
                                                <th className="p-4 font-semibold">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/30 text-sm">
                                            {recentProjects.length > 0 ? (
                                                recentProjects.map((proj) => (
                                                    <tr key={proj.id} className="hover:bg-[#1c1b14]/50 transition-colors">
                                                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium whitespace-nowrap">
                                                            {proj.class_name} - {proj.group_number}
                                                        </td>
                                                        <td className="p-4 font-medium text-slate-200">
                                                            {proj.title}
                                                        </td>
                                                        <td className="p-4 text-slate-400 whitespace-nowrap">
                                                            {proj.themes?.theme_name || '-'}
                                                        </td>
                                                        <td className="p-4 text-slate-400 whitespace-nowrap">
                                                            {new Date(proj.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4 whitespace-nowrap">
                                                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${proj.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                proj.status === 'revision' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                                }`}>
                                                                {proj.status || 'pending'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                                        No projects submitted yet.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: SCORE */}
                    {activeTab === 'score' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <BarChart2 className="text-amber-500" />
                                Student Score
                            </h2>

                            {/* Score Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                    <select
                                        value={scoreGrade}
                                        onChange={(e) => { setScoreGrade(e.target.value); setScoreClass(''); setClassScores([]); }}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="">Select Grade</option>
                                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class</label>
                                    <select
                                        value={scoreClass}
                                        onChange={(e) => { setScoreClass(e.target.value); setClassScores([]); }}
                                        disabled={!scoreGrade}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    >
                                        <option value="">Select Class</option>
                                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessment</label>
                                    <select
                                        value={scoreCategory}
                                        onChange={(e) => { setScoreCategory(e.target.value); setClassScores([]); }}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="">Select Assessment</option>
                                        {assessmentCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={fetchClassScores}
                                        disabled={!scoreClass || !scoreCategory || isFetchingScores}
                                        className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                    >
                                        {isFetchingScores ? 'Loading...' : 'Search Scores'}
                                    </button>
                                </div>
                            </div>

                            {/* Scores Table */}
                            {classScores.length > 0 && (
                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                    <th className="p-4 font-semibold text-center w-20">Group</th>
                                                    <th className="p-4 font-semibold">Project Title</th>
                                                    <th className="p-4 font-semibold text-center">Score</th>
                                                    <th className="p-4 font-semibold">Assessment Details</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                {classScores.map((score) => (
                                                    <tr key={score.group_number} className="hover:bg-[#1a1811] transition-colors">
                                                        <td className="p-4 text-center">
                                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 font-bold text-xs mx-auto">
                                                                {score.group_number}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-medium text-slate-200">
                                                            {score.title}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {score.isAssessed ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className={`text-lg font-bold ${score.percentage >= 80 ? 'text-emerald-400' : score.percentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                        {score.percentage}%
                                                                    </span>
                                                                    <span className="text-xs text-slate-500 block">{score.totalScore}/{score.totalMax}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md">Not Assessed</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            {score.isAssessed ? (
                                                                <div className="text-xs text-slate-400">
                                                                    <p className="mb-0.5"><span className="text-slate-500">By:</span> {score.assessedBy}</p>
                                                                    <p><span className="text-slate-500">Date:</span> {new Date(score.assessedAt).toLocaleDateString()}</p>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-600">—</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}

                    {/* TAB 3: ASSESS */}
                    {activeTab === 'assess' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <ClipboardCheck className="text-amber-500" />
                                Project Assessment
                            </h2>

                            {/* Selection Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                    <select
                                        value={assessGrade}
                                        onChange={(e) => { setAssessGrade(e.target.value); setAssessClass(''); setAssessGroup(''); }}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="">Select Grade</option>
                                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class</label>
                                    <select
                                        value={assessClass}
                                        onChange={(e) => { setAssessClass(e.target.value); setAssessGroup(''); }}
                                        disabled={!assessGrade}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    >
                                        <option value="">Select Class</option>
                                        {availableAssessClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Group</label>
                                    <select
                                        value={assessGroup}
                                        onChange={(e) => setAssessGroup(e.target.value)}
                                        disabled={!assessClass}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    >
                                        <option value="">Select Group</option>
                                        {availableAssessGroups.map(g => <option key={g} value={g}>Group {g}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessment</label>
                                    <select
                                        value={assessCategory}
                                        onChange={(e) => setAssessCategory(e.target.value)}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                    >
                                        <option value="">Select Assessment</option>
                                        {assessmentCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Evaluation Area */}
                            {assessClass && assessGroup && assessCategory ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Left sidebar: Project Overview */}
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5 sticky top-24">
                                            <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">Project Info</h3>

                                            {assessProject ? (
                                                <div className="space-y-4">
                                                    <div>
                                                        <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Title</span>
                                                        <p className="text-sm font-medium text-slate-200 leading-snug">{assessProject.title}</p>
                                                    </div>

                                                    {assessProject.abstract && (() => {
                                                        let absData: any = {};
                                                        try { absData = JSON.parse(assessProject.abstract); } catch (e) { }
                                                        return (
                                                            <>
                                                                <div>
                                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Problem</span>
                                                                    <p className="text-sm text-slate-300 bg-[#1a1811] p-3 rounded-lg border border-slate-800/50 italic leading-relaxed">
                                                                        "{absData.problem || 'No description.'}"
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Solution</span>
                                                                    <p className="text-sm text-slate-300 bg-[#1a1811] p-3 rounded-lg border border-slate-800/50 italic leading-relaxed">
                                                                        "{absData.solution || 'No description.'}"
                                                                    </p>
                                                                </div>
                                                            </>
                                                        )
                                                    })()}

                                                    {assessProject.google_doc_url && (
                                                        <a href={assessProject.google_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-4 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold mt-4">
                                                            <LinkIcon className="w-4 h-4" />
                                                            Open Google Doc
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">No project submitted by this group yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Content: Interactive Rubric */}
                                    <div className="lg:col-span-2 space-y-6">
                                        {(() => {
                                            const cat = assessmentCategories.find(c => c.id === assessCategory);
                                            const dims = rubricDimensions.filter(d => d.category_id === assessCategory);

                                            if (dims.length === 0) {
                                                return (
                                                    <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-8 text-center text-amber-400">
                                                        <FileText className="w-8 h-8 mx-auto mb-3 opacity-80" />
                                                        <p>No rubric dimensions defined for this assessment.</p>
                                                    </div>
                                                );
                                            }

                                            const isChecklist = cat?.rubric_type === 'checklist';
                                            const maxScale = parseInt(cat?.rubric_type.replace('scale_', '') || '1');

                                            return (
                                                <div className="space-y-6">
                                                    {dims.map(dim => {
                                                        const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                                        return (
                                                            <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                                                                <div className="bg-[#1a1811] border-b border-slate-800 px-5 py-3">
                                                                    <h3 className="font-bold text-slate-200">{dim.name}</h3>
                                                                </div>
                                                                <div className="divide-y divide-slate-800/50">
                                                                    {inds.map(ind => (
                                                                        <div key={ind.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1a1811]/50 transition-colors">
                                                                            <p className="text-sm text-slate-400 flex-1">{ind.description}</p>
                                                                            <div className="shrink-0 flex items-center justify-end">
                                                                                {isChecklist ? (
                                                                                    // Checklist Toggle
                                                                                    <button
                                                                                        onClick={() => setCurrentScores(prev => ({ ...prev, [ind.id]: prev[ind.id] === 1 ? 0 : 1 }))}
                                                                                        className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${currentScores[ind.id] === 1 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#1a1811] border-slate-700 text-slate-600 hover:border-slate-500'}`}
                                                                                    >
                                                                                        {currentScores[ind.id] === 1 ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                                                    </button>
                                                                                ) : (
                                                                                    // Scale Selector
                                                                                    <div className="flex gap-1.5 p-1.5 bg-[#1a1811] border border-slate-800 rounded-lg">
                                                                                        {Array.from({ length: maxScale }).map((_, i) => {
                                                                                            const val = i + 1;
                                                                                            const isSelected = currentScores[ind.id] === val;
                                                                                            return (
                                                                                                <button
                                                                                                    key={val}
                                                                                                    onClick={() => setCurrentScores(prev => ({ ...prev, [ind.id]: val }))}
                                                                                                    className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm transition-all ${isSelected ? 'bg-amber-500 text-[#1a1811] shadow-lg shadow-amber-500/20 translate-y-[-2px]' : 'bg-[#1c1b14] text-slate-500 hover:text-amber-400 hover:bg-[#25221b]'}`}
                                                                                                >
                                                                                                    {val}
                                                                                                </button>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}

                                                    {/* Submit Button */}
                                                    <div className="flex justify-end pt-4">
                                                        <button
                                                            onClick={submitAssessment}
                                                            disabled={isSubmittingScore}
                                                            className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-[#1a1811] px-8 py-3.5 rounded-xl font-bold hover:from-amber-500 hover:to-amber-400 transition-all shadow-xl shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isSubmittingScore ? 'Saving Scores...' : 'Save Assessment'}
                                                            {!isSubmittingScore && <CheckCircle2 className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-[#1a1811]/50 border border-slate-800/50 rounded-2xl">
                                    <ClipboardCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-300 mb-2">Select a Target</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto">Please choose grading parameters (Grade, Class, Group, and Assessment) to load the rubric evaluator.</p>
                                </div>
                            )}

                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
