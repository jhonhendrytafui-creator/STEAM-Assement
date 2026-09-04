'use client';

import React, { useState } from 'react';
import {
    BarChart2
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import {
    contributionMultiplier, applyMultiplier,
    WEIGHTING_DEFAULTS, type WeightingConfig, type PeerAssessmentRow,
} from '@/lib/contribution';
import type { AssessmentCategory, RubricDimension, RubricIndicator } from '@/lib/types';

interface ScoreTabProps {
    allStudents: any[];
    assessmentCategories: AssessmentCategory[];
    rubricDimensions: RubricDimension[];
    rubricIndicators: RubricIndicator[];
    showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ScoreTab({ allStudents, assessmentCategories, rubricDimensions, rubricIndicators, showToast }: ScoreTabProps) {
    // Score Tab State
    const [scoreGrade, setScoreGrade] = useState<string>('');
    const [scoreClass, setScoreClass] = useState<string>('');
    const [scoreCategories, setScoreCategories] = useState<string[]>([]);
    const [classScores, setClassScores] = useState<any[]>([]);
    const [isFetchingScores, setIsFetchingScores] = useState(false);
    const [scoreGrouping, setScoreGrouping] = useState<'group' | 'alphabetical'>('group');
    // Individual contribution weighting from peer assessment. Off by default —
    // whether an individual mark may differ from the group mark is a school
    // assessment-policy decision, not something to switch on silently.
    const [weighting, setWeighting] = useState<WeightingConfig>(WEIGHTING_DEFAULTS);

    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort((a, b) => Number(a) - Number(b));
    const availableClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === scoreGrade).map(s => s.class_name))).sort();

    const fetchClassScores = async () => {
        if (!scoreClass || scoreCategories.length === 0) return;
        setIsFetchingScores(true);

        const studentsInClass = allStudents.filter(s => s.class_name === scoreClass).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

        const { data: classProjects } = await supabase
            .from('projects')
            .select('group_number, title')
            .eq('class_name', scoreClass)
            .eq('academic_year', ACADEMIC_YEAR)
            .order('iteration', { ascending: false });

        const { data: scoresData } = await supabase
            .from('assessment_scores')
            .select('*')
            .eq('class_name', scoreClass)
            .in('category_id', scoreCategories)
            .eq('academic_year', ACADEMIC_YEAR);

        // Peer assessments drive the per-student contribution multiplier.
        const { data: peerData } = await supabase
            .from('peer_assessments')
            .select('assessor_email, assessed_email, q1_score, q2_score, q3_score, q4_score, q5_score, q6_score')
            .eq('class_name', scoreClass)
            .eq('academic_year', ACADEMIC_YEAR);

        const peerRows = (peerData ?? []) as PeerAssessmentRow[];

        const results = studentsInClass.map(student => {
            const proj = classProjects?.find(p => p.group_number === student.group_number);

            const groupPeerRows = peerRows.filter(r =>
                studentsInClass.some(s =>
                    s.group_number === student.group_number &&
                    (s.email === r.assessor_email || s.email === r.assessed_email)
                )
            );
            const contribution = contributionMultiplier(student.email, groupPeerRows, weighting);

            const studentAssessments: Record<string, any> = {};

            scoreCategories.forEach(catId => {
                const cat = assessmentCategories.find(c => c.id === catId);
                const dims = rubricDimensions.filter(d => d.category_id === catId);
                const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));

                const maxScale = parseInt(cat?.rubric_type.replace('scale_', '') || '1');
                const isChecklist = cat?.rubric_type === 'checklist';
                const totalMax = isChecklist ? inds.length : inds.length * maxScale;

                const groupCatScores = scoresData?.filter(s => s.group_number === student.group_number && s.category_id === catId) || [];
                const groupScore = groupCatScores.reduce((sum, s) => sum + s.score, 0);
                const totalScore = applyMultiplier(groupScore, totalMax, contribution.multiplier);

                studentAssessments[catId] = {
                    groupScore,
                    totalScore,
                    totalMax,
                    percentage: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0,
                    isAssessed: groupCatScores.length > 0,
                    adjusted: totalScore !== groupScore,
                };
            });

            return {
                student_name: student.full_name,
                student_email: student.email,
                group_number: student.group_number,
                project_title: proj?.title || 'No Project Submitted',
                assessments: studentAssessments,
                contribution,
            };
        });

        // Sorting
        if (scoreGrouping === 'group') {
            results.sort((a, b) => a.group_number - b.group_number || (a.student_name || '').localeCompare(b.student_name || ''));
        }

        setClassScores(results);
        setIsFetchingScores(false);
    };

    // Escape one CSV field: quote it, double any inner quotes, and defuse
    // spreadsheet formulas. Students choose their own project titles, so a
    // title starting with = + - or @ would otherwise execute in Excel when a
    // teacher opens the export.
    const csvCell = (value: unknown): string => {
        const text = value === null || value === undefined ? '' : String(value);
        const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
    };

    const downloadScoresCSV = () => {
        if (classScores.length === 0) return;

        const headers = ['Student Name', 'Group', 'Project Title'];
        if (weighting.enabled) headers.push('Contribution');
        scoreCategories.forEach(catId => {
            const cat = assessmentCategories.find(c => c.id === catId);
            if (cat) headers.push(cat.name);
        });

        const csvRows = [headers.map(csvCell).join(',')];

        classScores.forEach(row => {
            const rowData = [
                csvCell(row.student_name),
                csvCell(row.group_number),
                csvCell(row.project_title),
            ];

            if (weighting.enabled) {
                rowData.push(csvCell(
                    row.contribution.meanRating === null
                        ? '-'
                        : `x${row.contribution.multiplier.toFixed(2)}`
                ));
            }

            scoreCategories.forEach(catId => {
                const assessment = row.assessments[catId];
                rowData.push(csvCell(
                    assessment.isAssessed
                        ? `${assessment.totalScore}/${assessment.totalMax} (${assessment.percentage}%)`
                        : '-'
                ));
            });

            csvRows.push(rowData.join(','));
        });

        // CRLF and a UTF-8 BOM so Excel on Windows opens it with the right
        // encoding instead of mangling accented names.
        const csvString = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Steam_Scores_${scoreClass}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <BarChart2 className="text-amber-500" />
                Student Score
            </h2>

            {/* Score Filters */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-5">
                <div className="space-y-4 lg:col-span-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="score-tab-grade" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                            <select
                                id="score-tab-grade"
                                value={scoreGrade}
                                onChange={(e) => { setScoreGrade(e.target.value); setScoreClass(''); setClassScores([]); }}
                                className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                            >
                                <option value="">Select Grade</option>
                                {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="score-tab-class" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class</label>
                            <select
                                id="score-tab-class"
                                value={scoreClass}
                                onChange={(e) => { setScoreClass(e.target.value); setClassScores([]); }}
                                disabled={!scoreGrade}
                                className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                            >
                                <option value="">Select Class</option>
                                {availableClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase" id="score-grouping-options">Grouping Options</span>
                        <div className="flex bg-[#1a1811] border border-slate-800 rounded-lg overflow-hidden" role="group" aria-labelledby="score-grouping-options">
                            <button
                                onClick={() => { setScoreGrouping('group'); setClassScores([]); }}
                                className={`flex-1 py-2 text-xs font-bold transition-colors ${scoreGrouping === 'group' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                By Group
                            </button>
                            <button
                                onClick={() => { setScoreGrouping('alphabetical'); setClassScores([]); }}
                                className={`flex-1 py-2 text-xs font-bold transition-colors ${scoreGrouping === 'alphabetical' ? 'bg-amber-500/20 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                A-Z Alphabetical
                            </button>
                        </div>
                    </div>

                    <div>
                        <span className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Individual Contribution</span>
                        <label className="flex items-start gap-2.5 bg-[#1a1811] border border-slate-800 rounded-lg p-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={weighting.enabled}
                                onChange={(e) => {
                                    setWeighting(w => ({ ...w, enabled: e.target.checked }));
                                    setClassScores([]);
                                }}
                                className="accent-amber-500 mt-0.5"
                            />
                            <span className="text-xs leading-relaxed">
                                <span className="text-slate-200 font-medium block">Weight by peer assessment</span>
                                <span className="text-slate-500">
                                    Adjusts each student between &times;{weighting.floor} and &times;{weighting.ceiling} of
                                    the group score, based on how their teammates rated them.
                                    Needs at least {weighting.minRatings} ratings. Self-ratings are ignored.
                                </span>
                            </span>
                        </label>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <span className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase" id="score-assessments">Assessments (Multi-Select)</span>
                    <div className="bg-[#1a1811] border border-slate-800 rounded-lg p-3 custom-scrollbar overflow-y-auto max-h-48" role="group" aria-labelledby="score-assessments">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {assessmentCategories.map(c => {
                                const isSelected = scoreCategories.includes(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            if (isSelected) {
                                                setScoreCategories(prev => prev.filter(id => id !== c.id));
                                            } else {
                                                setScoreCategories(prev => [...prev, c.id]);
                                            }
                                            setClassScores([]);
                                        }}
                                        className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-center h-full ${isSelected
                                            ? 'bg-amber-500 text-[#1a1811] border-amber-500 shadow-md'
                                            : 'bg-[#1c1b14] border-slate-700 hover:border-amber-500/50'
                                            }`}
                                    >
                                        <span className={`text-xs font-extrabold ${isSelected ? 'text-[#1a1811]' : 'text-slate-300'}`}>{c.code}</span>
                                        <span className={`text-[10px] leading-tight mt-0.5 line-clamp-2 ${isSelected ? 'text-amber-950' : 'text-slate-500'}`}>{c.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {assessmentCategories.length === 0 && <span className="text-sm text-slate-500 italic">No assessments available.</span>}
                    </div>
                </div>

                <div className="flex flex-col justify-end gap-3 lg:col-span-1">
                    <button
                        onClick={fetchClassScores}
                        disabled={!scoreClass || scoreCategories.length === 0 || isFetchingScores}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-[#1a1811] font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm h-[42px] flex items-center justify-center gap-2"
                    >
                        {isFetchingScores ? 'Loading...' : 'Search Scores'}
                    </button>

                    <button
                        onClick={downloadScoresCSV}
                        disabled={classScores.length === 0}
                        className="w-full bg-[#1a1811] border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm h-[42px] flex items-center justify-center gap-2"
                    >
                        Download CSV
                    </button>
                </div>
            </div>

            {/* Scores Table */}
            {classScores.length > 0 && (
                <div className="bg-[#1c1b14] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                                <tr className="bg-[#1a1811] border-b border-slate-800/50 text-xs uppercase tracking-wider text-slate-500">
                                    <th className="p-4 font-semibold w-64 bg-[#1a1811] sticky left-0 z-10 border-r border-slate-800/50">Student Name</th>
                                    <th className="p-4 font-semibold text-center w-20">Group</th>
                                    <th className="p-4 font-semibold w-64">Project Title</th>
                                    {weighting.enabled && (
                                        <th className="p-4 font-semibold text-center w-32">Contribution</th>
                                    )}
                                    {scoreCategories.map(catId => {
                                        const cat = assessmentCategories.find(c => c.id === catId);
                                        return <th key={catId} className="p-4 font-semibold text-center">{cat?.code || 'Score'}</th>;
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30 text-sm">
                                {classScores.map((score, idx) => (
                                    <tr key={idx} className="hover:bg-[#1a1811]/50 transition-colors group">
                                        <td className="p-4 font-bold text-slate-200 bg-[#1c1b14] group-hover:bg-[#1a1811] sticky left-0 z-10 border-r border-slate-800/50">
                                            {score.student_name}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="w-7 h-7 rounded-sm bg-slate-800/80 flex items-center justify-center text-amber-400 font-bold text-xs mx-auto border border-slate-700">
                                                {score.group_number}
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium text-slate-400">
                                            <span className="line-clamp-2">{score.project_title}</span>
                                        </td>

                                        {weighting.enabled && (
                                            <td className="p-4 text-center">
                                                {score.contribution.reason === 'not-enough-ratings' ? (
                                                    <span
                                                        className="text-[11px] text-slate-500"
                                                        title={`Only ${score.contribution.ratingCount} teammate rating(s) — at least ${weighting.minRatings} are needed.`}
                                                    >
                                                        Not enough ratings
                                                    </span>
                                                ) : score.contribution.meanRating === null ? (
                                                    <span className="text-slate-600">—</span>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`text-sm font-bold ${
                                                            score.contribution.multiplier > 1.001 ? 'text-emerald-400'
                                                                : score.contribution.multiplier < 0.999 ? 'text-amber-400'
                                                                : 'text-slate-400'
                                                        }`}>
                                                            &times;{score.contribution.multiplier.toFixed(2)}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-medium block">
                                                            {score.contribution.meanRating.toFixed(1)} vs {score.contribution.groupMean?.toFixed(1)} avg
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                        )}

                                        {scoreCategories.map(catId => {
                                            const assessment = score.assessments[catId];
                                            return (
                                                <td key={catId} className="p-4 text-center">
                                                    {assessment.isAssessed ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className={`text-sm font-bold ${assessment.percentage >= 80 ? 'text-emerald-400' : assessment.percentage >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                                                                {assessment.percentage}%
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-medium block">
                                                                {assessment.totalScore}/{assessment.totalMax}
                                                                {assessment.adjusted && (
                                                                    <span className="text-slate-600" title="Group score before the contribution multiplier">
                                                                        {' '}(group {assessment.groupScore})
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600">—</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
