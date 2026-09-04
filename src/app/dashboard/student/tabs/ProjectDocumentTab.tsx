'use client';

import React, { useState } from 'react';
import {
    Monitor, PenSquare, Plus, Trash2,
    Link as LinkIcon, Save, Lock,
    ChevronDown, CheckCircle2, ExternalLink,
    FilePlus2, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { safeExternalUrl } from '@/lib/url';
import type { ProjectData, StudentInfo, TeamMember, ToastType } from '@/lib/types';

interface ProjectDocumentTabProps {
    projectData: ProjectData | null;
    showToast: (message: string, type: ToastType) => void;
    studentInfo: StudentInfo;
    teamMembers: TeamMember[];
    onProjectDataUpdate: (updated: ProjectData) => void;
}

export default function ProjectDocumentTab({
    projectData,
    showToast,
    studentInfo,
    teamMembers,
    onProjectDataUpdate,
}: ProjectDocumentTabProps) {
    // Local state
    const [documents, setDocuments] = useState<{ type: string, url: string }[]>(
        projectData?.additional_documents || []
    );
    const [newDocType, setNewDocType] = useState('Website');
    const [newDocUrl, setNewDocUrl] = useState('');
    const [isSavingDoc, setIsSavingDoc] = useState(false);
    const [isSavingGoogleDoc, setIsSavingGoogleDoc] = useState(false);
    const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
    const [isEditingMainDoc, setIsEditingMainDoc] = useState(false);
    const [confirmDeleteDocIdx, setConfirmDeleteDocIdx] = useState<number | null>(null);
    const [docUrl, setDocUrl] = useState(projectData?.google_doc_url || '');

    // ─── Save Google Doc ───────────────────────────────
    const handleSaveGoogleDoc = async () => {
        if (!docUrl.trim()) {
            showToast('Please provide a Google Docs URL.', 'warning');
            return;
        }

        if (!docUrl.includes('docs.google.com')) {
            showToast('Please provide a valid Google Docs URL.', 'error');
            return;
        }

        setIsSavingGoogleDoc(true);
        try {
            const docCheck = await fetch('/api/check-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: docUrl })
            });
            const checkResult = await docCheck.json();

            if (!checkResult.isPublic) {
                showToast(checkResult.error || 'The Google Doc is not publicly accessible. Please set sharing to "Anyone with the link".', 'error');
                setIsSavingGoogleDoc(false);
                return;
            }

            const { error } = await supabase
                .from('projects')
                .update({ google_doc_url: docUrl })
                .eq('id', projectData!.id);

            if (error) throw error;
            
            // update local state
            const updatedProject = { ...projectData!, google_doc_url: docUrl };
            onProjectDataUpdate(updatedProject);
            setIsEditingMainDoc(false);
            showToast('Google Doc link saved successfully!', 'success');
        } catch (err: any) {
            console.error(err);
            showToast(err.message || 'Failed to verify Google Doc access.', 'error');
        } finally {
            setIsSavingGoogleDoc(false);
        }
    };

    // ─── Generate Google Doc from Template ─────────────
    const handleGenerateDoc = async () => {
        if (!studentInfo || !projectData) return;

        setIsGeneratingDoc(true);
        try {
            const res = await fetch('/api/generate-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    className: studentInfo.class_name,
                    groupNumber: studentInfo.group_number,
                    projectTitle: projectData.title,
                    teamMembers: teamMembers,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                // Show detailed error from the improved API response
                const stepInfo = data.failedStep ? ` [Step: ${data.failedStep}]` : '';
                const reasonInfo = data.errorReason ? ` (Reason: ${data.errorReason})` : '';
                throw new Error(`${data.error || 'Failed to generate document'}${stepInfo}${reasonInfo}`);
            }

            // Save the generated doc URL to the project in Supabase
            const generatedUrl = data.docUrl;
            const { error } = await supabase
                .from('projects')
                .update({ google_doc_url: generatedUrl })
                .eq('id', projectData.id);

            if (error) throw error;

            // Update local state
            setDocUrl(generatedUrl);
            const updatedProject = { ...projectData, google_doc_url: generatedUrl };
            onProjectDataUpdate(updatedProject);
            setIsEditingMainDoc(false);
            showToast(`Document "${data.docName}" generated and linked successfully!`, 'success');
        } catch (err: any) {
            console.error('Generate doc error:', err);
            showToast(err.message || 'Failed to generate document. Please try again.', 'error');
        } finally {
            setIsGeneratingDoc(false);
        }
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                <Monitor className="text-amber-500" />
                Project Documents
            </h2>
            <p className="text-slate-400 text-sm mb-8">Submit any relevant project links here (e.g., Website, Canva Presentation, GitHub, Demo Video). They will be visible to your teacher during assessment.</p>

            {!projectData ? (
                <div className="bg-[#1c1b14] border border-dashed border-slate-700 rounded-xl p-10 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4">
                        <PenSquare className="w-7 h-7 text-amber-500" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-300 mb-2">No Project Submitted Yet</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                        You need to submit a project first before adding project documents.
                    </p>
                </div>
            ) : projectData.status !== 'approved' ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex items-start gap-4">
                    <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                        <Lock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-amber-400 mb-1">Documents Locked</h3>
                        <p className="text-sm text-amber-200/80">
                            You can only add external document links after your project has been <strong>approved</strong> by a teacher (C1 approval).
                            Your current project status is: <span className={`font-bold ${projectData.status === 'revision' ? 'text-red-400' : 'text-amber-400'}`}>{projectData.status}</span>
                        </p>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Compulsory Main Project Document */}
                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 py-1 px-3 bg-amber-500/20 text-amber-500 text-[10px] font-bold tracking-wider uppercase rounded-bl-lg border-b border-l border-amber-500/20">
                            Compulsory
                        </div>
                        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                            <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Main Project Document (Google Doc)
                        </h3>
                        
                        {projectData?.google_doc_url && !isEditingMainDoc ? (
                            <div className="mt-2 mb-2 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                    <div className="bg-emerald-500/20 p-2.5 rounded-xl text-emerald-400 shrink-0">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-emerald-400 mb-0.5">Google Doc Linked Successfully</p>
                                        <a href={safeExternalUrl(projectData.google_doc_url) ?? undefined} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Open Google Doc
                                        </a>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setDocUrl(projectData.google_doc_url || '');
                                        setIsEditingMainDoc(true);
                                    }}
                                    className="shrink-0 text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors w-full sm:w-auto"
                                >
                                    Edit Link
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Auto-Generate Button */}
                                {!projectData?.google_doc_url && (
                                    <div className="mb-5 p-5 bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-cyan-500/10 border border-teal-500/25 rounded-xl">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="bg-teal-500/15 p-2.5 rounded-xl text-teal-400 shrink-0 border border-teal-500/20">
                                                    <FilePlus2 className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-teal-300 mb-0.5">Auto-Generate from Template</p>
                                                    <p className="text-xs text-teal-400/70">Creates a pre-filled project document with cover page, sections, and your team details.</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleGenerateDoc}
                                                disabled={isGeneratingDoc}
                                                className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-[#0d1a14] font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap shadow-lg shadow-teal-900/30"
                                            >
                                                {isGeneratingDoc ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-[#0d1a14] border-t-transparent rounded-full animate-spin"></div>
                                                        Generating...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4" />
                                                        Generate Document
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Divider between auto-generate and manual input */}
                                {!projectData?.google_doc_url && (
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="flex-1 h-px bg-slate-800"></div>
                                        <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider">or paste link manually</span>
                                        <div className="flex-1 h-px bg-slate-800"></div>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-4 mb-2">
                                    <div className="flex-1 relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                            <LinkIcon className="w-4 h-4" />
                                        </div>
                                        <input
                                            type="url"
                                            value={docUrl}
                                            onChange={(e) => setDocUrl(e.target.value)}
                                            className="w-full bg-[#110e08] border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
                                            placeholder="https://docs.google.com/document/d/..."
                                        />
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={handleSaveGoogleDoc}
                                            disabled={isSavingGoogleDoc || !docUrl.trim()}
                                            className="flex-1 sm:flex-none bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                                        >
                                            {isSavingGoogleDoc ? (
                                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            Save & Check
                                        </button>
                                        {isEditingMainDoc && (
                                            <button
                                                onClick={() => setIsEditingMainDoc(false)}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 text-sm"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-amber-500/80 mb-2">
                                    * Make sure the document sharing setting is set to &quot;Anyone with the link can view&quot;. This is required.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Document List */}
                    {documents.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-semibold text-slate-300 mb-4">Saved Documents</h3>
                            <div className="space-y-3">
                                {documents.map((doc, idx) => (
                                    <div key={idx} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500">
                                                <LinkIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-300">{doc.type}</p>
                                                <a href={safeExternalUrl(doc.url) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-500/80 hover:text-amber-400 block truncate max-w-[200px] sm:max-w-md">
                                                    {doc.url}
                                                </a>
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <button aria-label="Remove this document link"
                                                onClick={() => setConfirmDeleteDocIdx(idx)}
                                                className="text-slate-500 hover:text-red-400 p-2 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            
                                            {confirmDeleteDocIdx === idx && (
                                                <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#292314] border border-amber-500/30 rounded-xl p-3 shadow-2xl z-20 flex flex-col items-center animate-[slideIn_0.2s_ease-out]">
                                                    <p className="text-xs font-semibold text-slate-200 mb-3 text-center">Remove this link?</p>
                                                    <div className="flex gap-2 w-full">
                                                        <button 
                                                            onClick={() => setConfirmDeleteDocIdx(null)} 
                                                            className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                const newDocs = documents.filter((_, i) => i !== idx);
                                                                setIsSavingDoc(true);
                                                                const { error } = await supabase
                                                                    .from('projects')
                                                                    .update({ additional_documents: newDocs })
                                                                    .eq('id', projectData.id);
                                                                setIsSavingDoc(false);
                                                                setConfirmDeleteDocIdx(null);
                                                                if (error) {
                                                                    showToast('Failed to remove document', 'error');
                                                                } else {
                                                                    setDocuments(newDocs);
                                                                    showToast('Document removed', 'success');
                                                                }
                                                            }} 
                                                            className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20 transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                    <div className="absolute top-full right-4 -mt-[1px] w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-amber-500/30"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Optional Other Documents */}
                    <div className="pt-6 border-t border-slate-800/50">
                        <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-slate-400" />
                            Add Other Optional Documents
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                                <label htmlFor="project-document-tab-type" className="block text-xs font-semibold text-slate-400 mb-2">Type</label>
                                <div className="relative">
                                    <select
                                        id="project-document-tab-type"
                                        value={newDocType}
                                        onChange={(e) => setNewDocType(e.target.value)}
                                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all appearance-none text-sm"
                                    >
                                        <option value="Website">Website</option>
                                        <option value="Canva Presentation">Canva Presentation</option>
                                        <option value="Figma Prototype">Figma Prototype</option>
                                        <option value="GitHub Repo">GitHub Repo</option>
                                        <option value="Video Demo">Video Demo</option>
                                        <option value="Other">Other Link</option>
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label htmlFor="project-document-tab-document-url" className="block text-xs font-semibold text-slate-400 mb-2">Document URL</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                                        <LinkIcon className="w-4 h-4" />
                                    </div>
                                    <input
                                        id="project-document-tab-document-url"
                                        type="url"
                                        value={newDocUrl}
                                        onChange={(e) => setNewDocUrl(e.target.value)}
                                        className="w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono text-sm"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Add Button */}
                        <button
                            onClick={async () => {
                                if (!newDocUrl.trim() || !newDocUrl.startsWith('http')) {
                                    showToast('Please enter a valid URL starting with http:// or https://', 'warning');
                                    return;
                                }
                                setIsSavingDoc(true);
                                const updatedDocs = [...documents, { type: newDocType, url: newDocUrl.trim() }];
                                const { error } = await supabase
                                    .from('projects')
                                    .update({ additional_documents: updatedDocs })
                                    .eq('id', projectData.id);
                                setIsSavingDoc(false);
                                if (error) {
                                    showToast('Failed to add document: ' + error.message, 'error');
                                } else {
                                    setDocuments(updatedDocs);
                                    setNewDocUrl('');
                                    showToast('Document added successfully!', 'success');
                                }
                            }}
                            disabled={isSavingDoc}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {isSavingDoc ? (
                                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            Add Document
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
