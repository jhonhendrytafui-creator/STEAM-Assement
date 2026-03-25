'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    Star, LogOut, Database, PenSquare, FileCheck,
    Plus, Trash2, Link as LinkIcon, Calculator,
    FlaskConical, Paintbrush, Globe, Cpu, Wrench, BookOpen, Calendar, Save, X, Users,
    TrendingUp, Award, ChevronDown, CheckCircle2, AlertTriangle, XCircle, Info,
    MessageSquare, History, Sparkles, Monitor, Lock, ExternalLink
} from 'lucide-react';

// ─── Toast Notification System ────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastData {
    id: number;
    message: string;
    type: ToastType;
}

const TOAST_ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const TOAST_STYLES = {
    success: 'border-emerald-500/50 bg-emerald-950/80 text-emerald-300',
    error: 'border-red-500/50 bg-red-950/80 text-red-300',
    warning: 'border-amber-500/50 bg-amber-950/80 text-amber-300',
    info: 'border-blue-500/50 bg-blue-950/80 text-blue-300',
};

function ToastContainer({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map((toast) => {
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

// ─── Confirm Dialog ───────────────────────────────────
function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Delete',
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1811] border border-amber-900/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6 ml-[52px]">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-bold"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Define the subjects available for Key Concepts
const SUBJECTS = [
    { id: 'biology_marine', label: 'Biology & Marine Biology', group: 'Science (S)', icon: Globe },
    { id: 'chemistry', label: 'Chemistry', group: 'Science (S)', icon: FlaskConical },
    { id: 'physics', label: 'Physics', group: 'Science (S)', icon: Sparkles },
    { id: 'environmental_science', label: 'Environmental Science', group: 'Science (S)', icon: Globe },
    { id: 'astronomy', label: 'Astronomy', group: 'Science (S)', icon: Sparkles },
    { id: 'geology_meteorology', label: 'Geology & Meteorology', group: 'Science (S)', icon: Globe },
    { id: 'psychology', label: 'Psychology', group: 'Science (S)', icon: Users },
    
    { id: 'cs_programming', label: 'Computer Science & Programming', group: 'Technology (T)', icon: Monitor },
    { id: 'it', label: 'Information Technology (IT)', group: 'Technology (T)', icon: Database },
    { id: 'cybersecurity_data', label: 'Cybersecurity & Data Science', group: 'Technology (T)', icon: Lock },
    { id: 'ai_ml', label: 'Artificial Intelligence & Machine Learning', group: 'Technology (T)', icon: Cpu },
    { id: 'robotics', label: 'Robotics', group: 'Technology (T)', icon: Wrench },
    { id: 'web_development', label: 'Web Development', group: 'Technology (T)', icon: Globe },
    
    { id: 'civil_structural', label: 'Civil & Structural Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'mechanical', label: 'Mechanical Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'aerospace', label: 'Aerospace Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'electrical_electronic', label: 'Electrical & Electronic Engineering', group: 'Engineering (E)', icon: Cpu },
    { id: 'chemical', label: 'Chemical Engineering', group: 'Engineering (E)', icon: FlaskConical },
    { id: 'biomedical', label: 'Biomedical Engineering', group: 'Engineering (E)', icon: Plus },
    
    { id: 'visual_design', label: 'Visual Arts & Design', group: 'Arts (A)', icon: Paintbrush },
    { id: 'graphic_digital', label: 'Graphic Design & Digital Media', group: 'Arts (A)', icon: Monitor },
    { id: 'industrial_product', label: 'Industrial/Product Design', group: 'Arts (A)', icon: Wrench },
    { id: 'architecture', label: 'Architecture', group: 'Arts (A)', icon: Paintbrush },
    { id: 'creative_language', label: 'Creative Arts & Language Arts', group: 'Arts (A)', icon: BookOpen },
    { id: 'performing_arts', label: 'Performing Arts', group: 'Arts (A)', icon: Users },
    
    { id: 'calculus_linear', label: 'Calculus & Linear Algebra', group: 'Mathematics (M)', icon: Calculator },
    { id: 'statistics_probability', label: 'Statistics & Probability', group: 'Mathematics (M)', icon: TrendingUp },
    { id: 'differential_equations', label: 'Differential Equations', group: 'Mathematics (M)', icon: Calculator },
    { id: 'discrete_mathematics', label: 'Discrete Mathematics', group: 'Mathematics (M)', icon: Calculator },
    { id: 'financial_mathematics', label: 'Financial Mathematics', group: 'Mathematics (M)', icon: TrendingUp },
];

// Current academic year
const ACADEMIC_YEAR = '2025/2026';

// Type definitions
interface StudentInfo {
    full_name: string;
    class_name: string;
    group_number: number;
    email: string;
}

interface TeamMember {
    full_name: string;
    email: string;
}

interface ProjectData {
    id: string;
    title: string;
    abstract: string;
    google_doc_url: string;
    presentation_url?: string | null;
    status: string;
    theme_id: string;
    iteration?: number;
    teacher_comment?: string | null;
    created_at: string;
}

interface LogbookEntry {
    id: string;
    student_email: string;
    entry_date: string;
    task: string;
    result: string;
    feedback: string | null;
    created_at: string;
}

interface Theme {
    id: string;
    theme_name: string;
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

interface AssessmentScoreEntry {
    id: string;
    indicator_id: string;
    score: number;
    assessed_at: string;
    teacher_comment?: string;
}

export default function StudentDashboardPage() {
    const [activeTab, setActiveTab] = useState('data');
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Helper: render text with **bold** markdown converted to <strong> tags
    const renderFormattedText = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    // Student & group info
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Project
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [projectHistory, setProjectHistory] = useState<ProjectData[]>([]);
    const [viewingPastIteration, setViewingPastIteration] = useState<ProjectData | null>(null);

    // Form State for Project Submission
    const [title, setTitle] = useState('');
    const [theme, setTheme] = useState('');
    const [problem, setProblem] = useState('');
    const [solution, setSolution] = useState('');
    const [docUrl, setDocUrl] = useState('');
    const [keyConcepts, setKeyConcepts] = useState([{ subject: 'matematika', concept: '' }]);
    const [themesList, setThemesList] = useState<Theme[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Presentation State
    const [presentationUrl, setPresentationUrl] = useState('');
    const [isSavingPresentation, setIsSavingPresentation] = useState(false);

    // AI Precheck State
    const [isPrechecking, setIsPrechecking] = useState(false);
    const [precheckResult, setPrecheckResult] = useState('');
    const [showPrecheckModal, setShowPrecheckModal] = useState(false);

    // Logbook State
    const [logbooks, setLogbooks] = useState<LogbookEntry[]>([]);
    const [showLogbookForm, setShowLogbookForm] = useState(false);
    const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [newLogTask, setNewLogTask] = useState('');
    const [newLogResult, setNewLogResult] = useState('');
    const [newLogFeedback, setNewLogFeedback] = useState('');
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    // Assessment Data
    const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
    const [rubricDimensions, setRubricDimensions] = useState<RubricDimension[]>([]);
    const [rubricIndicators, setRubricIndicators] = useState<RubricIndicator[]>([]);
    const [assessmentScores, setAssessmentScores] = useState<AssessmentScoreEntry[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Toast & Dialog State
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastIdRef = useRef(0);
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') => {
        setConfirmDialog({ open: true, title, message, confirmLabel, onConfirm });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
    }, []);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
            setLoading(false);
            return;
        }

        setUserEmail(user.email);

        // 1. Fetch student info from student_master
        const { data: myInfo } = await supabase
            .from('student_master')
            .select('full_name, class_name, group_number, email')
            .eq('email', user.email)
            .eq('academic_year', ACADEMIC_YEAR)
            .single();

        if (!myInfo) {
            setLoading(false);
            return;
        }

        setStudentInfo(myInfo);

        // Extract grade from class_name (e.g., '7.1' -> '7', '10.3' -> '10')
        const grade = myInfo.class_name.split('.')[0];

        // 2. Fetch team members (same class + group + year)
        const { data: members } = await supabase
            .from('student_master')
            .select('full_name, email')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR);

        if (members) setTeamMembers(members);

        // 3. Fetch themes for this student's grade
        const { data: fetchedThemes } = await supabase
            .from('themes')
            .select('id, theme_name')
            .eq('grade', grade)
            .eq('academic_year', ACADEMIC_YEAR);

        if (fetchedThemes && fetchedThemes.length > 0) {
            setThemesList(fetchedThemes);
            setTheme(fetchedThemes[0].id);
        }

        // 4. Fetch project(s) for this group
        const { data: fetchedProjects } = await supabase
            .from('projects')
            .select('*')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR)
            .order('iteration', { ascending: false });

        if (fetchedProjects && fetchedProjects.length > 0) {
            setProjectHistory(fetchedProjects);
            setProjectData(fetchedProjects[0]);
            setPresentationUrl(fetchedProjects[0].presentation_url || '');
        }

        // 5. Fetch logbooks for this group (all members' entries)
        const { data: fetchedLogs } = await supabase
            .from('logbooks')
            .select('*')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (fetchedLogs) setLogbooks(fetchedLogs);

        // 6. Fetch assessment categories, dimensions, indicators, and scores
        const { data: cats } = await supabase
            .from('assessment_categories')
            .select('*')
            .order('sort_order');
        if (cats) {
            setAssessmentCategories(cats);
            if (cats.length > 0) setSelectedCategory(cats[0].id);
        }

        const { data: dims } = await supabase
            .from('rubric_dimensions')
            .select('*')
            .order('sort_order');
        if (dims) setRubricDimensions(dims);

        const { data: inds } = await supabase
            .from('rubric_indicators')
            .select('*')
            .order('sort_order');
        if (inds) setRubricIndicators(inds);

        const { data: scrs } = await supabase
            .from('assessment_scores')
            .select('id, indicator_id, score, assessed_at, teacher_comment')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR);
        if (scrs) setAssessmentScores(scrs);

        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ─── Key Concepts Handlers ─────────────────────────
    const addConcept = () => {
        setKeyConcepts([...keyConcepts, { subject: 'biology_marine', concept: '' }]);
    };

    const removeConcept = (index: number) => {
        setKeyConcepts(keyConcepts.filter((_, i) => i !== index));
    };

    const updateConcept = (index: number, field: 'subject' | 'concept', value: string) => {
        const newConcepts = [...keyConcepts];
        newConcepts[index][field] = value;
        setKeyConcepts(newConcepts);
    };

    // ─── Logbook Submit ────────────────────────────────
    const handleLogbookSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail || !studentInfo || isSubmittingLog) return;

        setIsSubmittingLog(true);

        const { data, error } = await supabase.from('logbooks').insert([
            {
                class_name: studentInfo.class_name,
                group_number: studentInfo.group_number,
                academic_year: ACADEMIC_YEAR,
                student_email: userEmail,
                entry_date: newLogDate,
                task: newLogTask,
                result: newLogResult,
                feedback: newLogFeedback
            }
        ]).select();

        setIsSubmittingLog(false);

        if (error) {
            console.error("Error inserting logbook:", error);
            showToast("Failed to submit logbook entry. Please try again.", 'error');
        } else if (data) {
            setLogbooks([data[0], ...logbooks]);
            setNewLogTask('');
            setNewLogResult('');
            setNewLogFeedback('');
            setNewLogDate(new Date().toISOString().split('T')[0]);
            setShowLogbookForm(false);
            showToast('Logbook entry saved successfully!', 'success');
        }
    };

    // ─── Logbook Delete ────────────────────────────────
    const handleLogbookDelete = async (logId: string) => {
        showConfirm(
            'Delete Entry',
            'Are you sure you want to delete this logbook entry? This action cannot be undone.',
            async () => {
                closeConfirm();
                const { error } = await supabase
                    .from('logbooks')
                    .delete()
                    .eq('id', logId)
                    .eq('student_email', userEmail!);

                if (error) {
                    console.error('Error deleting logbook:', error);
                    showToast('Failed to delete logbook entry.', 'error');
                } else {
                    setLogbooks(logbooks.filter(l => l.id !== logId));
                    showToast('Logbook entry deleted.', 'success');
                }
            }
        );
    };

    // ─── AI Pre-Check ──────────────────────────────────
    const handlePreCheck = async () => {
        if (!problem.trim() || !solution.trim()) {
            showToast('Please fill in both the Problem and Solution fields before running the AI Pre-Check.', 'warning');
            return;
        }

        setIsPrechecking(true);
        setPrecheckResult('');

        try {
            const res = await fetch('/api/precheck', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    problem,
                    solution,
                    keyConcepts: keyConcepts.filter(c => c.concept.trim() !== '')
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to analyze project');
            }

            setPrecheckResult(data.result);
            setShowPrecheckModal(true);
        } catch (error: any) {
            showToast(error.message || 'An error occurred during AI Pre-Check.', 'error');
        } finally {
            setIsPrechecking(false);
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
        if (!docUrl.trim()) {
            showToast('Please provide a Google Docs URL.', 'warning');
            setIsSubmitting(false);
            return;
        }

        // URL validation
        if (!docUrl.includes('docs.google.com')) {
            showToast('Please provide a valid Google Docs URL.', 'error');
            setIsSubmitting(false);
            return;
        }

        // Check if the Google Doc is public (always enforced)
        try {
            const docCheck = await fetch('/api/check-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: docUrl })
            });
            const checkResult = await docCheck.json();

            if (!checkResult.isPublic) {
                showToast(checkResult.error || 'The Google Doc is not publicly accessible. Please set sharing to "Anyone with the link".', 'error');
                setIsSubmitting(false);
                return;
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to verify Google Doc access. Please make sure the URL is correct and try again.', 'error');
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
                title: title,
                abstract: combinedAbstract,
                status: 'pending',
                google_doc_url: docUrl,
                iteration: nextIteration
            }
        ]).select();

        setIsSubmitting(false);

        if (error) {
            console.error(error);
            showToast('Error submitting project: ' + error.message, 'error');
        } else if (data) {
            showToast(nextIteration > 1 ? 'Project resubmitted successfully!' : 'Project submitted successfully!', 'success');
            setProjectHistory(prev => [data[0], ...prev]);
            setProjectData(data[0]);
            setPresentationUrl('');
            setActiveTab('data');
            setTitle('');
            setProblem('');
            setSolution('');
            setDocUrl('');
            setKeyConcepts([{ subject: 'biology_marine', concept: '' }]);

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
        }
    };

    // ─── Helper: Get member name from email ─────────────
    const getMemberName = (email: string) => {
        const member = teamMembers.find(m => m.email === email);
        return member?.full_name || email;
    };

    // ─── Loading State ─────────────────────────────────
    if (loading) return (
        <div className="min-h-screen bg-[#1c1b14] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm">Loading your dashboard...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] font-sans">
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                onConfirm={confirmDialog.onConfirm}
                onCancel={closeConfirm}
            />

            {/* Navbar */}
            <nav className="bg-[#1a1811] border-b border-amber-900/40 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" strokeWidth={2} />
                    <span className="font-bold text-xl text-amber-500">
                        PAHOA STEAM ASSESSMENT
                    </span>
                    <span className="ml-2 bg-amber-900/30 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/20 hidden sm:inline-block">
                        Student Portal
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400 hidden sm:block">{userEmail}</div>
                    <button
                        onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
                        className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-red-950/30"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </nav>

            {/* Not registered warning */}
            {!studentInfo && (
                <div className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-8 text-center">
                        <Users className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Not Registered in Any Group</h2>
                        <p className="text-slate-400 max-w-md mx-auto">
                            Your email ({userEmail}) is not found in the student database for the academic year {ACADEMIC_YEAR}. Please contact your teacher to be added to a group.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Layout (only if registered) */}
            {studentInfo && (
                <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 h-[calc(100vh-65px)] overflow-hidden">

                    {/* Sidebar / Tabs */}
                    <aside
                        className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 z-40 bg-[#1c1b14] pt-2 md:pt-0"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                        {/* Group Info Card (Desktop) */}
                        <div className="hidden md:flex flex-col bg-[#1a1811] border border-amber-900/30 rounded-xl px-4 py-3 mb-3">
                            <span className="text-xs text-slate-500 uppercase tracking-wider">Your Group</span>
                            <span className="text-amber-400 font-bold text-lg">
                                {studentInfo.class_name} — Group {studentInfo.group_number}
                            </span>
                            <span className="text-xs text-slate-500 mt-0.5">{ACADEMIC_YEAR}</span>
                        </div>

                        {[
                            { id: 'data', label: 'My Project Data', icon: Database },
                            { id: 'submit', label: 'Submit a Project', icon: PenSquare },
                            { id: 'logbook', label: 'My Logbook', icon: BookOpen },
                            { id: 'presentation', label: 'My Presentation', icon: Monitor },
                            { id: 'result', label: 'Assessment Result', icon: FileCheck },
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

                    {/* Tab Content Area */}
                    <div className="flex-1 min-h-0 overflow-y-auto">

                        {/* ═══════════════════════════════════════════ */}
                        {/* TAB 1: MY PROJECT DATA                     */}
                        {/* ═══════════════════════════════════════════ */}
                        {activeTab === 'data' && (
                            <div className="space-y-6">
                                {/* Team Members Card */}
                                <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                        <Users className="text-amber-500 w-5 h-5" />
                                        Team Members
                                        <span className="ml-auto text-xs bg-amber-900/30 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20 sm:hidden">
                                            {studentInfo.class_name} — G{studentInfo.group_number}
                                        </span>
                                    </h2>
                                    {teamMembers.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {teamMembers.map((member, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center gap-3 bg-[#1c1b14] border rounded-xl px-4 py-3 transition-all ${member.email === userEmail
                                                        ? 'border-amber-500/50 shadow-lg shadow-amber-900/10'
                                                        : 'border-slate-800 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${member.email === userEmail
                                                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-[#1a160d]'
                                                        : 'bg-slate-800 text-slate-400'
                                                        }`}>
                                                        {member.full_name?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-medium truncate ${member.email === userEmail ? 'text-amber-400' : 'text-slate-200'
                                                            }`}>
                                                            {member.full_name}
                                                            {member.email === userEmail && (
                                                                <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full">You</span>
                                                            )}
                                                        </p>
                                                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 text-center">
                                            <p className="text-slate-500 text-sm">No team members found.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Project Data Card */}
                                <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                        <Database className="text-amber-500 w-5 h-5" />
                                        Project Details
                                    </h2>

                                    {projectData ? (
                                        <div className="space-y-4">
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs text-slate-500 uppercase tracking-wider">Title</span>
                                                    <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${projectData.status === 'approved'
                                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                        : projectData.status === 'revision'
                                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                        }`}>
                                                        {projectData.status || 'pending'}
                                                    </span>
                                                </div>
                                                <p className="text-lg font-semibold text-white">{projectData.title}</p>
                                            </div>
                                            {projectData.abstract && (() => {
                                                try {
                                                    const parsed = JSON.parse(projectData.abstract);
                                                    return (
                                                        <div className="space-y-4">
                                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Problem</span>
                                                                <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{parsed.problem}</p>
                                                            </div>
                                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Proposed Solution</span>
                                                                <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{parsed.solution}</p>
                                                            </div>
                                                            {parsed.keyConcepts && parsed.keyConcepts.length > 0 && (
                                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-3">Key Concepts mapping</span>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                        {parsed.keyConcepts.map((item: any, idx: number) => {
                                                                            const subj = SUBJECTS.find(s => s.id === item.subject);
                                                                            const Icon = subj?.icon || BookOpen;
                                                                            return (
                                                                                <div key={idx} className="bg-[#1a1811] border border-amber-900/10 rounded-lg p-3 flex gap-3 items-start">
                                                                                    <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 shrink-0">
                                                                                        <Icon className="w-4 h-4" />
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-xs font-bold text-slate-400 mb-0.5">{subj?.label || item.subject}</p>
                                                                                        <p className="text-sm text-slate-200">{item.concept}</p>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                } catch (e) {
                                                    // Fallback for old simple text format
                                                    return (
                                                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                            <span className="text-xs text-slate-500 uppercase tracking-wider">Abstract</span>
                                                            <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{projectData.abstract}</p>
                                                        </div>
                                                    );
                                                }
                                            })()}                                          {projectData.google_doc_url && (
                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                    <span className="text-xs text-slate-500 uppercase tracking-wider">Google Doc</span>
                                                    <a
                                                        href={projectData.google_doc_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center justify-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-medium py-2.5 px-5 rounded-xl mt-3 transition-all active:scale-95 text-sm w-full sm:w-auto"
                                                    >
                                                        <LinkIcon className="w-4 h-4" />
                                                        Open Document
                                                    </a>
                                                </div>
                                            )}

                                            {projectData.teacher_comment && (
                                                <div className="bg-[#1c1b14] border border-amber-900/30 rounded-xl p-5 mt-4">
                                                    <span className="text-xs text-amber-500 uppercase tracking-wider block mb-2 font-bold flex items-center gap-2">
                                                        <MessageSquare className="w-4 h-4" /> Teacher Feedback
                                                    </span>
                                                    <p className="text-sm text-amber-100/90 whitespace-pre-line bg-amber-500/5 p-4 rounded-lg border border-amber-500/10">
                                                        {projectData.teacher_comment}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Iteration History */}
                                            {projectHistory.length > 1 && (
                                                <div className="mt-8 pt-8 border-t border-slate-800/50">
                                                    <h3 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                                                        <History className="w-5 h-5 text-amber-500" />
                                                        Previous Submissions (History)
                                                    </h3>
                                                    <div className="space-y-4">
                                                        {projectHistory.slice(1).map((past, idx) => (
                                                            <div key={past.id} className="bg-[#1c1b14] border border-slate-800/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <span className="bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                                            Iteration {past.iteration || 1}
                                                                        </span>
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${past.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                            past.status === 'revision' ? 'bg-amber-500/10 text-amber-400' :
                                                                                past.status === 'disapproved' ? 'bg-red-500/10 text-red-500' :
                                                                                    'bg-slate-800/50 text-slate-400'
                                                                            }`}>
                                                                            {past.status || 'pending'}
                                                                        </span>
                                                                    </div>
                                                                    <h4 className="text-slate-300 font-medium text-sm">{past.title}</h4>
                                                                    {past.teacher_comment && (
                                                                        <p className="text-xs text-amber-500/70 mt-2 line-clamp-1 italic">
                                                                            &quot;{past.teacher_comment}&quot;
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => setViewingPastIteration(past)}
                                                                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-colors shrink-0 whitespace-nowrap"
                                                                >
                                                                    View
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-[#1c1b14] border border-dashed border-slate-700 rounded-xl p-10 text-center flex flex-col items-center justify-center">
                                            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                                                <PenSquare className="w-7 h-7 text-amber-500" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-300 mb-2">No Project Submitted Yet</h3>
                                            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
                                                Your team hasn&apos;t submitted a project yet. Start by filling out the submission form.
                                            </p>
                                            <button
                                                onClick={() => setActiveTab('submit')}
                                                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20"
                                            >
                                                <PenSquare className="w-5 h-5" />
                                                Submit a Project
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════ */}
                        {/* TAB 2: MY LOGBOOK                          */}
                        {/* ═══════════════════════════════════════════ */}
                        {activeTab === 'logbook' && (
                            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <BookOpen className="text-amber-500" />
                                        Group Logbook
                                    </h2>
                                    {!showLogbookForm && projectData?.status === 'approved' && (
                                        <button
                                            onClick={() => setShowLogbookForm(true)}
                                            className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2 px-4 flex items-center gap-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
                                        >
                                            <Plus className="w-4 h-4" /> Add Log
                                        </button>
                                    )}
                                </div>
                                {projectData?.status !== 'approved' && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-200">
                                            <p className="font-semibold mb-1">Logbook Locked</p>
                                            <p className="opacity-80">You can only create logbook entries once your project iteration has been officially approved by a teacher.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Add Log Form */}
                                {showLogbookForm && (
                                    <form onSubmit={handleLogbookSubmit} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 mb-8 text-slate-300 space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-semibold text-amber-500 flex items-center gap-2">
                                                <PenSquare className="w-5 h-5" /> New Log Entry
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setShowLogbookForm(false)}
                                                className="text-slate-500 hover:text-red-400 transition-colors"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                                                <div className="relative">
                                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                    <input
                                                        type="date"
                                                        required
                                                        value={newLogDate}
                                                        onChange={(e) => setNewLogDate(e.target.value)}
                                                        className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Task</label>
                                            <textarea
                                                required
                                                rows={2}
                                                value={newLogTask}
                                                onChange={(e) => setNewLogTask(e.target.value)}
                                                placeholder="What did you work on today?"
                                                className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Result</label>
                                            <textarea
                                                required
                                                rows={2}
                                                value={newLogResult}
                                                onChange={(e) => setNewLogResult(e.target.value)}
                                                placeholder="What was the outcome of your task?"
                                                className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Feedback</label>
                                            <textarea
                                                rows={2}
                                                value={newLogFeedback}
                                                onChange={(e) => setNewLogFeedback(e.target.value)}
                                                placeholder="Any feedback, reflections, or challenges?"
                                                className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowLogbookForm(false)}
                                                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={isSubmittingLog}
                                                className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20"
                                            >
                                                {isSubmittingLog ? (
                                                    <div className="w-4 h-4 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Save className="w-4 h-4" />
                                                )}
                                                Save Entry
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {/* Logbooks Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-amber-900/30">
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm whitespace-nowrap">Date</th>
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm whitespace-nowrap">Member</th>
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/4">Task</th>
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/4">Result</th>
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm min-w-[130px]">Feedback</th>
                                                <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {logbooks.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-8 text-center text-slate-500">
                                                        No logbook entries found. Click &quot;Add Log&quot; to create your first entry.
                                                    </td>
                                                </tr>
                                            ) : (
                                                logbooks.map((log) => (
                                                    <tr key={log.id} className="hover:bg-[#1c1b14] transition-colors">
                                                        <td className="py-4 px-4 text-sm text-amber-500 font-medium whitespace-nowrap align-top">
                                                            {new Date(log.entry_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm align-top whitespace-nowrap">
                                                            <span className={`font-medium ${log.student_email === userEmail ? 'text-amber-400' : 'text-slate-300'}`}>
                                                                {getMemberName(log.student_email)}
                                                            </span>
                                                            {log.student_email === userEmail && (
                                                                <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-500 px-1 py-0.5 rounded-full">You</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm text-slate-300 align-top">
                                                            {log.task}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm text-slate-300 align-top">
                                                            {log.result}
                                                        </td>
                                                        <td className="py-4 px-4 text-sm align-top">
                                                            {log.feedback ? (
                                                                <span className="text-amber-100">{log.feedback}</span>
                                                            ) : (
                                                                <span className="text-slate-600 italic">No feedback yet</span>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-2 text-sm align-top">
                                                            {log.student_email === userEmail && (
                                                                <button
                                                                    onClick={() => handleLogbookDelete(log.id)}
                                                                    className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                    title="Delete this entry"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════ */}
                        {/* TAB: MY PRESENTATION                       */}
                        {/* ═══════════════════════════════════════════ */}
                        {activeTab === 'presentation' && (
                            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                    <Monitor className="text-amber-500" />
                                    My Presentation
                                </h2>
                                <p className="text-slate-400 text-sm mb-8">Submit your Canva presentation link here. A preview will be shown below.</p>

                                {!projectData ? (
                                    <div className="bg-[#1c1b14] border border-dashed border-slate-700 rounded-xl p-10 text-center flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                                            <PenSquare className="w-7 h-7 text-amber-500" />
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-300 mb-2">No Project Submitted Yet</h3>
                                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                            You need to submit a project first before adding a presentation link.
                                        </p>
                                    </div>
                                ) : projectData.status !== 'approved' ? (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex items-start gap-4">
                                        <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                                            <Lock className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-amber-400 mb-1">Presentation Locked</h3>
                                            <p className="text-sm text-amber-200/80">
                                                You can only add a presentation link after your project has been <strong>approved</strong> by a teacher (C1 approval).
                                                Your current project status is: <span className={`font-bold ${projectData.status === 'revision' ? 'text-red-400' : 'text-amber-400'}`}>{projectData.status}</span>
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Canva URL Input */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-300 mb-2">Canva Presentation URL</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                    <LinkIcon className="w-5 h-5" />
                                                </div>
                                                <input
                                                    type="url"
                                                    value={presentationUrl}
                                                    onChange={(e) => setPresentationUrl(e.target.value)}
                                                    className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
                                                    placeholder="https://www.canva.com/design/.../view"
                                                />
                                            </div>
                                            <p className="text-xs text-amber-500/80 mt-2">
                                                * Paste the public view link of your Canva presentation. Make sure the presentation is set to &quot;Anyone with the link can view&quot;.
                                            </p>
                                        </div>

                                        {/* Save Button */}
                                        <button
                                            onClick={async () => {
                                                if (!presentationUrl.trim()) {
                                                    showToast('Please enter a Canva presentation URL.', 'warning');
                                                    return;
                                                }
                                                if (!presentationUrl.includes('canva.com')) {
                                                    showToast('Please provide a valid Canva URL.', 'error');
                                                    return;
                                                }
                                                setIsSavingPresentation(true);
                                                const { error } = await supabase
                                                    .from('projects')
                                                    .update({ presentation_url: presentationUrl.trim() })
                                                    .eq('id', projectData.id);
                                                setIsSavingPresentation(false);
                                                if (error) {
                                                    showToast('Failed to save presentation URL: ' + error.message, 'error');
                                                } else {
                                                    setProjectData({ ...projectData, presentation_url: presentationUrl.trim() });
                                                    showToast('Presentation link saved successfully!', 'success');
                                                }
                                            }}
                                            disabled={isSavingPresentation}
                                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSavingPresentation ? (
                                                <div className="w-5 h-5 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Save className="w-5 h-5" />
                                            )}
                                            {isSavingPresentation ? 'Saving...' : 'Save Presentation Link'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════ */}
                        {/* TAB 3: PROJECT SUBMISSION                   */}
                        {/* ═══════════════════════════════════════════ */}
                        {activeTab === 'submit' && (
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
                                            onClick={() => setActiveTab('data')}
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

                                        {/* Google Doc URL */}
                                        <div className="pt-4 border-t border-slate-800/50">
                                            <label className="block text-sm font-semibold text-slate-300 mb-2">Google Doc URL (Public)</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                                    <LinkIcon className="w-5 h-5" />
                                                </div>
                                                <input
                                                    type="url"
                                                    value={docUrl}
                                                    onChange={(e) => setDocUrl(e.target.value)}
                                                    className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
                                                    placeholder="https://docs.google.com/document/d/..."
                                                />
                                            </div>
                                            <p className="text-xs text-amber-500/80 mt-2">
                                                * Make sure the document sharing setting is set to &quot;Anyone with the link can view&quot;.
                                            </p>
                                        </div>

                                        {/* Submit & PreCheck Buttons */}
                                        <div className="flex flex-col sm:flex-row gap-4 mt-8">
                                            <button
                                                type="button"
                                                onClick={handlePreCheck}
                                                disabled={isPrechecking || isSubmitting}
                                                className="w-full sm:w-1/2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isPrechecking ? (
                                                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <Sparkles className="w-5 h-5" />
                                                )}
                                                {isPrechecking ? 'Analyzing...' : 'AI Pre-Check'}
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
                        )}

                        {/* ═══════════════════════════════════════════ */}
                        {/* TAB 4: ASSESSMENT RESULT                    */}
                        {/* ═══════════════════════════════════════════ */}
                        {activeTab === 'result' && (
                            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                    <FileCheck className="text-amber-500" />
                                    Assessment Results
                                </h2>

                                {/* Category Pills */}
                                <div className="flex flex-wrap gap-2 mb-8">
                                    {assessmentCategories.map((cat) => {
                                        const isActive = selectedCategory === cat.id;
                                        // Check if this category has any scores
                                        const catDimIds = rubricDimensions.filter(d => d.category_id === cat.id).map(d => d.id);
                                        const catIndIds = rubricIndicators.filter(ind => catDimIds.includes(ind.dimension_id)).map(ind => ind.id);
                                        const hasScores = assessmentScores.some(s => catIndIds.includes(s.indicator_id));

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`relative px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${isActive
                                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-lg shadow-amber-900/10'
                                                    : 'bg-[#1c1b14] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-300'
                                                    }`}
                                            >
                                                <span className="text-xs font-bold mr-1.5 opacity-60">{cat.code}</span>
                                                <span className="hidden sm:inline">{cat.name}</span>
                                                {hasScores && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1a1811]"></span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Rubric Result View */}
                                {(() => {
                                    if (!selectedCategory) return null;

                                    const cat = assessmentCategories.find(c => c.id === selectedCategory);
                                    if (!cat) return null;

                                    const dims = rubricDimensions.filter(d => d.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
                                    const maxScale = parseInt(cat.rubric_type.replace('scale_', '')) || 1;
                                    const isChecklist = cat.rubric_type === 'checklist';

                                    // Collect all indicators and scores for this category
                                    const allInds = dims.flatMap(dim =>
                                        rubricIndicators.filter(ind => ind.dimension_id === dim.id)
                                    );
                                    const allIndIds = allInds.map(ind => ind.id);
                                    const catScores = assessmentScores.filter(s => allIndIds.includes(s.indicator_id));

                                    if (dims.length === 0) {
                                        return (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
                                                <FileCheck className="w-14 h-14 text-slate-700 mb-4" />
                                                <h3 className="text-lg font-bold text-slate-300 mb-2">No Rubric Defined</h3>
                                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                                    The rubric for <strong className="text-amber-400">{cat.code} — {cat.name}</strong> has not been set up yet. Please wait for your teacher to configure it.
                                                </p>
                                            </div>
                                        );
                                    }

                                    if (catScores.length === 0) {
                                        return (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
                                                <FileCheck className="w-14 h-14 text-slate-700 mb-4" />
                                                <h3 className="text-lg font-bold text-slate-300 mb-2">Not Assessed Yet</h3>
                                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                                    <strong className="text-amber-400">{cat.code} — {cat.name}</strong> is pending review by your teacher. Scores will appear here once graded.
                                                </p>
                                            </div>
                                        );
                                    }

                                    // Overall score for this category
                                    const totalScore = catScores.reduce((sum, s) => sum + s.score, 0);
                                    const totalMax = isChecklist ? allInds.length : allInds.length * maxScale;
                                    const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

                                    let overallColor = 'text-amber-400';
                                    let overallBg = 'bg-amber-500';
                                    if (overallPct >= 80) { overallColor = 'text-emerald-400'; overallBg = 'bg-emerald-500'; }
                                    else if (overallPct < 60) { overallColor = 'text-red-400'; overallBg = 'bg-red-500'; }

                                    const teacherComment = catScores[0]?.teacher_comment;

                                    return (
                                        <div className="space-y-6">
                                            {/* Overall Summary Card */}
                                            <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/10 border border-amber-500/20 rounded-xl p-6">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <TrendingUp className="w-5 h-5 text-amber-500" />
                                                        <span className="text-sm font-semibold text-slate-300">{cat.code} — {cat.name}</span>
                                                    </div>
                                                    <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                                                        {isChecklist ? 'Checklist' : `Scale 1-${maxScale}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-end gap-3 mt-3">
                                                    <span className={`text-4xl font-bold ${overallColor}`}>{overallPct}%</span>
                                                    <span className="text-sm text-slate-500 mb-1">({totalScore}/{totalMax} points)</span>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-2 mt-3">
                                                    <div className={`${overallBg} h-2 rounded-full transition-all duration-700`} style={{ width: `${overallPct}%` }}></div>
                                                </div>

                                                {teacherComment && (
                                                    <div className="mt-5 pt-4 border-t border-amber-500/20">
                                                        <span className="text-[10px] uppercase text-amber-500/70 font-bold block mb-1">Teacher Assessment Comment</span>
                                                        <p className="text-sm text-amber-100 whitespace-pre-wrap leading-relaxed">"{teacherComment.split('\n').map((line: string, idx: number) => (
                                                            <React.Fragment key={idx}>
                                                                {idx > 0 && <br />}
                                                                {renderFormattedText(line)}
                                                            </React.Fragment>
                                                        ))}"</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Dimension Cards */}
                                            {dims.map((dim) => {
                                                const dimInds = rubricIndicators.filter(ind => ind.dimension_id === dim.id).sort((a, b) => a.sort_order - b.sort_order);
                                                const dimIndIds = dimInds.map(ind => ind.id);
                                                const dimScores = assessmentScores.filter(s => dimIndIds.includes(s.indicator_id));

                                                const dimTotal = dimScores.reduce((sum, s) => sum + s.score, 0);
                                                const dimMax = isChecklist ? dimInds.length : dimInds.length * maxScale;
                                                const dimPct = dimMax > 0 ? Math.round((dimTotal / dimMax) * 100) : 0;

                                                return (
                                                    <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                        {/* Dimension Header */}
                                                        <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                                                            <h4 className="font-bold text-white text-sm">{dim.name}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-slate-500">{dimTotal}/{dimMax}</span>
                                                                <span className={`text-sm font-bold ${dimPct >= 80 ? 'text-emerald-400' : dimPct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                    {dimPct}%
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Indicators */}
                                                        <div className="divide-y divide-slate-800/30">
                                                            {dimInds.map((ind, idx) => {
                                                                const scoreEntry = dimScores.find(s => s.indicator_id === ind.id);
                                                                const scoreVal = scoreEntry?.score || 0;

                                                                return (
                                                                    <div key={ind.id} className="px-5 py-3 flex items-center gap-4 hover:bg-[#1a1811] transition-colors">
                                                                        <span className="text-xs text-slate-600 font-mono w-6 shrink-0">{idx + 1}.</span>
                                                                        <p className="text-sm text-slate-300 flex-1">{ind.description}</p>

                                                                        {/* Score Visualization */}
                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                            {isChecklist ? (
                                                                                scoreVal >= 1 ? (
                                                                                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                                                                                        <X className="w-3 h-3 text-slate-600" />
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                Array.from({ length: maxScale }, (_, i) => (
                                                                                    <div
                                                                                        key={i}
                                                                                        className={`w-5 h-5 rounded-full border-2 transition-colors ${i < scoreVal
                                                                                            ? 'bg-amber-500 border-amber-500'
                                                                                            : 'bg-transparent border-slate-700'
                                                                                            }`}
                                                                                    />
                                                                                ))
                                                                            )}
                                                                            <span className="text-xs font-bold text-slate-400 ml-2 w-8 text-right">
                                                                                {isChecklist ? (scoreVal >= 1 ? '✓' : '—') : `${scoreVal}/${maxScale}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                    </div>
                </main>
            )}

            {/* Past Iteration Modal */}
            {viewingPastIteration && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1c1b14] border border-amber-900/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideIn_0.3s_ease-out]">
                        <div className="sticky top-0 bg-[#1a1811]/90 backdrop-blur-md border-b border-amber-900/30 p-5 flex justify-between items-center z-10">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                                    <History className="text-amber-500" />
                                    Iteration {viewingPastIteration.iteration || 1}
                                </h3>
                                <p className="text-sm text-slate-400 mt-1">Submitted on {new Date(viewingPastIteration.created_at).toLocaleDateString()}</p>
                            </div>
                            <button
                                onClick={() => setViewingPastIteration(null)}
                                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-4">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Project Title</span>
                                    <h4 className="text-white font-bold">{viewingPastIteration.title}</h4>
                                </div>
                                <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-4">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Status</span>
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-1 ${viewingPastIteration.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                        viewingPastIteration.status === 'revision' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            viewingPastIteration.status === 'disapproved' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                'bg-slate-800 text-slate-400 border border-slate-700'
                                        }`}>
                                        {viewingPastIteration.status || 'pending'}
                                    </span>
                                </div>
                            </div>

                            {viewingPastIteration.teacher_comment && (
                                <div className="bg-[#1a1811] border border-amber-900/30 rounded-xl p-5">
                                    <span className="text-xs text-amber-500 uppercase tracking-wider block mb-2 font-bold flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" /> Teacher Feedback
                                    </span>
                                    <p className="text-sm text-amber-100/90 whitespace-pre-line bg-amber-500/5 p-4 rounded-lg border border-amber-500/10">
                                        {viewingPastIteration.teacher_comment.split('\n').map((line: string, idx: number) => (
                                            <React.Fragment key={idx}>
                                                {idx > 0 && <br />}
                                                {renderFormattedText(line)}
                                            </React.Fragment>
                                        ))}
                                    </p>
                                </div>
                            )}

                            {viewingPastIteration.abstract && (() => {
                                try {
                                    const parsed = JSON.parse(viewingPastIteration.abstract);
                                    return (
                                        <div className="space-y-4 bg-[#1a1811] border border-slate-800 rounded-xl p-5">
                                            <div>
                                                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2 cursor-help" title="Describe the problem your project aims to solve.">The Problem</span>
                                                <p className="text-sm text-slate-300 leading-relaxed bg-[#1c1b14] p-4 rounded-lg border border-slate-800">
                                                    {parsed.problem || 'No description provided.'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2 cursor-help" title="Describe your proposed solution to the problem.">The Solution</span>
                                                <p className="text-sm text-slate-300 leading-relaxed bg-[#1c1b14] p-4 rounded-lg border border-slate-800">
                                                    {parsed.solution || 'No description provided.'}
                                                </p>
                                            </div>
                                            {parsed.keyConcepts && parsed.keyConcepts.length > 0 && (
                                                <div className="mt-6 pt-6 border-t border-slate-800">
                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-3">Key Concepts mapping</span>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {parsed.keyConcepts.map((item: any, idx: number) => {
                                                            const subj = SUBJECTS.find(s => s.id === item.subject);
                                                            const Icon = subj?.icon || BookOpen;
                                                            return (
                                                                <div key={idx} className="bg-[#1c1b14] border border-amber-900/10 rounded-lg p-3 flex gap-3 items-start">
                                                                    <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 shrink-0">
                                                                        <Icon className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-slate-400 mb-0.5">{subj?.label || item.subject}</p>
                                                                        <p className="text-sm text-slate-200">{item.concept}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                } catch (e) {
                                    return (
                                        <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-5">
                                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Abstract</span>
                                            <p className="text-sm text-slate-300 whitespace-pre-line">{viewingPastIteration.abstract}</p>
                                        </div>
                                    );
                                }
                            })()}

                            {viewingPastIteration.google_doc_url && (
                                <a
                                    href={viewingPastIteration.google_doc_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold py-4 rounded-xl transition-colors border border-blue-500/20"
                                >
                                    <LinkIcon className="w-5 h-5" />
                                    Open Google Document
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Pre-Check Modal */}
            {showPrecheckModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1a1811] border border-indigo-500/30 rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            onClick={() => setShowPrecheckModal(false)}
                            className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                <Sparkles className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white leading-tight">AI Pre-Check Results</h3>
                                <p className="text-xs text-indigo-400/80 mb-0">Powered by Pahoa STEAM AI</p>
                            </div>
                        </div>

                        <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                            {precheckResult.split('\n').map((line, idx) => {
                                if (line.startsWith('### ')) {
                                    return <h4 key={idx} className="text-indigo-400 font-bold mt-6 mb-3 text-lg">{line.replace('### ', '')}</h4>;
                                }
                                if (line.startsWith('- ')) {
                                    return (
                                        <div key={idx} className="flex gap-2 mb-2 items-start text-[15px]">
                                            <span className="text-indigo-500 mt-1.5">•</span>
                                            <span>{renderFormattedText(line.substring(2))}</span>
                                        </div>
                                    );
                                }
                                if (line.trim() === '') return <div key={idx} className="h-2"></div>;
                                return <p key={idx} className="mb-2 leading-relaxed">{renderFormattedText(line)}</p>;
                            })}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={() => setShowPrecheckModal(false)}
                                className="bg-[#292314] hover:bg-[#3d341e] text-indigo-400 font-semibold py-2.5 px-6 rounded-xl transition-colors border border-indigo-900/40 text-sm"
                            >
                                Close & Continue Editing
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
