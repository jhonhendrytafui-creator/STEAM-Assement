'use client';

import React from 'react';
import {
    Users, Database, PenSquare, BookOpen,
    Link as LinkIcon, MessageSquare, History
} from 'lucide-react';
import { SUBJECTS } from '@/lib/constants';
import type { ProjectData, StudentInfo, TeamMember } from '@/lib/types';

interface ProjectDataTabProps {
    projectData: ProjectData | null;
    teamMembers: TeamMember[];
    studentInfo: StudentInfo;
    userEmail: string | null;
    projectHistory: ProjectData[];
    onViewPastIteration: (iteration: ProjectData) => void;
    renderFormattedText: (text: string) => React.ReactNode;
    onNavigateToSubmit: () => void;
}

export default function ProjectDataTab({
    projectData,
    teamMembers,
    studentInfo,
    userEmail,
    projectHistory,
    onViewPastIteration,
    renderFormattedText,
    onNavigateToSubmit,
}: ProjectDataTabProps) {
    return (
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
                                                onClick={() => onViewPastIteration(past)}
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
                            onClick={onNavigateToSubmit}
                            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-3 px-8 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20"
                        >
                            <PenSquare className="w-5 h-5" />
                            Submit a Project
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
