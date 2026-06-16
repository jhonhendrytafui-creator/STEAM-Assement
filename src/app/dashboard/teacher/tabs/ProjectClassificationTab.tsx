'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType, ProjectData, ProjectTeacherRecommendation } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Info, X, Users, AlertCircle, RefreshCw, Wand2, Zap } from 'lucide-react';

interface ProjectClassificationTabProps {
    showToast: (message: string, type: ToastType) => void;
}

interface ProjectWithRecommendations extends ProjectData {
    recommendations: ProjectTeacherRecommendation[];
}

export default function ProjectClassificationTab({ showToast }: ProjectClassificationTabProps) {
    const [projects, setProjects] = useState<ProjectWithRecommendations[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGrade, setSelectedGrade] = useState<string>('All');
    const [classifyingProjectIds, setClassifyingProjectIds] = useState<Set<string>>(new Set());
    const [isClassifyingAll, setIsClassifyingAll] = useState(false);

    // Modal state
    const [selectedProject, setSelectedProject] = useState<ProjectWithRecommendations | null>(null);

    const fetchClassifications = async () => {
        setIsLoading(true);
        try {
            // Fetch all approved projects for the current academic year
            const { data: approvedProjects, error: projectError } = await supabase
                .from('projects')
                .select('*, themes(theme_name)')
                .eq('academic_year', ACADEMIC_YEAR)
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (projectError) throw projectError;

            if (!approvedProjects || approvedProjects.length === 0) {
                setProjects([]);
                return;
            }

            // Fetch recommendations for these projects
            const projectIds = approvedProjects.map(p => p.id);
            const { data: recs, error: recsError } = await supabase
                .from('project_teacher_recommendations')
                .select('*')
                .in('project_id', projectIds);

            if (recsError) throw recsError;

            // Merge
            const merged = approvedProjects.map(p => ({
                ...p,
                recommendations: recs ? recs.filter(r => r.project_id === p.id) : []
            }));

            setProjects(merged);
        } catch (error: any) {
            showToast(error.message || 'Failed to fetch classification data', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClassifications();
    }, []);

    // Auto-poll every 5 seconds while any project is still waiting for recommendations.
    // Stops automatically once all projects have recommendations.
    useEffect(() => {
        const hasPending = projects.some(p => !p.recommendations || p.recommendations.length === 0);
        if (!hasPending || isLoading) return;

        const timer = setTimeout(() => {
            fetchClassifications();
        }, 5000);

        return () => clearTimeout(timer);
    }, [projects, isLoading]);

    // Extract unique grades from projects
    const availableGrades = ['All', ...Array.from(new Set(projects.map(p => String(p.class_name).split('.')[0])))].sort((a, b) => {
        if (a === 'All') return -1;
        if (b === 'All') return 1;
        return Number(a) - Number(b);
    });

    const filteredProjects = selectedGrade === 'All' 
        ? projects 
        : projects.filter(p => String(p.class_name).split('.')[0] === selectedGrade);

    const handleClassifyProject = async (projectId: string) => {
        setClassifyingProjectIds(prev => new Set(prev).add(projectId));
        try {
            const res = await fetch('/api/ai-classify-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Classification failed');
            showToast('AI classification complete!', 'success');
            await fetchClassifications();
        } catch (err: any) {
            showToast(err.message || 'AI classification failed. Check if teacher expertise is configured.', 'error');
        } finally {
            setClassifyingProjectIds(prev => {
                const next = new Set(prev);
                next.delete(projectId);
                return next;
            });
        }
    };

    const handleClassifyAllPending = async () => {
        const pending = filteredProjects.filter(p => !p.recommendations || p.recommendations.length === 0);
        if (pending.length === 0) {
            showToast('All visible projects already have recommendations.', 'info');
            return;
        }
        setIsClassifyingAll(true);
        for (const project of pending) {
            await handleClassifyProject(project.id);
        }
        setIsClassifyingAll(false);
    };

    // Helpers for rendering the ranks beautifully
    const getRankColor = (rank: string) => {
        switch (rank.toLowerCase()) {
            case 'high': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'low': return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
            default: return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="w-6 h-6 text-indigo-400" />
                        Project Classification
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                        AI-powered guide teacher recommendations for approved projects.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-slate-800/50 p-1 rounded-xl border border-slate-700/50 flex">
                        {availableGrades.map((grade) => (
                            <button
                                key={grade}
                                onClick={() => setSelectedGrade(grade)}
                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    selectedGrade === grade
                                        ? 'bg-indigo-500 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                }`}
                            >
                                {grade === 'All' ? 'All Grades' : `Grade ${grade}`}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleClassifyAllPending}
                        disabled={isClassifyingAll || isLoading || filteredProjects.every(p => p.recommendations && p.recommendations.length > 0)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl border border-indigo-500/50 transition-colors text-sm font-medium"
                        title="Run AI classification for all pending projects"
                    >
                        <Zap className={`w-4 h-4 ${isClassifyingAll ? 'animate-pulse' : ''}`} />
                        {isClassifyingAll ? 'Classifying...' : 'Classify Pending'}
                    </button>
                    <button
                        onClick={fetchClassifications}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl h-64"></div>
                    ))}
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">No Approved Projects Found</h3>
                    <p className="text-slate-400">
                        There are no approved projects to classify for {selectedGrade === 'All' ? 'any grade' : `Grade ${selectedGrade}`}.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <AnimatePresence>
                        {filteredProjects.map((project) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={project.id}
                                className="bg-[#1a1811]/60 backdrop-blur-sm border border-slate-700/60 hover:border-indigo-500/40 transition-colors rounded-2xl overflow-hidden flex flex-col"
                            >
                                {/* Card Header */}
                                <div className="p-5 border-b border-slate-700/50 bg-slate-800/20">
                                    <div className="flex justify-between items-start gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md text-xs font-bold tracking-wider">
                                                    {project.class_name} - G{project.group_number}
                                                </span>
                                                {project.themes && (
                                                    <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-md text-xs font-medium truncate max-w-[150px]">
                                                        {project.themes.theme_name}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-bold text-white leading-snug line-clamp-2">
                                                {project.title}
                                            </h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Recommendations Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Users className="w-3.5 h-3.5" />
                                        Guide Teacher Recommendations
                                    </h4>
                                    
                                    {classifyingProjectIds.has(project.id) ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-6">
                                            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-3"></div>
                                            <p className="text-sm text-slate-400 text-center">AI is classifying this project...</p>
                                            <p className="text-xs text-slate-600 mt-1 text-center">Matching project to teacher expertise</p>
                                        </div>
                                    ) : project.recommendations && project.recommendations.length > 0 ? (
                                        <div className="space-y-3 flex-1">
                                            {/* Sort recommendations: High -> Medium -> Low */}
                                            {[...project.recommendations].sort((a, b) => {
                                                const rankOrder: Record<string, number> = { 'High': 1, 'Medium': 2, 'Low': 3 };
                                                return (rankOrder[a.rank_level] || 4) - (rankOrder[b.rank_level] || 4);
                                            }).map((rec) => (
                                                <div key={rec.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankColor(rec.rank_level)}`}>
                                                            {rec.relevance_percentage}%
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-200">{rec.teacher_name}</p>
                                                            <p className="text-xs text-slate-400">{rec.teacher_expertise}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getRankColor(rec.rank_level)}`}>
                                                        {rec.rank_level}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center py-6">
                                            <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-3"></div>
                                            <p className="text-sm text-slate-400 text-center">AI is analyzing this project...</p>
                                            <p className="text-xs text-slate-600 mt-1 text-center">Auto-refreshing every 5 seconds</p>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer */}
                                <div className="p-4 bg-slate-800/30 border-t border-slate-700/50 flex gap-2">
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        disabled={!project.recommendations || project.recommendations.length === 0 || classifyingProjectIds.has(project.id)}
                                        className="flex-1 py-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Info className="w-4 h-4" />
                                        View Reasoning
                                    </button>
                                    <button
                                        onClick={() => handleClassifyProject(project.id)}
                                        disabled={classifyingProjectIds.has(project.id) || isClassifyingAll}
                                        className="py-2.5 px-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-600/50 transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Re-run AI classification for this project"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                        Re-classify
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* AI Reasoning Modal */}
            <AnimatePresence>
                {selectedProject && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={() => setSelectedProject(null)}
                        />
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-[#1a1811] w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col pointer-events-auto"
                            >
                                <div className="p-5 border-b border-slate-700/50 flex justify-between items-start bg-slate-800/30">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                                            <BrainCircuit className="w-5 h-5 text-indigo-400" />
                                            AI Classification Reasoning
                                        </h3>
                                        <p className="text-sm text-slate-400 line-clamp-1">
                                            {selectedProject.title}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedProject(null)}
                                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="p-6 overflow-y-auto space-y-6">
                                    {[...(selectedProject.recommendations || [])].sort((a, b) => {
                                        const rankOrder: Record<string, number> = { 'High': 1, 'Medium': 2, 'Low': 3 };
                                        return (rankOrder[a.rank_level] || 4) - (rankOrder[b.rank_level] || 4);
                                    }).map((rec) => (
                                        <div key={rec.id} className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                                            <div className={`px-4 py-3 border-b flex justify-between items-center ${
                                                rec.rank_level === 'High' ? 'bg-emerald-500/10 border-emerald-500/20' :
                                                rec.rank_level === 'Medium' ? 'bg-amber-500/10 border-amber-500/20' :
                                                'bg-slate-500/10 border-slate-500/20'
                                            }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-200">
                                                        {rec.relevance_percentage}%
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{rec.teacher_name}</h4>
                                                        <p className="text-xs text-slate-400">{rec.teacher_expertise}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${getRankColor(rec.rank_level)} border-none`}>
                                                    {rec.rank_level} Match
                                                </span>
                                            </div>
                                            <div className="p-4">
                                                <p className="text-slate-300 text-sm leading-relaxed">
                                                    {rec.reason}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="p-4 border-t border-slate-700/50 bg-slate-800/30 flex justify-end">
                                    <button 
                                        onClick={() => setSelectedProject(null)}
                                        className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors font-medium text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
