'use client';

import React, { useState } from 'react';
import {
    Star, TrendingUp, X, FolderOpen
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { ProjectData } from '@/lib/types';

interface VotingTabProps {
    recentProjects: ProjectData[];
    myVotes: string[];
    leaderboardData: any[];
    teacherProfile: any;
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    onVoteChange: (newVotes: string[]) => void;
    onLeaderboardRefresh: () => Promise<void>;
}

export default function VotingTab({ recentProjects, myVotes, leaderboardData, teacherProfile, showToast, onVoteChange, onLeaderboardRefresh }: VotingTabProps) {
    // Local State
    const [votingGradeFilter, setVotingGradeFilter] = useState<string>('');
    const [votingSearchTerm, setVotingSearchTerm] = useState<string>('');
    const [selectedProjectVote, setSelectedProjectVote] = useState<ProjectData | null>(null);
    const [isVoting, setIsVoting] = useState(false);

    const availableGrades = Array.from(new Set(recentProjects.map(p => String(p.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    const handleVote = async (projectId: string) => {
        if (!teacherProfile || isVoting) return;
        if (myVotes.length >= 3) {
            showToast('You can only vote for up to 3 projects.', 'warning');
            return;
        }

        setIsVoting(true);
        try {
            const { error } = await supabase
                .from('project_votes')
                .insert([{ project_id: projectId, teacher_id: teacherProfile.id }]);
            
            if (error) throw error;
            
            onVoteChange([...myVotes, projectId]);
            showToast('Vote submitted successfully!', 'success');
            await onLeaderboardRefresh();
        } catch (e: any) {
            showToast(e.message || 'Failed to submit vote.', 'error');
        } finally {
            setIsVoting(false);
        }
    };

    const handleUnvote = async (projectId: string) => {
        if (!teacherProfile || isVoting) return;

        setIsVoting(true);
        try {
            const { error } = await supabase
                .from('project_votes')
                .delete()
                .eq('project_id', projectId)
                .eq('teacher_id', teacherProfile.id);
            
            if (error) throw error;
            
            onVoteChange(myVotes.filter(id => id !== projectId));
            showToast('Vote removed successfully!', 'success');
            await onLeaderboardRefresh();
        } catch (e: any) {
            showToast(e.message || 'Failed to remove vote.', 'error');
        } finally {
            setIsVoting(false);
        }
    };

    // Projects filter - ONLY show APPROVED projects for voting
    let filteredVotingProjects = recentProjects.filter(p => p.status === 'approved');
    if (votingGradeFilter) {
        filteredVotingProjects = filteredVotingProjects.filter(p => String(p.class_name).split('.')[0] === votingGradeFilter);
    }
    if (votingSearchTerm) {
        const term = votingSearchTerm.toLowerCase();
        filteredVotingProjects = filteredVotingProjects.filter(p => 
            p.title.toLowerCase().includes(term) || 
            p.class_name.toLowerCase().includes(term) ||
            String(p.group_number).includes(term)
        );
    }

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                <Star className="text-amber-500 fill-amber-500" />
                Project Voting & Leaderboard
            </h2>

            {/* LEADERBOARD SECTION */}
            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" /> Top Projects Leaderboard
                </h3>
                {leaderboardData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {leaderboardData.slice(0, 10).map((lb, idx) => (
                            <div key={idx} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-400/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-[#1a1811] text-slate-500 border border-slate-700'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-200 truncate">{lb.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{lb.class_name} • Group {lb.group_number}</p>
                                </div>
                                <div className="text-center">
                                    <span className="block text-2xl font-black text-amber-500 leading-none">{lb.vote_count}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-amber-500/50">Votes</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">No votes have been cast yet.</p>
                    </div>
                )}
            </div>

            {/* VOTING SECTION */}
            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-400" /> Cast Your Votes
                    </h3>
                    <div className="text-sm font-semibold bg-[#1c1b14] px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-2">
                        <span className="text-slate-400">My Votes:</span>
                        <span className={`text-lg ${myVotes.length >= 3 ? 'text-red-400' : 'text-amber-400'}`}>{myVotes.length} / 3</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Search</label>
                        <input 
                            type="text" 
                            placeholder="Search by title, class, group..." 
                            value={votingSearchTerm}
                            onChange={e => setVotingSearchTerm(e.target.value)}
                            className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade Filter</label>
                        <select
                            value={votingGradeFilter}
                            onChange={(e) => setVotingGradeFilter(e.target.value)}
                            className="w-full bg-[#1c1b14] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="">All Grades</option>
                            {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-3 mt-4 max-h-[600px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}>
                    {filteredVotingProjects.length > 0 ? filteredVotingProjects.map(p => {
                        const hasVoted = myVotes.includes(p.id);
                        return (
                            <div key={p.id} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${hasVoted ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#1c1b14] border-slate-800 hover:border-slate-700'}`}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{p.class_name} G{p.group_number}</span>
                                        <span className="text-xs text-slate-500 truncate">{p.themes?.theme_name}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-200 truncate" title={p.title}>{p.title}</h4>
                                </div>
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => setSelectedProjectVote(p)}
                                        className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm font-medium hover:bg-slate-700 transition"
                                    >
                                        Detail
                                    </button>
                                    {hasVoted ? (
                                        <button 
                                            onClick={() => handleUnvote(p.id)}
                                            disabled={isVoting}
                                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <X className="w-4 h-4" /> Unvote
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleVote(p.id)}
                                            disabled={isVoting || myVotes.length >= 3}
                                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Star className="w-4 h-4" /> Vote
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="text-center py-12 text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                            No projects match your search criteria.
                        </div>
                    )}
                </div>
            </div>
            
            {/* Detail Modal */}
            {selectedProjectVote && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1811] border border-amber-900/40 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-[slideIn_0.2s_ease-out]">
                        <div className="flex justify-between items-center p-6 border-b border-slate-800/50">
                            <h3 className="text-xl font-bold text-white flex gap-3 items-center">
                                <FolderOpen className="text-amber-500" />
                                Project Details
                            </h3>
                            <button onClick={() => setSelectedProjectVote(null)} className="text-slate-500 hover:text-white transition">
                                <X />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Title</span>
                                <h4 className="text-lg font-semibold text-amber-400">{selectedProjectVote.title}</h4>
                            </div>
                            <div className="flex gap-4">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Class</span>
                                    <span className="text-slate-200">{selectedProjectVote.class_name}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Group</span>
                                    <span className="text-slate-200">{selectedProjectVote.group_number}</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Theme</span>
                                <span className="text-slate-200">{selectedProjectVote.themes?.theme_name || '-'}</span>
                            </div>
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Submission Status</span>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold ${
                                    selectedProjectVote.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                                    selectedProjectVote.status === 'revision' ? 'bg-red-500/20 text-red-400' :
                                    'bg-amber-500/20 text-amber-400'
                                }`}>
                                    {selectedProjectVote.status?.toUpperCase() || 'UNKNOWN'}
                                </span>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-800/50 flex justify-end">
                            <button 
                                onClick={() => setSelectedProjectVote(null)}
                                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
