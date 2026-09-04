'use client';

import React, { useState, useEffect } from 'react';
import {
    Search, FolderOpen, Users, LinkIcon,
    AlertTriangle, CheckCircle, Clock, ClipboardCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType, ProjectData } from '@/lib/types';
import { parseAbstract } from '@/lib/abstract';

interface PlagiarismTabProps {
    allStudents: any[];
    showToast: (message: string, type: ToastType) => void;
}

export default function PlagiarismTab({ allStudents, showToast }: PlagiarismTabProps) {
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedGroup, setSelectedGroup] = useState<string>('');

    const [project, setProject] = useState<ProjectData | null>(null);
    const [isFetchingProject, setIsFetchingProject] = useState(false);
    const [isCheckingAI, setIsCheckingAI] = useState(false);
    const [groupCheckStatus, setGroupCheckStatus] = useState<Record<number, boolean>>({});

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));
    const availableClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === selectedGrade).map(s => s.class_name))).sort();
    const availableGroups = Array.from(new Set(allStudents.filter(s => s.class_name === selectedClass).map(s => s.group_number))).sort((a: number, b: number) => a - b);

    // Auto-select first group when class changes
    useEffect(() => {
        if (selectedClass && availableGroups.length > 0) {
            setSelectedGroup(String(availableGroups[0]));
        } else {
            setSelectedGroup('');
        }
    }, [selectedClass]);

    // Fetch AI check status for all groups in the selected class
    useEffect(() => {
        if (!selectedClass) { setGroupCheckStatus({}); return; }
        const fetchGroupStatus = async () => {
            const { data } = await supabase
                .from('projects')
                .select('group_number, ai_plagiarism_score, iteration')
                .eq('class_name', selectedClass)
                .eq('academic_year', ACADEMIC_YEAR)
                .order('iteration', { ascending: false });

            // For each group_number keep only the latest iteration
            const seen = new Set<number>();
            const statusMap: Record<number, boolean> = {};
            (data || []).forEach((p: any) => {
                if (!seen.has(p.group_number)) {
                    seen.add(p.group_number);
                    statusMap[p.group_number] = p.ai_plagiarism_score !== null && p.ai_plagiarism_score !== undefined;
                }
            });
            setGroupCheckStatus(statusMap);
        };
        fetchGroupStatus();
    }, [selectedClass]);

    // Fetch the selected group's project
    useEffect(() => {
        const fetchProject = async () => {
            if (!selectedClass || !selectedGroup) {
                setProject(null);
                return;
            }
            setIsFetchingProject(true);
            setProject(null);

            const { data: projs } = await supabase
                .from('projects')
                .select('*')
                .eq('class_name', selectedClass)
                .eq('group_number', parseInt(selectedGroup))
                .eq('academic_year', ACADEMIC_YEAR)
                .order('iteration', { ascending: false })
                .limit(1);

            if (projs && projs.length > 0) {
                setProject(projs[0]);
            }
            setIsFetchingProject(false);
        };

        fetchProject();
    }, [selectedClass, selectedGroup]);

    const MAX_SCANS = 3;

    const handleRunAICheck = async () => {
        if (!project) return;
        const currentCount = project.ai_plagiarism_check_count ?? 0;
        if (currentCount >= MAX_SCANS) {
            showToast('Scan limit reached. This group has already been scanned 3 times.', 'warning');
            return;
        }
        setIsCheckingAI(true);
        try {
            const res = await fetch('/api/ai-detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    googleDocUrl: project.google_doc_url,
                    abstractText: project.abstract
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const timestamp = new Date().toISOString();
            const newCount = currentCount + 1;

            const { error } = await supabase
                .from('projects')
                .update({
                    ai_plagiarism_score: data.ai_percentage,
                    ai_plagiarism_checked_at: timestamp,
                    ai_plagiarism_check_count: newCount
                })
                .eq('id', project.id);

            if (error) throw error;

            const remaining = MAX_SCANS - newCount;
            showToast(
                `AI Check complete: Estimated ${data.ai_percentage}% AI generated. ${remaining} scan${remaining !== 1 ? 's' : ''} remaining for this group.`,
                'success'
            );

            setProject(prev => prev ? {
                ...prev,
                ai_plagiarism_score: data.ai_percentage,
                ai_plagiarism_checked_at: timestamp,
                ai_plagiarism_check_count: newCount
            } : null);

            // Mark this group as checked in the Quick Nav
            setGroupCheckStatus(prev => ({ ...prev, [parseInt(selectedGroup)]: true }));

        } catch (e: any) {
            showToast(e.message || 'Failed to run AI check.', 'error');
        } finally {
            setIsCheckingAI(false);
        }
    };

    const getDaysSinceCheck = (dateString: string | null | undefined) => {
        if (!dateString) return null;
        const checkedAt = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - checkedAt.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Search className="text-amber-500" />
                AI Plagiarism Check
            </h2>

            {/* Top Selection Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                    <select
                        value={selectedGrade}
                        onChange={(e) => {
                            setSelectedGrade(e.target.value);
                            setSelectedClass('');
                            setSelectedGroup('');
                        }}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">Select Grade</option>
                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => { setSelectedClass(e.target.value); }}
                        disabled={!selectedGrade}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                        <option value="">Select Class</option>
                        {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {selectedClass && selectedGroup ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* LEFT / CENTER: Project Info & Plagiarism Action */}
                    <div className="xl:col-span-10">
                        {isFetchingProject ? (
                            <div className="flex flex-col items-center justify-center min-h-[400px] bg-[#1c1b14] border border-slate-800 rounded-xl">
                                <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4"></div>
                                <p className="text-slate-400 font-medium">Loading project data...</p>
                            </div>
                        ) : project ? (
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-slate-800 pb-6 mb-6">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                                {project.class_name} • Group {project.group_number}
                                            </span>
                                            <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                                                project.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                project.status === 'revision' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                project.status === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                                'bg-slate-800/50 text-slate-400 border-slate-700'
                                            }`}>
                                                {project.status || 'pending'}
                                            </span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">{project.title}</h3>
                                        <p className="text-sm text-slate-500 flex items-center gap-2">
                                            <Clock className="w-4 h-4" /> Last Updated: {new Date(project.created_at).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {project.google_doc_url && (
                                        <a
                                            href={project.google_doc_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="shrink-0 flex items-center gap-2 bg-[#1a1811] text-blue-400 border border-slate-800 py-2.5 px-4 rounded-lg hover:border-blue-500/30 hover:bg-blue-500/10 transition-colors text-sm font-semibold"
                                        >
                                            <LinkIcon className="w-4 h-4" /> View Google Doc
                                        </a>
                                    )}
                                </div>

                                {/* Plagiarism Action Block */}
                                <div className="bg-gradient-to-br from-[#1a1811] to-[#1c1b14] border border-amber-900/30 rounded-xl p-6 md:p-8 mb-8 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                                    <h4 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                        <Search className="w-5 h-5 text-amber-500" /> AI Plagiarism Scan
                                    </h4>

                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                        <div className="space-y-4 flex-1">
                                            {project.ai_plagiarism_score !== null && project.ai_plagiarism_score !== undefined ? (
                                                <>
                                                    <div className="flex items-baseline gap-3">
                                                        <span className={`text-4xl md:text-5xl font-black tracking-tighter ${
                                                            project.ai_plagiarism_score > 50 ? 'text-red-400' : 'text-emerald-400'
                                                        }`}>
                                                            {project.ai_plagiarism_score}%
                                                        </span>
                                                        <span className="text-slate-400 font-medium">Estimated AI-Generated</span>
                                                    </div>
                                                    <div className="bg-[#1a1811] border border-slate-800 rounded-lg p-3 inline-flex flex-col gap-1">
                                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Scan Metadata</div>
                                                        <div className="text-sm text-slate-300">
                                                            <span className="font-semibold text-amber-100/70">Last Checked: </span>
                                                            {project.ai_plagiarism_checked_at ? new Date(project.ai_plagiarism_checked_at).toLocaleString() : 'Unknown'}
                                                        </div>
                                                        <div className="text-sm text-slate-300">
                                                            <span className="font-semibold text-amber-100/70">Days Passed: </span>
                                                            {getDaysSinceCheck(project.ai_plagiarism_checked_at) ?? 0} days ago
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-slate-400">
                                                    <p className="mb-2">This project has not been scanned for AI plagiarism yet.</p>
                                                    <p className="text-sm">Click the button to scan the project abstract and Google Doc content.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-2 shrink-0">
                                            {(() => {
                                                const count = project.ai_plagiarism_check_count ?? 0;
                                                const remaining = MAX_SCANS - count;
                                                const isLimitReached = count >= MAX_SCANS;
                                                return (
                                                    <>
                                                        <button
                                                            onClick={handleRunAICheck}
                                                            disabled={isCheckingAI || isLimitReached || (!project.google_doc_url && !project.abstract)}
                                                            className="group relative px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
                                                        >
                                                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                                                            {isCheckingAI ? (
                                                                <>
                                                                    <div className="w-5 h-5 border-2 border-[#1a1811]/30 border-t-[#1a1811] rounded-full animate-spin"></div>
                                                                    <span>Scanning...</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Search className="w-5 h-5 relative z-10" />
                                                                    <span className="relative z-10 uppercase tracking-wide">
                                                                        {project.ai_plagiarism_score !== null && project.ai_plagiarism_score !== undefined ? 'Re-scan Project' : 'Scan Project'}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </button>
                                                        <p className={`text-xs font-semibold ${isLimitReached ? 'text-red-400' : 'text-slate-500'}`}>
                                                            {isLimitReached
                                                                ? 'Scan limit reached (3/3)'
                                                                : `${remaining} scan${remaining !== 1 ? 's' : ''} remaining`}
                                                        </p>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Project Abstract Content Preview */}
                                {project.abstract && (() => {
                                    const absData = parseAbstract(project.abstract);
                                    return (
                                        <div className="space-y-4 opacity-70">
                                            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-2">Abstract Preview</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Problem</span>
                                                    <p className="text-sm text-slate-400 leading-relaxed italic">{absData.problem || 'No description provided.'}</p>
                                                </div>
                                                <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Solution</span>
                                                    <p className="text-sm text-slate-400 leading-relaxed italic">{absData.solution || 'No description provided.'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        ) : (
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                                <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
                                <h3 className="text-xl font-bold text-slate-300 mb-2">No Project Found</h3>
                                <p className="text-slate-500 max-w-md">This group has not submitted a project for the current academic year.</p>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Quick Navigation (narrow, matching AssessTab col-span-2) */}
                    <div className="xl:col-span-2 space-y-6">
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                            <p className="text-sm font-bold text-white mb-4">Class {selectedClass}</p>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                {availableGroups.map(groupNum => {
                                    const isActive = selectedGroup === String(groupNum);
                                    const isChecked = groupCheckStatus[groupNum] === true;

                                    return (
                                        <button
                                            key={groupNum}
                                            onClick={() => setSelectedGroup(String(groupNum))}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between group ${
                                                isActive
                                                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                    : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                            }`}
                                        >
                                            <span>Group {groupNum}</span>
                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold border transition-colors ${
                                                isChecked
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500/20'
                                                    : 'bg-slate-800 text-slate-500 border-slate-700 group-hover:bg-slate-700 group-hover:text-slate-300'
                                            }`}>
                                                {isChecked
                                                    ? <CheckCircle className="w-3.5 h-3.5" />
                                                    : <Clock className="w-3 h-3" />
                                                }
                                                <span>{isChecked ? 'Checked' : 'Pending'}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="w-20 h-20 bg-[#1a1811] border border-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                        <ClipboardCheck className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-300 mb-2">Select a Target</h3>
                    <p className="text-slate-500 max-w-md">Please choose a Grade and Class from the dropdowns above to begin checking projects for AI plagiarism. Use the Quick Navigation sidebar to switch between groups.</p>
                </div>
            )}
        </div>
    );
}
