'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, FolderOpen, BookOpen, ClipboardCheck,
    Users, BarChart2, Star, TrendingUp, HelpCircle, Search, BrainCircuit,
    ShieldCheck, DatabaseZap, ScrollText
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type {
    ProjectData, AssessmentCategory, RubricDimension,
    RubricIndicator, TeacherProfile, ConfirmDialogState,
} from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ui/ToastContainer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Navbar from '@/components/ui/Navbar';
import Sidebar, { type SidebarSection } from '@/components/ui/Sidebar';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Tab components
import OverviewTab from './tabs/OverviewTab';
import SubmissionsTab from './tabs/SubmissionsTab';
import LogbookTab from './tabs/LogbookTab';
import PlagiarismTab from './tabs/PlagiarismTab';
import AssessTab from './tabs/AssessTab';
import ScoreTab from './tabs/ScoreTab';
import VotingTab from './tabs/VotingTab';
import AnalyticsTab from './tabs/AnalyticsTab';
import PeerAssessmentResultsTab from './PeerAssessmentResultsTab';
import HelpCenterTab from '../components/HelpCenterTab';
import ProjectClassificationTab from './tabs/ProjectClassificationTab';

// Admin-only tab components
import AdminStudentsTab from './tabs/admin/AdminStudentsTab';
import AdminAccessTab from './tabs/admin/AdminAccessTab';
import AdminProjectsTab from './tabs/admin/AdminProjectsTab';
import AdminAuditTab from './tabs/admin/AdminAuditTab';

// Sidebar sections. Eleven teacher tabs plus four admin ones is too long for a
// flat list — grouping gives the menu a shape and lets the admin items drop the
// "Admin ·" prefix they were carrying to stand apart.
const TEACHER_SECTIONS: SidebarSection[] = [
    {
        label: 'Review',
        tabs: [
            { id: 'overview', label: 'Project Overview', icon: LayoutDashboard },
            { id: 'submissions', label: 'Project Submission', icon: FolderOpen },
            { id: 'logbook', label: 'Project Logbook', icon: BookOpen },
            { id: 'plagiarism', label: 'AI Plagiarism Check', icon: Search },
        ],
    },
    {
        label: 'Assess',
        tabs: [
            { id: 'assess', label: 'Project Assessment', icon: ClipboardCheck },
            { id: 'classification', label: 'Project Classification', icon: BrainCircuit },
            { id: 'peer', label: 'Peer Assessment Result', icon: Users },
        ],
    },
    {
        label: 'Report',
        tabs: [
            { id: 'score', label: 'Student Score', icon: BarChart2 },
            { id: 'voting', label: 'Voting and Leaderboard', icon: Star },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        ],
    },
    {
        label: '',
        tabs: [{ id: 'help', label: 'Help Center', icon: HelpCircle }],
    },
];

// Shown only to teachers flagged as admins in profiles.is_admin.
// See sql/add_admin_role.sql for how the flag is granted.
const ADMIN_SECTION: SidebarSection = {
    label: 'Admin',
    tabs: [
        { id: 'admin-students', label: 'Students & Groups', icon: Users },
        { id: 'admin-access', label: 'Teacher Access', icon: ShieldCheck },
        { id: 'admin-projects', label: 'Project Data', icon: DatabaseZap },
        { id: 'admin-audit', label: 'Activity Log', icon: ScrollText },
    ],
};

const ADMIN_TAB_IDS = new Set(ADMIN_SECTION.tabs.map(t => t.id));

export default function TeacherDashboardPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);

    // Admin rights come from profiles.is_admin (see sql/add_admin_role.sql).
    // This only controls the menu — the database RLS policies are what actually
    // enforce who may write.
    const isAdmin = teacherProfile?.is_admin === true;

    // Overview data
    const [totalGroups, setTotalGroups] = useState(0);
    const [totalProjects, setTotalProjects] = useState(0);
    const [recentProjects, setRecentProjects] = useState<ProjectData[]>([]);

    // Reference data (shared across tabs)
    const [allStudents, setAllStudents] = useState<any[]>([]);
    const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
    const [rubricDimensions, setRubricDimensions] = useState<RubricDimension[]>([]);
    const [rubricIndicators, setRubricIndicators] = useState<RubricIndicator[]>([]);

    // Analytics data
    const [allAssessmentScores, setAllAssessmentScores] = useState<any[]>([]);

    // Voting data
    const [myVotes, setMyVotes] = useState<string[]>([]);
    const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

    // Toast
    const { toasts, showToast, dismissToast } = useToast();

    // Confirm dialog (used by the admin tabs for destructive actions)
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
        open: false, title: '', message: '', onConfirm: () => { },
    });

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') => {
        setConfirmDialog({ open: true, title, message, confirmLabel, onConfirm });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
    }, []);

    // Re-read the roster after an admin edits students or groups, so every
    // other tab (assessment, scores, analytics) sees the change without a reload.
    const refreshStudents = useCallback(async () => {
        const { data: students } = await supabase
            .from('student_master')
            .select('full_name, class_name, group_number, email')
            .eq('academic_year', ACADEMIC_YEAR);
        if (students) {
            setAllStudents(students);
            setTotalGroups(new Set(students.map(s => `${s.class_name}-${s.group_number}`)).size);
        }
    }, []);

    // Leaderboard refresh (used by VotingTab)
    const fetchLeaderboard = useCallback(async () => {
        const { data: leaderboard } = await supabase
            .from('project_leaderboard')
            .select('*')
            .eq('academic_year', ACADEMIC_YEAR)
            .order('vote_count', { ascending: false });
        if (leaderboard) setLeaderboardData(leaderboard);
    }, []);

    // Callback for AssessTab to sync scores with analytics
    const handleAssessmentSaved = useCallback((scores: any[], assessClass: string, assessGroup: number, assessCategory: string) => {
        setAllAssessmentScores(prev => {
            const filtered = prev.filter(s => !(s.class_name === assessClass && s.group_number === assessGroup && s.category_id === assessCategory));
            return [...filtered, ...scores];
        });
    }, []);

    // Main data loading
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
            setTeacherProfile({ ...profile, email: authData.user.email } as TeacherProfile);

            // Fetch my votes
            const { data: votes } = await supabase
                .from('project_votes')
                .select('project_id')
                .eq('teacher_id', profile.id);
            if (votes) setMyVotes(votes.map(v => v.project_id));

            // Fetch leaderboard
            const { data: leaderboard } = await supabase
                .from('project_leaderboard')
                .select('*')
                .eq('academic_year', ACADEMIC_YEAR)
                .order('vote_count', { ascending: false });
            if (leaderboard) setLeaderboardData(leaderboard);

            // Fetch all students
            const { data: students } = await supabase
                .from('student_master')
                .select('full_name, class_name, group_number, email')
                .eq('academic_year', ACADEMIC_YEAR);

            if (students) {
                setAllStudents(students);
                const uniqueGroups = new Set(students.map(s => `${s.class_name}-${s.group_number}`));
                setTotalGroups(uniqueGroups.size);
            }

            // Fetch assessment reference data
            const { data: cats } = await supabase.from('assessment_categories').select('*').order('sort_order');
            if (cats) setAssessmentCategories(cats);

            const { data: dims } = await supabase.from('rubric_dimensions').select('*').order('sort_order');
            if (dims) setRubricDimensions(dims);

            const { data: inds } = await supabase.from('rubric_indicators').select('*').order('sort_order');
            if (inds) setRubricIndicators(inds);

            // Fetch all assessment scores for analytics
            const { data: allScores } = await supabase
                .from('assessment_scores')
                .select('*')
                .eq('academic_year', ACADEMIC_YEAR);
            if (allScores) setAllAssessmentScores(allScores);

            // Fetch submitted projects
            const { data: projects } = await supabase
                .from('projects')
                .select('id, class_name, group_number, title, status, created_at, themes(theme_name)')
                .eq('academic_year', ACADEMIC_YEAR)
                .order('iteration', { ascending: false });

            if (projects) {
                // Filter to only the latest project iteration per group
                const latestProjects: any[] = [];
                const seenGroups = new Set();
                
                for (const p of projects) {
                    const key = `${p.class_name}-${p.group_number}`;
                    if (!seenGroups.has(key)) {
                        seenGroups.add(key);
                        latestProjects.push(p);
                    }
                }
                
                setTotalProjects(latestProjects.length);
                setRecentProjects(latestProjects as unknown as ProjectData[]);
            }

            setLoading(false);
        };

        initData();
    }, []);

    if (loading) return <LoadingScreen message="Loading Teacher Portal..." />;

    return (
        <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] font-sans">
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                onConfirm={() => { confirmDialog.onConfirm(); closeConfirm(); }}
                onCancel={closeConfirm}
            />

            <Navbar portalName={isAdmin ? 'Teacher Portal · Admin' : 'Teacher Portal'} userEmail={teacherProfile?.email} />

            <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 md:h-[calc(100dvh-65px)] md:overflow-hidden">
                <Sidebar
                    sections={isAdmin ? [...TEACHER_SECTIONS, ADMIN_SECTION] : TEACHER_SECTIONS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="flex-1 w-full min-w-0 md:overflow-y-auto">
                    {activeTab === 'overview' && (
                        <OverviewTab
                            recentProjects={recentProjects}
                            allStudents={allStudents}
                            totalGroups={totalGroups}
                        />
                    )}

                    {activeTab === 'submissions' && (
                        <SubmissionsTab
                            allStudents={allStudents}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'logbook' && (
                        <LogbookTab
                            allStudents={allStudents}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'plagiarism' && (
                        <PlagiarismTab
                            allStudents={allStudents}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'assess' && (
                        <AssessTab
                            allStudents={allStudents}
                            assessmentCategories={assessmentCategories}
                            rubricDimensions={rubricDimensions}
                            rubricIndicators={rubricIndicators}
                            showToast={showToast}
                            onAssessmentSaved={handleAssessmentSaved}
                            teacherProfile={teacherProfile}
                        />
                    )}

                    {activeTab === 'peer' && (
                        <div className="p-4 sm:p-0">
                            <PeerAssessmentResultsTab
                                allStudents={allStudents}
                                academicYear={ACADEMIC_YEAR}
                                showToast={showToast}
                            />
                        </div>
                    )}

                    {activeTab === 'score' && (
                        <ScoreTab
                            allStudents={allStudents}
                            assessmentCategories={assessmentCategories}
                            rubricDimensions={rubricDimensions}
                            rubricIndicators={rubricIndicators}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'voting' && (
                        <VotingTab
                            recentProjects={recentProjects}
                            myVotes={myVotes}
                            leaderboardData={leaderboardData}
                            teacherProfile={teacherProfile}
                            showToast={showToast}
                            onVoteChange={setMyVotes}
                            onLeaderboardRefresh={fetchLeaderboard}
                        />
                    )}

                    {activeTab === 'analytics' && (
                        <AnalyticsTab
                            allStudents={allStudents}
                            allAssessmentScores={allAssessmentScores}
                            assessmentCategories={assessmentCategories}
                            rubricDimensions={rubricDimensions}
                            rubricIndicators={rubricIndicators}
                        />
                    )}

                    {activeTab === 'classification' && (
                        <ProjectClassificationTab showToast={showToast} />
                    )}

                    {activeTab === 'help' && (
                        <HelpCenterTab />
                    )}

                    {/* Admin area. The isAdmin guard here is a UI convenience —
                        the database RLS policies are the real enforcement. */}
                    {isAdmin && activeTab === 'admin-students' && (
                        <AdminStudentsTab
                            adminEmail={teacherProfile?.email ?? null}
                            showToast={showToast}
                            showConfirm={showConfirm}
                            onRosterChanged={refreshStudents}
                        />
                    )}

                    {isAdmin && activeTab === 'admin-access' && (
                        <AdminAccessTab
                            adminEmail={teacherProfile?.email ?? null}
                            showToast={showToast}
                            showConfirm={showConfirm}
                        />
                    )}

                    {isAdmin && activeTab === 'admin-projects' && (
                        <AdminProjectsTab
                            adminEmail={teacherProfile?.email ?? null}
                            allStudents={allStudents}
                            showToast={showToast}
                            showConfirm={showConfirm}
                        />
                    )}

                    {isAdmin && activeTab === 'admin-audit' && (
                        <AdminAuditTab showToast={showToast} />
                    )}

                    {/* A teacher who loses admin rights mid-session would
                        otherwise be left staring at a blank pane. */}
                    {!isAdmin && ADMIN_TAB_IDS.has(activeTab) && (
                        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-8 text-center">
                            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-white mb-2">Admin access required</h3>
                            <p className="text-slate-400 text-sm">
                                This section is only available to teachers with admin rights.
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
