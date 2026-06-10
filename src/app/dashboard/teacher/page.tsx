'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutDashboard, FolderOpen, BookOpen, ClipboardCheck,
    Users, BarChart2, Star, TrendingUp, HelpCircle, Search
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type {
    ProjectData, AssessmentCategory, RubricDimension,
    RubricIndicator, ToastType,
} from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ui/ToastContainer';
import Navbar from '@/components/ui/Navbar';
import Sidebar from '@/components/ui/Sidebar';
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

// Tab definitions for sidebar
const TEACHER_TABS = [
    { id: 'overview', label: 'Project Overview', icon: LayoutDashboard },
    { id: 'submissions', label: 'Project Submission', icon: FolderOpen },
    { id: 'logbook', label: 'Project Logbook', icon: BookOpen },
    { id: 'plagiarism', label: 'AI Plagiarism Check', icon: Search },
    { id: 'assess', label: 'Project Assessment', icon: ClipboardCheck },
    { id: 'peer', label: 'Peer Assessment Result', icon: Users },
    { id: 'score', label: 'Student Score', icon: BarChart2 },
    { id: 'voting', label: 'Voting and Leaderboard', icon: Star },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'help', label: 'Help Center', icon: HelpCircle },
];

export default function TeacherDashboardPage() {
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [teacherProfile, setTeacherProfile] = useState<any>(null);

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
            setTeacherProfile({ ...profile, email: authData.user.email });

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

            <Navbar portalName="Teacher Portal" userEmail={teacherProfile?.email} />

            <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 h-[calc(100vh-65px)] overflow-hidden">
                <Sidebar
                    tabs={TEACHER_TABS}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />

                <div className="flex-1 w-full min-w-0 overflow-y-auto">
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

                    {activeTab === 'help' && (
                        <HelpCenterTab />
                    )}
                </div>
            </main>
        </div>
    );
}
