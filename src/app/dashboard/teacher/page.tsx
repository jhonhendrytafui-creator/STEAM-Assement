'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    GraduationCap, LogOut, LayoutDashboard, BarChart2,
    ClipboardCheck, Users, FileText, CheckCircle2,
    X, AlertTriangle, LinkIcon, TrendingUp, BookOpen, Star, FolderOpen, History, Sparkles
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
    const [scoreCategories, setScoreCategories] = useState<string[]>([]);
    const [classScores, setClassScores] = useState<any[]>([]);
    const [isFetchingScores, setIsFetchingScores] = useState(false);
    const [scoreGrouping, setScoreGrouping] = useState<'group' | 'alphabetical'>('group');

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));
    const availableClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === scoreGrade).map(s => s.class_name))).sort();

    const fetchClassScores = async () => {
        if (!scoreClass || scoreCategories.length === 0) return;
        setIsFetchingScores(true);

        const studentsInClass = allStudents.filter(s => s.class_name === scoreClass).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        const { data: classProjects } = await supabase
            .from('projects')
            .select('group_number, title')
            .eq('class_name', scoreClass)
            .eq('academic_year', ACADEMIC_YEAR);

        const { data: scoresData } = await supabase
            .from('assessment_scores')
            .select('*')
            .eq('class_name', scoreClass)
            .in('category_id', scoreCategories)
            .eq('academic_year', ACADEMIC_YEAR);

        const results = studentsInClass.map(student => {
            const proj = classProjects?.find(p => p.group_number === student.group_number);

            const studentAssessments: Record<string, any> = {};

            scoreCategories.forEach(catId => {
                const cat = assessmentCategories.find(c => c.id === catId);
                const dims = rubricDimensions.filter(d => d.category_id === catId);
                const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));

                const maxScale = parseInt(cat?.rubric_type.replace('scale_', '') || '1');
                const isChecklist = cat?.rubric_type === 'checklist';
                const totalMax = isChecklist ? inds.length : inds.length * maxScale;

                const groupCatScores = scoresData?.filter(s => s.group_number === student.group_number && s.category_id === catId) || [];
                const totalScore = groupCatScores.reduce((sum, s) => sum + s.score, 0);

                studentAssessments[catId] = {
                    totalScore,
                    totalMax,
                    percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
                    isAssessed: groupCatScores.length > 0
                };
            });

            return {
                student_name: student.full_name,
                group_number: student.group_number,
                project_title: proj?.title || 'No Project Submitted',
                assessments: studentAssessments
            };
        });

        // Sorting
        if (scoreGrouping === 'group') {
            results.sort((a, b) => a.group_number - b.group_number || (a.student_name || '').localeCompare(b.student_name || ''));
        }

        setClassScores(results);
        setIsFetchingScores(false);
    };

    const downloadScoresCSV = () => {
        if (classScores.length === 0) return;

        const headers = ['Student Name', 'Group', 'Project Title'];
        scoreCategories.forEach(catId => {
            const cat = assessmentCategories.find(c => c.id === catId);
            if (cat) headers.push(cat.name);
        });

        const csvRows = [headers.join(',')];

        classScores.forEach(row => {
            const rowData = [
                `"${row.student_name}"`,
                row.group_number,
                `"${row.project_title.replace(/"/g, '""')}"`
            ];

            scoreCategories.forEach(catId => {
                const assessment = row.assessments[catId];
                if (assessment.isAssessed) {
                    rowData.push(`${assessment.totalScore}/${assessment.totalMax} (${assessment.percentage}%)`);
                } else {
                    rowData.push('-');
                }
            });

            csvRows.push(rowData.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Steam_Scores_${scoreClass}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Submissions Tab State
    const [submissionGrade, setSubmissionGrade] = useState<string>('');
    const [gradeSubmissionsList, setGradeSubmissionsList] = useState<any[]>([]);
    const [selectedGroupForSubmission, setSelectedGroupForSubmission] = useState<{ class_name: string, group_number: number } | null>(null);
    const [groupSubmissions, setGroupSubmissions] = useState<any[]>([]);
    const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);
    const [isFetchingSubmissions, setIsFetchingSubmissions] = useState(false);

    const fetchGradeSubmissionsList = async () => {
        if (!submissionGrade) return;
        setIsFetchingSubmissions(true);
        setSelectedGroupForSubmission(null);
        setGroupSubmissions([]);

        // Get all groups for this grade
        const groupsInGrade = allStudents.filter(s => String(s.class_name).split('.')[0] === submissionGrade);
        const uniqueGroups = new Map();
        groupsInGrade.forEach(s => {
            uniqueGroups.set(`${s.class_name}-${s.group_number}`, { class_name: s.class_name, group_number: s.group_number });
        });

        // Get all submitted projects
        const { data: projs } = await supabase
            .from('projects')
            .select(`*, themes(theme_name)`)
            .eq('academic_year', ACADEMIC_YEAR)
            .ilike('class_name', `${submissionGrade}.%`)
            .order('iteration', { ascending: false });

        const listView: any[] = [];
        uniqueGroups.forEach((group) => {
            const groupProjs = projs?.filter(p => p.class_name === group.class_name && p.group_number === group.group_number) || [];
            if (groupProjs.length > 0) {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    latestStatus: groupProjs[0].status,
                    latestTitle: groupProjs[0].title,
                    iterationsCount: groupProjs.length,
                    latestProject: groupProjs[0],
                    allProjects: groupProjs
                });
            } else {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    latestStatus: 'not submitted yet',
                    latestTitle: '-',
                    iterationsCount: 0,
                    latestProject: null,
                    allProjects: []
                });
            }
        });

        setGradeSubmissionsList(listView.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number));
        setIsFetchingSubmissions(false);
    };

    const handleSelectSubmissionGroup = (group: any) => {
        setSelectedGroupForSubmission({ class_name: group.class_name, group_number: group.group_number });
        setGroupSubmissions(group.allProjects);
        setCurrentSubmissionIndex(0);
    };

    // Assess Tab State
    const [assessGrade, setAssessGrade] = useState<string>('');
    const [assessClass, setAssessClass] = useState<string>('');
    const [assessGroup, setAssessGroup] = useState<string>('');
    const [assessCategory, setAssessCategory] = useState<string>('');

    // Assess Form State
    const [assessProject, setAssessProject] = useState<any>(null);
    const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
    const [assessStatus, setAssessStatus] = useState<string>('');
    const [assessComment, setAssessComment] = useState<string>('');
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [isAutoAssessing, setIsAutoAssessing] = useState(false);

    const handleAutoAssess = async () => {
        if (!assessProject || !assessCategory) return;
        setIsAutoAssessing(true);
        showToast('Gemini AI is analyzing the project...', 'info');

        try {
            const cat = assessmentCategories.find(c => c.id === assessCategory);
            const dims = rubricDimensions.filter(d => d.category_id === assessCategory);
            const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));

            const response = await fetch('/api/ai-assess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project: assessProject,
                    categoryName: cat?.name || 'Unknown Category',
                    indicators: inds.map(i => ({ id: i.id, description: i.description }))
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to auto-assess');
            }

            if (data.scores) setCurrentScores(data.scores);
            if (data.teacher_comment) setAssessComment(data.teacher_comment);
            if (data.suggested_status) setAssessStatus(data.suggested_status);

            showToast('AI Assessment complete! Please review.', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsAutoAssessing(false);
        }
    };

    const availableAssessClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === assessGrade).map(s => s.class_name))).sort();
    const availableAssessGroups = Array.from(new Set(allStudents.filter(s => s.class_name === assessClass).map(s => s.group_number))).sort((a, b) => a - b);

    useEffect(() => {
        const loadAssessData = async () => {
            if (!assessClass || !assessGroup || !assessCategory) {
                setAssessProject(null);
                setCurrentScores({});
                return;
            }

            // Load project (get latest iteration)
            const { data: projs } = await supabase
                .from('projects')
                .select('*')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('academic_year', ACADEMIC_YEAR)
                .order('iteration', { ascending: false })
                .limit(1);
            const proj = projs && projs.length > 0 ? projs[0] : null;
            setAssessProject(proj);
            setAssessStatus(proj?.status !== 'pending' ? proj?.status : '');
            setAssessComment(proj?.teacher_comment || '');

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
        if (!assessStatus) {
            showToast('Please select an approval status before saving.', 'warning');
            return;
        }
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
            teacher_comment: assessComment || null
        }));

        if (scoreEntries.length > 0) {
            const { error } = await supabase.from('assessment_scores').insert(scoreEntries);
            if (error) {
                showToast('Failed to save assessment: ' + error.message, 'error');
            } else {
                showToast('Assessment saved successfully!', 'success');
                if (assessProject) {
                    await supabase.from('projects')
                        .update({
                            status: assessStatus,
                            teacher_comment: assessComment
                        })
                        .eq('id', assessProject.id);
                    setAssessProject({ ...assessProject, status: assessStatus, teacher_comment: assessComment });
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
            // 1. Get unique groups and all student profiles
            const { data: students } = await supabase
                .from('student_master')
                .select('full_name, class_name, group_number')
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

            <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8">
                {/* Sidebar */}
                <aside
                    className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 sticky top-20 md:top-24 h-fit z-40 bg-[#1c1b14] pt-2 md:pt-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                    {[
                        { id: 'overview', label: 'Projects Overview', icon: LayoutDashboard },
                        { id: 'submissions', label: 'Project Submissions', icon: FolderOpen },
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

                    {/* TAB 1.5: SUBMISSIONS */}
                    {activeTab === 'submissions' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <FolderOpen className="text-amber-500" />
                                Project Submissions & History
                            </h2>

                            {/* Submissions Filters */}
                            {!selectedGroupForSubmission ? (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                            <select
                                                value={submissionGrade}
                                                onChange={(e) => { setSubmissionGrade(e.target.value); setGradeSubmissionsList([]); }}
                                                className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                            >
                                                <option value="">Select Grade</option>
                                                {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex items-end sm:w-48 shrink-0">
                                            <button
                                                onClick={fetchGradeSubmissionsList}
                                                disabled={!submissionGrade || isFetchingSubmissions}
                                                className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                            >
                                                {isFetchingSubmissions ? 'Loading...' : 'Search Grade'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Groups Grid */}
                                    {gradeSubmissionsList.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {gradeSubmissionsList.map((group, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleSelectSubmissionGroup(group)}
                                                    className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-900/10 group"
                                                >
                                                    <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-3">
                                                        <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                                            {group.class_name} - Group {group.group_number}
                                                        </h3>
                                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${group.latestStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                            group.latestStatus === 'revision' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                group.latestStatus === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                                    'bg-slate-800/50 text-slate-400 border-slate-700'
                                                            }`}>
                                                            {group.latestStatus}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-medium text-slate-300 line-clamp-2 mb-3 h-10">
                                                        {group.latestTitle}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <History className="w-3.5 h-3.5" />
                                                        {group.iterationsCount} Iteration{group.iterationsCount !== 1 ? 's' : ''} Found
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        submissionGrade && !isFetchingSubmissions && (
                                            <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                                <AlertTriangle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                                <p className="text-sm text-slate-400">Click Search to load groups for Grade {submissionGrade}.</p>
                                            </div>
                                        )
                                    )}
                                </>
                            ) : (
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button
                                            onClick={() => setSelectedGroupForSubmission(null)}
                                            className="px-4 py-2 bg-[#1c1b14] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center gap-2"
                                        >
                                            &larr; Back to List
                                        </button>
                                        <h3 className="text-lg font-bold text-amber-400">
                                            {selectedGroupForSubmission.class_name} - Group {selectedGroupForSubmission.group_number} Timeline
                                        </h3>
                                    </div>

                                    <div className="flex flex-col xl:flex-row gap-8">
                                        {/* Main Timeline */}
                                        <div className="flex-1">
                                            {groupSubmissions.length > 0 ? (
                                                <div className="space-y-6">
                                                    {(() => {
                                                        const sub = groupSubmissions[currentSubmissionIndex];
                                                        let absData: any = {};
                                                        try { absData = JSON.parse(sub.abstract); } catch (e) { }

                                                        return (
                                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
                                                                {/* Pagination Headers */}
                                                                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4 mb-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                                            <History className="w-5 h-5" />
                                                                        </div>
                                                                        <div>
                                                                            <h3 className="text-lg font-bold text-slate-200">Iteration {sub.iteration || 1}</h3>
                                                                            <p className="text-sm text-slate-500">{new Date(sub.created_at).toLocaleString()}</p>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : sub.status === 'revision' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : sub.status === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                                                        {sub.status || 'pending'}
                                                                    </span>
                                                                </div>

                                                                {/* Project Data */}
                                                                <div className="space-y-6">
                                                                    <div>
                                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Project Title</span>
                                                                        <h4 className="text-xl font-bold text-white">{sub.title}</h4>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Problem</span>
                                                                            <p className="text-sm text-slate-300 leading-relaxed italic">{absData.problem || 'No description provided.'}</p>
                                                                        </div>
                                                                        <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Solution</span>
                                                                            <p className="text-sm text-slate-300 leading-relaxed italic">{absData.solution || 'No description provided.'}</p>
                                                                        </div>
                                                                    </div>

                                                                    {absData.keyConcepts && absData.keyConcepts.length > 0 && (
                                                                        <div>
                                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Subject Key Concepts</span>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                {absData.keyConcepts.map((item: any, idx: number) => (
                                                                                    <div key={idx} className="bg-[#1a1811] border border-slate-800/50 p-3 rounded-lg flex flex-col gap-1.5">
                                                                                        <span className="inline-block self-start bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{item.subject}</span>
                                                                                        <span className="text-sm text-slate-300">{item.concept || 'No concept provided'}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {sub.google_doc_url && (
                                                                        <div className="pt-2">
                                                                            <a href={sub.google_doc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-5 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold">
                                                                                <LinkIcon className="w-4 h-4" />
                                                                                Open Project Document
                                                                            </a>
                                                                        </div>
                                                                    )}

                                                                    {sub.teacher_comment && (
                                                                        <div className="mt-6 bg-[#1a1811] border border-amber-900/30 p-4 rounded-xl">
                                                                            <span className="text-xs uppercase text-amber-500/70 font-bold block mb-2">Teacher Feedback from this iteration</span>
                                                                            <p className="text-sm text-amber-100">{sub.teacher_comment}</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Pagination Controls */}
                                                                {groupSubmissions.length > 1 && (
                                                                    <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                                        <button
                                                                            onClick={() => setCurrentSubmissionIndex(prev => prev + 1)}
                                                                            disabled={currentSubmissionIndex === groupSubmissions.length - 1}
                                                                            className="w-full sm:w-auto px-4 py-2 bg-[#1a1811] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                                        >
                                                                            &larr; Older Iteration
                                                                        </button>

                                                                        <div className="flex gap-1.5 flex-wrap justify-center">
                                                                            {groupSubmissions.map((_, idx) => (
                                                                                <button
                                                                                    key={idx}
                                                                                    onClick={() => setCurrentSubmissionIndex(idx)}
                                                                                    className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${currentSubmissionIndex === idx
                                                                                        ? 'bg-amber-500 w-5 sm:w-6'
                                                                                        : 'bg-slate-700 hover:bg-slate-500'
                                                                                        }`}
                                                                                    aria-label={`Go to iteration ${groupSubmissions.length - idx}`}
                                                                                />
                                                                            ))}
                                                                        </div>

                                                                        <button
                                                                            onClick={() => setCurrentSubmissionIndex(prev => prev - 1)}
                                                                            disabled={currentSubmissionIndex === 0}
                                                                            className="w-full sm:w-auto px-4 py-2 bg-[#1a1811] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                                        >
                                                                            Newer Iteration &rarr;
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                                    <AlertTriangle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">No project submissions found for this group.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Navigation Sidebar */}
                                        <div className="w-full xl:w-64 shrink-0">
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                                <p className="text-sm font-bold text-white mb-4">Class {selectedGroupForSubmission.class_name}</p>
                                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                                    {gradeSubmissionsList.filter(g => g.class_name === selectedGroupForSubmission.class_name).map(g => (
                                                        <button
                                                            key={g.group_number}
                                                            onClick={() => handleSelectSubmissionGroup(g)}
                                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between ${selectedGroupForSubmission.group_number === g.group_number
                                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                                : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                                }`}
                                                        >
                                                            <span>Group {g.group_number}</span>
                                                            {g.latestStatus === 'not submitted yet' && <span className="w-2 h-2 rounded-full bg-slate-700 block"></span>}
                                                            {g.latestStatus === 'approved' && <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>}
                                                            {g.latestStatus === 'revision' && <span className="w-2 h-2 rounded-full bg-amber-500 block"></span>}
                                                            {g.latestStatus === 'disapproved' && <span className="w-2 h-2 rounded-full bg-red-500 block"></span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                <div className="space-y-4 lg:col-span-2">
                                    <div className="grid grid-cols-2 gap-4">
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
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grouping Options</label>
                                        <div className="flex bg-[#1a1811] border border-slate-800 rounded-lg overflow-hidden">
                                            <button
                                                onClick={() => { setScoreGrouping('group'); setClassScores([]); }}
                                                className={`flex-1 py-2 text-xs font-bold transition-colors ${scoreGrouping === 'group' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                By Group
                                            </button>
                                            <button
                                                onClick={() => { setScoreGrouping('alphabetical'); setClassScores([]); }}
                                                className={`flex-1 py-2 text-xs font-bold transition-colors ${scoreGrouping === 'alphabetical' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                A-Z Alphabetical
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="lg:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessments (Multi-Select)</label>
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-lg p-3 custom-scrollbar overflow-y-auto max-h-48">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {assessmentCategories.map(c => {
                                                const isSelected = scoreCategories.includes(c.id);
                                                return (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setScoreCategories(prev => prev.filter(id => id !== c.id));
                                                            } else {
                                                                setScoreCategories(prev => [...prev, c.id]);
                                                            }
                                                            setClassScores([]);
                                                        }}
                                                        className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-center h-full ${isSelected
                                                            ? 'bg-amber-500 text-[#1a1811] border-amber-500 shadow-md'
                                                            : 'bg-[#1c1b14] border-slate-700 hover:border-amber-500/50'
                                                            }`}
                                                    >
                                                        <span className={`text-xs font-extrabold ${isSelected ? 'text-[#1a1811]' : 'text-slate-300'}`}>{c.code}</span>
                                                        <span className={`text-[10px] leading-tight mt-0.5 line-clamp-2 ${isSelected ? 'text-amber-950' : 'text-slate-500'}`}>{c.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {assessmentCategories.length === 0 && <span className="text-sm text-slate-500 italic">No assessments available.</span>}
                                    </div>
                                </div>

                                <div className="flex flex-col justify-end gap-3 lg:col-span-1">
                                    <button
                                        onClick={fetchClassScores}
                                        disabled={!scoreClass || scoreCategories.length === 0 || isFetchingScores}
                                        className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm h-[42px] flex items-center justify-center gap-2"
                                    >
                                        {isFetchingScores ? 'Loading...' : 'Search Scores'}
                                    </button>

                                    <button
                                        onClick={downloadScoresCSV}
                                        disabled={classScores.length === 0}
                                        className="w-full bg-[#1a1811] border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm h-[42px] flex items-center justify-center gap-2"
                                    >
                                        Download CSV
                                    </button>
                                </div>
                            </div>

                            {/* Scores Table */}
                            {classScores.length > 0 && (
                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse min-w-max">
                                            <thead>
                                                <tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                    <th className="p-4 font-semibold w-64 bg-[#1a1811] sticky left-0 z-10 border-r border-slate-800/50">Student Name</th>
                                                    <th className="p-4 font-semibold text-center w-20">Group</th>
                                                    <th className="p-4 font-semibold w-64">Project Title</th>
                                                    {scoreCategories.map(catId => {
                                                        const cat = assessmentCategories.find(c => c.id === catId);
                                                        return <th key={catId} className="p-4 font-semibold text-center">{cat?.code || 'Score'}</th>;
                                                    })}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                {classScores.map((score, idx) => (
                                                    <tr key={idx} className="hover:bg-[#1a1811]/50 transition-colors group">
                                                        <td className="p-4 font-bold text-slate-200 bg-[#1c1b14] group-hover:bg-[#1a1811] sticky left-0 z-10 border-r border-slate-800/50">
                                                            {score.student_name}
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            <div className="w-7 h-7 rounded-sm bg-slate-800/80 flex items-center justify-center text-amber-400 font-bold text-xs mx-auto border border-slate-700">
                                                                {score.group_number}
                                                            </div>
                                                        </td>
                                                        <td className="p-4 font-medium text-slate-400">
                                                            <span className="line-clamp-2">{score.project_title}</span>
                                                        </td>

                                                        {scoreCategories.map(catId => {
                                                            const assessment = score.assessments[catId];
                                                            return (
                                                                <td key={catId} className="p-4 text-center">
                                                                    {assessment.isAssessed ? (
                                                                        <div className="flex flex-col items-center">
                                                                            <span className={`text-sm font-bold ${assessment.percentage >= 80 ? 'text-emerald-400' : assessment.percentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                                {assessment.percentage}%
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-500 font-medium block">{assessment.totalScore}/{assessment.totalMax}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-slate-600">—</span>
                                                                    )}
                                                                </td>
                                                            );
                                                        })}
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
                                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                    {/* Left sidebar: Project Overview */}
                                    <div className="xl:col-span-4 space-y-6">
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
                                                            <div className="space-y-4">
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
                                                                {absData.keyConcepts && absData.keyConcepts.length > 0 && (
                                                                    <div>
                                                                        <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Subject Key Concepts</span>
                                                                        <div className="space-y-2">
                                                                            {absData.keyConcepts.map((item: any, idx: number) => {
                                                                                return (
                                                                                    <div key={idx} className="bg-[#1a1811] border border-slate-800/50 p-2.5 rounded-lg flex flex-col sm:flex-row sm:items-start gap-2">
                                                                                        <span className="inline-block bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{item.subject}</span>
                                                                                        <span className="text-sm text-slate-300 flex-1 leading-snug">{item.concept || 'No concept provided'}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
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

                                    {/* Center Content: Interactive Rubric */}
                                    <div className="xl:col-span-6 space-y-6">
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

                                                    {/* Approval Status & Comments */}
                                                    <div className="bg-[#1c1b14] border border-amber-900/50 rounded-xl p-6 shadow-lg mt-8">
                                                        <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">Final Decision & Feedback</h3>
                                                        <div className="space-y-5">
                                                            <div>
                                                                <label className="block text-sm font-semibold text-slate-300 mb-3">Project Status</label>
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                    {[
                                                                        { val: 'approved', label: 'Approved', color: 'emerald' },
                                                                        { val: 'revision', label: 'Needs Revision', color: 'amber' },
                                                                        { val: 'disapproved', label: 'Disapproved', color: 'red' }
                                                                    ].map(st => (
                                                                        <button
                                                                            key={st.val}
                                                                            onClick={() => setAssessStatus(st.val)}
                                                                            className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${assessStatus === st.val
                                                                                ? (st.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : st.color === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-red-500/20 border-red-500 text-red-400')
                                                                                : 'bg-[#1a1811] border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                                                                                }`}
                                                                        >
                                                                            {assessStatus === st.val && <CheckCircle2 className="w-4 h-4" />}
                                                                            {st.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-semibold text-slate-300 mb-2">Teacher Comment / Feedback</label>
                                                                <textarea
                                                                    value={assessComment}
                                                                    onChange={e => setAssessComment(e.target.value)}
                                                                    rows={3}
                                                                    placeholder="Leave constructive feedback for the group..."
                                                                    className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Submit Button */}
                                                    <div className="flex justify-end gap-3 pt-4">
                                                        <button
                                                            onClick={handleAutoAssess}
                                                            disabled={isAutoAssessing || isSubmittingScore}
                                                            className="flex items-center gap-2 bg-[#1c1b2e] border border-indigo-500/30 text-indigo-400 px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-900/40 hover:text-indigo-300 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isAutoAssessing ? 'AI is Thinking...' : 'Auto-Assess with Gemini'}
                                                            {!isAutoAssessing && <Sparkles className="w-5 h-5" />}
                                                        </button>
                                                        <button
                                                            onClick={submitAssessment}
                                                            disabled={isSubmittingScore || isAutoAssessing}
                                                            className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-[#1a1811] px-8 py-3.5 rounded-xl font-bold hover:from-amber-500 hover:to-amber-400 transition-all shadow-xl shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            {isSubmittingScore ? 'Saving Assessment...' : 'Save Assessment'}
                                                            {!isSubmittingScore && <CheckCircle2 className="w-5 h-5" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Right Content: Quick Navigation Sidebar */}
                                    <div className="xl:col-span-2 space-y-6">
                                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                            <p className="text-sm font-bold text-white mb-4">Class {assessClass}</p>
                                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                                {availableAssessGroups.map(g => (
                                                    <button
                                                        key={g}
                                                        onClick={() => setAssessGroup(g.toString())}
                                                        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold ${assessGroup === g.toString()
                                                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                            : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                            }`}
                                                    >
                                                        Group {g}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
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
