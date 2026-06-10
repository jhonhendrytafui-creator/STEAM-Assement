'use client';

import React, { useState } from 'react';
import {
    BookOpen, Users, LayoutGrid, List, Calendar, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType } from '@/lib/types';

interface LogbookTabProps {
    allStudents: any[];
    showToast: (message: string, type: ToastType) => void;
}

export default function LogbookTab({ allStudents, showToast }: LogbookTabProps) {
    // Local state
    const [logbookGrade, setLogbookGrade] = useState<string>('');
    const [gradeLogbooksList, setGradeLogbooksList] = useState<any[]>([]);
    const [selectedGroupForLogbook, setSelectedGroupForLogbook] = useState<{ class_name: string, group_number: number } | null>(null);
    const [groupLogbooks, setGroupLogbooks] = useState<any[]>([]);
    const [isFetchingLogbooks, setIsFetchingLogbooks] = useState(false);
    const [logbookClassFilter, setLogbookClassFilter] = useState<string>('');
    const [logbookViewMode, setLogbookViewMode] = useState<'card' | 'list'>('card');
    const [logbookGroupByClass, setLogbookGroupByClass] = useState(false);

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

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BookOpen className="text-amber-500" />
                Student Logbook
            </h2>

            {/* Logbook Filters */}
            {!selectedGroupForLogbook ? (() => {
                const logbookAvailableClasses = Array.from(new Set(gradeLogbooksList.map(g => g.class_name))).sort();

                let filtered = gradeLogbooksList;
                if (logbookClassFilter) filtered = filtered.filter(g => g.class_name === logbookClassFilter);

                const classesSorted = Array.from(new Set(filtered.map(g => g.class_name))).sort();

                const renderGroupCard = (group: any, idx: number) => (
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
                                    <div className="flex items-end gap-2 ml-auto">
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
                                    </div>
                                </div>
                            </div>
                        )}

                        {filtered.length > 0 ? (
                            logbookViewMode === 'card' ? (
                                logbookGroupByClass ? (
                                    <div className="space-y-6">
                                        {classesSorted.map(cls => (
                                            <div key={cls}>
                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {filtered.filter(g => g.class_name === cls).map((group, idx) => renderGroupCard(group, idx))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filtered.map((group, idx) => renderGroupCard(group, idx))}
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
                                                            <div className="prose prose-sm prose-invert max-w-none text-slate-300" dangerouslySetInnerHTML={{ __html: log.result }} />
                                                        </td>
                                                        <td className="p-4 text-slate-300 align-top">
                                                            <div className="prose prose-sm prose-invert max-w-none text-amber-100/90" dangerouslySetInnerHTML={{ __html: log.feedback || '<span class="text-slate-600 italic">No feedback</span>' }} />
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
