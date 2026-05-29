'use client';

import React, { useState } from 'react';
import {
    BookOpen, PenSquare, Plus, Trash2,
    Calendar, Save, X, AlertTriangle
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';
import type { ProjectData, StudentInfo, TeamMember, LogbookEntry, ToastType } from '@/lib/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

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
    const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [newLogTask, setNewLogTask] = useState('');
    const [newLogResult, setNewLogResult] = useState('');
    const [newLogFeedback, setNewLogFeedback] = useState('');
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

    // ─── Logbook Submit ────────────────────────────────
    const handleLogbookSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userEmail || !studentInfo || isSubmittingLog) return;

        setIsSubmittingLog(true);

        const { data, error } = await supabase.from('logbooks').insert([
            {
                class_name: studentInfo.class_name,
                group_number: studentInfo.group_number,
                academic_year: ACADEMIC_YEAR,
                student_email: userEmail,
                entry_date: newLogDate,
                task: newLogTask,
                result: newLogResult,
                feedback: newLogFeedback
            }
        ]).select();

        setIsSubmittingLog(false);

        if (error) {
            console.error("Error inserting logbook:", error);
            showToast("Failed to submit logbook entry. Please try again.", 'error');
        } else if (data) {
            onLogbooksUpdate([data[0], ...logbooks]);
            setNewLogTask('');
            setNewLogResult('');
            setNewLogFeedback('');
            setNewLogDate(new Date().toISOString().split('T')[0]);
            setShowLogbookForm(false);
            showToast('Logbook entry saved successfully!', 'success');
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
                <form onSubmit={handleLogbookSubmit} className="bg-[#1c1b14] border border-slate-800 rounded-xl p-6 mb-8 text-slate-300 space-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-amber-500 flex items-center gap-2">
                            <PenSquare className="w-5 h-5" /> New Log Entry
                        </h3>
                        <button
                            type="button"
                            onClick={() => setShowLogbookForm(false)}
                            className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="date"
                                    required
                                    value={newLogDate}
                                    onChange={(e) => setNewLogDate(e.target.value)}
                                    className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 pl-10 pr-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
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

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Result</label>
                        <textarea
                            required
                            rows={2}
                            value={newLogResult}
                            onChange={(e) => setNewLogResult(e.target.value)}
                            placeholder="What was the outcome of your task?"
                            className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Feedback</label>
                        <textarea
                            rows={2}
                            value={newLogFeedback}
                            onChange={(e) => setNewLogFeedback(e.target.value)}
                            placeholder="Any feedback, reflections, or challenges?"
                            className="w-full bg-[#110e08] border border-slate-800 rounded-lg py-2 px-4 text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setShowLogbookForm(false)}
                            className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmittingLog}
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
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-amber-900/30">
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm whitespace-nowrap">Date</th>
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm whitespace-nowrap">Member</th>
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/4">Task</th>
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-1/4">Result</th>
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm min-w-[130px]">Feedback</th>
                            <th className="py-3 px-4 font-semibold text-slate-400 text-sm w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {logbooks.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-8 text-center text-slate-500">
                                    No logbook entries found. Click &quot;Add Log&quot; to create your first entry.
                                </td>
                            </tr>
                        ) : (
                            logbooks.map((log) => (
                                <tr key={log.id} className="hover:bg-[#1c1b14] transition-colors">
                                    <td className="py-4 px-4 text-sm text-amber-500 font-medium whitespace-nowrap align-top">
                                        {new Date(log.entry_date).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-4 text-sm align-top whitespace-nowrap">
                                        <span className={`font-medium ${log.student_email === userEmail ? 'text-amber-400' : 'text-slate-300'}`}>
                                            {getMemberName(log.student_email)}
                                        </span>
                                        {log.student_email === userEmail && (
                                            <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-500 px-1 py-0.5 rounded-full">You</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-4 text-sm text-slate-300 align-top">
                                        {log.task}
                                    </td>
                                    <td className="py-4 px-4 text-sm text-slate-300 align-top">
                                        {log.result}
                                    </td>
                                    <td className="py-4 px-4 text-sm align-top">
                                        {log.feedback ? (
                                            <span className="text-amber-100">{log.feedback}</span>
                                        ) : (
                                            <span className="text-slate-600 italic">No feedback yet</span>
                                        )}
                                    </td>
                                    <td className="py-4 px-2 text-sm align-top">
                                        {log.student_email === userEmail && (
                                            <button
                                                onClick={() => handleLogbookDelete(log.id)}
                                                className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
