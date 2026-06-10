'use client';

import React, { useState } from 'react';
import {
    BookOpen, PenSquare, Plus, Trash2,
    Calendar, Save, X, AlertTriangle, Camera, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ProjectData, StudentInfo, TeamMember, LogbookEntry, ToastType } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RichTextEditor from '@/components/ui/RichTextEditor';
import imageCompression from 'browser-image-compression';

interface LogbookTabProps {
    projectData: ProjectData | null;
    studentInfo: StudentInfo;
    userEmail: string | null;
    logbooks: LogbookEntry[];
    teamMembers: TeamMember[];
    showToast: (message: string, type: ToastType) => void;
    onLogbooksUpdate: (logbooks: LogbookEntry[]) => void;
}

export default function LogbookTab({
    projectData,
    studentInfo,
    userEmail,
    logbooks,
    teamMembers,
    showToast,
    onLogbooksUpdate,
}: LogbookTabProps) {
    // Local state
    const [showLogbookForm, setShowLogbookForm] = useState(false);
    
    // Date limits: today and yesterday
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const maxDateStr = today.toISOString().split('T')[0];
    const minDateStr = yesterday.toISOString().split('T')[0];
    const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];

    const [newLogDate, setNewLogDate] = useState(maxDateStr);
    const [newLogTask, setNewLogTask] = useState('');
    const [newLogResult, setNewLogResult] = useState('');
    const [newLogFeedback, setNewLogFeedback] = useState('');
    const [newLogPhoto, setNewLogPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        confirmLabel?: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => { } });

    // ─── Helper: Get member name from email ─────────────
    const getMemberName = (email: string) => {
        const member = teamMembers.find(m => m.email === email);
        return member?.full_name || email;
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const options = {
                maxSizeMB: 0.09, // Keep under 100kb
                maxWidthOrHeight: 1200,
                useWebWorker: true
            };
            const compressedFile = await imageCompression(file, options);
            setNewLogPhoto(compressedFile);
            setPhotoPreview(URL.createObjectURL(compressedFile));
        } catch (error) {
            console.error('Error compressing image:', error);
            showToast('Failed to compress image.', 'error');
        }
    };

    const clearForm = () => {
        setNewLogTask('');
        setNewLogResult('');
        setNewLogFeedback('');
        setNewLogDate(maxDateStr);
        setNewLogPhoto(null);
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        setPhotoPreview(null);
        setShowLogbookForm(false);
    };

    // ─── Logbook Submit ────────────────────────────────
    const handleLogbookSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail || !studentInfo || isSubmittingLog) return;

        setIsSubmittingLog(true);

        try {
            let photoUrl = null;

            if (newLogPhoto) {
                const fileExt = newLogPhoto.name.split('.').pop() || 'jpg';
                const imageCounter = logbooks.filter(l => l.photo_url).length + 1;
                const safeClassName = studentInfo.class_name.replace(/\s+/g, '_');
                const fileName = `${ACADEMIC_YEAR}_${safeClassName}_Group${studentInfo.group_number}_Image${imageCounter}.${fileExt}`;
                const filePath = `${ACADEMIC_YEAR}/${studentInfo.class_name}/${studentInfo.group_number}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('logbook_photos')
                    .upload(filePath, newLogPhoto);
                    
                if (uploadError) throw new Error('Failed to upload photo. Ensure the bucket "logbook_photos" exists and is public.');
                
                const { data: { publicUrl } } = supabase.storage
                    .from('logbook_photos')
                    .getPublicUrl(filePath);
                    
                photoUrl = publicUrl;
            }

            const { data, error } = await supabase.from('logbooks').insert([
                {
                    class_name: studentInfo.class_name,
                    group_number: studentInfo.group_number,
                    academic_year: ACADEMIC_YEAR,
                    student_email: userEmail,
                    entry_date: newLogDate,
                    task: newLogTask,
                    result: newLogResult,
                    feedback: newLogFeedback,
                    photo_url: photoUrl
                }
            ]).select();

            if (error) throw error;

            if (data) {
                onLogbooksUpdate([data[0], ...logbooks]);
                clearForm();
                showToast('Logbook entry saved successfully!', 'success');
            }
        } catch (error: any) {
            console.error("Error submitting logbook:", error);
            showToast(error.message || "Failed to submit logbook entry.", 'error');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    // ─── Logbook Delete ────────────────────────────────
    const handleLogbookDelete = async (logId: string) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Entry',
            message: 'Are you sure you want to delete this logbook entry? This action cannot be undone.',
            onConfirm: async () => {
                setConfirmDialog(prev => ({ ...prev, open: false }));
                const { error } = await supabase
                    .from('logbooks')
                    .delete()
                    .eq('id', logId)
                    .eq('student_email', userEmail!);

                if (error) {
                    console.error('Error deleting logbook:', error);
                    showToast('Failed to delete logbook entry.', 'error');
                } else {
                    onLogbooksUpdate(logbooks.filter(l => l.id !== logId));
                    showToast('Logbook entry deleted.', 'success');
                }
            }
        });
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {/* Local Confirm Dialog */}
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmLabel={confirmDialog.confirmLabel}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <BookOpen className="text-amber-500" />
                    Group Logbook
                </h2>
                {!showLogbookForm && projectData?.status === 'approved' && (
                    <button
                        onClick={() => setShowLogbookForm(true)}
                        className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2 px-4 flex items-center gap-2 rounded-xl transition-colors text-sm shadow-lg shadow-amber-900/20"
                    >
                        <Plus className="w-4 h-4" /> Add Log
                    </button>
                )}
            </div>
            {projectData?.status !== 'approved' && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200">
                        <p className="font-semibold mb-1">Logbook Locked</p>
                        <p className="opacity-80">You can only create logbook entries once your project iteration has been officially approved by a teacher.</p>
                    </div>
                </div>
            )}

            {/* Add Log Form */}
            {showLogbookForm && (
                <form onSubmit={handleLogbookSubmit} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 mb-8 text-slate-300 space-y-6">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-2">
                        <h3 className="text-lg font-semibold text-amber-500 flex items-center gap-2">
                            <PenSquare className="w-5 h-5" /> New Log Entry
                        </h3>
                        <button
                            type="button"
                            onClick={clearForm}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <select
                                    required
                                    value={newLogDate}
                                    onChange={(e) => setNewLogDate(e.target.value)}
                                    className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 appearance-none"
                                >
                                    <option value={maxDateStr}>Today ({maxDateStr})</option>
                                    <option value={minDateStr}>Yesterday ({minDateStr})</option>
                                    <option value={twoDaysAgoStr}>2-Days Ago ({twoDaysAgoStr})</option>
                                </select>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Select from the past 3 days.</p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Photo (Optional)</label>
                            <div className="flex items-center gap-3">
                                <label className="cursor-pointer bg-[#110e08] hover:bg-slate-800 border border-slate-800 text-slate-300 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium">
                                    <Camera className="w-4 h-4 text-amber-500" />
                                    <span>Take / Upload Photo</span>
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        capture="environment" 
                                        className="hidden" 
                                        onChange={handlePhotoChange}
                                    />
                                </label>
                                {photoPreview && (
                                    <div className="relative">
                                        <img src={photoPreview} alt="Preview" className="h-10 w-10 object-cover rounded-md border border-slate-700" />
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                setNewLogPhoto(null);
                                                setPhotoPreview(null);
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Images are automatically compressed.</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Task</label>
                        <textarea
                            required
                            rows={2}
                            value={newLogTask}
                            onChange={(e) => setNewLogTask(e.target.value)}
                            placeholder="What did you work on today?"
                            className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Result</label>
                            <RichTextEditor
                                value={newLogResult}
                                onChange={setNewLogResult}
                                placeholder="What was the outcome of your task?"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Feedback</label>
                            <RichTextEditor
                                value={newLogFeedback}
                                onChange={setNewLogFeedback}
                                placeholder="Any feedback, reflections, or challenges?"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                        <button
                            type="button"
                            onClick={clearForm}
                            className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingLog || (!newLogTask || !newLogResult)}
                            className="bg-amber-500 hover:bg-amber-400 text-[#1a160d] font-bold py-2 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-900/20"
                        >
                            {isSubmittingLog ? (
                                <div className="w-4 h-4 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Entry
                        </button>
                    </div>
                </form>
            )}

            {/* Logbooks Table */}
            <div className="overflow-x-auto bg-[#1c1b14] rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-amber-900/30 bg-[#1a1811]">
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm whitespace-nowrap">Date</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm whitespace-nowrap">Member</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm w-1/4">Task</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm w-1/4">Result</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm min-w-[150px]">Feedback</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm whitespace-nowrap">Photo</th>
                            <th className="py-4 px-5 font-semibold text-slate-400 text-sm w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {logbooks.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <BookOpen className="w-10 h-10 text-slate-700 mb-3" />
                                        <p>No logbook entries found.</p>
                                        <p className="text-sm mt-1">Click &quot;Add Log&quot; to create your first entry.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            logbooks.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="py-5 px-5 text-sm text-amber-500 font-medium whitespace-nowrap align-top">
                                        {new Date(log.entry_date).toLocaleDateString()}
                                    </td>
                                    <td className="py-5 px-5 text-sm align-top whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            <span className={`font-medium ${log.student_email === userEmail ? 'text-amber-400' : 'text-slate-300'}`}>
                                                {getMemberName(log.student_email)}
                                            </span>
                                            {log.student_email === userEmail && (
                                                <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full w-max font-bold uppercase tracking-wider">You</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-5 px-5 text-sm text-slate-300 align-top">
                                        {log.task}
                                    </td>
                                    <td className="py-5 px-5 text-sm text-slate-300 align-top">
                                        <div 
                                            className="prose prose-sm prose-invert max-w-none text-slate-300"
                                            dangerouslySetInnerHTML={{ __html: log.result }}
                                        />
                                    </td>
                                    <td className="py-5 px-5 text-sm align-top">
                                        {log.feedback && log.feedback !== '<p></p>' ? (
                                            <div 
                                                className="prose prose-sm prose-invert max-w-none text-amber-100/90"
                                                dangerouslySetInnerHTML={{ __html: log.feedback }}
                                            />
                                        ) : (
                                            <span className="text-slate-600 italic">No feedback yet</span>
                                        )}
                                    </td>
                                    <td className="py-5 px-5 text-sm align-top">
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
                                    <td className="py-5 px-2 text-sm align-top">
                                        {log.student_email === userEmail && (
                                            <button
                                                onClick={() => handleLogbookDelete(log.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete this entry"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
