'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    GraduationCap, LogOut, LayoutDashboard, BarChart2,
    ClipboardCheck, Users, FileText, CheckCircle2,
    X, AlertTriangle, LinkIcon, TrendingUp, BookOpen, Star, FolderOpen, History, Sparkles,
    Lock, Unlock, Filter, LayoutGrid, List, PieChart, Clock, Calendar,
    Globe, FlaskConical, Monitor, Database, Cpu, Wrench, Plus, Paintbrush, Calculator
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const ACADEMIC_YEAR = '2025/2026';

// ─── C1 Rubric Tooltips ─────────────────────────────
const C1_RUBRIC_TOOLTIPS: Record<string, Record<number, string>> = {
    'Title Quality & Originality': {
        4: 'Concise, highly original, and immediately makes the core purpose clear to teachers and colleagues.',
        3: 'Clear and easy to understand, but standard or slightly wordy.',
        2: 'Somewhat confusing, too long, or misses the core focus of the project.',
        1: 'Missing, completely unrelated, or extremely difficult to understand.'
    },
    'Problem & Contextual Relevance': {
        4: 'Problem connects deeply to the theme/real-life context. Solution is logical and perfectly aligns with students\' grade/ability level.',
        3: 'Problem relates to the theme/real-life but is generic. Solution is mostly grade-appropriate.',
        2: 'Weak connection to theme/real-world. Solution is a mismatch for students\' ability (too easy/hard).',
        1: 'No clear connection to a real-life problem/theme. Completely disconnected from grade level.'
    },
    'STEAM Integration & Conceptual Depth': {
        4: 'Seamlessly integrates 3+ STEAM fields. Massive potential for applying deep conceptual understanding.',
        3: 'Integrates 2-3 STEAM fields well. Good potential for applying conceptual understanding.',
        2: 'Attempts 2 disciplines, but integration feels forced or superficial.',
        1: 'Focuses entirely on a single subject area with no cross-disciplinary connections.'
    },
    'Prototype Focus': {
        4: 'Highly actionable, clear plan for a functional physical or digital prototype. Making is central to the solution.',
        3: 'Proposes a prototype, but lacks some functional details, materials, or building clarity.',
        2: 'Vaguely mentions a prototype; leans heavily toward a theoretical model or presentation.',
        1: 'No prototype planned. Strictly a research paper, essay, or standard presentation.'
    }
};

// ─── C2 Rubric Tooltips ─────────────────────────────
const C2_RUBRIC_TOOLTIPS: Record<string, Record<number, string>> = {
    'Ask': {
        4: 'Masterfully defines a clear problem relevant to the student\'s life. Explicitly breaks down causes and real-world impacts. Relies entirely on hard facts and data, not personal opinions.',
        3: 'Clearly states the problem and touches on causes/impacts. Uses some data but might occasionally rely on assumptions or general statements.',
        2: 'The problem is vague. Briefly mentions causes/impacts but lacks depth. Heavily reliant on personal opinions rather than factual data.',
        1: 'Unclear, irrelevant, lacks explanation of causes/impacts. Zero facts or data provided.'
    },
    'Research': {
        4: 'Gathers highly credible data from academic resources. Elevates research by incorporating real-world data from expert interviews and/or deep analysis of existing solutions/products.',
        3: 'Uses good, credible academic or online resources. May mention existing products but lacks deep analysis or expert input.',
        2: 'Research relies on basic, potentially non-credible sources. No mention of existing solutions, expert input, or deep academic literature.',
        1: 'No meaningful research, data, or credible sources provided.'
    },
    'Interdisciplinary': {
        4: 'Masterfully explains how specific, advanced concepts from 2 or more STEAM fields intertwine to explain the problem and theory. Connections are deeply analyzed.',
        3: 'Clearly explains the theoretical involvement of 2 or more STEAM fields. Connections make sense but might lack deep, critical analysis.',
        2: 'Mentions different STEAM fields but fails to clearly elaborate on how their theoretical concepts specifically connect to the problem.',
        1: 'Focuses entirely on the theory of a single subject, missing the interdisciplinary nature of STEAM.'
    },
    'Analysis': {
        4: 'Brilliantly critiques the problem space and research. Uses data to identify a specific, clear opportunity to create something genuinely new or significantly better than existing solutions.',
        3: 'Analyzes the research well enough to spot an opportunity for a project, though the proposed innovation might be slightly standard or generic.',
        2: 'Takes data at face value without critical thought. Struggles to identify a clear, specific opportunity to improve upon existing solutions.',
        1: 'Shows no critical analysis. Fails entirely to identify any opportunity to create a solution or improve upon existing ideas.'
    }
};

// ─── C3 Rubric Tooltips ─────────────────────────────
const C3_RUBRIC_TOOLTIPS: Record<string, Record<number, string>> = {
    'Execution': {
        4: 'Exhaustive, sequential step-by-step execution plan. Comprehensive material list with a highly detailed, realistic budget/price list. Clear and actionable timeline.',
        3: 'Solid plan and timeline. Material list is present, but the budget might lack minor details or execution steps skip minor transitional phases.',
        2: 'Timeline is vague or unrealistic. Material list is incomplete, or budget is entirely missing. Execution steps are out of order or lack necessary detail.',
        1: 'No timeline, budget, or coherent execution steps are provided.'
    },
    'Design': {
        4: 'High-quality visual representation (diagram, illustration, blueprint) that perfectly maps to the plan. Exceptional, logical rationale defending exactly why this solution is the best choice over alternatives.',
        3: 'Basic visual representation included. Rationale is present and makes sense, but justification could be stronger or more deeply analyzed.',
        2: 'Visuals are messy, confusing, or poorly described. Rationale is weak (e.g., "I chose this because it\'s easy to make").',
        1: 'No visuals or diagrams provided or described. No rationale is given for the chosen solution.'
    },
    'Risk': {
        4: 'Sharp foresight identifying highly specific, realistic risks during the prototype building phase. Strong, actionable, and logical contingency plan ("Plan B") to mitigate these exact problems.',
        3: 'Identifies potential risks and offers basic mitigation ideas or a general Plan B, though it may lack specific technical details.',
        2: 'Mentions only generic, surface-level risks (e.g., "it might break") and provides a poor or entirely missing contingency plan.',
        1: 'Ignores risk assessment completely. Assumes a flawless execution with zero backup plan.'
    },
    'STEAM': {
        4: 'The construction and function of the prototype explicitly require the application of multiple STEAM concepts. The "making" phase is a true interdisciplinary engineering and design challenge.',
        3: 'The build process applies 1-2 STEAM concepts well, though execution might lean heavily toward a single discipline rather than a fully integrated approach.',
        2: 'The prototype barely utilizes the STEAM theories discussed in earlier chapters. The actual build is overly simplistic or disconnected from core concepts.',
        1: 'The prototype has absolutely no connection to STEAM application; it operates more like a basic arts-and-crafts project than a functional STEAM solution.'
    }
};

// ─── C4 Rubric Tooltips ─────────────────────────────
const C4_RUBRIC_TOOLTIPS: Record<string, Record<number, string>> = {
    'Structure': {
        4: 'Professional organization. Entries for every date worked, highly readable structure, and exceptionally clear language documenting a logical start-to-finish progression.',
        3: 'Clear structure and communicative language. Includes most relevant dates and entries, showing logical progression despite minor gaps.',
        2: 'Structure is somewhat disorganized, dates are missing, or entries skip major timeframes, making it hard to follow the project flow. Language is occasionally confusing.',
        1: 'Completely incoherent mess. Few entries, no clear dates or timeline, impossible to understand the project progression.'
    },
    'Iteration': {
        4: 'Candidly and precisely documents specific technical failures or struggles. Clearly details the iterative process taken to analyze why something failed and how they attempted to fix it. Documented solution for every issue.',
        3: 'Lists problems encountered and includes successful follow-up solutions. Shows that problem-solving occurred, though it might lack deep detail on the steps between failure and final solution.',
        2: 'Vaguely mentions difficulties or lists them without detail. Many problems identified lack corresponding solutions or follow-up actions.',
        1: 'Documents only successes or surface-level work. Zero evidence of technical struggle, failure documentation, or iterative improvement.'
    },
    'Reflection': {
        4: 'Features a deep, honest self-reflection of the journey, balancing analysis of struggles against recognition of achievements and learning points. Evaluates how the process made them feel as makers.',
        3: 'Includes reflective summaries that recognize progress and identify key learning milestones, though the analysis of personal growth or struggle could be deeper.',
        2: 'Reflection is highly superficial (e.g., "Today went well") and lacks any genuine analysis of struggles or successes. It reads like a dry checklist.',
        1: 'No self-reflection or honest assessment included at all.'
    },
    'Task': {
        4: 'Activity descriptions are exceptionally detailed and articulate. The text paints a vivid, precise picture of exactly what specific technical, research, or building tasks were performed during that session, leaving no ambiguity about the work done.',
        3: 'Activity descriptions are clear and specify what was done, though some technical details, materials used, or specific steps might be slightly generalized.',
        2: 'Task descriptions are overly vague or repetitive (e.g., "did research," "worked on project," "cut materials"). It is hard to know exactly what was accomplished during the session.',
        1: 'Descriptions are missing, entirely uninformative, or just list the name of the project phase without explaining the actual work done.'
    }
};

// ─── C5 Rubric Tooltips ─────────────────────────────
const C5_RUBRIC_TOOLTIPS: Record<string, Record<number, string>> = {
    'Problem Articulation': {
        4: 'Masterfully defines the problem, deeply justifies its significance to a specific target audience, and thoroughly accounts for real-world constraints.',
        3: 'Clearly states the problem and audience but lacks deep justification or detailed constraints.',
        2: 'Vague problem and generic audience with little context.',
        1: 'Fails to define the problem, audience, or constraints entirely.'
    },
    'Scientific Foundation & Math': {
        4: 'Flawless scientific accuracy, precise mathematical data supporting their claims, and explicit links between at least two STEAM fields.',
        3: 'Mostly accurate science and math with clear STEAM connections.',
        2: 'Shaky scientific theories, weak math, and forced interdisciplinary links.',
        1: 'Major factual errors, no mathematical backing, and zero STEAM integration.'
    },
    'Solution & Architecture': {
        4: 'The prototype directly solves the problem with exceptional documentation of the Engineering Design Process (EDP), clear iterations, and strong aesthetic choices.',
        3: 'A solid solution with good EDP documentation and helpful visuals.',
        2: 'Partially solves the problem but lacks evidence of testing, iteration, or clear visuals.',
        1: 'Does not solve the problem and shows zero evidence of design iteration or visual planning.'
    },
    'Presentation Delivery': {
        4: 'Seamless, equal team participation, highly organized visual aids, and confident, deeply knowledgeable answers during the Q&A.',
        3: 'Even participation and clear visuals, with adequate but surface-level Q&A answers.',
        2: 'Uneven speaking time, cluttered slides, and significant struggle during the Q&A.',
        1: 'Poor delivery, missing visuals, and a complete inability to answer questions.'
    }
};

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
    const [overviewGradeFilter, setOverviewGradeFilter] = useState<string>('');

    // Reference Data
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
    const [rubricDimensions, setRubricDimensions] = useState<RubricDimension[]>([]);
    const [rubricIndicators, setRubricIndicators] = useState<RubricIndicator[]>([]);

    // PDF Export State
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const pdfRef = useRef<HTMLDivElement>(null);

    const handleExportPDF = async () => {
        if (!pdfRef.current || !assessProject) return;
        setIsExportingPDF(true);
        try {
            const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`STEAM_Report_${assessProject.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            showToast('PDF Exported Successfully!', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to export PDF', 'error');
        } finally {
            setIsExportingPDF(false);
        }
    };

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
    const [submissionClassFilter, setSubmissionClassFilter] = useState<string>('');
    const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string[]>([]);
    const [submissionViewMode, setSubmissionViewMode] = useState<'card' | 'list'>('card');
    const [submissionGroupByClass, setSubmissionGroupByClass] = useState(false);

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

    // Logbook Tab State
    const [logbookGrade, setLogbookGrade] = useState<string>('');
    const [gradeLogbooksList, setGradeLogbooksList] = useState<any[]>([]);
    const [selectedGroupForLogbook, setSelectedGroupForLogbook] = useState<{ class_name: string, group_number: number } | null>(null);
    const [groupLogbooks, setGroupLogbooks] = useState<any[]>([]);
    const [isFetchingLogbooks, setIsFetchingLogbooks] = useState(false);
    const [logbookClassFilter, setLogbookClassFilter] = useState<string>('');
    const [logbookViewMode, setLogbookViewMode] = useState<'card' | 'list'>('card');
    const [logbookGroupByClass, setLogbookGroupByClass] = useState(false);

    const fetchGradeLogbooksList = async () => {
        if (!logbookGrade) return;
        setIsFetchingLogbooks(true);
        setSelectedGroupForLogbook(null);
        setGroupLogbooks([]);

        const groupsInGrade = allStudents.filter(s => String(s.class_name).split('.')[0] === logbookGrade);
        const uniqueGroups = new Map();
        groupsInGrade.forEach(s => {
            uniqueGroups.set(`${s.class_name}-${s.group_number}`, { class_name: s.class_name, group_number: s.group_number });
        });

        const { data: logs } = await supabase
            .from('logbooks')
            .select('*')
            .eq('academic_year', ACADEMIC_YEAR)
            .ilike('class_name', `${logbookGrade}.%`)
            .order('entry_date', { ascending: false });

        const listView: any[] = [];
        uniqueGroups.forEach((group) => {
            const groupLogs = logs?.filter(l => l.class_name === group.class_name && l.group_number === group.group_number) || [];
            if (groupLogs.length > 0) {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    entriesCount: groupLogs.length,
                    latestEntryDate: groupLogs[0].entry_date,
                    allEntries: groupLogs
                });
            } else {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    entriesCount: 0,
                    latestEntryDate: null,
                    allEntries: []
                });
            }
        });

        setGradeLogbooksList(listView.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number));
        setIsFetchingLogbooks(false);
    };

    const handleSelectLogbookGroup = (group: any) => {
        setSelectedGroupForLogbook({ class_name: group.class_name, group_number: group.group_number });
        setGroupLogbooks(group.allEntries);
    };

    // Assess Tab State
    const [assessGrade, setAssessGrade] = useState<string>('');
    const [assessClass, setAssessClass] = useState<string>('');
    const [assessGroup, setAssessGroup] = useState<string>('');
    const [assessCategory, setAssessCategory] = useState<string>('');
    const [assessedGroupsMap, setAssessedGroupsMap] = useState<Record<number, boolean>>({});

    // Assess Form State
    const [assessProject, setAssessProject] = useState<any>(null);
    const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
    const [assessStatus, setAssessStatus] = useState<string>('');
    const [assessComment, setAssessComment] = useState<string>('');
    const [assessLogbooks, setAssessLogbooks] = useState<any[]>([]);
    const [c5Questions, setC5Questions] = useState<string>('');
    const [isGeneratingC5, setIsGeneratingC5] = useState(false);
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [isAutoAssessing, setIsAutoAssessing] = useState(false);
    const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);
    const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

    // Analytics State
    const [allAssessmentScores, setAllAssessmentScores] = useState<any[]>([]);
    const [analyticsGrade, setAnalyticsGrade] = useState<string>('');
    const [analyticsClass, setAnalyticsClass] = useState<string>('');
    const [analyticsCategory, setAnalyticsCategory] = useState<string>('');

    const handleAutoAssess = async () => {
        if (!assessProject || !assessCategory) return;
        setIsAutoAssessing(true);
        showToast('Gemini AI is analyzing the project...', 'info');

        try {
            const cat = assessmentCategories.find(c => c.id === assessCategory);
            const dims = rubricDimensions.filter(d => d.category_id === assessCategory);
            const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));

            const categoryName = cat?.name || 'Unknown Category';
            const indicators = inds.map(i => ({ id: i.id, description: i.description }));
            const googleDocUrl = assessProject?.google_doc_url || null;
            const project = assessProject; // Alias for clarity

            const response = await fetch('/api/ai-assess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project: assessProject,
                    categoryName: cat?.name || 'Unknown Category',
                    indicators: inds.map(i => ({ id: i.id, description: i.description })),
                    googleDocUrl: assessProject?.google_doc_url || null,
                    assessLogbooks: cat?.code === 'C4' ? assessLogbooks : undefined
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

    const handleGenerateC5Questions = async () => {
        if (!assessProject) return;
        setIsGeneratingC5(true);
        showToast('Gemini AI is analyzing the project presentation outline...', 'info');

        try {
            const response = await fetch('/api/generate-c5-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectData: assessProject })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate C5 context questions');
            }

            if (data.generatedQuestions) {
                setC5Questions(data.generatedQuestions);
                
                // Save immediately to cache in database so we don't need to generate again later
                const { error: dbError } = await supabase
                    .from('projects')
                    .update({ c5_generated_questions: data.generatedQuestions })
                    .eq('id', assessProject.id);

                if (dbError) throw dbError;
                showToast('Q&A context generated & saved successfully!', 'success');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsGeneratingC5(false);
        }
    };

    const availableAssessClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === assessGrade).map(s => s.class_name))).sort();
    const availableAssessGroups = Array.from(new Set(allStudents.filter(s => s.class_name === assessClass).map(s => s.group_number))).sort((a: number, b: number) => a - b);

    // Auto-select first group when class changes
    useEffect(() => {
        if (assessClass && availableAssessGroups.length > 0) {
            setAssessGroup(availableAssessGroups[0].toString());
        } else {
            setAssessGroup('');
        }
    }, [assessClass]);

    // Fetch assessed groups map when class or category changes
    useEffect(() => {
        const fetchAssessedGroups = async () => {
            if (!assessClass || !assessCategory) {
                setAssessedGroupsMap({});
                return;
            }
            const { data: scores } = await supabase
                .from('assessment_scores')
                .select('group_number')
                .eq('class_name', assessClass)
                .eq('category_id', assessCategory)
                .eq('academic_year', ACADEMIC_YEAR);
            const map: Record<number, boolean> = {};
            const currentCat = assessmentCategories.find(c => c.id === assessCategory);
            // We just need map of group_number -> true if they have any scores in this category
            if (scores) {
                scores.forEach(s => { map[s.group_number] = true; });
            }
            setAssessedGroupsMap(map);
        };
        fetchAssessedGroups();
    }, [assessClass, assessCategory, supabase]);

    useEffect(() => {
        const loadAssessData = async () => {
            if (!assessClass || !assessGroup || !assessCategory) {
                setAssessProject(null);
                setCurrentScores({});
                setAssessComment('');
                setAssessStatus('');
                setC5Questions('');
                return;
            }

            // Reset state before loading new data
            setCurrentScores({});
            setAssessComment('');
            setAssessStatus('');
            setAssessLogbooks([]);
            setC5Questions('');

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

            // Load existing scores for this group + category
            const { data: scores } = await supabase
                .from('assessment_scores')
                .select('indicator_id, score, teacher_comment')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('category_id', assessCategory)
                .eq('academic_year', ACADEMIC_YEAR);

            if (scores && scores.length > 0) {
                const scoreMap: Record<string, number> = {};
                scores.forEach(s => scoreMap[s.indicator_id] = s.score);
                setCurrentScores(scoreMap);

                // Load comment from the assessment scores (stored per-category)
                const savedComment = scores.find(s => s.teacher_comment)?.teacher_comment || '';
                setAssessComment(savedComment);

                // Lock if scores already exist
                setIsAssessmentLocked(true);
            } else {
                setCurrentScores({});
                setAssessComment('');
                setIsAssessmentLocked(false);
            }

            // Load status from project only for C1 assessments
            const currentCat = assessmentCategories.find(c => c.id === assessCategory);
            const isC1Category = currentCat?.code === 'C1';
            if (isC1Category) {
                setAssessStatus(proj?.status !== 'pending' ? proj?.status : '');
            } else {
                setAssessStatus('');
            }

            // Fetch Logbooks if category is C4
            if (currentCat?.code === 'C4') {
                const { data: logs } = await supabase
                    .from('logbooks')
                    .select('*')
                    .eq('class_name', assessClass)
                    .eq('group_number', parseInt(assessGroup))
                    .eq('academic_year', ACADEMIC_YEAR)
                    .order('entry_date', { ascending: true });
                if (logs) {
                    setAssessLogbooks(logs);
                }
            }

            // Load C5 Questions if category is C5
            if (currentCat?.code === 'C5' && proj) {
                setC5Questions(proj.c5_generated_questions || '');
            }
        };
        loadAssessData();
    }, [assessClass, assessGroup, assessCategory, supabase]);

    const submitAssessment = async () => {
        if (!assessClass || !assessGroup || !assessCategory || !teacherProfile) return;
        const selectedCat = assessmentCategories.find(c => c.id === assessCategory);
        const isC1Category = selectedCat?.code === 'C1';
        
        // Only C1 assessments require an approval status
        if (isC1Category && !assessStatus) {
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
                setIsAssessmentLocked(true);
                setAssessedGroupsMap(prev => ({ ...prev, [groupNum]: true }));

                // Update local analytics data so charts reflect instantly
                setAllAssessmentScores(prev => {
                    const filtered = prev.filter(s => !(s.class_name === assessClass && s.group_number === groupNum && s.category_id === assessCategory));
                    return [...filtered, ...scoreEntries];
                });

                if (assessProject && isC1Category) { // Only update the global project status for C1 (Proposals)
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
                .select('full_name, class_name, group_number, email')
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

            // 1c. Fetch all assessment scores for analytics
            const { data: allScores } = await supabase
                .from('assessment_scores')
                .select('*')
                .eq('academic_year', ACADEMIC_YEAR);
            if (allScores) setAllAssessmentScores(allScores);

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
                    <Star className="w-6 h-6 text-amber-500 fill-amber-500" strokeWidth={2} />
                    <span className="font-bold text-xl text-amber-500">
                        PAHOA STEAM ASSESSMENT
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

            <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 h-[calc(100vh-65px)] overflow-hidden">
                {/* Sidebar */}
                <aside
                    className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 z-40 bg-[#1c1b14] pt-2 md:pt-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                    {[
                        { id: 'overview', label: 'Projects Overview', icon: LayoutDashboard },
                        { id: 'submissions', label: 'Project Submissions', icon: FolderOpen },
                        { id: 'logbook', label: 'Student Logbook', icon: BookOpen },
                        { id: 'score', label: 'Student Score', icon: BarChart2 },
                        { id: 'assess', label: 'Project Assessment', icon: ClipboardCheck },
                        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
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
                <div className="flex-1 w-full min-w-0 overflow-y-auto">

                    {/* TAB 1: OVERVIEW */}
                    {activeTab === 'overview' && (() => {
                        // Compute filtered projects based on grade filter
                        const filteredProjects = overviewGradeFilter
                            ? recentProjects.filter(p => String(p.class_name).split('.')[0] === overviewGradeFilter)
                            : recentProjects;

                        // Compute unique latest project per group
                        const latestByGroup = new Map<string, ProjectData>();
                        filteredProjects.forEach(p => {
                            const key = `${p.class_name}-${p.group_number}`;
                            if (!latestByGroup.has(key)) latestByGroup.set(key, p);
                        });
                        const uniqueLatest = Array.from(latestByGroup.values());

                        const filteredStudents = overviewGradeFilter
                            ? allStudents.filter(s => String(s.class_name).split('.')[0] === overviewGradeFilter)
                            : allStudents;
                        const filteredGroupCount = new Set(filteredStudents.map(s => `${s.class_name}-${s.group_number}`)).size;

                        const pendingCount = uniqueLatest.filter(p => !p.status || p.status === 'pending').length;
                        const approvedCount = uniqueLatest.filter(p => p.status === 'approved').length;
                        const revisionCount = uniqueLatest.filter(p => p.status === 'revision').length;
                        const disapprovedCount = uniqueLatest.filter(p => p.status === 'disapproved').length;

                        return (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                        <LayoutDashboard className="text-amber-500" />
                                        Projects Overview
                                    </h2>
                                    <div className="w-full sm:w-48">
                                        <select
                                            value={overviewGradeFilter}
                                            onChange={(e) => setOverviewGradeFilter(e.target.value)}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="">All Grades</option>
                                            {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <Users className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs font-semibold">Total Groups</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white">{filteredGroupCount}</div>
                                    </div>
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                                            <span className="text-xs font-semibold">Pending</span>
                                        </div>
                                        <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
                                    </div>
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-semibold">Approved</span>
                                        </div>
                                        <div className="text-2xl font-bold text-emerald-400">{approvedCount}</div>
                                    </div>
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <History className="w-4 h-4 text-orange-400" />
                                            <span className="text-xs font-semibold">Revision</span>
                                        </div>
                                        <div className="text-2xl font-bold text-orange-400">{revisionCount}</div>
                                    </div>
                                    <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <X className="w-4 h-4 text-red-400" />
                                            <span className="text-xs font-semibold">Disapproved</span>
                                        </div>
                                        <div className="text-2xl font-bold text-red-400">{disapprovedCount}</div>
                                    </div>
                                </div>

                                {/* Recent Projects Table */}
                                <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl shadow-xl overflow-hidden mt-4">
                                    <div className="p-6 border-b border-slate-800/50">
                                        <h3 className="text-lg font-bold text-white">{overviewGradeFilter ? `Grade ${overviewGradeFilter} Submissions` : 'All Submissions'}</h3>
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
                                                {filteredProjects.length > 0 ? (
                                                    filteredProjects.slice(0, 10).map((proj) => (
                                                        <tr key={proj.id} className="hover:bg-[#1c1b14]/50 transition-colors">
                                                            <td className="p-4 whitespace-nowrap text-amber-400 font-medium">
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
                                                                    proj.status === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                                        proj.status === 'disapproved' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
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
                        );
                    })()}

                    {/* TAB 1.5: SUBMISSIONS */}
                    {activeTab === 'submissions' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <FolderOpen className="text-amber-500" />
                                Project Submissions & History
                            </h2>

                            {/* Submissions Filters */}
                            {!selectedGroupForSubmission ? (() => {
                                // Compute available classes for filter
                                const submissionAvailableClasses = Array.from(new Set(gradeSubmissionsList.map(g => g.class_name))).sort();
                                // Apply client-side filters
                                let filtered = gradeSubmissionsList;
                                if (submissionClassFilter) filtered = filtered.filter(g => g.class_name === submissionClassFilter);
                                if (submissionStatusFilter.length > 0) filtered = filtered.filter(g => submissionStatusFilter.includes(g.latestStatus));

                                // Group by class if toggled
                                const classesSorted = Array.from(new Set(filtered.map(g => g.class_name))).sort();

                                const statusOptions = ['pending', 'approved', 'revision', 'disapproved', 'not submitted yet'];
                                const statusColors: Record<string, string> = {
                                    'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                                    'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                                    'revision': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                                    'disapproved': 'bg-red-500/10 text-red-400 border-red-500/30',
                                    'not submitted yet': 'bg-slate-800/50 text-slate-400 border-slate-600',
                                };
                                const statusColorsActive: Record<string, string> = {
                                    'pending': 'bg-amber-500 text-[#1a1811] border-amber-500',
                                    'approved': 'bg-emerald-500 text-[#1a1811] border-emerald-500',
                                    'revision': 'bg-orange-500 text-[#1a1811] border-orange-500',
                                    'disapproved': 'bg-red-500 text-white border-red-500',
                                    'not submitted yet': 'bg-slate-500 text-white border-slate-500',
                                };

                                const renderGroupCard = (group: any, idx: number) => (
                                    <div
                                        key={`${group.class_name}-${group.group_number}`}
                                        onClick={() => handleSelectSubmissionGroup(group)}
                                        className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-900/10 group"
                                    >
                                        <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-3">
                                            <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                                {group.class_name} - Group {group.group_number}
                                            </h3>
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${group.latestStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                group.latestStatus === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    group.latestStatus === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                        group.latestStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
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
                                );

                                const renderGroupRow = (group: any) => (
                                    <tr
                                        key={`${group.class_name}-${group.group_number}`}
                                        onClick={() => handleSelectSubmissionGroup(group)}
                                        className="hover:bg-[#1c1b14]/50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium">{group.class_name} - G{group.group_number}</td>
                                        <td className="p-4 font-medium text-slate-200">{group.latestTitle}</td>
                                        <td className="p-4 text-center text-slate-400">{group.iterationsCount}</td>
                                        <td className="p-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${group.latestStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                group.latestStatus === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    group.latestStatus === 'disapproved' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        group.latestStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                            'bg-slate-800/50 text-slate-400 border-slate-700'
                                                }`}>{group.latestStatus}</span>
                                        </td>
                                    </tr>
                                );

                                return (
                                    <>
                                        {/* Grade selector + Search */}
                                        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                                <select
                                                    value={submissionGrade}
                                                    onChange={(e) => { setSubmissionGrade(e.target.value); setGradeSubmissionsList([]); setSubmissionClassFilter(''); setSubmissionStatusFilter([]); }}
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

                                        {/* Extra Filters (only show after data loaded) */}
                                        {gradeSubmissionsList.length > 0 && (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    {/* Class Filter */}
                                                    <div className="w-full sm:w-48">
                                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Filter by Class</label>
                                                        <select
                                                            value={submissionClassFilter}
                                                            onChange={(e) => setSubmissionClassFilter(e.target.value)}
                                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                                        >
                                                            <option value="">All Classes</option>
                                                            {submissionAvailableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    {/* View Toggle */}
                                                    <div className="flex items-end gap-2 ml-auto">
                                                        <button
                                                            onClick={() => setSubmissionGroupByClass(!submissionGroupByClass)}
                                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${submissionGroupByClass ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                        >
                                                            <Users className="w-3.5 h-3.5" /> Group by Class
                                                        </button>
                                                        <button
                                                            onClick={() => setSubmissionViewMode('card')}
                                                            className={`p-2 rounded-lg border transition-all ${submissionViewMode === 'card' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                            title="Card View"
                                                        >
                                                            <LayoutGrid className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setSubmissionViewMode('list')}
                                                            className={`p-2 rounded-lg border transition-all ${submissionViewMode === 'list' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                            title="List View"
                                                        >
                                                            <List className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Status Filter Pills */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Filter by Status</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {statusOptions.map(st => {
                                                            const isActive = submissionStatusFilter.includes(st);
                                                            return (
                                                                <button
                                                                    key={st}
                                                                    onClick={() => {
                                                                        if (isActive) setSubmissionStatusFilter(prev => prev.filter(s => s !== st));
                                                                        else setSubmissionStatusFilter(prev => [...prev, st]);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${isActive ? statusColorsActive[st] : statusColors[st]}`}
                                                                >
                                                                    {st}
                                                                </button>
                                                            );
                                                        })}
                                                        {submissionStatusFilter.length > 0 && (
                                                            <button onClick={() => setSubmissionStatusFilter([])} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Results Area */}
                                        {filtered.length > 0 ? (
                                            submissionViewMode === 'card' ? (
                                                submissionGroupByClass ? (
                                                    <div className="space-y-6">
                                                        {classesSorted.map(cls => (
                                                            <div key={cls}>
                                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                    {filtered.filter(g => g.class_name === cls).map((group, idx) => renderGroupCard(group, idx))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {filtered.map((group, idx) => renderGroupCard(group, idx))}
                                                    </div>
                                                )
                                            ) : (
                                                /* List View */
                                                submissionGroupByClass ? (
                                                    <div className="space-y-6">
                                                        {classesSorted.map(cls => (
                                                            <div key={cls}>
                                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                                            <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold">Title</th><th className="p-3 font-semibold text-center">Iter.</th><th className="p-3 font-semibold">Status</th>
                                                                        </tr></thead>
                                                                        <tbody className="divide-y divide-slate-800/30 text-sm">
                                                                            {filtered.filter(g => g.class_name === cls).map(g => renderGroupRow(g))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                                <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold">Title</th><th className="p-3 font-semibold text-center">Iterations</th><th className="p-3 font-semibold">Status</th>
                                                            </tr></thead>
                                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                                {filtered.map(g => renderGroupRow(g))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            )
                                        ) : (
                                            submissionGrade && !isFetchingSubmissions && (
                                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                                    <AlertTriangle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">{gradeSubmissionsList.length > 0 ? 'No groups match your filters.' : `Click Search to load groups for Grade ${submissionGrade}.`}</p>
                                                </div>
                                            )
                                        )}
                                    </>
                                );
                            })() : (
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

                                                                    <div className="pt-2 flex flex-wrap gap-3">
                                                                        {sub.google_doc_url && (
                                                                            <a href={sub.google_doc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-5 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold">
                                                                                <LinkIcon className="w-4 h-4" />
                                                                                Open Google Doc
                                                                            </a>
                                                                        )}
                                                                        
                                                                        {sub.presentation_url && (
                                                                            <a href={sub.presentation_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 py-2.5 px-5 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-semibold">
                                                                                <Star className="w-4 h-4" />
                                                                                View Canva Presentation
                                                                            </a>
                                                                        )}

                                                                        {sub.additional_documents && sub.additional_documents.map((doc: any, i: number) => (
                                                                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 py-2.5 px-5 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-semibold">
                                                                                <LinkIcon className="w-4 h-4" />
                                                                                {doc.type}
                                                                            </a>
                                                                        ))}
                                                                    </div>

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

                    {/* TAB 1.6: LOGBOOK */}
                    {activeTab === 'logbook' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <BookOpen className="text-amber-500" />
                                Student Logbook
                            </h2>

                            {/* Logbook Filters */}
                            {!selectedGroupForLogbook ? (() => {
                                const logbookAvailableClasses = Array.from(new Set(gradeLogbooksList.map(g => g.class_name))).sort();
                                
                                let filtered = gradeLogbooksList;
                                if (logbookClassFilter) filtered = filtered.filter(g => g.class_name === logbookClassFilter);

                                const classesSorted = Array.from(new Set(filtered.map(g => g.class_name))).sort();

                                const renderGroupCard = (group: any, idx: number) => (
                                    <div
                                        key={`${group.class_name}-${group.group_number}`}
                                        onClick={() => handleSelectLogbookGroup(group)}
                                        className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-900/10 group"
                                    >
                                        <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-3">
                                            <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                                {group.class_name} - Group {group.group_number}
                                            </h3>
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${group.entriesCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                                {group.entriesCount > 0 ? 'Active' : 'No Logs'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                            <BookOpen className="w-3.5 h-3.5" />
                                            {group.entriesCount} Entr{group.entriesCount !== 1 ? 'ies' : 'y'}
                                        </div>
                                        {group.latestEntryDate && (
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Latest: {new Date(group.latestEntryDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                );

                                const renderGroupRow = (group: any) => (
                                    <tr
                                        key={`${group.class_name}-${group.group_number}`}
                                        onClick={() => handleSelectLogbookGroup(group)}
                                        className="hover:bg-[#1c1b14]/50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium">{group.class_name} - G{group.group_number}</td>
                                        <td className="p-4 text-center text-slate-400">{group.entriesCount}</td>
                                        <td className="p-4 text-slate-400 whitespace-nowrap">{group.latestEntryDate ? new Date(group.latestEntryDate).toLocaleDateString() : '-'}</td>
                                        <td className="p-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${group.entriesCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                                {group.entriesCount > 0 ? 'Active' : 'No Logs'}
                                            </span>
                                        </td>
                                    </tr>
                                );

                                return (
                                    <>
                                        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                                            <div className="flex-1">
                                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                                <select
                                                    value={logbookGrade}
                                                    onChange={(e) => { setLogbookGrade(e.target.value); setGradeLogbooksList([]); setLogbookClassFilter(''); }}
                                                    className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                                >
                                                    <option value="">Select Grade</option>
                                                    {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                                </select>
                                            </div>
                                            <div className="flex items-end sm:w-48 shrink-0">
                                                <button
                                                    onClick={fetchGradeLogbooksList}
                                                    disabled={!logbookGrade || isFetchingLogbooks}
                                                    className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                                >
                                                    {isFetchingLogbooks ? 'Loading...' : 'Search Grade'}
                                                </button>
                                            </div>
                                        </div>

                                        {gradeLogbooksList.length > 0 && (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
                                                <div className="flex flex-col sm:flex-row gap-4">
                                                    <div className="w-full sm:w-48">
                                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Filter by Class</label>
                                                        <select
                                                            value={logbookClassFilter}
                                                            onChange={(e) => setLogbookClassFilter(e.target.value)}
                                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                                        >
                                                            <option value="">All Classes</option>
                                                            {logbookAvailableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="flex items-end gap-2 ml-auto">
                                                        <button
                                                            onClick={() => setLogbookGroupByClass(!logbookGroupByClass)}
                                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${logbookGroupByClass ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                        >
                                                            <Users className="w-3.5 h-3.5" /> Group by Class
                                                        </button>
                                                        <button
                                                            onClick={() => setLogbookViewMode('card')}
                                                            className={`p-2 rounded-lg border transition-all ${logbookViewMode === 'card' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                            title="Card View"
                                                        >
                                                            <LayoutGrid className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setLogbookViewMode('list')}
                                                            className={`p-2 rounded-lg border transition-all ${logbookViewMode === 'list' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                                            title="List View"
                                                        >
                                                            <List className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {filtered.length > 0 ? (
                                            logbookViewMode === 'card' ? (
                                                logbookGroupByClass ? (
                                                    <div className="space-y-6">
                                                        {classesSorted.map(cls => (
                                                            <div key={cls}>
                                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                    {filtered.filter(g => g.class_name === cls).map((group, idx) => renderGroupCard(group, idx))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {filtered.map((group, idx) => renderGroupCard(group, idx))}
                                                    </div>
                                                )
                                            ) : (
                                                logbookGroupByClass ? (
                                                    <div className="space-y-6">
                                                        {classesSorted.map(cls => (
                                                            <div key={cls}>
                                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                                    <table className="w-full text-left border-collapse">
                                                                        <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                                            <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold text-center">Entries</th><th className="p-3 font-semibold">Latest Entry</th><th className="p-3 font-semibold">Status</th>
                                                                        </tr></thead>
                                                                        <tbody className="divide-y divide-slate-800/30 text-sm">
                                                                            {filtered.filter(g => g.class_name === cls).map(g => renderGroupRow(g))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                        <table className="w-full text-left border-collapse">
                                                            <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                                <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold text-center">Entries</th><th className="p-3 font-semibold">Latest Entry</th><th className="p-3 font-semibold">Status</th>
                                                            </tr></thead>
                                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                                {filtered.map(g => renderGroupRow(g))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )
                                            )
                                        ) : (
                                            logbookGrade && !isFetchingLogbooks && (
                                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                                    <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">{gradeLogbooksList.length > 0 ? 'No groups match your filters.' : `Click Search to load logbooks for Grade ${logbookGrade}.`}</p>
                                                </div>
                                            )
                                        )}
                                    </>
                                );
                            })() : (
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <button
                                            onClick={() => setSelectedGroupForLogbook(null)}
                                            className="px-4 py-2 bg-[#1c1b14] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center gap-2"
                                        >
                                            &larr; Back to List
                                        </button>
                                        <h3 className="text-lg font-bold text-amber-400">
                                            {selectedGroupForLogbook.class_name} - Group {selectedGroupForLogbook.group_number} Logbook
                                        </h3>
                                    </div>

                                    <div className="flex flex-col xl:flex-row gap-8">
                                        <div className="flex-1">
                                            {groupLogbooks.length > 0 ? (
                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="w-full text-left border-collapse table-fixed">
                                                            <thead>
                                                                <tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                                    <th className="p-4 font-semibold w-24">Date</th>
                                                                    <th className="p-4 font-semibold w-24">Submitted By</th>
                                                                    <th className="p-4 font-semibold w-[28%]">Task / Meeting Focus</th>
                                                                    <th className="p-4 font-semibold w-[28%]">Result / Progress</th>
                                                                    <th className="p-4 font-semibold">Student Feedback</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                                {groupLogbooks.map((log: any, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-[#1a1811]/50 transition-colors">
                                                                        <td className="p-4 text-amber-500 font-medium align-top">
                                                                            {new Date(log.entry_date).toLocaleDateString()}
                                                                        </td>
                                                                        <td className="p-4 text-slate-400 align-top">
                                                                            {allStudents.find(s => s.email === log.student_email)?.full_name || log.student_email?.split('@')[0]}
                                                                        </td>
                                                                        <td className="p-4 text-slate-300 align-top">
                                                                            <div className="whitespace-pre-wrap">{log.task}</div>
                                                                        </td>
                                                                        <td className="p-4 text-slate-300 align-top">
                                                                            <div className="whitespace-pre-wrap">{log.result}</div>
                                                                        </td>
                                                                        <td className="p-4 text-slate-300 align-top">
                                                                            <div className="whitespace-pre-wrap">{log.feedback || <span className="text-slate-600 italic">No feedback</span>}</div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                                    <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">No logbook entries found for this group.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick Navigation Sidebar */}
                                        <div className="w-full xl:w-64 shrink-0">
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                                <p className="text-sm font-bold text-white mb-4">Class {selectedGroupForLogbook.class_name}</p>
                                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                                    {gradeLogbooksList.filter(g => g.class_name === selectedGroupForLogbook.class_name).map(g => (
                                                        <button
                                                            key={g.group_number}
                                                            onClick={() => handleSelectLogbookGroup(g)}
                                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between ${selectedGroupForLogbook.group_number === g.group_number
                                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                                : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                                }`}
                                                        >
                                                            <span>Group {g.group_number}</span>
                                                            {g.entriesCount > 0 && <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 rounded-full font-bold">{g.entriesCount}</span>}
                                                            {g.entriesCount === 0 && <span className="w-2 h-2 rounded-full bg-slate-700 block"></span>}
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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
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
                                        onChange={(e) => { setAssessClass(e.target.value); }}
                                        disabled={!assessGrade}
                                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                    >
                                        <option value="">Select Class</option>
                                        {availableAssessClasses.map(c => <option key={c} value={c}>{c}</option>)}
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
                                    {/* Left sidebar: Project Overview or Logbook Overview */}
                                    <div className="xl:col-span-4 space-y-6">
                                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5 sticky top-24">
                                            {(() => {
                                                const currentCat = assessmentCategories.find(c => c.id === assessCategory);
                                                const isC4 = currentCat?.code === 'C4';

                                                if (isC4) {
                                                    return (
                                                        <>
                                                            <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2">
                                                                <BookOpen className="w-5 h-5 text-amber-500" />
                                                                Logbook Entries
                                                            </h3>
                                                            {assessLogbooks && assessLogbooks.length > 0 ? (
                                                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                                    {assessLogbooks.map((log: any, idx: number) => (
                                                                        <div key={idx} className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50 space-y-3">
                                                                            <div className="flex justify-between items-start border-b border-slate-800/50 pb-2">
                                                                                <span className="text-xs font-bold text-amber-500">{new Date(log.entry_date).toLocaleDateString()}</span>
                                                                                <span className="text-[10px] text-slate-500 uppercase">{allStudents.find(s => s.email === log.student_email)?.full_name || log.student_email?.split('@')[0]}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Task/Focus</span>
                                                                                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.task}</p>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Result</span>
                                                                                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.result}</p>
                                                                            </div>
                                                                            {log.feedback && (
                                                                                <div>
                                                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Feedback</span>
                                                                                    <p className="text-xs text-slate-400 whitespace-pre-wrap italic">{log.feedback}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-8">
                                                                    <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-3 opacity-50" />
                                                                    <p className="text-sm text-slate-400">No logbooks found for this group.</p>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">Project Info</h3>

                                                        {assessProject ? (
                                                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
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

                                                                <div className="mt-4 space-y-3">
                                                                    {assessProject.google_doc_url && (
                                                                        <a href={assessProject.google_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-4 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold">
                                                                            <LinkIcon className="w-4 h-4" />
                                                                            Open Google Doc
                                                                        </a>
                                                                    )}

                                                                    {assessProject.presentation_url && (
                                                                        <a href={assessProject.presentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-purple-500/10 text-purple-400 border border-purple-500/20 py-2.5 px-4 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-semibold">
                                                                            <Star className="w-4 h-4" />
                                                                            View Canva Presentation
                                                                        </a>
                                                                    )}

                                                                    {assessProject.additional_documents && assessProject.additional_documents.map((doc: any, i: number) => (
                                                                        <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-amber-500/10 text-amber-500 border border-amber-500/20 py-2.5 px-4 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-semibold">
                                                                            <LinkIcon className="w-4 h-4" />
                                                                            View {doc.type}
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-8">
                                                                <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                                                                <p className="text-sm text-slate-400">No project submitted by this group yet.</p>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
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
                                                    {/* Lock Banner */}
                                                    {isAssessmentLocked && (
                                                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                                                                <div>
                                                                    <p className="text-sm font-bold text-amber-400">Assessment Locked</p>
                                                                    <p className="text-xs text-amber-500/70">This group has already been assessed. Unlock to modify scores.</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                                <button
                                                                    onClick={handleExportPDF}
                                                                    disabled={isExportingPDF}
                                                                    className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 border border-indigo-500/40 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 disabled:opacity-50"
                                                                >
                                                                    <FileText className="w-4 h-4" />
                                                                    {isExportingPDF ? 'Exporting...' : 'Export PDF'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setShowUnlockConfirm(true)}
                                                                    className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0"
                                                                >
                                                                    <Unlock className="w-4 h-4" />
                                                                    Unlock
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Unlock Confirmation Dialog */}
                                                    {showUnlockConfirm && (
                                                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowUnlockConfirm(false)}>
                                                            <div className="bg-[#1c1b14] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                                                                <div className="flex items-center gap-3 mb-4">
                                                                    <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                                                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                                    </div>
                                                                    <h3 className="text-lg font-bold text-white">Unlock Assessment?</h3>
                                                                </div>
                                                                <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                                                                    This group has already been assessed. Are you sure you want to unlock and modify the scores? The existing scores will remain until you save new ones.
                                                                </p>
                                                                <div className="flex justify-end gap-3">
                                                                    <button
                                                                        onClick={() => setShowUnlockConfirm(false)}
                                                                        className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setIsAssessmentLocked(false); setShowUnlockConfirm(false); }}
                                                                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#1a1811] px-5 py-2 rounded-lg text-sm font-bold transition-all"
                                                                    >
                                                                        <Unlock className="w-4 h-4" />
                                                                        Yes, Unlock
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {dims.map(dim => {
                                                        const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                                        return (
                                                            <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl shadow-lg">
                                                                <div className="bg-[#1a1811] border-b border-slate-800 rounded-t-xl px-5 py-3">
                                                                    <h3 className="font-bold text-slate-200">{dim.name}</h3>
                                                                </div>
                                                                <div className="divide-y divide-slate-800/50">
                                                                    {inds.map(ind => (
                                                                        <div key={ind.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1a1811]/50 transition-colors last:rounded-b-xl">
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
                                                                                            const isC1 = cat?.code === 'C1';
                                                                                            const isC2 = cat?.code === 'C2';
                                                                                            const isC3 = cat?.code === 'C3';
                                                                                            const isC4 = cat?.code === 'C4';
                                                                                            const isC5 = cat?.code === 'C5';
                                                                                            const tooltipText = isC1 ? C1_RUBRIC_TOOLTIPS[dim.name]?.[val] : isC2 ? C2_RUBRIC_TOOLTIPS[dim.name]?.[val] : isC3 ? C3_RUBRIC_TOOLTIPS[dim.name]?.[val] : isC4 ? C4_RUBRIC_TOOLTIPS[dim.name]?.[val] : isC5 ? C5_RUBRIC_TOOLTIPS[dim.name]?.[val] : undefined;

                                                                                            return (
                                                                                                <div key={val} className="relative group inline-block">
                                                                                                    <button
                                                                                                        onClick={() => !isAssessmentLocked && setCurrentScores(prev => ({ ...prev, [ind.id]: val }))}
                                                                                                        className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm transition-all relative ${isAssessmentLocked ? 'cursor-not-allowed opacity-60' : ''} ${isSelected ? 'bg-amber-500 text-[#1a1811] shadow-lg shadow-amber-500/20 translate-y-[-2px]' : 'bg-[#1c1b14] text-slate-500 hover:text-amber-400 hover:bg-[#25221b]'}`}
                                                                                                        disabled={isAssessmentLocked}
                                                                                                    >
                                                                                                        {val}
                                                                                                        {tooltipText && (
                                                                                                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-500/20 border border-sky-500/50 text-sky-400 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm">!</div>
                                                                                                        )}
                                                                                                    </button>

                                                                                                    {tooltipText && (
                                                                                                        <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-3 w-64 p-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                                                                            <div className="font-bold text-amber-400 mb-1.5 pb-1.5 border-b border-slate-700/50">Score: {val}</div>
                                                                                                            <div className="leading-relaxed">{tooltipText}</div>
                                                                                                            <div className="absolute top-full right-4 sm:left-1/2 sm:-translate-x-1/2 border-[5px] border-transparent border-t-slate-700"></div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
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

                                                    {/* Approval Status & Comments — hide status for anything except C1 */}
                                                    {(() => {
                                                        const selectedCat = assessmentCategories.find(c => c.id === assessCategory);
                                                        const isC1Category = selectedCat?.code === 'C1';
                                                        const isC5Category = selectedCat?.code === 'C5';
                                                        const isNoStatusCat = !isC1Category;
                                                        return (
                                                            <div className="bg-[#1c1b14] border border-amber-900/50 rounded-xl p-6 shadow-lg mt-8">
                                                                <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">
                                                                    {isNoStatusCat ? 'Feedback & Comments' : 'Final Decision & Feedback'}
                                                                </h3>
                                                                <div className="space-y-5">
                                                                    {!isNoStatusCat && (
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
                                                                    )}
                                                                    <div>
                                                                        <label className="block text-sm font-semibold text-slate-300 mb-2">Teacher Comment / Feedback</label>
                                                                        <textarea
                                                                            value={assessComment}
                                                                            onChange={e => setAssessComment(e.target.value)}
                                                                            rows={3}
                                                                            placeholder="Leave constructive feedback for the group..."
                                                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 resize-none whitespace-pre-wrap"
                                                                            disabled={isAssessmentLocked}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Generated C5 Questions Display */}
                                                    {cat?.code === 'C5' && (c5Questions || isGeneratingC5) && (
                                                        <div className="bg-[#1c1b14] border border-amber-500/30 rounded-xl p-6 shadow-lg mt-8">
                                                            <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
                                                                <FileText className="w-5 h-5 text-amber-500" />
                                                                <h3 className="font-bold text-white">Generated Q&A Context</h3>
                                                            </div>
                                                            {isGeneratingC5 ? (
                                                                <div className="flex items-center justify-center py-8 text-amber-500/70 space-x-2">
                                                                    <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin"></div>
                                                                    <span className="text-sm font-medium">Analyzing project data & generating questions...</span>
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                                    {(() => {
                                                                        if (!c5Questions) return null;
                                                                        // The prompt enforces 1 summary paragraph, followed by a numbered list.
                                                                        // We can roughly split by observing \n1. or splitting by double newlines.
                                                                        const parts = c5Questions.split(/(?=\n1\.\s)/);
                                                                        const summary = parts[0]?.trim();
                                                                        const questions = parts.length > 1 ? parts.slice(1).join('').trim() : '';
                                                                        
                                                                        const questionsList = questions ? questions.split(/\n(?=\d+\.\s)/).map(q => q.trim()).filter(Boolean) : [];

                                                                        return (
                                                                            <>
                                                                                {summary && (
                                                                                    <div className="bg-[#1a1811] border border-slate-800/50 p-4 rounded-xl">
                                                                                         <p className="text-sm text-slate-300 leading-relaxed italic">
                                                                                            {summary}
                                                                                        </p>
                                                                                    </div>
                                                                                )}

                                                                                {questionsList.length > 0 ? (
                                                                                    <div className="grid grid-cols-1 gap-3">
                                                                                        {questionsList.map((q, idx) => {
                                                                                            // Extract the question number and text
                                                                                            const match = q.match(/^(\d+)\.\s*([\s\S]*)/);
                                                                                            const num = match ? match[1] : (idx + 1).toString();
                                                                                            const text = match ? match[2] : q;

                                                                                            // Attempt to extract the bolded category if it exists like "**Problem Articulation (2 Questions):**"
                                                                                            // Wait, the prompt structured it as: 1. **Problem Articulation:** What is...
                                                                                            let category = '';
                                                                                            let cleanText = text;
                                                                                            const catMatch = text.match(/^\*\*(.*?)\*\*\s*([\s\S]*)/);
                                                                                            if (catMatch) {
                                                                                                category = catMatch[1].replace(':', '').trim();
                                                                                                cleanText = catMatch[2].trim();
                                                                                            }

                                                                                            return (
                                                                                                <div key={idx} className="bg-gradient-to-br from-[#1c1b14] to-[#1a1811] border border-amber-500/20 hover:border-amber-500/40 p-4 rounded-xl shadow-sm transition-colors group relative overflow-hidden">
                                                                                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover:bg-amber-500 transition-colors"></div>
                                                                                                    <div className="flex items-start gap-4">
                                                                                                        <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
                                                                                                            {num}
                                                                                                        </div>
                                                                                                        <div className="flex-1 pt-1">
                                                                                                            {category && (
                                                                                                                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-500/80 mb-1.5">
                                                                                                                    {category}
                                                                                                                </span>
                                                                                                            )}
                                                                                                            <p className="text-sm text-slate-200 leading-relaxed font-medium">
                                                                                                                {cleanText.replace(/\*\*/g, '') /* Remove any stray markdown bolds */}
                                                                                                            </p>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                                                        {c5Questions}
                                                                                    </div>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Submit Button */}
                                                    <div className="flex justify-end gap-3 pt-4">
                                                        {cat?.code === 'C5' ? (
                                                            <button
                                                                onClick={handleGenerateC5Questions}
                                                                disabled={isGeneratingC5 || isSubmittingScore || isAssessmentLocked}
                                                                className="flex items-center gap-2 bg-[#1c1b2e] border border-indigo-500/30 text-indigo-400 px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-900/40 hover:text-indigo-300 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isGeneratingC5 ? 'Generating...' : c5Questions ? 'Regenerate Q&A' : 'Generate Q&A'}
                                                                {!isGeneratingC5 && <Sparkles className="w-5 h-5" />}
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={handleAutoAssess}
                                                                disabled={isAutoAssessing || isSubmittingScore || isAssessmentLocked}
                                                                className="flex items-center gap-2 bg-[#1c1b2e] border border-indigo-500/30 text-indigo-400 px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-900/40 hover:text-indigo-300 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isAutoAssessing ? 'AI is Thinking...' : 'Auto-Assess with Gemini'}
                                                                {!isAutoAssessing && <Sparkles className="w-5 h-5" />}
                                                            </button>
                                                        )}
                                                        
                                                        <button
                                                            onClick={submitAssessment}
                                                            disabled={isSubmittingScore || isAutoAssessing || isGeneratingC5 || isAssessmentLocked}
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
                                                {availableAssessGroups.map(g => {
                                                    const isAssessed = assessedGroupsMap[g] === true;
                                                    return (
                                                        <button
                                                            key={g}
                                                            onClick={() => setAssessGroup(g.toString())}
                                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between group ${assessGroup === g.toString()
                                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                                : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                                }`}
                                                        >
                                                            <span>Group {g}</span>
                                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold border transition-colors ${isAssessed
                                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500/20'
                                                                : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:bg-slate-700 group-hover:text-slate-300'
                                                                }`}>
                                                                {isAssessed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                                                                <span>{isAssessed ? 'Assessed' : 'Pending'}</span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-16 bg-[#1a1811]/50 border border-slate-800/50 rounded-2xl">
                                    <ClipboardCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-slate-300 mb-2">Select a Target</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto">Please choose Grade, Class, and Assessment to begin grading. Use the Quick Navigation sidebar to switch between groups.</p>
                                </div>
                            )}

                        </div>
                    )}

                    {/* TAB 5: ANALYTICS */}
                    {activeTab === 'analytics' && (() => {
                        // 1. FILTERING & DATA PREP
                        // Available classes based on selected grade
                        const availableAnalyticsClasses = analyticsGrade
                            ? Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === analyticsGrade).map(s => s.class_name))).sort()
                            : [];

                        // Chart 1 Data: Average score for each assessment (Filtered by Grade/Class)
                        const chart1Data = assessmentCategories.map(cat => {
                            const dims = rubricDimensions.filter(d => d.category_id === cat.id);
                            const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));
                            const isChecklist = cat.rubric_type === 'checklist';
                            const maxScale = parseInt(cat.rubric_type.replace('scale_', '') || '1');
                            const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

                            let baseScores = allAssessmentScores.filter(s => s.category_id === cat.id);
                            if (analyticsClass) {
                                baseScores = baseScores.filter(s => s.class_name === analyticsClass);
                            } else if (analyticsGrade) {
                                baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
                            }

                            const groupScores = new Map<string, number>();
                            baseScores.forEach(s => {
                                const key = `${s.class_name}-${s.group_number}`;
                                groupScores.set(key, (groupScores.get(key) || 0) + s.score);
                            });

                            const groupEntries = Array.from(groupScores.values());
                            const avgPct = groupEntries.length > 0 && maxPerGroup > 0
                                ? Math.round(groupEntries.reduce((a, b) => a + b, 0) / groupEntries.length / maxPerGroup * 100)
                                : 0;
                            return { code: cat.code, name: cat.name, avgPct, groupCount: groupEntries.length };
                        });

                        // Chart 2 & 3 Dependencies: Selected Category
                        const selectedCatForCharts = assessmentCategories.find(c => c.id === analyticsCategory);

                        // Chart 2 Data: Leaderboard (Top 10) for Selected Grade/Class & Category
                        let leaderboardData: { label: string; pct: number }[] = [];
                        if (selectedCatForCharts) {
                            const dims = rubricDimensions.filter(d => d.category_id === selectedCatForCharts.id);
                            const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));
                            const isChecklist = selectedCatForCharts.rubric_type === 'checklist';
                            const maxScale = parseInt(selectedCatForCharts.rubric_type.replace('scale_', '') || '1');
                            const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

                            let baseScores = allAssessmentScores.filter(s => s.category_id === selectedCatForCharts.id);
                            if (analyticsClass) {
                                baseScores = baseScores.filter(s => s.class_name === analyticsClass);
                            } else if (analyticsGrade) {
                                baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
                            }

                            const groupScores = new Map<string, number>();
                            baseScores.forEach(s => {
                                const key = `${s.class_name}-${s.group_number}`;
                                groupScores.set(key, (groupScores.get(key) || 0) + s.score);
                            });

                            groupScores.forEach((score, key) => {
                                const pct = maxPerGroup > 0 ? Math.round((score / maxPerGroup) * 100) : 0;
                                const [cls, grp] = key.split('-');
                                leaderboardData.push({ label: `${cls} G${grp}`, pct });
                            });
                            leaderboardData.sort((a, b) => b.pct - a.pct);
                            leaderboardData = leaderboardData.slice(0, 10); // Top 10
                        }

                        // Chart 3 Data: Avg per dimension for Selected Grade/Class & Category
                        const chart3Data: { dimName: string; avgPct: number; count: number }[] = [];
                        if (selectedCatForCharts) {
                            const dims = rubricDimensions.filter(d => d.category_id === selectedCatForCharts.id);
                            const isChecklist = selectedCatForCharts.rubric_type === 'checklist';
                            const maxScale = parseInt(selectedCatForCharts.rubric_type.replace('scale_', '') || '1');

                            dims.forEach(dim => {
                                const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                const indIds = inds.map(i => i.id);
                                const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

                                let baseScores = allAssessmentScores.filter(s => indIds.includes(s.indicator_id));
                                if (analyticsClass) {
                                    baseScores = baseScores.filter(s => s.class_name === analyticsClass);
                                } else if (analyticsGrade) {
                                    baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
                                }

                                const groupScores = new Map<string, number>();
                                baseScores.forEach(s => {
                                    const key = `${s.class_name}-${s.group_number}`;
                                    groupScores.set(key, (groupScores.get(key) || 0) + s.score);
                                });

                                const entries = Array.from(groupScores.values());
                                const avgPct = entries.length > 0 && maxPerGroup > 0
                                    ? Math.round(entries.reduce((a, b) => a + b, 0) / entries.length / maxPerGroup * 100)
                                    : 0;
                                chart3Data.push({ dimName: dim.name, avgPct, count: entries.length });
                            });
                        }

                        const barColor = (pct: number) => pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

                        return (
                            <div className="space-y-8">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                                    <TrendingUp className="text-amber-500" />
                                    Analytics Dashboard
                                </h2>

                                {/* ANALYTICS FILTERS */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4 shadow-xl">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade Filter</label>
                                        <select
                                            value={analyticsGrade}
                                            onChange={(e) => { setAnalyticsGrade(e.target.value); setAnalyticsClass(''); }}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="">All Grades</option>
                                            {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class Filter</label>
                                        <select
                                            value={analyticsClass}
                                            onChange={(e) => setAnalyticsClass(e.target.value)}
                                            disabled={!analyticsGrade}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                                        >
                                            <option value="">All Classes (in Grade {analyticsGrade || '-'})</option>
                                            {availableAnalyticsClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessment Filter (Charts 2 & 3)</label>
                                        <select
                                            value={analyticsCategory}
                                            onChange={(e) => setAnalyticsCategory(e.target.value)}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                                        >
                                            <option value="">Select an Assessment...</option>
                                            {assessmentCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {allAssessmentScores.length === 0 ? (
                                    <div className="text-center py-16 bg-[#1a1811]/50 border border-slate-800/50 rounded-2xl">
                                        <PieChart className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-slate-300 mb-2">No Assessment Data Yet</h3>
                                        <p className="text-slate-500 max-w-sm mx-auto">Start assessing projects to see analytics here.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Chart 1: Average by Assessment */}
                                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 shadow-xl">
                                            <h3 className="text-lg font-bold text-white mb-2">Average Score by Assessment</h3>
                                            <p className="text-xs text-slate-400 mb-6">
                                                Filtering: {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Grades'}
                                            </p>
                                            <div className="space-y-4">
                                                {chart1Data.map(c => (
                                                    <div key={c.code} className="flex items-center gap-4">
                                                        <span className="w-12 text-sm font-bold text-amber-400 shrink-0" title={c.name}>{c.code}</span>
                                                        <div className="flex-1 bg-[#1c1b14] rounded-full h-8 border border-slate-800 overflow-hidden">
                                                            <div className={`h-full rounded-r-full ${barColor(c.avgPct)} transition-all flex items-center justify-end pr-3`} style={{ width: `${Math.max(c.avgPct, 5)}%` }}>
                                                                <span className="text-xs font-bold text-white drop-shadow-md">{c.avgPct}%</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-500 w-20 text-right shrink-0">{c.groupCount} groups</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                            {/* Chart 2: Leaderboard */}
                                            <div className="bg-[#1a1811] border border-emerald-900/20 rounded-2xl p-6 shadow-xl">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                                        <Star className="w-5 h-5 text-emerald-400" /> Leaderboard (Top 10)
                                                    </h3>
                                                </div>
                                                <p className="text-xs text-slate-400 mb-6">
                                                    {analyticsCategory ? (
                                                        <>Based on <strong className="text-emerald-400">{selectedCatForCharts?.code}</strong> • {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Regions'}</>
                                                    ) : 'Please select an Assessment Filter above to view.'}
                                                </p>

                                                {analyticsCategory ? (
                                                    leaderboardData.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {leaderboardData.map((g, idx) => (
                                                                <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-[#1c1b14] border-b border-l-4 border-l-transparent border-slate-800/50 hover:border-l-emerald-500 hover:bg-[#25221b] transition-all">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-400/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-[#1a1811] text-slate-500 border border-slate-700'}`}>
                                                                        {idx + 1}
                                                                    </div>
                                                                    <span className="flex-1 text-sm font-bold text-slate-200">{g.label}</span>
                                                                    <span className={`text-lg font-bold ${g.pct >= 80 ? 'text-emerald-400' : g.pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{g.pct}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <p className="text-sm text-slate-500 italic py-8 text-center">No scores found for these filters.</p>
                                                ) : (
                                                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl">
                                                        <p className="text-slate-500 flex items-center gap-2 text-sm">
                                                            <Filter className="w-4 h-4" /> Select an assessment
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Chart 3: Dimension Breakdown */}
                                            <div className="bg-[#1a1811] border border-indigo-900/20 rounded-2xl p-6 shadow-xl relative">
                                                <h3 className="text-lg font-bold text-white mb-2">Dimension Breakdown</h3>
                                                <p className="text-xs text-slate-400 mb-6">
                                                    {analyticsCategory ? (
                                                        <>Dimensions of <strong className="text-indigo-400">{selectedCatForCharts?.code}</strong> • {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Regions'}</>
                                                    ) : 'Please select an Assessment Filter above to view.'}
                                                </p>

                                                {analyticsCategory ? (
                                                    chart3Data.length > 0 && chart3Data.some(d => d.count > 0) ? (
                                                        <>
                                                            <div className="space-y-5">
                                                                {chart3Data.map((d, idx) => (
                                                                    <div key={idx} className="space-y-1.5">
                                                                        <div className="flex justify-between items-end">
                                                                            <span className="text-sm font-semibold text-slate-300 truncate pr-4" title={d.dimName}>{d.dimName}</span>
                                                                            <span className="text-sm font-bold text-slate-400">{d.avgPct}%</span>
                                                                        </div>
                                                                        <div className="w-full bg-[#1c1b14] rounded-full h-3 border border-slate-800 overflow-hidden">
                                                                            <div className={`h-full rounded-r-full ${barColor(d.avgPct)} transition-all`} style={{ width: `${Math.max(d.avgPct, 2)}%` }}></div>
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-600 font-medium text-right mt-1">{d.count} groups assessed</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {/* Interactive Radar Chart Representation */}
                                                            <div className="mt-8 pt-6 border-t border-slate-800/50">
                                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Class Skills Profile</h4>
                                                                <div className="h-64 w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chart3Data}>
                                                                            <PolarGrid stroke="#334155" />
                                                                            <PolarAngleAxis dataKey="dimName" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                                                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                                                                            <Radar name="Average Score" dataKey="avgPct" stroke="#818cf8" fill="#818cf8" fillOpacity={0.4} isAnimationActive={true} />
                                                                            <RechartsTooltip contentStyle={{ backgroundColor: '#1e1e2d', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#818cf8' }} />
                                                                        </RadarChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : <p className="text-sm text-slate-500 italic py-8 text-center">No dimension data found for these filters.</p>
                                                ) : (
                                                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl">
                                                        <p className="text-slate-500 flex items-center gap-2 text-sm">
                                                            <Filter className="w-4 h-4" /> Select an assessment
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                </div>
            </main>

            {/* Hidden PDF Export Template */}
            <div style={{ position: 'absolute', top: '-20000px', left: '-20000px', width: '800px' }}>
                <div ref={pdfRef} className="bg-white text-slate-900 p-12 w-[800px] min-h-[1131px] font-sans flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-center border-b-4 border-amber-500 pb-6 mb-8">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">PAHOA STEAM</h1>
                            <h2 className="text-xl font-bold text-amber-600 mt-1">OFFICIAL ASSESSMENT REPORT</h2>
                        </div>
                        <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center">
                            <Star className="w-10 h-10 text-white fill-white" />
                        </div>
                    </div>

                    {/* Project Info */}
                    <div className="mb-8">
                        <h3 className="text-3xl font-bold text-slate-800 leading-tight mb-2">{assessProject?.title || 'Unknown Project'}</h3>
                        <p className="text-slate-500 font-bold uppercase tracking-wider">Group {assessGroup} • Class {assessClass} • Grade {assessGrade}</p>
                        {assessmentCategories.find(c => c.id === assessCategory)?.name && (
                             <p className="text-indigo-600 font-bold mt-2">Assessment: {assessmentCategories.find(c => c.id === assessCategory)?.name}</p>
                        )}
                    </div>

                    {/* Personal Performance Radar Chart */}
                    <div className="flex justify-center mb-10 w-full">
                        {(() => {
                            if (!assessCategory || !currentScores) return null;
                            const dims = rubricDimensions.filter(d => d.category_id === assessCategory);
                            const radarData = dims.map(dim => {
                                const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                const maxScale = parseInt(assessmentCategories.find(c => c.id === assessCategory)?.rubric_type.replace('scale_', '') || '1');
                                const isChecklist = assessmentCategories.find(c => c.id === assessCategory)?.rubric_type === 'checklist';
                                const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;
                                const earned = inds.reduce((sum, i) => sum + (currentScores[i.id] || 0), 0);
                                return {
                                    dimName: dim.name,
                                    score: maxPerGroup > 0 ? Math.round((earned / maxPerGroup) * 100) : 0,
                                };
                            });
                            return radarData.length > 0 ? (
                                <div style={{ width: '400px', height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart data={radarData}>
                                            <PolarGrid stroke="#e2e8f0" />
                                            <PolarAngleAxis dataKey="dimName" tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} />
                                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name="Score" dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} isAnimationActive={false} />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : null;
                        })()}
                    </div>

                    {/* Scores Detail Table */}
                    <div className="mb-8 flex-1">
                        <h4 className="text-xl font-bold border-b-2 border-slate-200 pb-2 mb-4 text-slate-800">Score Breakdown</h4>
                        <div className="space-y-4">
                            {rubricDimensions.filter(d => d.category_id === assessCategory).map(dim => {
                                const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                const maxScale = parseInt(assessmentCategories.find(c => c.id === assessCategory)?.rubric_type.replace('scale_', '') || '1');
                                const isChecklist = assessmentCategories.find(c => c.id === assessCategory)?.rubric_type === 'checklist';
                                const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;
                                const earned = inds.reduce((sum, i) => sum + (currentScores[i.id] || 0), 0);
                                const pct = maxPerGroup > 0 ? Math.round((earned / maxPerGroup) * 100) : 0;
                                
                                return (
                                    <div key={dim.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="font-bold text-slate-700">{dim.name}</span>
                                            <span className="font-bold text-amber-600">{earned}/{maxPerGroup} ({pct}%)</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Certificate Footer */}
                    <div className="mt-auto pt-8 border-t-2 border-slate-200 text-center">
                        <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold uppercase tracking-widest text-sm mb-4">
                            Assessment Completed
                        </div>
                        <h3 className="text-xl font-black text-slate-800">OFFICIAL STEAM ENDORSEMENT</h3>
                        <p className="text-slate-600 mt-2 text-sm italic">This document certifies the evaluation and successful completion of the required PAHOA STEAM Project criteria by the designated student group.</p>
                        <p className="text-slate-400 mt-6 text-xs font-mono">Generated: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
