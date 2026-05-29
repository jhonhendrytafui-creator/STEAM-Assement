'use client';

import React, { useState } from 'react';
import {
    LayoutDashboard, Users, AlertTriangle, CheckCircle2, History, X
} from 'lucide-react';
import type { ProjectData } from '@/lib/types';

interface OverviewTabProps {
    recentProjects: ProjectData[];
    allStudents: any[];
    totalGroups: number;
}

export default function OverviewTab({ recentProjects, allStudents, totalGroups }: OverviewTabProps) {
    const [overviewGradeFilter, setOverviewGradeFilter] = useState<string>('');

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    // Compute filtered projects based on grade filter
    const filteredProjects = overviewGradeFilter
        ? recentProjects.filter(p => String(p.class_name).split('.')[0] === overviewGradeFilter)
        : recentProjects;

    // Compute unique latest project per group
    const latestByGroup = new Map<string, ProjectData>();
    filteredProjects.forEach(p => {
        const key = `${p.class_name}-${p.group_number}`;
        if (!latestByGroup.has(key)) latestByGroup.set(key, p);
    });
    const uniqueLatest = Array.from(latestByGroup.values());

    const filteredStudents = overviewGradeFilter
        ? allStudents.filter(s => String(s.class_name).split('.')[0] === overviewGradeFilter)
        : allStudents;
    const filteredGroupCount = new Set(filteredStudents.map(s => `${s.class_name}-${s.group_number}`)).size;

    const pendingCount = uniqueLatest.filter(p => !p.status || p.status === 'pending').length;
    const approvedCount = uniqueLatest.filter(p => p.status === 'approved').length;
    const revisionCount = uniqueLatest.filter(p => p.status === 'revision').length;
    const disapprovedCount = uniqueLatest.filter(p => p.status === 'disapproved').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <LayoutDashboard className="text-amber-500" />
                    Projects Overview
                </h2>
                <div className="w-full sm:w-48">
                    <select
                        value={overviewGradeFilter}
                        onChange={(e) => setOverviewGradeFilter(e.target.value)}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">All Grades</option>
                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-semibold">Total Groups</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{filteredGroupCount}</div>
                </div>
                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold">Pending</span>
                    </div>
                    <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
                </div>
                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold">Approved</span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{approvedCount}</div>
                </div>
                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <History className="w-4 h-4 text-orange-400" />
                        <span className="text-xs font-semibold">Revision</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-400">{revisionCount}</div>
                </div>
                <div className="bg-[#1a1811] border border-slate-800 rounded-2xl p-5 hover:border-amber-900/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                        <X className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-semibold">Disapproved</span>
                    </div>
                    <div className="text-2xl font-bold text-red-400">{disapprovedCount}</div>
                </div>
            </div>

            {/* Recent Projects Table */}
            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl shadow-xl overflow-hidden mt-4">
                <div className="p-6 border-b border-slate-800/50">
                    <h3 className="text-lg font-bold text-white">{overviewGradeFilter ? `Grade ${overviewGradeFilter} Submissions` : 'All Submissions'}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1c1b14] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                <th className="p-4 font-semibold">Group</th>
                                <th className="p-4 font-semibold">Project Title</th>
                                <th className="p-4 font-semibold">Theme</th>
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30 text-sm">
                            {filteredProjects.length > 0 ? (
                                filteredProjects.slice(0, 10).map((proj) => (
                                    <tr key={proj.id} className="hover:bg-[#1c1b14]/50 transition-colors">
                                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium">
                                            {proj.class_name} - {proj.group_number}
                                        </td>
                                        <td className="p-4 font-medium text-slate-200">
                                            {proj.title}
                                        </td>
                                        <td className="p-4 text-slate-400 whitespace-nowrap">
                                            {proj.themes?.theme_name || '-'}
                                        </td>
                                        <td className="p-4 text-slate-400 whitespace-nowrap">
                                            {new Date(proj.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${proj.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                proj.status === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                    proj.status === 'disapproved' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                }`}>
                                                {proj.status || 'pending'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-500">
                                        No projects submitted yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
