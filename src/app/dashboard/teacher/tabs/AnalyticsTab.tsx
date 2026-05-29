'use client';

import React, { useState } from 'react';
import {
    TrendingUp, Star, PieChart, Filter
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import type { AssessmentCategory, RubricDimension, RubricIndicator } from '@/lib/types';

interface AnalyticsTabProps {
    allStudents: any[];
    allAssessmentScores: any[];
    assessmentCategories: AssessmentCategory[];
    rubricDimensions: RubricDimension[];
    rubricIndicators: RubricIndicator[];
}

export default function AnalyticsTab({ allStudents, allAssessmentScores, assessmentCategories, rubricDimensions, rubricIndicators }: AnalyticsTabProps) {
    // Local State
    const [analyticsGrade, setAnalyticsGrade] = useState<string>('');
    const [analyticsClass, setAnalyticsClass] = useState<string>('');
    const [analyticsCategory, setAnalyticsCategory] = useState<string>('');

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));

    // 1. FILTERING & DATA PREP
    // Available classes based on selected grade
    const availableAnalyticsClasses = analyticsGrade
        ? Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === analyticsGrade).map(s => s.class_name))).sort()
        : [];

    // Chart 1 Data: Average score for each assessment (Filtered by Grade/Class)
    const chart1Data = assessmentCategories.map(cat => {
        const dims = rubricDimensions.filter(d => d.category_id === cat.id);
        const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));
        const isChecklist = cat.rubric_type === 'checklist';
        const maxScale = parseInt(cat.rubric_type.replace('scale_', '') || '1');
        const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

        let baseScores = allAssessmentScores.filter(s => s.category_id === cat.id);
        if (analyticsClass) {
            baseScores = baseScores.filter(s => s.class_name === analyticsClass);
        } else if (analyticsGrade) {
            baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
        }

        const groupScores = new Map<string, number>();
        baseScores.forEach(s => {
            const key = `${s.class_name}-${s.group_number}`;
            groupScores.set(key, (groupScores.get(key) || 0) + s.score);
        });

        const groupEntries = Array.from(groupScores.values());
        const avgPct = groupEntries.length > 0 && maxPerGroup > 0
            ? Math.round(groupEntries.reduce((a, b) => a + b, 0) / groupEntries.length / maxPerGroup * 100)
            : 0;
        return { code: cat.code, name: cat.name, avgPct, groupCount: groupEntries.length };
    });

    // Chart 2 & 3 Dependencies: Selected Category
    const selectedCatForCharts = assessmentCategories.find(c => c.id === analyticsCategory);

    // Chart 2 Data: Leaderboard (Top 10) for Selected Grade/Class & Category
    let analyticsLeaderboardData: { label: string; pct: number }[] = [];
    if (selectedCatForCharts) {
        const dims = rubricDimensions.filter(d => d.category_id === selectedCatForCharts.id);
        const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));
        const isChecklist = selectedCatForCharts.rubric_type === 'checklist';
        const maxScale = parseInt(selectedCatForCharts.rubric_type.replace('scale_', '') || '1');
        const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

        let baseScores = allAssessmentScores.filter(s => s.category_id === selectedCatForCharts.id);
        if (analyticsClass) {
            baseScores = baseScores.filter(s => s.class_name === analyticsClass);
        } else if (analyticsGrade) {
            baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
        }

        const groupScores = new Map<string, number>();
        baseScores.forEach(s => {
            const key = `${s.class_name}-${s.group_number}`;
            groupScores.set(key, (groupScores.get(key) || 0) + s.score);
        });

        groupScores.forEach((score, key) => {
            const pct = maxPerGroup > 0 ? Math.round((score / maxPerGroup) * 100) : 0;
            const [cls, grp] = key.split('-');
            analyticsLeaderboardData.push({ label: `${cls} G${grp}`, pct });
        });
        analyticsLeaderboardData.sort((a, b) => b.pct - a.pct);
        analyticsLeaderboardData = analyticsLeaderboardData.slice(0, 10); // Top 10
    }

    // Chart 3 Data: Avg per dimension for Selected Grade/Class & Category
    const chart3Data: { dimName: string; avgPct: number; count: number }[] = [];
    if (selectedCatForCharts) {
        const dims = rubricDimensions.filter(d => d.category_id === selectedCatForCharts.id);
        const isChecklist = selectedCatForCharts.rubric_type === 'checklist';
        const maxScale = parseInt(selectedCatForCharts.rubric_type.replace('scale_', '') || '1');

        dims.forEach(dim => {
            const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
            const indIds = inds.map(i => i.id);
            const maxPerGroup = isChecklist ? inds.length : inds.length * maxScale;

            let baseScores = allAssessmentScores.filter(s => indIds.includes(s.indicator_id));
            if (analyticsClass) {
                baseScores = baseScores.filter(s => s.class_name === analyticsClass);
            } else if (analyticsGrade) {
                baseScores = baseScores.filter(s => String(s.class_name).split('.')[0] === analyticsGrade);
            }

            const groupScores = new Map<string, number>();
            baseScores.forEach(s => {
                const key = `${s.class_name}-${s.group_number}`;
                groupScores.set(key, (groupScores.get(key) || 0) + s.score);
            });

            const entries = Array.from(groupScores.values());
            const avgPct = entries.length > 0 && maxPerGroup > 0
                ? Math.round(entries.reduce((a, b) => a + b, 0) / entries.length / maxPerGroup * 100)
                : 0;
            chart3Data.push({ dimName: dim.name, avgPct, count: entries.length });
        });
    }

    const barColor = (pct: number) => pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
                <TrendingUp className="text-amber-500" />
                Analytics Dashboard
            </h2>

            {/* ANALYTICS FILTERS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#1c1b14] border border-slate-800 rounded-xl p-4 shadow-xl">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade Filter</label>
                    <select
                        value={analyticsGrade}
                        onChange={(e) => { setAnalyticsGrade(e.target.value); setAnalyticsClass(''); }}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                        <option value="">All Grades</option>
                        {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class Filter</label>
                    <select
                        value={analyticsClass}
                        onChange={(e) => setAnalyticsClass(e.target.value)}
                        disabled={!analyticsGrade}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                    >
                        <option value="">All Classes (in Grade {analyticsGrade || '-'})</option>
                        {availableAnalyticsClasses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessment Filter (Charts 2 & 3)</label>
                    <select
                        value={analyticsCategory}
                        onChange={(e) => setAnalyticsCategory(e.target.value)}
                        className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                        <option value="">Select an Assessment...</option>
                        {assessmentCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                    </select>
                </div>
            </div>

            {allAssessmentScores.length === 0 ? (
                <div className="text-center py-16 bg-[#1a1811]/50 border border-slate-800/50 rounded-2xl">
                    <PieChart className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-300 mb-2">No Assessment Data Yet</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">Start assessing projects to see analytics here.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Chart 1: Average by Assessment */}
                    <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-2">Average Score by Assessment</h3>
                        <p className="text-xs text-slate-400 mb-6">
                            Filtering: {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Grades'}
                        </p>
                        <div className="space-y-4">
                            {chart1Data.map(c => (
                                <div key={c.code} className="flex items-center gap-4">
                                    <span className="w-12 text-sm font-bold text-amber-400 shrink-0" title={c.name}>{c.code}</span>
                                    <div className="flex-1 bg-[#1c1b14] rounded-full h-8 border border-slate-800 overflow-hidden">
                                        <div className={`h-full rounded-r-full ${barColor(c.avgPct)} transition-all flex items-center justify-end pr-3`} style={{ width: `${Math.max(c.avgPct, 5)}%` }}>
                                            <span className="text-xs font-bold text-white drop-shadow-md">{c.avgPct}%</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 w-20 text-right shrink-0">{c.groupCount} groups</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Chart 2: Leaderboard */}
                        <div className="bg-[#1a1811] border border-emerald-900/20 rounded-2xl p-6 shadow-xl">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Star className="w-5 h-5 text-emerald-400" /> Leaderboard (Top 10)
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400 mb-6">
                                {analyticsCategory ? (
                                    <>Based on <strong className="text-emerald-400">{selectedCatForCharts?.code}</strong> • {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Regions'}</>
                                ) : 'Please select an Assessment Filter above to view.'}
                            </p>

                            {analyticsCategory ? (
                                analyticsLeaderboardData.length > 0 ? (
                                    <div className="space-y-3">
                                        {analyticsLeaderboardData.map((g, idx) => (
                                            <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-[#1c1b14] border-b border-l-4 border-l-transparent border-slate-800/50 hover:border-l-emerald-500 hover:bg-[#25221b] transition-all">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-400/50' : idx === 2 ? 'bg-orange-700/20 text-orange-400 border border-orange-700/50' : 'bg-[#1a1811] text-slate-500 border border-slate-700'}`}>
                                                    {idx + 1}
                                                </div>
                                                <span className="flex-1 text-sm font-bold text-slate-200">{g.label}</span>
                                                <span className={`text-lg font-bold ${g.pct >= 80 ? 'text-emerald-400' : g.pct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>{g.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <p className="text-sm text-slate-500 italic py-8 text-center">No scores found for these filters.</p>
                            ) : (
                                <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-slate-500 flex items-center gap-2 text-sm">
                                        <Filter className="w-4 h-4" /> Select an assessment
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Chart 3: Dimension Breakdown */}
                        <div className="bg-[#1a1811] border border-indigo-900/20 rounded-2xl p-6 shadow-xl relative">
                            <h3 className="text-lg font-bold text-white mb-2">Dimension Breakdown</h3>
                            <p className="text-xs text-slate-400 mb-6">
                                {analyticsCategory ? (
                                    <>Dimensions of <strong className="text-indigo-400">{selectedCatForCharts?.code}</strong> • {analyticsClass ? `Class ${analyticsClass}` : analyticsGrade ? `Grade ${analyticsGrade}` : 'All Regions'}</>
                                ) : 'Please select an Assessment Filter above to view.'}
                            </p>

                            {analyticsCategory ? (
                                chart3Data.length > 0 && chart3Data.some(d => d.count > 0) ? (
                                    <>
                                        <div className="space-y-5">
                                            {chart3Data.map((d, idx) => (
                                                <div key={idx} className="space-y-1.5">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-sm font-semibold text-slate-300 truncate pr-4" title={d.dimName}>{d.dimName}</span>
                                                        <span className="text-sm font-bold text-slate-400">{d.avgPct}%</span>
                                                    </div>
                                                    <div className="w-full bg-[#1c1b14] rounded-full h-3 border border-slate-800 overflow-hidden">
                                                        <div className={`h-full rounded-r-full ${barColor(d.avgPct)} transition-all`} style={{ width: `${Math.max(d.avgPct, 2)}%` }}></div>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-medium text-right mt-1">{d.count} groups assessed</p>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Interactive Radar Chart Representation */}
                                        <div className="mt-8 pt-6 border-t border-slate-800/50">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 text-center">Class Skills Profile</h4>
                                            <div className="h-64 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chart3Data}>
                                                        <PolarGrid stroke="#334155" />
                                                        <PolarAngleAxis dataKey="dimName" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                                                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} />
                                                        <Radar name="Average Score" dataKey="avgPct" stroke="#818cf8" fill="#818cf8" fillOpacity={0.4} isAnimationActive={true} />
                                                        <RechartsTooltip contentStyle={{ backgroundColor: '#1e1e2d', border: '1px solid #334155', borderRadius: '8px' }} itemStyle={{ color: '#818cf8' }} />
                                                    </RadarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </>
                                ) : <p className="text-sm text-slate-500 italic py-8 text-center">No dimension data found for these filters.</p>
                            ) : (
                                <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-800 rounded-xl">
                                    <p className="text-slate-500 flex items-center gap-2 text-sm">
                                        <Filter className="w-4 h-4" /> Select an assessment
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
