'use client';

import React, { useState } from 'react';
import { FileCheck, TrendingUp, CheckCircle2, X } from 'lucide-react';
import type { AssessmentCategory, RubricDimension, RubricIndicator, AssessmentScoreEntry } from '@/lib/types';

interface AssessmentResultTabProps {
    assessmentCategories: AssessmentCategory[];
    rubricDimensions: RubricDimension[];
    rubricIndicators: RubricIndicator[];
    assessmentScores: AssessmentScoreEntry[];
    renderFormattedText: (text: string) => React.ReactNode;
}

export default function AssessmentResultTab({
    assessmentCategories,
    rubricDimensions,
    rubricIndicators,
    assessmentScores,
    renderFormattedText,
}: AssessmentResultTabProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        assessmentCategories.length > 0 ? assessmentCategories[0].id : null
    );

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <FileCheck className="text-amber-500" />
                Assessment Results
            </h2>

            {/* Category Pills */}
            <div className="flex flex-wrap gap-2 mb-8">
                {assessmentCategories.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    const catDimIds = rubricDimensions.filter(d => d.category_id === cat.id).map(d => d.id);
                    const catIndIds = rubricIndicators.filter(ind => catDimIds.includes(ind.dimension_id)).map(ind => ind.id);
                    const hasScores = assessmentScores.some(s => catIndIds.includes(s.indicator_id));

                    return (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`relative px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${isActive
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-lg shadow-amber-900/10'
                                : 'bg-[#1c1b14] text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-300'
                                }`}
                        >
                            <span className="text-xs font-bold mr-1.5 opacity-60">{cat.code}</span>
                            <span className="hidden sm:inline">{cat.name}</span>
                            {hasScores && (
                                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#1a1811]"></span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Rubric Result View */}
            {(() => {
                if (!selectedCategory) return null;

                const cat = assessmentCategories.find(c => c.id === selectedCategory);
                if (!cat) return null;

                const dims = rubricDimensions.filter(d => d.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
                const maxScale = parseInt(cat.rubric_type.replace('scale_', '')) || 1;
                const isChecklist = cat.rubric_type === 'checklist';

                const allInds = dims.flatMap(dim =>
                    rubricIndicators.filter(ind => ind.dimension_id === dim.id)
                );
                const allIndIds = allInds.map(ind => ind.id);
                const catScores = assessmentScores.filter(s => allIndIds.includes(s.indicator_id));

                if (dims.length === 0) {
                    return (
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
                            <FileCheck className="w-14 h-14 text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-300 mb-2">No Rubric Defined</h3>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                The rubric for <strong className="text-amber-400">{cat.code} — {cat.name}</strong> has not been set up yet. Please wait for your teacher to configure it.
                            </p>
                        </div>
                    );
                }

                if (catScores.length === 0) {
                    return (
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[250px]">
                            <FileCheck className="w-14 h-14 text-slate-700 mb-4" />
                            <h3 className="text-lg font-bold text-slate-300 mb-2">Not Assessed Yet</h3>
                            <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                <strong className="text-amber-400">{cat.code} — {cat.name}</strong> is pending review by your teacher. Scores will appear here once graded.
                            </p>
                        </div>
                    );
                }

                const totalScore = catScores.reduce((sum, s) => sum + s.score, 0);
                const totalMax = isChecklist ? allInds.length : allInds.length * maxScale;
                const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

                let overallColor = 'text-amber-400';
                let overallBg = 'bg-amber-500';
                if (overallPct >= 80) { overallColor = 'text-emerald-400'; overallBg = 'bg-emerald-500'; }
                else if (overallPct < 60) { overallColor = 'text-red-400'; overallBg = 'bg-red-500'; }

                // Only show the top-level comment when all rows share the same text (old format).
                // New format saves unique per-indicator reasons, so we surface those inline instead.
                const allSameComment = catScores.length > 0 && catScores.every(s => s.teacher_comment === catScores[0].teacher_comment);
                const teacherComment = allSameComment ? catScores[0]?.teacher_comment : null;

                return (
                    <div className="space-y-6">
                        {/* Overall Summary Card */}
                        <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/10 border border-amber-500/20 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-amber-500" />
                                    <span className="text-sm font-semibold text-slate-300">{cat.code} — {cat.name}</span>
                                </div>
                                <span className="text-xs bg-slate-800 text-slate-400 px-2.5 py-1 rounded-full border border-slate-700">
                                    {isChecklist ? 'Checklist' : `Scale 1-${maxScale}`}
                                </span>
                            </div>
                            <div className="flex items-end gap-3 mt-3">
                                <span className={`text-4xl font-bold ${overallColor}`}>{overallPct}%</span>
                                <span className="text-sm text-slate-500 mb-1">({totalScore}/{totalMax} points)</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 mt-3">
                                <div className={`${overallBg} h-2 rounded-full transition-all duration-700`} style={{ width: `${overallPct}%` }}></div>
                            </div>

                            {teacherComment && (
                                <div className="mt-5 pt-4 border-t border-amber-500/20">
                                    <span className="text-[10px] uppercase text-amber-500/70 font-bold block mb-1">Teacher Assessment Comment</span>
                                    <p className="text-sm text-amber-100 whitespace-pre-wrap leading-relaxed">&quot;{teacherComment.split('\n').map((line: string, idx: number) => (
                                        <React.Fragment key={idx}>
                                            {idx > 0 && <br />}
                                            {renderFormattedText(line)}
                                        </React.Fragment>
                                    ))}&quot;</p>
                                </div>
                            )}
                        </div>

                        {/* Dimension Cards */}
                        {dims.map((dim) => {
                            const dimInds = rubricIndicators.filter(ind => ind.dimension_id === dim.id).sort((a, b) => a.sort_order - b.sort_order);
                            const dimIndIds = dimInds.map(ind => ind.id);
                            const dimScores = assessmentScores.filter(s => dimIndIds.includes(s.indicator_id));

                            const dimTotal = dimScores.reduce((sum, s) => sum + s.score, 0);
                            const dimMax = isChecklist ? dimInds.length : dimInds.length * maxScale;
                            const dimPct = dimMax > 0 ? Math.round((dimTotal / dimMax) * 100) : 0;

                            return (
                                <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-800/50 flex items-center justify-between">
                                        <h4 className="font-bold text-white text-sm">{dim.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500">{dimTotal}/{dimMax}</span>
                                            <span className={`text-sm font-bold ${dimPct >= 80 ? 'text-emerald-400' : dimPct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                                {dimPct}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-800/30">
                                        {dimInds.map((ind, idx) => {
                                            const scoreEntry = dimScores.find(s => s.indicator_id === ind.id);
                                            const scoreVal = scoreEntry?.score || 0;
                                            const indicatorReason = !allSameComment ? scoreEntry?.teacher_comment : null;

                                            return (
                                                <div key={ind.id} className="px-5 py-3 hover:bg-[#1a1811] transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-xs text-slate-600 font-mono w-6 shrink-0">{idx + 1}.</span>
                                                        <p className="text-sm text-slate-300 flex-1">{ind.description}</p>

                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isChecklist ? (
                                                                scoreVal >= 1 ? (
                                                                    <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center">
                                                                        <X className="w-3 h-3 text-slate-600" aria-hidden="true" />
                                                                    </div>
                                                                )
                                                            ) : (
                                                                Array.from({ length: maxScale }, (_, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className={`w-5 h-5 rounded-full border-2 transition-colors ${i < scoreVal
                                                                            ? 'bg-amber-500 border-amber-500'
                                                                            : 'bg-transparent border-slate-700'
                                                                            }`}
                                                                    />
                                                                ))
                                                            )}
                                                            <span className="text-xs font-bold text-slate-400 ml-2 w-8 text-right">
                                                                {isChecklist ? (scoreVal >= 1 ? '✓' : '—') : `${scoreVal}/${maxScale}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {indicatorReason && (
                                                        <p className="text-xs text-slate-500 mt-1.5 ml-10 leading-relaxed italic">
                                                            {indicatorReason}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
}
