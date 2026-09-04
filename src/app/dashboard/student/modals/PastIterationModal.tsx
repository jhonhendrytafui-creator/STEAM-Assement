'use client';

import React from 'react';
import { History, X, MessageSquare, BookOpen, Link as LinkIcon } from 'lucide-react';
import { SUBJECTS } from '@/lib/constants';
import type { ProjectData } from '@/lib/types';
import { parseAbstract } from '@/lib/abstract';

interface PastIterationModalProps {
    iteration: ProjectData | null;
    onClose: () => void;
    renderFormattedText: (text: string) => React.ReactNode;
}

export default function PastIterationModal({ iteration, onClose, renderFormattedText }: PastIterationModalProps) {
    if (!iteration) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1c1b14] border border-amber-900/50 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-[slideIn_0.3s_ease-out]">
                <div className="sticky top-0 bg-[#1a1811]/90 backdrop-blur-md border-b border-amber-900/30 p-5 flex justify-between items-center z-10">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <History className="text-amber-500" />
                            Iteration {iteration.iteration || 1}
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">Submitted on {new Date(iteration.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-4">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Project Title</span>
                            <h4 className="text-white font-bold">{iteration.title}</h4>
                        </div>
                        <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-4">
                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Status</span>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mt-1 ${iteration.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                iteration.status === 'revision' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                    iteration.status === 'disapproved' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}>
                                {iteration.status || 'pending'}
                            </span>
                        </div>
                    </div>

                    {iteration.teacher_comment && (
                        <div className="bg-[#1a1811] border border-amber-900/30 rounded-xl p-5">
                            <span className="text-xs text-amber-500 uppercase tracking-wider block mb-2 font-bold flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Teacher Feedback
                            </span>
                            <p className="text-sm text-amber-100/90 whitespace-pre-line bg-amber-500/5 p-4 rounded-lg border border-amber-500/10">
                                {iteration.teacher_comment.split('\n').map((line: string, idx: number) => (
                                    <React.Fragment key={idx}>
                                        {idx > 0 && <br />}
                                        {renderFormattedText(line)}
                                    </React.Fragment>
                                ))}
                            </p>
                        </div>
                    )}

                    {iteration.abstract && (() => {
                        const parsed = parseAbstract(iteration.abstract);
                        if (parsed.isPlainText) {
                            return (
                                <div className="bg-[#1a1811] border border-slate-800 rounded-xl p-5">
                                    <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2">Abstract</span>
                                    <p className="text-sm text-slate-300 whitespace-pre-line">{parsed.raw}</p>
                                </div>
                            );
                        }
                        return (
                                <div className="space-y-4 bg-[#1a1811] border border-slate-800 rounded-xl p-5">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2 cursor-help" title="Describe the problem your project aims to solve.">The Problem</span>
                                        <p className="text-sm text-slate-300 leading-relaxed bg-[#1c1b14] p-4 rounded-lg border border-slate-800">
                                            {parsed.problem || 'No description provided.'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider block mb-2 cursor-help" title="Describe your proposed solution to the problem.">The Solution</span>
                                        <p className="text-sm text-slate-300 leading-relaxed bg-[#1c1b14] p-4 rounded-lg border border-slate-800">
                                            {parsed.solution || 'No description provided.'}
                                        </p>
                                    </div>
                                    {parsed.keyConcepts && parsed.keyConcepts.length > 0 && (
                                        <div className="mt-6 pt-6 border-t border-slate-800">
                                            <span className="text-xs text-slate-500 uppercase tracking-wider block mb-3">Key Concepts mapping</span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {parsed.keyConcepts.map((item: any, idx: number) => {
                                                    const subj = SUBJECTS.find(s => s.id === item.subject);
                                                    const Icon = subj?.icon || BookOpen;
                                                    return (
                                                        <div key={idx} className="bg-[#1c1b14] border border-amber-900/10 rounded-lg p-3 flex gap-3 items-start">
                                                            <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500 shrink-0">
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-400 mb-0.5">{subj?.label || item.subject}</p>
                                                                <p className="text-sm text-slate-200">{item.concept}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        );
                    })()}

                    {iteration.google_doc_url && (
                        <a
                            href={iteration.google_doc_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold py-4 rounded-xl transition-colors border border-blue-500/20"
                        >
                            <LinkIcon className="w-5 h-5" />
                            Open Google Document
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
