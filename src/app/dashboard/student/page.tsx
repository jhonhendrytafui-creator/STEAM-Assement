'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
    Database, PenSquare, Monitor, BookOpen, Users,
    FileCheck, Trophy, HelpCircle,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type {
    ProjectData, StudentInfo, TeamMember, Theme,
    LogbookEntry, AssessmentCategory, RubricDimension,
    RubricIndicator, AssessmentScoreEntry,
} from '@/lib/types';
import { useToast } from '@/hooks/useToast';
import ToastContainer from '@/components/ui/ToastContainer';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Navbar from '@/components/ui/Navbar';
import Sidebar from '@/components/ui/Sidebar';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Tab components
import ProjectDataTab from './tabs/ProjectDataTab';
import SubmitProjectTab from './tabs/SubmitProjectTab';
import ProjectDocumentTab from './tabs/ProjectDocumentTab';
import LogbookTab from './tabs/LogbookTab';
import AssessmentResultTab from './tabs/AssessmentResultTab';
import LeaderboardTab from './tabs/LeaderboardTab';
import PeerAssessmentTab from './PeerAssessmentTab';
import HelpCenterTab from '../components/HelpCenterTab';

// Modal components
import PastIterationModal from './modals/PastIterationModal';
import PrecheckModal from './modals/PrecheckModal';

// Tab definitions for sidebar
const STUDENT_TABS = [
    { id: 'data', label: 'Project Data', icon: Database },
    { id: 'submit', label: 'Submit Project', icon: PenSquare },
    { id: 'presentation', label: 'Project Document', icon: Monitor },
    { id: 'logbook', label: 'Project Logbook', icon: BookOpen },
    { id: 'peer', label: 'Peer & Self Assessment', icon: Users },
    { id: 'result', label: 'Assessment Result', icon: FileCheck },
    { id: 'leaderboard', label: 'Project Leaderboard', icon: Trophy },
    { id: 'help', label: 'Help Center', icon: HelpCircle },
];

// Helper: render text with **bold** markdown converted to <strong> tags
function renderFormattedText(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}

export default function StudentDashboardPage() {
    const [activeTab, setActiveTab] = useState('data');
    const [loading, setLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Student and group info
    const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    // Project
    const [projectData, setProjectData] = useState<ProjectData | null>(null);
    const [projectHistory, setProjectHistory] = useState<ProjectData[]>([]);
    const [viewingPastIteration, setViewingPastIteration] = useState<ProjectData | null>(null);

    // Themes
    const [themesList, setThemesList] = useState<Theme[]>([]);

    // Logbook
    const [logbooks, setLogbooks] = useState<LogbookEntry[]>([]);

    // Assessment data
    const [assessmentCategories, setAssessmentCategories] = useState<AssessmentCategory[]>([]);
    const [rubricDimensions, setRubricDimensions] = useState<RubricDimension[]>([]);
    const [rubricIndicators, setRubricIndicators] = useState<RubricIndicator[]>([]);
    const [assessmentScores, setAssessmentScores] = useState<AssessmentScoreEntry[]>([]);

    // Leaderboard
    const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

    // AI Precheck State (shared with SubmitProjectTab)
    const [isPrechecking, setIsPrechecking] = useState(false);
    const [precheckResult, setPrecheckResult] = useState('');
    const [showPrecheckModal, setShowPrecheckModal] = useState(false);

    // Toast and confirm dialog
    const { toasts, showToast, dismissToast } = useToast();
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, confirmLabel = 'Delete') => {
        setConfirmDialog({ open: true, title, message, confirmLabel, onConfirm });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmDialog(prev => ({ ...prev, open: false }));
    }, []);

    // Main data fetching
    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
            setLoading(false);
            return;
        }

        setUserEmail(user.email);

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
        const grade = myInfo.class_name.split('.')[0];

        const { data: members } = await supabase
            .from('student_master')
            .select('full_name, email')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR);
        if (members) setTeamMembers(members);

        const { data: fetchedThemes } = await supabase
            .from('themes')
            .select('id, theme_name')
            .eq('grade', grade)
            .eq('academic_year', ACADEMIC_YEAR);
        if (fetchedThemes && fetchedThemes.length > 0) {
            setThemesList(fetchedThemes);
        }

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
        }

        const { data: fetchedLogs } = await supabase
            .from('logbooks')
            .select('*')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false });
        if (fetchedLogs) setLogbooks(fetchedLogs);

        const { data: cats } = await supabase.from('assessment_categories').select('*').order('sort_order');
        if (cats) setAssessmentCategories(cats);

        const { data: dims } = await supabase.from('rubric_dimensions').select('*').order('sort_order');
        if (dims) setRubricDimensions(dims);

        const { data: inds } = await supabase.from('rubric_indicators').select('*').order('sort_order');
        if (inds) setRubricIndicators(inds);

        const { data: scrs } = await supabase
            .from('assessment_scores')
            .select('id, indicator_id, score, assessed_at, teacher_comment')
            .eq('class_name', myInfo.class_name)
            .eq('group_number', myInfo.group_number)
            .eq('academic_year', ACADEMIC_YEAR);
        if (scrs) setAssessmentScores(scrs);

        const { data: lb } = await supabase
            .from('project_leaderboard')
            .select('*')
            .eq('academic_year', ACADEMIC_YEAR)
            .order('vote_count', { ascending: false });
        if (lb) setLeaderboardData(lb);

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Callbacks for child components
    const handleSubmitSuccess = useCallback((newProject: ProjectData) => {
        setProjectHistory(prev => [newProject, ...prev]);
        setProjectData(newProject);
        setActiveTab('data');
    }, []);

    const handleStartPrecheck = useCallback(() => {
        setIsPrechecking(true);
        setPrecheckResult('');
    }, []);

    const handleEndPrecheck = useCallback((result: string) => {
        setIsPrechecking(false);
        setPrecheckResult(result);
        // Only open the results modal when there is actually something to show.
        // Errors and quota rejections go through handlePrecheckError instead.
        setShowPrecheckModal(Boolean(result && result.trim()));
    }, []);

    // Closes the "analyzing" overlay without opening an empty results modal.
    // The student's typed draft is untouched so they can retry or submit.
    const handlePrecheckError = useCallback(() => {
        setIsPrechecking(false);
        setPrecheckResult('');
        setShowPrecheckModal(false);
    }, []);

    const handleProjectDataUpdate = useCallback((updated: ProjectData) => {
        setProjectData(updated);
        setProjectHistory(prev => {
            const newHistory = [...prev];
            if (newHistory.length > 0) newHistory[0] = updated;
            return newHistory;
        });
    }, []);

    if (loading) return <LoadingScreen message="Loading your dashboard..." />;

    // Sidebar header content with group info
    const sidebarHeader = studentInfo ? (
        <div className="hidden md:flex flex-col bg-[#1a1811] border border-amber-900/30 rounded-xl px-4 py-3 mb-3">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Your Group</span>
            <span className="text-amber-400 font-bold text-lg">
                {studentInfo.class_name} — Group {studentInfo.group_number}
            </span>
            <span className="text-xs text-slate-500 mt-0.5">{ACADEMIC_YEAR}</span>
        </div>
    ) : null;

    return (
        <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] font-sans">
            {/* Loading Overlay for Pre-check */}
            {isPrechecking && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-[2px]">
                    <div className="bg-[#1a1811] border border-indigo-500/30 rounded-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
                        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">AI Pre-Check in Progress</h3>
                        <p className="text-slate-400 text-sm text-center">Please wait while Gemini is analyzing your project details. This may take a few seconds...</p>
                    </div>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                onConfirm={confirmDialog.onConfirm}
                onCancel={closeConfirm}
            />

            <Navbar portalName="Student Portal" userEmail={userEmail} />

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

            {/* Main Layout */}
            {studentInfo && (
                <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 md:h-[calc(100dvh-65px)] md:overflow-hidden">
                    <Sidebar
                        tabs={STUDENT_TABS}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        headerContent={sidebarHeader}
                    />

                    <div className="flex-1 min-h-0 md:overflow-y-auto">
                        {activeTab === 'data' && (
                            <ProjectDataTab
                                projectData={projectData}
                                teamMembers={teamMembers}
                                studentInfo={studentInfo}
                                onNavigateToSubmit={() => setActiveTab('submit')}
                                userEmail={userEmail}
                                projectHistory={projectHistory}
                                onViewPastIteration={setViewingPastIteration}
                                renderFormattedText={renderFormattedText}
                            />
                        )}

                        {activeTab === 'submit' && (
                            <SubmitProjectTab
                                projectData={projectData}
                                studentInfo={studentInfo}
                                userEmail={userEmail}
                                themesList={themesList}
                                projectHistory={projectHistory}
                                assessmentCategories={assessmentCategories}
                                showToast={showToast}
                                onSubmitSuccess={handleSubmitSuccess}
                                onStartPrecheck={handleStartPrecheck}
                                onEndPrecheck={handleEndPrecheck}
                                onPrecheckError={handlePrecheckError}
                                isPrechecking={isPrechecking}
                                onNavigateToData={() => setActiveTab('data')}
                            />
                        )}

                        {activeTab === 'presentation' && (
                            <ProjectDocumentTab
                                projectData={projectData}
                                showToast={showToast}
                                studentInfo={studentInfo}
                                teamMembers={teamMembers}
                                onProjectDataUpdate={handleProjectDataUpdate}
                            />
                        )}

                        {activeTab === 'logbook' && (
                            <LogbookTab
                                projectData={projectData}
                                studentInfo={studentInfo}
                                userEmail={userEmail}
                                logbooks={logbooks}
                                teamMembers={teamMembers}
                                showToast={showToast}
                                onLogbooksUpdate={setLogbooks}
                            />
                        )}

                        {activeTab === 'peer' && (
                            <PeerAssessmentTab
                                userEmail={userEmail!}
                                studentInfo={studentInfo}
                                teamMembers={teamMembers}
                                academicYear={ACADEMIC_YEAR}
                                showToast={showToast}
                            />
                        )}

                        {activeTab === 'result' && (
                            <AssessmentResultTab
                                assessmentCategories={assessmentCategories}
                                rubricDimensions={rubricDimensions}
                                rubricIndicators={rubricIndicators}
                                assessmentScores={assessmentScores}
                                renderFormattedText={renderFormattedText}
                            />
                        )}

                        {activeTab === 'leaderboard' && (
                            <LeaderboardTab leaderboardData={leaderboardData} />
                        )}

                        {activeTab === 'help' && (
                            <HelpCenterTab />
                        )}
                    </div>
                </main>
            )}

            {/* Modals */}
            <PastIterationModal
                iteration={viewingPastIteration}
                onClose={() => setViewingPastIteration(null)}
                renderFormattedText={renderFormattedText}
            />

            <PrecheckModal
                show={showPrecheckModal}
                result={precheckResult}
                onClose={() => setShowPrecheckModal(false)}
                renderFormattedText={renderFormattedText}
            />
        </div>
    );
}
