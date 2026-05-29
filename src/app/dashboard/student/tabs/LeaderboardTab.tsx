'use client';

import { TrendingUp } from 'lucide-react';

interface LeaderboardTabProps {
    leaderboardData: any[];
}

export default function LeaderboardTab({ leaderboardData }: LeaderboardTabProps) {
    return (
        <div className="space-y-6">
            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 shadow-xl">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                    <TrendingUp className="text-amber-500 w-6 h-6" />
                    Projects Leaderboard
                </h2>
                <p className="text-slate-400 text-sm mb-6">See which projects have received the most votes from teachers across the platform.</p>

                {leaderboardData.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {leaderboardData.map((lb, idx) => (
                            <div key={idx} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 flex items-start gap-4 hover:border-slate-700 transition-colors">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-400/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-[#1a1811] text-slate-500 border border-slate-700'}`}>
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-200 truncate" title={lb.title}>{lb.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">Class {lb.class_name} • Group {lb.group_number}</p>
                                    {lb.theme_name && <p className="text-xs text-slate-500 truncate mt-0.5">{lb.theme_name}</p>}
                                </div>
                                <div className="text-center shrink-0">
                                    <span className="block text-2xl font-black text-amber-500 leading-none">{lb.vote_count}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-amber-500/50">Votes</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                        <TrendingUp className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        No votes have been cast yet. Check back later!
                    </div>
                )}
            </div>
        </div>
    );
}
