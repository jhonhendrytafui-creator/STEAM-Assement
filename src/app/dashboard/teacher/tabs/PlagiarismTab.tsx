'use client';

import React, { useState, useEffect } from 'react';
import { 
    Search, FolderOpen, Users, LinkIcon, 
    AlertTriangle, LayoutGrid, List, CheckCircle, Clock 
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType, ProjectData } from '@/lib/types';

interface PlagiarismTabProps {
    allStudents: any[];
    showToast: (message: string, type: ToastType) => void;
}

export default function PlagiarismTab({ allStudents, showToast }: PlagiarismTabProps) {
    const [selectedGrade, setSelectedGrade] = useState<string>('');
    const [selectedGroup, setSelectedGroup] = useState<string>('');
    const [project, setProject] = useState<ProjectData | null>(null);
    const [isFetchingProject, setIsFetchingProject] = useState(false);
    
    const [isCheckingAI, setIsCheckingAI] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [groupByClass, setGroupByClass] = useState(false);

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    useEffect(() => {
        const fetchProject = async () => {
            if (!selectedGrade || !selectedGroup) return;
            setIsFetchingProject(true);
            setProject(null);

            // Fetch the LATEST iteration for the selected group
            const { data: projs } = await supabase
                .from('projects')
                .select('*')
                .eq('class_name', selectedGrade)
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
    }, [selectedGrade, selectedGroup]);

    const handleRunAICheck = async () => {
        if (!project) return;
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

            // Update database
            const { error } = await supabase
                .from('projects')
                .update({ 
                    ai_plagiarism_score: data.ai_percentage,
                    ai_plagiarism_checked_at: timestamp
                })
                .eq('id', project.id);
            
            if (error) throw error;

            showToast(`AI Check complete: Estimated ${data.ai_percentage}% AI generated.`, 'success');
            
            // Update local state
            setProject(prev => prev ? { 
                ...prev, 
                ai_plagiarism_score: data.ai_percentage,
                ai_plagiarism_checked_at: timestamp 
            } : null);

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
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Search className="text-amber-500" />
                AI Plagiarism Check
            </h2>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* LEFT SIDEBAR: Navigation */}
                <div className="xl:col-span-3 space-y-6">
                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider flex items-center gap-2">
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                            1. Select Grade
                        </h3>
                        <div className="flex flex-col gap-2">
                            {availableGrades.map(grade => {
                                const isActive = selectedGrade === grade && !selectedGroup;
                                const isExpanded = selectedGrade === grade;
                                
                                // Get classes for this grade
                                const gradeClasses = Array.from(new Set(
                                    allStudents
                                        .filter(s => String(s.class_name).split('.')[0] === grade)
                                        .map(s => s.class_name)
                                )).sort();

                                return (
                                    <div key={grade} className="flex flex-col gap-1">
                                        <button
                                            onClick={() => {
                                                setSelectedGrade(grade);
                                                setSelectedGroup('');
                                            }}
                                            className={`flex items-center justify-between w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                                                isActive
                                                    ? 'bg-amber-500 text-[#1a1811] font-bold shadow-md'
                                                    : 'bg-[#1a1811] border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 font-semibold'
                                            }`}
                                        >
                                            <span>Grade {grade}</span>
                                        </button>

                                        {isExpanded && (
                                            <div className="pl-4 border-l border-slate-800 mt-2 space-y-3">
                                                {gradeClasses.map(className => {
                                                    const classGroups = Array.from(new Set(
                                                        allStudents
                                                            .filter(s => s.class_name === className)
                                                            .map(s => s.group_number)
                                                    )).sort((a, b) => a - b);

                                                    return (
                                                        <div key={className} className="space-y-1">
                                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-2">Class {className}</div>
                                                            {classGroups.map(groupNum => {
                                                                const isGroupActive = selectedGroup === String(groupNum) && selectedGrade === className;
                                                                return (
                                                                    <button
                                                                        key={`${className}-${groupNum}`}
                                                                        onClick={() => {
                                                                            setSelectedGrade(className);
                                                                            setSelectedGroup(String(groupNum));
                                                                        }}
                                                                        className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                                                                            isGroupActive
                                                                                ? 'bg-amber-500/10 border border-amber-500/50 text-amber-500 font-bold'
                                                                                : 'text-slate-400 hover:bg-[#1a1811] hover:text-slate-200 hover:pl-4 border border-transparent'
                                                                        }`}
                                                                    >
                                                                        <Users className="w-3.5 h-3.5" />
                                                                        <span className="text-sm">Group {groupNum}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: Project Info & Plagiarism Action */}
                <div className="xl:col-span-9">
                    {!selectedGroup ? (
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                            <div className="w-20 h-20 bg-[#1a1811] border border-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                                <Search className="w-10 h-10 text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300 mb-2">Select a Group</h3>
                            <p className="text-slate-500 max-w-md">Choose a grade, class, and group from the navigation menu to check their project for AI plagiarism.</p>
                        </div>
                    ) : isFetchingProject ? (
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

                                    <button
                                        onClick={handleRunAICheck}
                                        disabled={isCheckingAI || (!project.google_doc_url && !project.abstract)}
                                        className="shrink-0 group relative px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-black rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden"
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
                                </div>
                            </div>

                            {/* Project Abstract Content Preview */}
                            {project.abstract && (() => {
                                let absData: any = {};
                                try { absData = JSON.parse(project.abstract); } catch (e) { }
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
            </div>
        </div>
    );
}
