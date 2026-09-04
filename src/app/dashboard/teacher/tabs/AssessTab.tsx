'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    ClipboardCheck, BookOpen, Link as LinkIcon, Star, FileText, Lock, Unlock,
    AlertTriangle, CheckCircle2, Clock, Sparkles, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { AssessmentCategory, RubricDimension, RubricIndicator, ProjectData, ToastType } from '@/lib/types';
import { parseAbstract, subjectLabel } from '@/lib/abstract';
import { jsPDF } from 'jspdf';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface AssessTabProps {
    allStudents: any[];
    assessmentCategories: AssessmentCategory[];
    rubricDimensions: RubricDimension[];
    rubricIndicators: RubricIndicator[];
    showToast: (message: string, type: ToastType) => void;
    onAssessmentSaved: (scores: any[], assessClass: string, assessGroup: number, assessCategory: string) => void;
    teacherProfile: any;
}

export default function AssessTab({
    allStudents,
    assessmentCategories,
    rubricDimensions,
    rubricIndicators,
    showToast,
    onAssessmentSaved,
    teacherProfile
}: AssessTabProps) {
    const availableGrades = Array.from(new Set(allStudents.map(s => String(s.class_name).split('.')[0]))).sort();

    const [assessGrade, setAssessGrade] = useState<string>('');
    const [assessClass, setAssessClass] = useState<string>('');
    const [assessGroup, setAssessGroup] = useState<string>('');
    const [assessCategory, setAssessCategory] = useState<string>('');
    const [assessedGroupsMap, setAssessedGroupsMap] = useState<Record<number, boolean>>({});
    const [groupCompletedCategories, setGroupCompletedCategories] = useState<Set<string>>(new Set());

    const [assessProject, setAssessProject] = useState<any>(null);
    const [currentScores, setCurrentScores] = useState<Record<string, number>>({});
    const [assessStatus, setAssessStatus] = useState<string>('');
    const [assessComment, setAssessComment] = useState<string>('');
    const [assessLogbooks, setAssessLogbooks] = useState<any[]>([]);
    const [c5Questions, setC5Questions] = useState<string>('');
    const [isGeneratingC5, setIsGeneratingC5] = useState(false);
    const [c5Language, setC5Language] = useState<'en' | 'id'>('en');
    const c5QuestionsCache = useRef<{ en: string; id: string }>({ en: '', id: '' });
    const [isSubmittingScore, setIsSubmittingScore] = useState(false);
    const [isAutoAssessing, setIsAutoAssessing] = useState(false);
    const [indicatorComments, setIndicatorComments] = useState<Record<string, string>>({});
    const [isAssessmentLocked, setIsAssessmentLocked] = useState(false);
    const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);

    const availableAssessClasses = Array.from(new Set(allStudents.filter(s => String(s.class_name).split('.')[0] === assessGrade).map(s => s.class_name))).sort();
    const availableAssessGroups = Array.from(new Set(allStudents.filter(s => s.class_name === assessClass).map(s => s.group_number))).sort((a: number, b: number) => a - b);

    // Auto-select first group when class changes
    useEffect(() => {
        if (assessClass && availableAssessGroups.length > 0) {
            setAssessGroup(availableAssessGroups[0].toString());
        } else {
            setAssessGroup('');
        }
    }, [assessClass]);

    // Fetch assessed groups map when class or category changes
    useEffect(() => {
        const fetchAssessedGroups = async () => {
            if (!assessClass || !assessCategory) {
                setAssessedGroupsMap({});
                return;
            }
            const { data: scores } = await supabase
                .from('assessment_scores')
                .select('group_number')
                .eq('class_name', assessClass)
                .eq('category_id', assessCategory)
                .eq('academic_year', ACADEMIC_YEAR);

            const map: Record<number, boolean> = {};
            const currentCat = assessmentCategories.find(c => c.id === assessCategory);
            const isC1Category = currentCat?.code === 'C1';

            if (isC1Category) {
                const { data: projs } = await supabase
                    .from('projects')
                    .select('group_number, status')
                    .eq('class_name', assessClass)
                    .eq('academic_year', ACADEMIC_YEAR)
                    .order('iteration', { ascending: false });

                const latestProjs = new Map();
                if (projs) {
                    projs.forEach(p => {
                        if (!latestProjs.has(p.group_number)) {
                            latestProjs.set(p.group_number, p.status);
                        }
                    });
                }

                if (scores) {
                    scores.forEach(s => {
                        if (latestProjs.get(s.group_number) !== 'pending') {
                            map[s.group_number] = true;
                        }
                    });
                }
            } else {
                if (scores) {
                    scores.forEach(s => { map[s.group_number] = true; });
                }
            }
            setAssessedGroupsMap(map);
        };
        fetchAssessedGroups();
    }, [assessClass, assessCategory, supabase, assessmentCategories]);

    useEffect(() => {
        const loadAssessData = async () => {
            if (!assessClass || !assessGroup || !assessCategory) {
                setAssessProject(null);
                setCurrentScores({});
                setAssessComment('');
                setAssessStatus('');
                setC5Questions('');
                return;
            }

            setCurrentScores({});
            setAssessComment('');
            setAssessStatus('');
            setAssessLogbooks([]);
            setC5Questions('');
            setIndicatorComments({});

            const { data: projs } = await supabase
                .from('projects')
                .select('*')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('academic_year', ACADEMIC_YEAR)
                .order('iteration', { ascending: false })
                .limit(1);
            const proj = projs && projs.length > 0 ? projs[0] : null;
            setAssessProject(proj);

            const { data: scores } = await supabase
                .from('assessment_scores')
                .select('indicator_id, score, teacher_comment')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('category_id', assessCategory)
                .eq('academic_year', ACADEMIC_YEAR);

            const { data: allGroupScores } = await supabase
                .from('assessment_scores')
                .select('category_id')
                .eq('class_name', assessClass)
                .eq('group_number', parseInt(assessGroup))
                .eq('academic_year', ACADEMIC_YEAR);

            if (allGroupScores) {
                setGroupCompletedCategories(new Set(allGroupScores.map(s => s.category_id)));
            } else {
                setGroupCompletedCategories(new Set());
            }

            const currentCat = assessmentCategories.find(c => c.id === assessCategory);
            const isC1Category = currentCat?.code === 'C1';

            if (scores && scores.length > 0) {
                const scoreMap: Record<string, number> = {};
                scores.forEach(s => scoreMap[s.indicator_id] = s.score);
                setCurrentScores(scoreMap);

                const savedComment = scores.find(s => s.teacher_comment)?.teacher_comment || '';
                setAssessComment(savedComment);
                
                if (isC1Category && proj && proj.status === 'pending') {
                    setIsAssessmentLocked(false);
                } else {
                    setIsAssessmentLocked(true);
                }
            } else {
                setCurrentScores({});
                setAssessComment('');
                setIsAssessmentLocked(false);
            }

            if (isC1Category) {
                setAssessStatus(proj?.status !== 'pending' ? proj?.status : '');
            } else {
                setAssessStatus('');
            }

            if (currentCat?.code === 'C4') {
                const { data: logs } = await supabase
                    .from('logbooks')
                    .select('*')
                    .eq('class_name', assessClass)
                    .eq('group_number', parseInt(assessGroup))
                    .eq('academic_year', ACADEMIC_YEAR)
                    .order('entry_date', { ascending: true });
                if (logs) {
                    setAssessLogbooks(logs);
                }
            }

            if (currentCat?.code === 'C5' && proj) {
                const enQ = proj.c5_generated_questions_en || proj.c5_generated_questions || '';
                const idQ = proj.c5_generated_questions_id || '';
                c5QuestionsCache.current = { en: enQ, id: idQ };
                // Always default to English when switching projects
                setC5Language('en');
                setC5Questions(enQ);
            }
        };
        loadAssessData();
    }, [assessClass, assessGroup, assessCategory, supabase]);

    const handleAutoAssess = async () => {
        if (!assessProject || !assessCategory) return;
        setIsAutoAssessing(true);
        showToast('Gemini AI is analyzing the project...', 'info');

        try {
            const cat = assessmentCategories.find(c => c.id === assessCategory);
            const dims = rubricDimensions.filter(d => d.category_id === assessCategory);
            const inds = rubricIndicators.filter(i => dims.some(d => d.id === i.dimension_id));

            const response = await fetch('/api/ai-assess', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project: assessProject,
                    categoryName: cat?.name || 'Unknown Category',
                    indicators: inds.map(i => ({ id: i.id, description: i.description, criteria: i.criteria || {} })),
                    googleDocUrl: assessProject?.google_doc_url || null,
                    assessLogbooks: cat?.code === 'C4' ? assessLogbooks : undefined
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to auto-assess');
            }

            if (data.scores) setCurrentScores(data.scores);
            if (data.teacher_comment) setAssessComment(data.teacher_comment);
            if (data.suggested_status) setAssessStatus(data.suggested_status);
            if (data.indicator_comments) setIndicatorComments(data.indicator_comments);

            showToast('AI Assessment complete! Please review.', 'success');
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsAutoAssessing(false);
        }
    };

    const handleGenerateC5Questions = async () => {
        if (!assessProject) return;
        setIsGeneratingC5(true);
        showToast(`Generating questions in ${c5Language === 'id' ? 'Bahasa Indonesia' : 'English'}...`, 'info');

        try {
            const response = await fetch('/api/generate-c5-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectData: assessProject, language: c5Language })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate C5 context questions');
            }

            if (data.generatedQuestions) {
                c5QuestionsCache.current[c5Language] = data.generatedQuestions;
                setC5Questions(data.generatedQuestions);
                const dbColumn = c5Language === 'id' ? 'c5_generated_questions_id' : 'c5_generated_questions_en';
                const { error: dbError } = await supabase
                    .from('projects')
                    .update({ [dbColumn]: data.generatedQuestions })
                    .eq('id', assessProject.id);

                if (dbError) throw dbError;
                showToast('Q&A context generated & saved successfully!', 'success');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsGeneratingC5(false);
        }
    };

    const handleC5LanguageSwitch = (lang: 'en' | 'id') => {
        setC5Language(lang);
        setC5Questions(c5QuestionsCache.current[lang]);
    };

    const submitAssessment = async () => {
        if (!assessClass || !assessGroup || !assessCategory || !teacherProfile) return;
        const selectedCat = assessmentCategories.find(c => c.id === assessCategory);
        const isC1Category = selectedCat?.code === 'C1';

        if (isC1Category && !assessStatus) {
            showToast('Please select an approval status before saving.', 'warning');
            return;
        }
        const groupNum = parseInt(assessGroup);

        const scoreEntries = Object.entries(currentScores).map(([indicatorId, score]) => ({
            class_name: assessClass,
            group_number: groupNum,
            academic_year: ACADEMIC_YEAR,
            category_id: assessCategory,
            indicator_id: indicatorId,
            score: score,
            teacher_comment: indicatorComments[indicatorId] || assessComment || null,
            // Record who graded this, so a disputed mark can be traced back.
            assessed_by: teacherProfile.id,
            assessed_at: new Date().toISOString(),
        }));

        // Refuse to save an empty rubric. This check used to come after the
        // delete, so clicking Save on a blank form wiped a completed assessment
        // while showing only "No scores provided".
        if (scoreEntries.length === 0) {
            showToast('No scores provided. Please fill out the rubric.', 'warning');
            return;
        }

        setIsSubmittingScore(true);

        {
            // Upsert on the (class_name, group_number, academic_year, indicator_id)
            // unique constraint. The old code deleted every existing score first
            // and inserted afterwards with no transaction between the two, so a
            // failed insert left the teacher with nothing at all.
            const { error } = await supabase
                .from('assessment_scores')
                .upsert(scoreEntries, { onConflict: 'class_name,group_number,academic_year,indicator_id' });
            if (error) {
                showToast('Failed to save assessment: ' + error.message, 'error');
            } else {
                // Only once the new scores are safely stored, drop any indicator
                // rows left over from a previous, longer version of this rubric.
                const savedIndicatorIds = scoreEntries.map(e => e.indicator_id);
                await supabase
                    .from('assessment_scores')
                    .delete()
                    .eq('class_name', assessClass)
                    .eq('group_number', groupNum)
                    .eq('category_id', assessCategory)
                    .eq('academic_year', ACADEMIC_YEAR)
                    .not('indicator_id', 'in', `(${savedIndicatorIds.join(',')})`);

                showToast('Assessment saved successfully!', 'success');
                setIsAssessmentLocked(true);
                setAssessedGroupsMap(prev => ({ ...prev, [groupNum]: true }));
                
                onAssessmentSaved(scoreEntries, assessClass, groupNum, assessCategory);

                if (assessProject && isC1Category) {
                    await supabase.from('projects')
                        .update({
                            status: assessStatus,
                            teacher_comment: assessComment
                        })
                        .eq('id', assessProject.id);
                    setAssessProject({ ...assessProject, status: assessStatus, teacher_comment: assessComment });
                    
                    // Trigger AI classification in the background if approved
                    if (assessStatus === 'approved') {
                        supabase.auth.getSession().then(({ data: { session } }) => {
                            fetch('/api/ai-classify-project', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
                                },
                                body: JSON.stringify({ projectId: assessProject.id })
                            }).catch(err => console.error('Failed to trigger AI classification:', err));
                        });
                    }
                }
            }
        }
        setIsSubmittingScore(false);
    };

    return (
        <div className="relative">
            {isAutoAssessing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-[2px]">
                    <div className="bg-[#1a1811] border border-indigo-500/30 rounded-2xl p-8 flex flex-col items-center max-w-sm w-full mx-4 shadow-2xl">
                        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">AI Auto-Assessment</h3>
                        <p className="text-slate-400 text-sm text-center">Please wait while Gemini is evaluating the project against the rubrics. This may take a few seconds...</p>
                    </div>
                </div>
            )}

            <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <ClipboardCheck className="text-amber-500" />
                    Project Assessment
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 bg-[#1c1b14] border border-slate-800 rounded-xl p-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Grade</label>
                        <select
                            value={assessGrade}
                            onChange={(e) => { setAssessGrade(e.target.value); setAssessClass(''); setAssessGroup(''); }}
                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="">Select Grade</option>
                            {availableGrades.map(g => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Class</label>
                        <select
                            value={assessClass}
                            onChange={(e) => { setAssessClass(e.target.value); }}
                            disabled={!assessGrade}
                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                        >
                            <option value="">Select Class</option>
                            {availableAssessClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Assessment</label>
                        <select
                            value={assessCategory}
                            onChange={(e) => setAssessCategory(e.target.value)}
                            className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-2.5 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                        >
                            <option value="">Select Assessment</option>
                            {assessmentCategories.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                        </select>
                    </div>
                </div>

                {assessClass && assessGroup && assessCategory ? (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-4 space-y-6">
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-5 sticky top-24">
                                {(() => {
                                    const currentCat = assessmentCategories.find(c => c.id === assessCategory);
                                    const isC4 = currentCat?.code === 'C4';

                                    if (isC4) {
                                        return (
                                            <>
                                                <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3 flex items-center gap-2">
                                                    <BookOpen className="w-5 h-5 text-amber-500" />
                                                    Logbook Entries
                                                </h3>
                                                {assessLogbooks && assessLogbooks.length > 0 ? (
                                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                        {assessLogbooks.map((log: any, idx: number) => (
                                                            <div key={idx} className="bg-[#1a1811] p-4 rounded-xl border border-slate-800/50 space-y-3">
                                                                <div className="flex justify-between items-start border-b border-slate-800/50 pb-2">
                                                                    <span className="text-xs font-bold text-amber-500">{new Date(log.entry_date).toLocaleDateString()}</span>
                                                                    <span className="text-[10px] text-slate-500 uppercase">{allStudents.find(s => s.email === log.student_email)?.full_name || log.student_email?.split('@')[0]}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Task/Focus</span>
                                                                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.task}</p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Result</span>
                                                                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{log.result}</p>
                                                                </div>
                                                                {log.feedback && (
                                                                    <div>
                                                                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Feedback</span>
                                                                        <p className="text-xs text-slate-400 whitespace-pre-wrap italic">{log.feedback}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8">
                                                        <BookOpen className="w-8 h-8 text-slate-500 mx-auto mb-3 opacity-50" />
                                                        <p className="text-sm text-slate-400">No logbooks found for this group.</p>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    }

                                    return (
                                        <>
                                            <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">Project Info</h3>
                                            {assessProject ? (
                                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                    <div>
                                                        <span className="text-xs uppercase text-slate-500 font-bold tracking-wider mb-2 block">Project Title</span>
                                                        <h4 className="text-xl font-bold text-white mb-4">{assessProject.title}</h4>

                                                        {/* AI Plagiarism Score Info */}
                                                        {assessProject.ai_plagiarism_score !== null && assessProject.ai_plagiarism_score !== undefined && (
                                                            <div className="bg-[#1c1b14] border border-slate-800 p-4 rounded-xl flex flex-col gap-2 mb-6 shadow-sm">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs uppercase text-slate-500 font-bold block">AI Plagiarism Check</span>
                                                                    <span className="text-[10px] text-slate-500 font-mono">
                                                                        {assessProject.ai_plagiarism_checked_at ? new Date(assessProject.ai_plagiarism_checked_at).toLocaleDateString() : 'Unknown Date'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm font-semibold">
                                                                    Estimated <span className={assessProject.ai_plagiarism_score > 50 ? 'text-red-400' : 'text-emerald-400'}>{assessProject.ai_plagiarism_score}%</span> AI Generated
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {assessProject.abstract && (() => {
                                                        const absData = parseAbstract(assessProject.abstract);
                                                        return (
                                                            <div className="space-y-4">
                                                                <div>
                                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Problem</span>
                                                                    <p className="text-sm text-slate-300 bg-[#1a1811] p-3 rounded-lg border border-slate-800/50 italic leading-relaxed">
                                                                        &quot;{absData.problem || 'No description.'}&quot;
                                                                    </p>
                                                                </div>
                                                                <div>
                                                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Solution</span>
                                                                    <p className="text-sm text-slate-300 bg-[#1a1811] p-3 rounded-lg border border-slate-800/50 italic leading-relaxed">
                                                                        &quot;{absData.solution || 'No description.'}&quot;
                                                                    </p>
                                                                </div>
                                                                {absData.keyConcepts && absData.keyConcepts.length > 0 && (
                                                                    <div>
                                                                        <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Subject Key Concepts</span>
                                                                        <div className="grid grid-cols-1 gap-3">
                                                                            {absData.keyConcepts.map((item: any, idx: number) => {
                                                                                return (
                                                                                    <div key={idx} className="bg-[#1a1811] border border-slate-800/50 p-3 rounded-lg flex flex-col gap-1.5">
                                                                                        <span className="inline-block self-start bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">{item.subject}</span>
                                                                                        <span className="text-sm text-slate-300 leading-snug">{item.concept || 'No concept provided'}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })()}

                                                    <div className="mt-4 space-y-3">
                                                        {assessProject.google_doc_url && (
                                                            <a href={assessProject.google_doc_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-blue-500/10 text-blue-400 border border-blue-500/20 py-2.5 px-4 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-semibold">
                                                                <LinkIcon className="w-4 h-4" /> Open Google Doc
                                                            </a>
                                                        )}

                                                        {assessProject.presentation_url && (
                                                            <a href={assessProject.presentation_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-purple-500/10 text-purple-400 border border-purple-500/20 py-2.5 px-4 rounded-lg hover:bg-purple-500/20 transition-colors text-sm font-semibold">
                                                                <Star className="w-4 h-4" /> View Canva Presentation
                                                            </a>
                                                        )}

                                                        {assessProject.additional_documents && assessProject.additional_documents.map((doc: any, i: number) => (
                                                            <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full bg-amber-500/10 text-amber-500 border border-amber-500/20 py-2.5 px-4 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-semibold">
                                                                <LinkIcon className="w-4 h-4" /> View {doc.type}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8">
                                                    <AlertTriangle className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                                                    <p className="text-sm text-slate-400">No project submitted by this group yet.</p>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="xl:col-span-6 space-y-6">
                            {(() => {
                                const cat = assessmentCategories.find(c => c.id === assessCategory);
                                const dims = rubricDimensions.filter(d => d.category_id === assessCategory);

                                const checkCategoryUnlocked = () => {
                                    if (!cat || !assessProject) return true;
                                    if (cat.code === 'C1') return true;

                                    const c1Cat = assessmentCategories.find(c => c.code === 'C1');
                                    if (!c1Cat || !groupCompletedCategories.has(c1Cat.id) || assessProject?.status !== 'approved') return false;

                                    const codes = ['C1', 'C2', 'C3', 'C4', 'C5'];
                                    const targetIndex = codes.indexOf(cat.code);
                                    if (targetIndex > 1) {
                                        for (let i = 1; i < targetIndex; i++) {
                                            const prevCat = assessmentCategories.find(c => c.code === codes[i]);
                                            if (prevCat && !groupCompletedCategories.has(prevCat.id)) return false;
                                        }
                                    }
                                    return true;
                                };

                                const isPrerequisitesMet = checkCategoryUnlocked();

                                if (!isPrerequisitesMet) {
                                    return (
                                        <div className="bg-[#1c1b14] border border-red-500/20 rounded-xl p-10 text-center text-red-400 shadow-xl">
                                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Lock className="w-8 h-8 text-red-500 opacity-90" />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-200 mb-2">Assessment Blocked</h3>
                                            <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                                                You must complete the previous assessments in order. For C1, ensure the project is fully scored and its status is set to <strong>Approved</strong> before proceeding to {cat?.code}.
                                            </p>
                                        </div>
                                    );
                                }

                                if (dims.length === 0) {
                                    return (
                                        <div className="bg-amber-900/10 border border-amber-500/20 rounded-xl p-8 text-center text-amber-400">
                                            <FileText className="w-8 h-8 mx-auto mb-3 opacity-80" />
                                            <p>No rubric dimensions defined for this assessment.</p>
                                        </div>
                                    );
                                }

                                const isChecklist = cat?.rubric_type === 'checklist';
                                const maxScale = parseInt(cat?.rubric_type.replace('scale_', '') || '1');

                                return (
                                    <div className="space-y-6">
                                        {isAssessmentLocked && (
                                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <Lock className="w-5 h-5 text-amber-500 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-400">Assessment Locked</p>
                                                        <p className="text-xs text-amber-500/70">This group has already been assessed. Unlock to modify scores.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => setShowUnlockConfirm(true)}
                                                        className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0"
                                                    >
                                                        <Unlock className="w-4 h-4" />
                                                        Unlock
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {showUnlockConfirm && (
                                            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowUnlockConfirm(false)}>
                                                <div className="bg-[#1c1b14] border border-amber-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                                                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-white">Unlock Assessment?</h3>
                                                    </div>
                                                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                                                        This group has already been assessed. Are you sure you want to unlock and modify the scores? The existing scores will remain until you save new ones.
                                                    </p>
                                                    <div className="flex justify-end gap-3">
                                                        <button
                                                            onClick={() => setShowUnlockConfirm(false)}
                                                            className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => { setIsAssessmentLocked(false); setShowUnlockConfirm(false); }}
                                                            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-[#1a1811] px-5 py-2 rounded-lg text-sm font-bold transition-all"
                                                        >
                                                            <Unlock className="w-4 h-4" />
                                                            Yes, Unlock
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {dims.map(dim => {
                                            const inds = rubricIndicators.filter(i => i.dimension_id === dim.id);
                                            return (
                                                <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl shadow-lg">
                                                    <div className="bg-[#1a1811] border-b border-slate-800 rounded-t-xl px-5 py-3">
                                                        <h3 className="font-bold text-slate-200">{dim.name}</h3>
                                                    </div>
                                                    <div className="divide-y divide-slate-800/50">
                                                        {inds.map(ind => (
                                                            <div key={ind.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1a1811]/50 transition-colors last:rounded-b-xl">
                                                                <p className="text-sm text-slate-400 flex-1">{ind.description}</p>
                                                                <div className="shrink-0 flex items-center justify-end">
                                                                    {isChecklist ? (
                                                                        <button
                                                                            onClick={() => !isAssessmentLocked && setCurrentScores(prev => ({ ...prev, [ind.id]: prev[ind.id] === 1 ? 0 : 1 }))}
                                                                            className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${currentScores[ind.id] === 1 ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-[#1a1811] border-slate-700 text-slate-600 hover:border-slate-500'}`}
                                                                        >
                                                                            {currentScores[ind.id] === 1 ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                                                        </button>
                                                                    ) : (
                                                                        <div className="flex gap-1.5 p-1.5 bg-[#1a1811] border border-slate-800 rounded-lg">
                                                                            {Array.from({ length: maxScale }).map((_, i) => {
                                                                                const val = i + 1;
                                                                                const isSelected = currentScores[ind.id] === val;
                                                                                const tooltipText = ind.criteria?.[val.toString()] || undefined;

                                                                                return (
                                                                                    <div key={val} className="relative group inline-block">
                                                                                        <button
                                                                                            onClick={() => !isAssessmentLocked && setCurrentScores(prev => ({ ...prev, [ind.id]: val }))}
                                                                                            className={`w-10 h-10 rounded-md flex items-center justify-center font-bold text-sm transition-all relative ${isAssessmentLocked ? 'cursor-not-allowed opacity-60' : ''} ${isSelected ? 'bg-amber-500 text-[#1a1811] shadow-lg shadow-amber-500/20 translate-y-[-2px]' : 'bg-[#1c1b14] text-slate-500 hover:text-amber-400 hover:bg-[#25221b]'}`}
                                                                                            disabled={isAssessmentLocked}
                                                                                        >
                                                                                            {val}
                                                                                            {tooltipText && (
                                                                                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-sky-500/20 border border-sky-500/50 text-sky-400 rounded-full flex items-center justify-center text-[9px] font-black shadow-sm">!</div>
                                                                                            )}
                                                                                        </button>
                                                                                        {tooltipText && (
                                                                                            <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-3 w-64 p-3 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                                                                                <div className="font-bold text-amber-400 mb-1.5 pb-1.5 border-b border-slate-700/50">Score: {val}</div>
                                                                                                <div className="leading-relaxed">{tooltipText}</div>
                                                                                                <div className="absolute top-full right-4 sm:left-1/2 sm:-translate-x-1/2 border-[5px] border-transparent border-t-slate-700"></div>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {(() => {
                                            const selectedCat = assessmentCategories.find(c => c.id === assessCategory);
                                            const isC1Category = selectedCat?.code === 'C1';
                                            const isNoStatusCat = !isC1Category;
                                            return (
                                                <div className="bg-[#1c1b14] border border-amber-900/50 rounded-xl p-6 shadow-lg mt-8">
                                                    <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-3">
                                                        {isNoStatusCat ? 'Feedback & Comments' : 'Final Decision & Feedback'}
                                                    </h3>
                                                    <div className="space-y-5">
                                                        {!isNoStatusCat && (
                                                            <div>
                                                                <label className="block text-sm font-semibold text-slate-300 mb-3">Project Status</label>
                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                    {[
                                                                        { val: 'approved', label: 'Approved', color: 'emerald' },
                                                                        { val: 'revision', label: 'Needs Revision', color: 'amber' },
                                                                        { val: 'disapproved', label: 'Disapproved', color: 'red' }
                                                                    ].map(st => (
                                                                        <button
                                                                            key={st.val}
                                                                            onClick={() => setAssessStatus(st.val)}
                                                                            className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-semibold transition-all ${assessStatus === st.val
                                                                                ? (st.color === 'emerald' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : st.color === 'amber' ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-red-500/20 border-red-500 text-red-400')
                                                                                : 'bg-[#1a1811] border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                                                                                }`}
                                                                        >
                                                                            {assessStatus === st.val && <CheckCircle2 className="w-4 h-4" />}
                                                                            {st.label}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <label className="block text-sm font-semibold text-slate-300 mb-2">Teacher Comment / Feedback</label>
                                                            <textarea
                                                                value={assessComment}
                                                                onChange={e => setAssessComment(e.target.value)}
                                                                rows={12}
                                                                placeholder="Leave constructive feedback for the group..."
                                                                className="w-full bg-[#1a1811] border border-slate-800 rounded-lg py-3 px-4 text-sm text-slate-200 focus:outline-none focus:border-amber-500 resize-none whitespace-pre-wrap"
                                                                disabled={isAssessmentLocked}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {cat?.code === 'C5' && (
                                            <div className="mt-6">
                                                {/* Language toggle — always visible in C5 */}
                                                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Q&amp;A Language</span>
                                                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-1 flex gap-1">
                                                        {(['en', 'id'] as const).map(lang => (
                                                            <button
                                                                key={lang}
                                                                onClick={() => handleC5LanguageSwitch(lang)}
                                                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${c5Language === lang ? 'bg-amber-500 text-[#1a1811]' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-900/20'}`}
                                                            >
                                                                {lang === 'en' ? '🇬🇧 English' : '🇮🇩 Indonesia'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {cat?.code === 'C5' && (c5Questions || isGeneratingC5) && (
                                            <div className="bg-[#1c1b14] border border-amber-500/30 rounded-xl p-6 shadow-lg">
                                                <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
                                                    <FileText className="w-5 h-5 text-amber-500" />
                                                    <h3 className="font-bold text-white">Generated Q&amp;A Context</h3>
                                                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded border ${c5Language === 'id' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                        {c5Language === 'id' ? '🇮🇩 Bahasa Indonesia' : '🇬🇧 English'}
                                                    </span>
                                                </div>
                                                {isGeneratingC5 ? (
                                                    <div className="flex items-center justify-center py-8 text-amber-500/70 space-x-2">
                                                        <div className="w-4 h-4 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin"></div>
                                                        <span className="text-sm font-medium">Analyzing project data & generating questions...</span>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                                        {(() => {
                                                            if (!c5Questions) return null;
                                                            const parts = c5Questions.split(/(?=\n1\.\s)/);
                                                            const summary = parts[0]?.trim();
                                                            const questions = parts.length > 1 ? parts.slice(1).join('').trim() : '';
                                                            const questionsList = questions ? questions.split(/\n(?=\d+\.\s)/).map(q => q.trim()).filter(Boolean) : [];

                                                            return (
                                                                <>
                                                                    {summary && (
                                                                        <div className="bg-[#1a1811] border border-slate-800/50 p-4 rounded-xl">
                                                                            <p className="text-sm text-slate-300 leading-relaxed italic">{summary}</p>
                                                                        </div>
                                                                    )}

                                                                    {questionsList.length > 0 ? (
                                                                        <div className="grid grid-cols-1 gap-3">
                                                                            {questionsList.map((q, idx) => {
                                                                                const match = q.match(/^(\d+)\.\s*([\s\S]*)/);
                                                                                const num = match ? match[1] : (idx + 1).toString();
                                                                                const text = match ? match[2] : q;
                                                                                let category = '';
                                                                                let cleanText = text;
                                                                                const catMatch = text.match(/^\*\*(.*?)\*\*\s*([\s\S]*)/);
                                                                                if (catMatch) {
                                                                                    category = catMatch[1].replace(':', '').trim();
                                                                                    cleanText = catMatch[2].trim();
                                                                                }

                                                                                return (
                                                                                    <div key={idx} className="bg-gradient-to-br from-[#1c1b14] to-[#1a1811] border border-amber-500/20 hover:border-amber-500/40 p-4 rounded-xl shadow-sm transition-colors group relative overflow-hidden">
                                                                                        <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 group-hover:bg-amber-500 transition-colors"></div>
                                                                                        <div className="flex items-start gap-4">
                                                                                            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
                                                                                                {num}
                                                                                            </div>
                                                                                            <div className="flex-1 pt-1">
                                                                                                {category && (
                                                                                                    <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-500/80 mb-1.5">
                                                                                                        {category}
                                                                                                    </span>
                                                                                                )}
                                                                                                <p className="text-sm text-slate-200 leading-relaxed font-medium">
                                                                                                    {cleanText.replace(/\*\*/g, '')}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                                            {c5Questions}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-3 pt-4">
                                            {cat?.code === 'C5' ? (
                                                <div className="flex flex-col items-end gap-1.5">
                                                    {cat?.code === 'C5' && !c5Questions && !isGeneratingC5 && (
                                                        <p className="text-xs text-slate-500 italic">
                                                            No {c5Language === 'id' ? 'Indonesian' : 'English'} questions generated yet.
                                                        </p>
                                                    )}
                                                    <button
                                                        onClick={handleGenerateC5Questions}
                                                        disabled={isGeneratingC5 || isSubmittingScore || isAssessmentLocked}
                                                        className="flex items-center gap-2 bg-[#1c1b14] border border-amber-500/30 text-amber-400 px-6 py-3.5 rounded-xl font-bold hover:bg-amber-900/20 hover:text-amber-300 transition-all shadow-xl shadow-amber-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isGeneratingC5
                                                            ? 'Generating...'
                                                            : c5Questions
                                                                ? `Regenerate in ${c5Language === 'id' ? 'Indonesia' : 'English'}`
                                                                : `Generate in ${c5Language === 'id' ? 'Indonesia' : 'English'}`
                                                        }
                                                        {!isGeneratingC5 && <Sparkles className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleAutoAssess}
                                                    disabled={isAutoAssessing || isSubmittingScore || isAssessmentLocked}
                                                    className="flex items-center gap-2 bg-[#1c1b2e] border border-indigo-500/30 text-indigo-400 px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-900/40 hover:text-indigo-300 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isAutoAssessing ? 'AI is Thinking...' : 'Auto-Assess with Gemini'}
                                                    {!isAutoAssessing && <Sparkles className="w-5 h-5" />}
                                                </button>
                                            )}

                                            <button
                                                onClick={submitAssessment}
                                                disabled={isSubmittingScore || isAutoAssessing || isGeneratingC5 || isAssessmentLocked}
                                                className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-[#1a1811] px-8 py-3.5 rounded-xl font-bold hover:from-amber-500 hover:to-amber-400 transition-all shadow-xl shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isSubmittingScore ? 'Saving Assessment...' : 'Save Assessment'}
                                                {!isSubmittingScore && <CheckCircle2 className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="xl:col-span-2 space-y-6">
                            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 sticky top-24">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation</h4>
                                <p className="text-sm font-bold text-white mb-4">Class {assessClass}</p>
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {availableAssessGroups.map(g => {
                                        const isAssessed = assessedGroupsMap[g] === true;
                                        return (
                                            <button
                                                key={g}
                                                onClick={() => setAssessGroup(g.toString())}
                                                className={`w-full text-left px-4 py-2.5 rounded-lg border transition-all text-sm font-semibold flex items-center justify-between group ${assessGroup === g.toString()
                                                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-900/10'
                                                    : 'bg-[#1a1811] border-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200 hover:bg-[#25221b]'
                                                    }`}
                                            >
                                                <span>Group {g}</span>
                                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold border transition-colors ${isAssessed
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover:bg-emerald-500/20'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 group-hover:bg-slate-700 group-hover:text-slate-300'
                                                    }`}>
                                                    {isAssessed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                                                    <span>{isAssessed ? 'Assessed' : 'Pending'}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 bg-[#1a1811]/50 border border-slate-800/50 rounded-2xl">
                        <ClipboardCheck className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-300 mb-2">Select a Target</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">Please choose Grade, Class, and Assessment to begin grading. Use the Quick Navigation sidebar to switch between groups.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
