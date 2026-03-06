'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
    Star, LogOut, Database, PenSquare, FileCheck,
    Plus, Trash2, Link as LinkIcon, Calculator,
    FlaskConical, Paintbrush, Globe, Cpu, Wrench, BookOpen, Calendar, Save, X, Users
} from 'lucide-react';

// Define the subjects available for Key Concepts
const SUBJECTS = [
    { id: 'matematika', label: 'Matematika', icon: Calculator },
    { id: 'fisika', label: 'Fisika', icon: FlaskConical },
    { id: 'biologi', label: 'Biologi', icon: Globe },
    { id: 'kimia', label: 'Kimia', icon: FlaskConical },
    { id: 'teknologi', label: 'Teknologi', icon: Cpu },
    { id: 'engineering', label: 'Engineering', icon: Wrench },
    { id: 'seni', label: 'Seni', icon: Paintbrush },
];

export default function StudentDashboardPage() {
    const [activeTab, setActiveTab] = useState('data');
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [groupId, setGroupId] = useState<string | null>(null);

    // Form State for Project Submission
    const [title, setTitle] = useState('');
    const [theme, setTheme] = useState('');
    const [problem, setProblem] = useState('');
    const [solution, setSolution] = useState('');
    const [docUrl, setDocUrl] = useState('');
    const [keyConcepts, setKeyConcepts] = useState([{ subject: 'matematika', concept: '' }]);
    const [themesList, setThemesList] = useState<{ id: string, theme_name: string }[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Team Members & Project Data State
    const [teamMembers, setTeamMembers] = useState<{ full_name: string; email: string }[]>([]);
    const [projectData, setProjectData] = useState<any | null>(null);
    const [studentInfo, setStudentInfo] = useState<{ class_name: string; group_number: number } | null>(null);

    // Logbook State
    const [logbooks, setLogbooks] = useState<any[]>([]);
    const [showLogbookForm, setShowLogbookForm] = useState(false);
    const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]); // Default to today YYYY-MM-DD
    const [newLogTask, setNewLogTask] = useState('');
    const [newLogResult, setNewLogResult] = useState('');
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchUserAndData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) {
                setUserEmail(user.email);

                // 1. Fetch this student's info from student_master
                const { data: myInfo } = await supabase
                    .from('student_master')
                    .select('full_name, class_name, group_number')
                    .eq('email', user.email)
                    .single();

                if (myInfo) {
                    setStudentInfo({ class_name: myInfo.class_name, group_number: myInfo.group_number });

                    // 2. Fetch team members who share the same class_name and group_number
                    const { data: members } = await supabase
                        .from('student_master')
                        .select('full_name, email')
                        .eq('class_name', myInfo.class_name)
                        .eq('group_number', myInfo.group_number);

                    if (members) setTeamMembers(members);
                }

                // 3. Try to get group_id from the students table (may not exist if backend was reset)
                let idForGroup = null;
                try {
                    const { data: studentData } = await supabase
                        .from('students')
                        .select('group_id, profiles!inner(email)')
                        .eq('profiles.email', user.email)
                        .single();
                    if (studentData?.group_id) {
                        idForGroup = studentData.group_id;
                        setGroupId(idForGroup);
                    }
                } catch (e) {
                    // students/profiles table might not exist or be empty, that's ok
                    console.log('Could not fetch group_id from students table:', e);
                }

                // 4. Fetch themes
                try {
                    const { data: fetchedThemes } = await supabase.from('themes').select('*');
                    if (fetchedThemes && fetchedThemes.length > 0) {
                        setThemesList(fetchedThemes);
                        setTheme(fetchedThemes[0].id);
                    } else {
                        setThemesList([
                            { id: '1', theme_name: 'Sistem Keberlanjutan Lingkungan' },
                            { id: '2', theme_name: 'Inovasi Teknologi Tepat Guna' },
                            { id: '3', theme_name: 'Kesenian Berbasis Digital' }
                        ]);
                        setTheme('1');
                    }
                } catch (e) {
                    setThemesList([
                        { id: '1', theme_name: 'Sistem Keberlanjutan Lingkungan' },
                        { id: '2', theme_name: 'Inovasi Teknologi Tepat Guna' },
                        { id: '3', theme_name: 'Kesenian Berbasis Digital' }
                    ]);
                    setTheme('1');
                }

                // 5. Fetch project data if group_id exists
                if (idForGroup) {
                    try {
                        const { data: fetchedProject } = await supabase
                            .from('projects')
                            .select('*')
                            .eq('group_id', idForGroup)
                            .single();
                        if (fetchedProject) setProjectData(fetchedProject);
                    } catch (e) {
                        console.log('No project found or projects table missing:', e);
                    }
                }

                // 6. Fetch Logbooks if group_id exists
                if (idForGroup) {
                    try {
                        const { data: fetchedLogs } = await supabase
                            .from('logbooks')
                            .select('*')
                            .eq('group_id', idForGroup)
                            .order('entry_date', { ascending: false })
                            .order('created_at', { ascending: false });
                        if (fetchedLogs) setLogbooks(fetchedLogs);
                    } catch (e) {
                        console.log('Logbooks fetch failed:', e);
                    }
                }
            }
            setLoading(false);
        };

        fetchUserAndData();
    }, [supabase]);

    // Handle Key Concepts
    const addConcept = () => {
        setKeyConcepts([...keyConcepts, { subject: 'matematika', concept: '' }]);
    };

    const removeConcept = (index: number) => {
        setKeyConcepts(keyConcepts.filter((_, i) => i !== index));
    };

    const updateConcept = (index: number, field: 'subject' | 'concept', value: string) => {
        const newConcepts = [...keyConcepts];
        newConcepts[index][field] = value;
        setKeyConcepts(newConcepts);
    };

    // Submitting a new Logbook Entry
    const handleLogbookSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userEmail) {
            alert("Sesi anda telah berakhir. Silahkan login kembali.");
            return;
        }
        if (!groupId) {
            alert("Anda belum terdaftar dalam kelompok manapun. Silahkan hubungi guru anda.");
            return;
        }
        if (isSubmittingLog) return;

        setIsSubmittingLog(true);

        const { data, error } = await supabase.from('logbooks').insert([
            {
                group_id: groupId,
                student_email: userEmail,
                entry_date: newLogDate,
                task: newLogTask,
                result: newLogResult
            }
        ]).select();

        setIsSubmittingLog(false);

        if (error) {
            console.error("Error inserting logbook:", error);
            alert("Failed to submit logbook entry. Please check your database connection or schema.");
        } else if (data) {
            // Update local state without re-fetching
            setLogbooks([data[0], ...logbooks]);
            // Reset form
            setNewLogTask('');
            setNewLogResult('');
            setNewLogDate(new Date().toISOString().split('T')[0]); // Reset to today
            setShowLogbookForm(false);
        }
    };

    // Form Submission for Project
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userEmail) {
            alert("Sesi anda telah berakhir. Silahkan login kembali.");
            return;
        }
        if (!groupId) {
            alert("Anda belum terdaftar dalam kelompok manapun. Silahkan hubungi guru anda.");
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);

        // Basic URL validation
        if (!docUrl.includes('docs.google.com')) {
            alert("Please provide a valid Google Docs URL.");
            setIsSubmitting(false);
            return;
        }

        // Check if the Google Doc is public
        try {
            const docCheck = await fetch('/api/check-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: docUrl })
            });
            const checkResult = await docCheck.json();

            if (!checkResult.isPublic) {
                alert("Google Doc error: " + checkResult.error);
                setIsSubmitting(false);
                return;
            }
        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan saat mengecek URL Google Doc.");
            setIsSubmitting(false);
            return;
        }

        // Construct a single text abstract from problem, solution, and key concepts
        const combinedAbstract = `Problem: ${problem}\n\nSolution: ${solution}\n\nKey Concepts: ${keyConcepts.map(c => c.subject + ': ' + c.concept).join(', ')}`;

        // Attempt to submit to Supabase using the exact backend.md schema
        const { data, error } = await supabase.from('projects').insert([
            {
                group_id: groupId,
                theme_id: theme, // We will update the select box to pass the ID
                title: title,
                abstract: combinedAbstract,
                status: 'pending',
                google_doc_url: docUrl
            }
        ]).select();

        setIsSubmitting(false);

        if (error) {
            console.error(error);
            alert("Error submitting project: " + error.message);
        } else {
            alert("Project submitted successfully!");
            setActiveTab('data');
            // Reset form
            setTitle('');
            setProblem('');
            setSolution('');
            setDocUrl('');
            setKeyConcepts([{ subject: 'matematika', concept: '' }]);
        }
    };

    if (loading) return <div className="min-h-screen bg-[#1c1b14] flex items-center justify-center"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div></div>;

    return (
        <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] font-sans">
            {/* Navbar View */}
            <nav className="bg-[#1a1811] border-b border-amber-900/40 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <Star className="text-amber-400 w-6 h-6" fill="currentColor" strokeWidth={0} />
                    <span className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-amber-100 to-amber-500">
                        PAHOA STEAM
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

            {/* Main Layout */}
            <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row gap-8">

                {/* Sidebar / Tabs */}
                <aside
                    className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 sticky top-20 md:top-24 h-fit z-40 bg-[#1c1b14] pt-2 md:pt-0"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />
                    {[
                        { id: 'data', label: 'My Project Data', icon: Database },
                        { id: 'submit', label: 'Submit a Project', icon: PenSquare },
                        { id: 'logbook', label: 'My Logbook', icon: BookOpen },
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
                <div className="flex-1 min-h-[500px]">

                    {/* TAB 1: MY PROJECT DATA */}
                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            {/* Team Members Card */}
                            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                                    <Users className="text-amber-500 w-5 h-5" />
                                    Team Members
                                    {studentInfo && (
                                        <span className="ml-auto text-xs bg-amber-900/30 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20">
                                            {studentInfo.class_name} — Group {studentInfo.group_number}
                                        </span>
                                    )}
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
                                        <p className="text-slate-500 text-sm">No team information found. Make sure your email is registered in the student database.</p>
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
                                        {projectData.abstract && (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Abstract</span>
                                                <p className="text-sm text-slate-300 mt-1 whitespace-pre-line">{projectData.abstract}</p>
                                            </div>
                                        )}
                                        {projectData.google_doc_url && (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                                                <span className="text-xs text-slate-500 uppercase tracking-wider">Google Doc</span>
                                                <a
                                                    href={projectData.google_doc_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 mt-1 transition-colors"
                                                >
                                                    <LinkIcon className="w-4 h-4" />
                                                    Open Document
                                                </a>
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
                                            Your team hasn&apos;t submitted a project yet. Start by filling out the submission form with your project details.
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

                    {/* TAB 2: MY LOGBOOK */}
                    {activeTab === 'logbook' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <BookOpen className="text-amber-500" />
                                    My Logbook
                                </h2>
                                {!showLogbookForm && (
                                    <button
                                        onClick={() => setShowLogbookForm(true)}
                                        className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2 px-4 flex items-center gap-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
                                    >
                                        <Plus className="w-4 h-4" /> Add Log
                                    </button>
                                )}
                            </div>

                            {/* Add Log Form */}
                            {showLogbookForm && (
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    handleLogbookSubmit(e);
                                }} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 mb-8 text-slate-300 space-y-4">
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
                                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/3">Task</th>
                                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/3">Result</th>
                                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm min-w-[150px]">Feedback</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {logbooks.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-slate-500">
                                                    No logbook entries found. Click "Add Log" to create your first entry.
                                                </td>
                                            </tr>
                                        ) : (
                                            logbooks.map((log) => (
                                                <tr key={log.id} className="hover:bg-[#1c1b14] transition-colors">
                                                    <td className="py-4 px-4 text-sm text-amber-500 font-medium whitespace-nowrap align-top">
                                                        {new Date(log.entry_date).toLocaleDateString()}
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
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: PROJECT SUBMISSION */}
                    {activeTab === 'submit' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                                <PenSquare className="text-amber-500" />
                                Project Submission
                            </h2>
                            <p className="text-slate-400 text-sm mb-8">Fill out the details of your STEAM project below.</p>

                            <form onSubmit={handleSubmit} className="space-y-6">
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
                                    <select
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value)}
                                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all appearance-none"
                                    >
                                        {themesList.map((t) => (
                                            <option key={t.id} value={t.id}>{t.theme_name}</option>
                                        ))}
                                    </select>
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

                                {/* Key Concepts (Dynamic Fields) */}
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
                                                {/* Subject Select */}
                                                <div className="relative w-1/3 shrink-0">
                                                    <select
                                                        value={item.subject}
                                                        onChange={(e) => updateConcept(index, 'subject', e.target.value)}
                                                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 appearance-none"
                                                    >
                                                        {SUBJECTS.map((sub) => (
                                                            <option key={sub.id} value={sub.id}>{sub.label}</option>
                                                        ))}
                                                    </select>
                                                    {/* Selected Icon Overlay */}
                                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                        {(() => {
                                                            const SelIcon = SUBJECTS.find(s => s.id === item.subject)?.icon || Calculator;
                                                            return <SelIcon className="w-4 h-4" />;
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Concept Text */}
                                                <input
                                                    type="text"
                                                    required
                                                    value={item.concept}
                                                    onChange={(e) => updateConcept(index, 'concept', e.target.value)}
                                                    className="flex-1 bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                                    placeholder="Describe the concept..."
                                                />

                                                {/* Remove Button */}
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
                                            required
                                            value={docUrl}
                                            onChange={(e) => setDocUrl(e.target.value)}
                                            className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
                                            placeholder="https://docs.google.com/document/d/..."
                                        />
                                    </div>
                                    <p className="text-xs text-amber-500/80 mt-2">
                                        * Make sure the document sharing setting is set to "Anyone with the link can view".
                                    </p>
                                </div>

                                {/* Submit Button */}
                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20 mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <PenSquare className="w-5 h-5" />
                                    )}
                                    {isSubmitting ? 'Submitting...' : 'Submit Project Review'}
                                </button>
                            </form>
                        </div>
                    )}

                    {/* TAB 3: ASSESSMENT RESULT */}
                    {activeTab === 'result' && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                                <FileCheck className="text-amber-500" />
                                Assessment Result
                            </h2>
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
                                <FileCheck className="w-16 h-16 text-slate-700 mb-4" />
                                <h3 className="text-xl font-bold text-slate-300 mb-2">Not Assessed Yet</h3>
                                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                    Your project is currently pending review by your teacher. Once graded, the feedback and scores will appear here.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
