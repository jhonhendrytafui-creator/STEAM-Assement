'use client';

import React, { useState } from 'react';
import {
    FolderOpen, AlertTriangle, History, Users, LayoutGrid, List,
    LinkIcon, Star
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ToastType } from '@/lib/types';
import { parseAbstract, subjectLabel } from '@/lib/abstract';

interface SubmissionsTabProps {
    allStudents: any[];
    showToast: (message: string, type: ToastType) => void;
}

export default function SubmissionsTab({ allStudents, showToast }: SubmissionsTabProps) {
    // Local state
    const [submissionGrade, setSubmissionGrade] = useState<string>('');
    const [gradeSubmissionsList, setGradeSubmissionsList] = useState<any[]>([]);
    const [selectedGroupForSubmission, setSelectedGroupForSubmission] = useState<{ class_name: string, group_number: number } | null>(null);
    const [groupSubmissions, setGroupSubmissions] = useState<any[]>([]);
    const [currentSubmissionIndex, setCurrentSubmissionIndex] = useState(0);
    const [isFetchingSubmissions, setIsFetchingSubmissions] = useState(false);
    const [submissionClassFilter, setSubmissionClassFilter] = useState<string>('');
    const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string[]>([]);
    const [submissionViewMode, setSubmissionViewMode] = useState<'card' | 'list'>('card');
    const [submissionGroupByClass, setSubmissionGroupByClass] = useState(false);

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    const fetchGradeSubmissionsList = async () => {
        if (!submissionGrade) return;
        setIsFetchingSubmissions(true);
        setSelectedGroupForSubmission(null);
        setGroupSubmissions([]);

        // Get all groups for this grade
        const groupsInGrade = allStudents.filter(s => String(s.class_name).split('.')[0] === submissionGrade);
        const uniqueGroups = new Map();
        groupsInGrade.forEach(s => {
            uniqueGroups.set(`${s.class_name}-${s.group_number}`, { class_name: s.class_name, group_number: s.group_number });
        });

        // Get all submitted projects
        const { data: projs } = await supabase
            .from('projects')
            .select(`*, themes(theme_name)`)
            .eq('academic_year', ACADEMIC_YEAR)
            .ilike('class_name', `${submissionGrade}.%`)
            .order('iteration', { ascending: false });

        const listView: any[] = [];
        uniqueGroups.forEach((group) => {
            const groupProjs = projs?.filter(p => p.class_name === group.class_name && p.group_number === group.group_number) || [];
            if (groupProjs.length > 0) {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    latestStatus: groupProjs[0].status,
                    latestTitle: groupProjs[0].title,
                    iterationsCount: groupProjs.length,
                    latestProject: groupProjs[0],
                    allProjects: groupProjs
                });
            } else {
                listView.push({
                    class_name: group.class_name,
                    group_number: group.group_number,
                    latestStatus: 'not submitted yet',
                    latestTitle: '-',
                    iterationsCount: 0,
                    latestProject: null,
                    allProjects: []
                });
            }
        });

        setGradeSubmissionsList(listView.sort((a, b) => a.class_name.localeCompare(b.class_name) || a.group_number - b.group_number));
        setIsFetchingSubmissions(false);
    };

    const handleSelectSubmissionGroup = (group: any) => {
        setSelectedGroupForSubmission({ class_name: group.class_name, group_number: group.group_number });
        setGroupSubmissions(group.allProjects);
        setCurrentSubmissionIndex(0);
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FolderOpen className="text-amber-500" />
                Project Submissions & History
            </h2>

            {/* Submissions Filters */}
            {!selectedGroupForSubmission ? (() => {
                // Compute available classes for filter
                const submissionAvailableClasses = Array.from(new Set(gradeSubmissionsList.map(g => g.class_name))).sort();
                // Apply client-side filters
                let filtered = gradeSubmissionsList;
                if (submissionClassFilter) filtered = filtered.filter(g => g.class_name === submissionClassFilter);
                if (submissionStatusFilter.length > 0) filtered = filtered.filter(g => submissionStatusFilter.includes(g.latestStatus));

                // Group by class if toggled
                const classesSorted = Array.from(new Set(filtered.map(g => g.class_name))).sort();

                const statusOptions = ['pending', 'approved', 'revision', 'disapproved', 'not submitted yet'];
                const statusColors: Record<string, string> = {
                    'pending': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                    'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                    'revision': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
                    'disapproved': 'bg-red-500/10 text-red-400 border-red-500/30',
                    'not submitted yet': 'bg-slate-800/50 text-slate-400 border-slate-600',
                };
                const statusColorsActive: Record<string, string> = {
                    'pending': 'bg-amber-500 text-[#1a1811] border-amber-500',
                    'approved': 'bg-emerald-500 text-[#1a1811] border-emerald-500',
                    'revision': 'bg-orange-500 text-[#1a1811] border-orange-500',
                    'disapproved': 'bg-red-500 text-white border-red-500',
                    'not submitted yet': 'bg-slate-500 text-white border-slate-500',
                };

                const renderGroupCard = (group: any, idx: number) => (
                    <div
                        key={`${group.class_name}-${group.group_number}`}
                        onClick={() => handleSelectSubmissionGroup(group)}
                        className="bg-[#1c1b14] border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-900/10 group"
                    >
                        <div className="flex items-center justify-between mb-3 border-b border-slate-800/50 pb-3">
                            <h3 className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                                {group.class_name} - Group {group.group_number}
                            </h3>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${group.latestStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                group.latestStatus === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                    group.latestStatus === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                        group.latestStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            'bg-slate-800/50 text-slate-400 border-slate-700'
                                }`}>
                                {group.latestStatus}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-slate-300 line-clamp-2 mb-3 h-10">
                            {group.latestTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <History className="w-3.5 h-3.5" />
                            {group.iterationsCount} Iteration{group.iterationsCount !== 1 ? 's' : ''} Found
                        </div>
                    </div>
                );

                const renderGroupRow = (group: any) => (
                    <tr
                        key={`${group.class_name}-${group.group_number}`}
                        onClick={() => handleSelectSubmissionGroup(group)}
                        className="hover:bg-[#1c1b14]/50 transition-colors cursor-pointer"
                    >
                        <td className="p-4 whitespace-nowrap text-amber-400 font-medium">{group.class_name} - G{group.group_number}</td>
                        <td className="p-4 font-medium text-slate-200">{group.latestTitle}</td>
                        <td className="p-4 text-center text-slate-400">{group.iterationsCount}</td>
                        <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium border ${group.latestStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                group.latestStatus === 'revision' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                    group.latestStatus === 'disapproved' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                        group.latestStatus === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            'bg-slate-800/50 text-slate-400 border-slate-700'
                                }`}>{group.latestStatus}</span>
                        </td>
                    </tr>
                );

                return (
                    <>
                        {/* Grade selector + Search */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                                <select
                                    value={submissionGrade}
                                    onChange={(e) => { setSubmissionGrade(e.target.value); setGradeSubmissionsList([]); setSubmissionClassFilter(''); setSubmissionStatusFilter([]); }}
                                    className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                >
                                    <option value="">Select Grade</option>
                                    {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end sm:w-48 shrink-0">
                                <button
                                    onClick={fetchGradeSubmissionsList}
                                    disabled={!submissionGrade || isFetchingSubmissions}
                                    className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {isFetchingSubmissions ? 'Loading...' : 'Search Grade'}
                                </button>
                            </div>
                        </div>

                        {/* Extra Filters (only show after data loaded) */}
                        {gradeSubmissionsList.length > 0 && (
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6 space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    {/* Class Filter */}
                                    <div className="w-full sm:w-48">
                                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Filter by Class</label>
                                        <select
                                            value={submissionClassFilter}
                                            onChange={(e) => setSubmissionClassFilter(e.target.value)}
                                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                                        >
                                            <option value="">All Classes</option>
                                            {submissionAvailableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    {/* View Toggle */}
                                    <div className="flex items-end gap-2 ml-auto">
                                        <button
                                            onClick={() => setSubmissionGroupByClass(!submissionGroupByClass)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${submissionGroupByClass ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <Users className="w-3.5 h-3.5" /> Group by Class
                                        </button>
                                        <button
                                            onClick={() => setSubmissionViewMode('card')}
                                            className={`p-2 rounded-lg border transition-all ${submissionViewMode === 'card' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                            title="Card View"
                                        >
                                            <LayoutGrid className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setSubmissionViewMode('list')}
                                            className={`p-2 rounded-lg border transition-all ${submissionViewMode === 'list' ? 'bg-amber-500/20 text-amber-400 border-amber-500/50' : 'bg-[#1a1811] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                                            title="List View"
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {/* Status Filter Pills */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase">Filter by Status</label>
                                    <div className="flex flex-wrap gap-2">
                                        {statusOptions.map(st => {
                                            const isActive = submissionStatusFilter.includes(st);
                                            return (
                                                <button
                                                    key={st}
                                                    onClick={() => {
                                                        if (isActive) setSubmissionStatusFilter(prev => prev.filter(s => s !== st));
                                                        else setSubmissionStatusFilter(prev => [...prev, st]);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all ${isActive ? statusColorsActive[st] : statusColors[st]}`}
                                                >
                                                    {st}
                                                </button>
                                            );
                                        })}
                                        {submissionStatusFilter.length > 0 && (
                                            <button onClick={() => setSubmissionStatusFilter([])} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Clear</button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Results Area */}
                        {filtered.length > 0 ? (
                            submissionViewMode === 'card' ? (
                                submissionGroupByClass ? (
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
                                /* List View */
                                submissionGroupByClass ? (
                                    <div className="space-y-6">
                                        {classesSorted.map(cls => (
                                            <div key={cls}>
                                                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3 pl-1">Class {cls}</h3>
                                                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead><tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                                            <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold">Title</th><th className="p-3 font-semibold text-center">Iter.</th><th className="p-3 font-semibold">Status</th>
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
                                                <th className="p-3 font-semibold">Group</th><th className="p-3 font-semibold">Title</th><th className="p-3 font-semibold text-center">Iterations</th><th className="p-3 font-semibold">Status</th>
                                            </tr></thead>
                                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                                {filtered.map(g => renderGroupRow(g))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            )
                        ) : (
                            submissionGrade && !isFetchingSubmissions && (
                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                    <AlertTriangle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400">{gradeSubmissionsList.length > 0 ? 'No groups match your filters.' : `Click Search to load groups for Grade ${submissionGrade}.`}</p>
                                </div>
                            )
                        )}
                    </>
                );
            })() : (
                <div>
                    <div className="flex items-center gap-4 mb-6">
                        <button
                            onClick={() => setSelectedGroupForSubmission(null)}
                            className="px-4 py-2 bg-[#1c1b14] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors flex items-center gap-2"
                        >
                            &larr; Back to List
                        </button>
                        <h3 className="text-lg font-bold text-amber-400">
                            {selectedGroupForSubmission.class_name} - Group {selectedGroupForSubmission.group_number} Timeline
                        </h3>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-8">
                        {/* Main Timeline */}
                        <div className="flex-1">
                            {groupSubmissions.length > 0 ? (
                                <div className="space-y-6">
                                    {(() => {
                                        const sub = groupSubmissions[currentSubmissionIndex];
                                        const absData = parseAbstract(sub.abstract);

                                        return (
                                            <div className="bg-[#1c1b14] border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl">
                                                {/* Pagination Headers */}
                                                <div className="flex items-center justify-between border-b border-slate-800/50 pb-4 mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                                            <History className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-bold text-slate-200">Iteration {sub.iteration || 1}</h3>
                                                            <p className="text-sm text-slate-500">{new Date(sub.created_at).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider border ${sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : sub.status === 'revision' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : sub.status === 'disapproved' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-slate-800/50 text-slate-400 border-slate-700'}`}>
                                                        {sub.status || 'pending'}
                                                    </span>
                                                </div>

                                                {/* Project Data */}
                                                <div className="space-y-6">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Project Title</span>
                                                        <h4 className="text-xl font-bold text-white">{sub.title}</h4>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Problem</span>
                                                            <p className="text-sm text-slate-300 leading-relaxed italic">{absData.problem || 'No description provided.'}</p>
                                                        </div>
                                                        <div className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50">
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Solution</span>
                                                            <p className="text-sm text-slate-300 leading-relaxed italic">{absData.solution || 'No description provided.'}</p>
                                                        </div>
                                                    </div>

                                                    {absData.keyConcepts && absData.keyConcepts.length > 0 && (
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Subject Key Concepts</span>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                {absData.keyConcepts.map((item: any, idx: number) => (
                                                                    <div key={idx} className="bg-[#1a1811] border border-slate-800/50 p-3 rounded-lg flex flex-col gap-1.5">
                                                                        <span className="inline-block self-start bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{item.subject}</span>
                                                                        <span className="text-sm text-slate-300">{item.concept || 'No concept provided'}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-2 flex flex-wrap gap-3">
                                                        {sub.google_doc_url && (
                                                            <a href={sub.google_doc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-5 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold">
                                                                <LinkIcon className="w-4 h-4" />
                                                                Open Google Doc
                                                            </a>
                                                        )}

                                                        {sub.presentation_url && (
                                                            <a href={sub.presentation_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 py-2.5 px-5 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-semibold">
                                                                <Star className="w-4 h-4" />
                                                                View Canva Presentation
                                                            </a>
                                                        )}

                                                        {sub.additional_documents && sub.additional_documents.map((doc: any, i: number) => (
                                                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 py-2.5 px-5 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-semibold">
                                                                <LinkIcon className="w-4 h-4" />
                                                                {doc.type}
                                                            </a>
                                                        ))}
                                                    </div>

                                                    {sub.teacher_comment && (
                                                        <div className="mt-6 bg-[#1a1811] border border-amber-900/30 p-4 rounded-xl">
                                                            <span className="text-xs uppercase text-amber-500/70 font-bold block mb-2">Teacher Feedback from this iteration</span>
                                                            <p className="text-sm text-amber-100">{sub.teacher_comment}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Pagination Controls */}
                                                {groupSubmissions.length > 1 && (
                                                    <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                        <button
                                                            onClick={() => setCurrentSubmissionIndex(prev => prev + 1)}
                                                            disabled={currentSubmissionIndex === groupSubmissions.length - 1}
                                                            className="w-full sm:w-auto px-4 py-2 bg-[#1a1811] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            &larr; Older Iteration
                                                        </button>

                                                        <div className="flex gap-1.5 flex-wrap justify-center">
                                                            {groupSubmissions.map((_: any, idx: number) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => setCurrentSubmissionIndex(idx)}
                                                                    className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${currentSubmissionIndex === idx
                                                                        ? 'bg-amber-500 w-5 sm:w-6'
                                                                        : 'bg-slate-700 hover:bg-slate-500'
                                                                        }`}
                                                                    aria-label={`Go to iteration ${groupSubmissions.length - idx}`}
                                                                />
                                                            ))}
                                                        </div>

                                                        <button
                                                            onClick={() => setCurrentSubmissionIndex(prev => prev - 1)}
                                                            disabled={currentSubmissionIndex === 0}
                                                            className="w-full sm:w-auto px-4 py-2 bg-[#1a1811] border border-slate-800 rounded-lg text-sm font-bold text-slate-300 hover:text-white hover:border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            Newer Iteration &rarr;
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-12 border border-slate-800 rounded-xl bg-[#1c1b14]">
                                    <AlertTriangle className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400">No project submissions found for this group.</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Navigation Sidebar */}
                        <div className="w-full xl:w-64 shrink-0">
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                <p className="text-sm font-bold text-white mb-4">Class {selectedGroupForSubmission.class_name}</p>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {gradeSubmissionsList.filter(g => g.class_name === selectedGroupForSubmission.class_name).map(g => (
                                        <button
                                            key={g.group_number}
                                            onClick={() => handleSelectSubmissionGroup(g)}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between ${selectedGroupForSubmission.group_number === g.group_number
                                                ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                }`}
                                        >
                                            <span>Group {g.group_number}</span>
                                            {g.latestStatus === 'not submitted yet' && <span className="w-2 h-2 rounded-full bg-slate-700 block"></span>}
                                            {g.latestStatus === 'approved' && <span className="w-2 h-2 rounded-full bg-emerald-500 block"></span>}
                                            {g.latestStatus === 'revision' && <span className="w-2 h-2 rounded-full bg-amber-500 block"></span>}
                                            {g.latestStatus === 'disapproved' && <span className="w-2 h-2 rounded-full bg-red-500 block"></span>}
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
