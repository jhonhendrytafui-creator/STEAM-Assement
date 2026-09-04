'use client';

import React, { useState } from 'react';
import {
    BookOpen, Users, LayoutGrid, List, Calendar, Image as ImageIcon,
    TrendingUp, AlertTriangle, Clock, CheckCircle2
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { supabase } from '@/lib/supabase/client';
import { sanitizeRichText } from '@/lib/sanitize';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType } from '@/lib/types';

interface LogbookTabProps {
    allStudents: any[];
    showToast: (message: string, type: ToastType) => void;
}

type GradeViewMode = 'card' | 'list' | 'analytics';

export default function LogbookTab({ allStudents, showToast }: LogbookTabProps) {
    const [logbookGrade, setLogbookGrade] = useState<string>('');
    const [gradeLogbooksList, setGradeLogbooksList] = useState<any[]>([]);
    const [selectedGroupForLogbook, setSelectedGroupForLogbook] = useState<{ class_name: string, group_number: number } | null>(null);
    const [groupLogbooks, setGroupLogbooks] = useState<any[]>([]);
    const [isFetchingLogbooks, setIsFetchingLogbooks] = useState(false);
    const [logbookClassFilter, setLogbookClassFilter] = useState<string>('');
    const [logbookViewMode, setLogbookViewMode] = useState<GradeViewMode>('card');
    const [logbookGroupByClass, setLogbookGroupByClass] = useState(false);
    const [staleDaysThreshold, setStaleDaysThreshold] = useState<7 | 14 | 21>(14);

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    const fetchGradeLogbooksList = async () => {
        if (!logbookGrade) return;
        setIsFetchingLogbooks(true);
        setSelectedGroupForLogbook(null);
        setGroupLogbooks([]);

        const groupsInGrade = allStudents.filter(s => String(s.class_name).split('.')[0] === logbookGrade);
        const uniqueGroups = new Map();
        groupsInGrade.forEach(s => {
            uniqueGroups.set(`${s.class_name}-${s.group_number}`, { class_name: s.class_name, group_number: s.group_number });
        });

        const { data: logs } = await supabase
            .from('logbooks')
            .select('*')
            .eq('academic_year', ACADEMIC_YEAR)
            .ilike('class_name', `${logbookGrade}.%`)
            .order('entry_date', { ascending: false });

        const listView: any[] = [];
        uniqueGroups.forEach((group) => {
            const groupLogs = logs?.filter(l => l.class_name === group.class_name && l.group_number === group.group_number) || [];
            if (groupLogs.length > 0) {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    entriesCount: groupLogs.length,
                    latestEntryDate: groupLogs[0].entry_date,
                    allEntries: groupLogs
                });
            } else {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    entriesCount: 0,
                    latestEntryDate: null,
                    allEntries: []
                });
            }
        });

        setGradeLogbooksList(listView.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number));
        setIsFetchingLogbooks(false);
    };

    const handleSelectLogbookGroup = (group: any) => {
        setSelectedGroupForLogbook({ class_name: group.class_name, group_number: group.group_number });
        setGroupLogbooks(group.allEntries);
    };

    // ── Analytics helpers ──────────────────────────────────────────────────────
    const getDaysSince = (dateStr: string | null): number => {
        if (!dateStr) return Infinity;
        return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    };

    const getWeeklyFrequency = (entries: any[]) => {
        const counts: Record<string, number> = {};
        [...entries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()).forEach(e => {
            const d = new Date(e.entry_date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            const label = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            counts[label] = (counts[label] ?? 0) + 1;
        });
        return Object.entries(counts).map(([week, count]) => ({ week, count }));
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BookOpen className="text-amber-500" />
                Student Logbook
            </h2>

            {!selectedGroupForLogbook ? (() => {
                const logbookAvailableClasses = Array.from(new Set(gradeLogbooksList.map(g => g.class_name))).sort();
                let filtered = gradeLogbooksList;
                if (logbookClassFilter) filtered = filtered.filter(g => g.class_name === logbookClassFilter);
                const classesSorted = Array.from(new Set(filtered.map(g => g.class_name))).sort();

                // ── Stale groups for analytics ──
                const staleGroups = filtered.filter(g => getDaysSince(g.latestEntryDate) >= staleDaysThreshold);
                const onTrackGroups = filtered.filter(g => g.entriesCount > 0 && getDaysSince(g.latestEntryDate) < staleDaysThreshold);
                const noLogGroups = filtered.filter(g => g.entriesCount === 0);

                const getStatusBadge = (group: any) => {
                    const days = getDaysSince(group.latestEntryDate);
                    if (group.entriesCount === 0) return { label: 'No Logs', cls: 'bg-slate-800/50 text-slate-400 border-slate-700' };
                    if (days >= staleDaysThreshold) return { label: `${days}d ago`, cls: 'bg-red-500/10 text-red-400 border-red-500/20' };
                    return { label: 'On Track', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
                };

                const renderGroupCard = (group: any) => (
                    <div
                        key={`${group.class_name}-${group.group_number}`}
                        onClick={() => handleSelectLogbookGroup(group)}
                        className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-900/10 group"
                    >
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-3">
                            <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                {group.class_name} - Group {group.group_number}
                            </h3>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${group.entriesCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                {group.entriesCount > 0 ? 'Active' : 'No Logs'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                            <BookOpen className="w-3.5 h-3.5" />
                            {group.entriesCount} Entr{group.entriesCount !== 1 ? 'ies' : 'y'}
                        </div>
                        {group.latestEntryDate && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                <Calendar className="w-3.5 h-3.5" />
                                Latest: {new Date(group.latestEntryDate).toLocaleDateString()}
                            </div>
                        )}
                    </div>
                );

                const renderGroupRow = (group: any) => (
                    <tr
                        key={`${group.class_name}-${group.group_number}`}
                        onClick={() => handleSelectLogbookGroup(group)}
                        className="hover:bg-[#1c1b14]/50 transition-colors cursor-pointer"
                    >
                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium">{group.class_name} - G{group.group_number}</td>
                        <td className="p-4 text-center text-slate-400">{group.entriesCount}</td>
                        <td className="p-4 text-slate-400 whitespace-nowrap">{group.latestEntryDate ? new Date(group.latestEntryDate).toLocaleDateString() : '-'}</td>
                        <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${group.entriesCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                {group.entriesCount > 0 ? 'Active' : 'No Logs'}
                            </span>
                        </td>
                    </tr>
                );

                return (
                    <>
                        {/* Grade + Search */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                <select
                                    value={logbookGrade}
                                    onChange={(e) => { setLogbookGrade(e.target.value); setGradeLogbooksList([]); setLogbookClassFilter(''); }}
                                    className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="">Select Grade</option>
                                    {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end sm:w-48 shrink-0">
                                <button
                                    onClick={fetchGradeLogbooksList}
                                    disabled={!logbookGrade || isFetchingLogbooks}
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {isFetchingLogbooks ? 'Loading...' : 'Search Grade'}
                                </button>
                            </div>
                        </div>

                        {gradeLogbooksList.length > 0 && (
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="w-full sm:w-48">
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Filter by Class</label>
                                        <select
                                            value={logbookClassFilter}
                                            onChange={(e) => setLogbookClassFilter(e.target.value)}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="">All Classes</option>
                                            {logbookAvailableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-end gap-2 ml-auto flex-wrap">
                                        <button
                                            onClick={() => setLogbookGroupByClass(!logbookGroupByClass)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${logbookGroupByClass ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <Users className="w-3.5 h-3.5" /> Group by Class
                                        </button>
                                        <button
                                            onClick={() => setLogbookViewMode('card')}
                                            className={`p-2 rounded-lg border transition-all ${logbookViewMode === 'card' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                            title="Card View"
                                        >
                                            <LayoutGrid className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setLogbookViewMode('list')}
                                            className={`p-2 rounded-lg border transition-all ${logbookViewMode === 'list' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                            title="List View"
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setLogbookViewMode('analytics')}
                                            className={`p-2 rounded-lg border transition-all ${logbookViewMode === 'analytics' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                            title="Analytics View"
                                        >
                                            <TrendingUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {filtered.length > 0 ? (
                            logbookViewMode === 'analytics' ? (
                                /* ── ANALYTICS VIEW ── */
                                <div className="space-y-6">
                                    {/* Stale group alert */}
                                    <div className={`border rounded-xl p-5 ${staleGroups.length > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <h3 className="font-bold text-white flex items-center gap-2">
                                                {staleGroups.length > 0
                                                    ? <AlertTriangle className="w-5 h-5 text-red-400" />
                                                    : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                                                Groups Behind on Logbook Updates
                                            </h3>
                                            {/* Threshold picker */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 font-semibold">Flag if no post in</span>
                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-lg p-0.5 flex">
                                                    {([7, 14, 21] as const).map(d => (
                                                        <button
                                                            key={d}
                                                            onClick={() => setStaleDaysThreshold(d)}
                                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${staleDaysThreshold === d ? 'bg-amber-500 text-[#1a1811]' : 'text-slate-400 hover:text-amber-400'}`}
                                                        >
                                                            {d}d
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {staleGroups.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                {staleGroups.map(g => (
                                                    <button
                                                        key={`${g.class_name}-${g.group_number}`}
                                                        onClick={() => handleSelectLogbookGroup(g)}
                                                        className="bg-[#1c1b14] border border-red-500/20 hover:border-red-500/40 rounded-lg p-3 text-left transition-colors group"
                                                    >
                                                        <p className="font-bold text-slate-200 text-sm group-hover:text-red-400 transition-colors">
                                                            {g.class_name} - G{g.group_number}
                                                        </p>
                                                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {g.entriesCount === 0 ? 'No entries' : `Last: ${getDaysSince(g.latestEntryDate)}d ago`}
                                                        </p>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-emerald-400 text-sm font-medium">All groups have posted within the last {staleDaysThreshold} days.</p>
                                        )}
                                    </div>

                                    {/* Summary table */}
                                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                        <div className="px-5 py-3 bg-[#1a1811] border-b border-slate-800 flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Summary</h3>
                                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> {onTrackGroups.length} On Track</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> {staleGroups.length} Behind</span>
                                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-600 inline-block"></span> {noLogGroups.length} No Logs</span>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800/60">
                                                        <th className="p-3 font-semibold">Group</th>
                                                        <th className="p-3 font-semibold text-center">Total Entries</th>
                                                        <th className="p-3 font-semibold">Last Entry</th>
                                                        <th className="p-3 font-semibold text-center">Days Since</th>
                                                        <th className="p-3 font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-800/30 text-sm">
                                                    {[...filtered].sort((a, b) => getDaysSince(a.latestEntryDate) - getDaysSince(b.latestEntryDate)).map(g => {
                                                        const badge = getStatusBadge(g);
                                                        const days = getDaysSince(g.latestEntryDate);
                                                        return (
                                                            <tr
                                                                key={`${g.class_name}-${g.group_number}`}
                                                                onClick={() => handleSelectLogbookGroup(g)}
                                                                className="hover:bg-[#1a1811]/50 transition-colors cursor-pointer"
                                                            >
                                                                <td className="p-3 text-amber-400 font-bold">{g.class_name} - G{g.group_number}</td>
                                                                <td className="p-3 text-center">
                                                                    <span className="font-bold text-white">{g.entriesCount}</span>
                                                                </td>
                                                                <td className="p-3 text-slate-400">
                                                                    {g.latestEntryDate ? new Date(g.latestEntryDate).toLocaleDateString() : '—'}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-400">
                                                                    {days === Infinity ? '—' : `${days}d`}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.cls}`}>
                                                                        {badge.label}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Frequency bar charts */}
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Entry Frequency by Week</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {[...filtered]
                                                .filter(g => g.entriesCount > 0)
                                                .sort((a, b) => b.entriesCount - a.entriesCount)
                                                .map(g => {
                                                    const weeklyData = getWeeklyFrequency(g.allEntries);
                                                    const isStale = getDaysSince(g.latestEntryDate) >= staleDaysThreshold;
                                                    return (
                                                        <div
                                                            key={`${g.class_name}-${g.group_number}`}
                                                            className={`bg-[#1c1b14] border rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all ${isStale ? 'border-red-500/20 hover:border-red-500/40' : 'border-slate-800 hover:border-amber-500/40'}`}
                                                            onClick={() => handleSelectLogbookGroup(g)}
                                                        >
                                                            <div className="flex items-center justify-between mb-3">
                                                                <p className="font-bold text-slate-200 text-sm">{g.class_name} - G{g.group_number}</p>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isStale ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                                    {g.entriesCount} entries
                                                                </span>
                                                            </div>
                                                            <ResponsiveContainer width="100%" height={70}>
                                                                <BarChart data={weeklyData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                                                                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                                    <YAxis tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                                                    <Tooltip
                                                                        contentStyle={{ background: '#1c1b14', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
                                                                        labelStyle={{ color: '#94a3b8' }}
                                                                        itemStyle={{ color: '#f59e0b' }}
                                                                        formatter={(v: any) => [`${v} entr${v !== 1 ? 'ies' : 'y'}`, '']}
                                                                    />
                                                                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                                                                        {weeklyData.map((_, i) => (
                                                                            <Cell key={i} fill={isStale ? '#f87171' : '#f59e0b'} fillOpacity={0.8} />
                                                                        ))}
                                                                    </Bar>
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        {filtered.every(g => g.entriesCount === 0) && (
                                            <div className="text-center py-8 text-slate-500 text-sm">No logbook entries found for this grade.</div>
                                        )}
                                    </div>
                                </div>
                            ) : logbookViewMode === 'card' ? (
                                logbookGroupByClass ? (
                                    <div className="space-y-6">
                                        {classesSorted.map(cls => (
                                            <div key={cls}>
                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {filtered.filter(g => g.class_name === cls).map(g => renderGroupCard(g))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filtered.map(g => renderGroupCard(g))}
                                    </div>
                                )
                            ) : (
                                logbookGroupByClass ? (
                                    <div className="space-y-6">
                                        {classesSorted.map(cls => (
                                            <div key={cls}>
                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                            <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold text-center">Entries</th><th className="p-3 font-semibold">Latest Entry</th><th className="p-3 font-semibold">Status</th>
                                                        </tr></thead>
                                                        <tbody className="divide-y divide-slate-800/30 text-sm">
                                                            {filtered.filter(g => g.class_name === cls).map(g => renderGroupRow(g))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold text-center">Entries</th><th className="p-3 font-semibold">Latest Entry</th><th className="p-3 font-semibold">Status</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                {filtered.map(g => renderGroupRow(g))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )
                        ) : (
                            logbookGrade && !isFetchingLogbooks && (
                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                    <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400">{gradeLogbooksList.length > 0 ? 'No groups match your filters.' : `Click Search to load logbooks for Grade ${logbookGrade}.`}</p>
                                </div>
                            )
                        )}
                    </>
                );
            })() : (
                /* ── DETAIL VIEW: individual group logbook ── */
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => setSelectedGroupForLogbook(null)}
                            className="px-4 py-2 bg-[#1c1b14] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center gap-2"
                        >
                            &larr; Back to List
                        </button>
                        <h3 className="text-lg font-bold text-amber-400">
                            {selectedGroupForLogbook.class_name} - Group {selectedGroupForLogbook.group_number} Logbook
                        </h3>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-8">
                        <div className="flex-1">
                            {groupLogbooks.length > 0 ? (
                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <thead>
                                                <tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                    <th className="p-4 font-semibold w-24">Date</th>
                                                    <th className="p-4 font-semibold w-24">Submitted By</th>
                                                    <th className="p-4 font-semibold w-[25%]">Task / Meeting Focus</th>
                                                    <th className="p-4 font-semibold w-[25%]">Result / Progress</th>
                                                    <th className="p-4 font-semibold">Student Feedback</th>
                                                    <th className="p-4 font-semibold w-24">Photo</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                {groupLogbooks.map((log: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-[#1a1811]/50 transition-colors">
                                                        <td className="p-4 text-amber-500 font-medium align-top">
                                                            {new Date(log.entry_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-4 text-slate-400 align-top">
                                                            {allStudents.find(s => s.email === log.student_email)?.full_name || log.student_email?.split('@')[0]}
                                                        </td>
                                                        <td className="p-4 text-slate-300 align-top">
                                                            <div className="whitespace-pre-wrap">{log.task}</div>
                                                        </td>
                                                        <td className="p-4 text-slate-300 align-top">
                                                            <div className="prose prose-sm prose-invert max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: sanitizeRichText(log.result) }} />
                                                        </td>
                                                        <td className="p-4 text-slate-300 align-top">
                                                            <div className="prose prose-sm prose-invert max-w-none text-amber-100/90" dangerouslySetInnerHTML={{ __html: sanitizeRichText(log.feedback) || '<span class="text-slate-600 italic">No feedback</span>' }} />
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            {log.photo_url ? (
                                                                <a href={log.photo_url} target="_blank" rel="noopener noreferrer" className="block relative group">
                                                                    <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-700 bg-slate-800 relative z-0">
                                                                        <img src={log.photo_url} alt="Log photo" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                                                    </div>
                                                                </a>
                                                            ) : (
                                                                <span className="text-slate-600 italic text-xs flex items-center gap-1">
                                                                    <ImageIcon className="w-3 h-3" /> None
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                    <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400">No logbook entries found for this group.</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Navigation Sidebar */}
                        <div className="w-full xl:w-64 shrink-0">
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                <p className="text-sm font-bold text-white mb-4">Class {selectedGroupForLogbook.class_name}</p>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {gradeLogbooksList.filter(g => g.class_name === selectedGroupForLogbook.class_name).map(g => (
                                        <button
                                            key={g.group_number}
                                            onClick={() => handleSelectLogbookGroup(g)}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between ${selectedGroupForLogbook.group_number === g.group_number
                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                }`}
                                        >
                                            <span>Group {g.group_number}</span>
                                            {g.entriesCount > 0 && <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 rounded-full font-bold">{g.entriesCount}</span>}
                                            {g.entriesCount === 0 && <span className="w-2 h-2 rounded-full bg-slate-700 block"></span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
