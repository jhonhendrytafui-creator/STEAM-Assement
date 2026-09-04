import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, Save, CheckCircle2, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// Drafts are kept per assessor + person being assessed, so switching tabs
// mid-form no longer throws away six ratings and two written comments.
const DRAFT_KEY_PREFIX = 'steam:peer-draft';

interface PeerAssessmentTabProps {
    userEmail: string;
    studentInfo: {
        class_name: string;
        group_number: number;
    };
    teamMembers: { full_name: string; email: string }[];
    academicYear: string;
    showToast: (msg: string, type?: 'success'|'error'|'info'|'warning') => void;
}

const SELF_INDICATORS = [
    "I actively participate and support group work.",
    "I share ideas and complete tasks I am responsible for.",
    "I care for others, help friends who struggle, and am willing to share knowledge.",
    "I try to find solutions when there are disagreements, without forcing my will.",
    "I maintain a good attitude, use polite language, and respect friends.",
    "I listen to others' opinions and respond politely."
];

const PEER_INDICATORS = [
    "This member actively supports group work.",
    "This member shares ideas and completes their tasks.",
    "This member cares about and is willing to help others.",
    "This member resolves disagreements well.",
    "This member maintains a good attitude, speaks politely, and respects friends.",
    "This member listens to and respects others' opinions."
];

export default function PeerAssessmentTab({
    userEmail,
    studentInfo,
    teamMembers,
    academicYear,
    showToast
}: PeerAssessmentTabProps) {
    const [assessments, setAssessments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMemberEmail, setSelectedMemberEmail] = useState<string | null>(null);

    // Form state
    const [qScores, setQScores] = useState<number[]>([0, 0, 0, 0, 0, 0]);
    const [commentGood, setCommentGood] = useState('');
    const [commentImprove, setCommentImprove] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    // Suppresses the draft save while handleSelectMember is populating the form
    // from a saved record, so switching members never writes a bogus draft.
    const loadingFormRef = useRef(false);

    const draftKey = selectedMemberEmail
        ? `${DRAFT_KEY_PREFIX}:${academicYear}:${userEmail}:${selectedMemberEmail}`
        : null;

    const fetchAssessments = useCallback(async () => {
        const { data, error } = await supabase
            .from('peer_assessments')
            .select('*')
            .eq('assessor_email', userEmail)
            .eq('academic_year', academicYear);
            
        if (!error && data) {
            setAssessments(data);
        }
        
        // Auto-select first member
        if (teamMembers.length > 0) {
            setSelectedMemberEmail(prev => prev ?? teamMembers[0].email);
        }
        setLoading(false);
    }, [userEmail, academicYear, teamMembers]);

    useEffect(() => {
        fetchAssessments();
    }, [fetchAssessments]);

    const handleSelectMember = (email: string) => {
        loadingFormRef.current = true;
        setSelectedMemberEmail(email);
        setIsEditing(false);

        const existing = assessments.find(a => a.assessed_email === email);
        if (existing) {
            setQScores([
                existing.q1_score, existing.q2_score, existing.q3_score,
                existing.q4_score, existing.q5_score, existing.q6_score
            ]);
            setCommentGood(existing.comment_good);
            setCommentImprove(existing.comment_improve);
            return;
        }

        // Nothing saved yet — bring back whatever they had typed last time.
        const key = `${DRAFT_KEY_PREFIX}:${academicYear}:${userEmail}:${email}`;
        try {
            const raw = window.localStorage.getItem(key);
            if (raw) {
                const d = JSON.parse(raw);
                setQScores(Array.isArray(d.qScores) && d.qScores.length === 6 ? d.qScores : [0, 0, 0, 0, 0, 0]);
                setCommentGood(typeof d.commentGood === 'string' ? d.commentGood : '');
                setCommentImprove(typeof d.commentImprove === 'string' ? d.commentImprove : '');
                return;
            }
        } catch {
            // Unreadable draft — fall through to a blank form
        }

        setQScores([0, 0, 0, 0, 0, 0]);
        setCommentGood('');
        setCommentImprove('');
    };

    // Auto update form when selected member changes or assessments load
    useEffect(() => {
        if (selectedMemberEmail) {
            handleSelectMember(selectedMemberEmail);
        }
    }, [selectedMemberEmail, assessments]);

    // Release the load guard once the populated values have rendered.
    useEffect(() => {
        loadingFormRef.current = false;
    }, [qScores, commentGood, commentImprove]);

    // Persist the in-progress form. Only for members with nothing saved yet —
    // once an assessment exists the saved record is the source of truth.
    useEffect(() => {
        if (!draftKey || loadingFormRef.current) return;
        if (assessments.some(a => a.assessed_email === selectedMemberEmail)) return;

        const isBlank = qScores.every(v => v === 0) && !commentGood.trim() && !commentImprove.trim();
        try {
            if (isBlank) {
                window.localStorage.removeItem(draftKey);
            } else {
                window.localStorage.setItem(draftKey, JSON.stringify({ qScores, commentGood, commentImprove }));
            }
        } catch {
            // Storage unavailable — the form still works, it just won't persist
        }
    }, [draftKey, selectedMemberEmail, assessments, qScores, commentGood, commentImprove]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMemberEmail) return;
        
        if (qScores.includes(0)) {
            showToast('Please answer all 6 questions in the rubric.', 'warning');
            return;
        }
        if (!commentGood.trim() || !commentImprove.trim()) {
            showToast('Please provide both positive and constructive comments.', 'warning');
            return;
        }

        setShowConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setShowConfirm(false);
        setIsSubmitting(true);
        
        // Upsert logic (need an id if updating, but since we have a unique constraint, we can use upset/insert correctly)
        // Check if exists
        const existing = assessments.find(a => a.assessed_email === selectedMemberEmail);
        
        const payload = {
            class_name: studentInfo.class_name,
            group_number: studentInfo.group_number,
            academic_year: academicYear,
            assessor_email: userEmail,
            assessed_email: selectedMemberEmail,
            q1_score: qScores[0],
            q2_score: qScores[1],
            q3_score: qScores[2],
            q4_score: qScores[3],
            q5_score: qScores[4],
            q6_score: qScores[5],
            comment_good: commentGood,
            comment_improve: commentImprove
        };

        let err;
        if (existing) {
            // .select() so we can see how many rows were actually written.
            // An UPDATE that RLS rejects is not an error in PostgREST: it
            // matches nothing and returns 200 with an empty array. Without this
            // check, editing an already-submitted assessment said "saved" and
            // changed nothing. sql/fix_silent_rls_failures.sql adds the missing
            // UPDATE policy; this catches it if that script has not been run.
            const { data, error } = await supabase
                .from('peer_assessments')
                .update(payload)
                .eq('id', existing.id)
                .select('id');
            err = error;
            if (!error && (!data || data.length === 0)) {
                err = {
                    message:
                        'Your change was not saved. Please tell your teacher — the database is missing the permission that lets you edit a submitted assessment.',
                };
            }
        } else {
            // Insert
            const { error } = await supabase
                .from('peer_assessments')
                .insert([payload]);
            err = error;
        }

        setIsSubmitting(false);

        if (err) {
            console.error(err);
            showToast(err.message || 'Failed to save assessment.', 'error');
        } else {
            showToast('Assessment saved successfully.', 'success');
            if (draftKey) {
                try { window.localStorage.removeItem(draftKey); } catch { /* ignore */ }
            }
            setIsEditing(false);
            await fetchAssessments();
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading assessments...</div>;

    const selectedMember = teamMembers.find(m => m.email === selectedMemberEmail);
    const isSelf = selectedMemberEmail === userEmail;
    const indicators = isSelf ? SELF_INDICATORS : PEER_INDICATORS;
    const existingAssess = assessments.find(a => a.assessed_email === selectedMemberEmail);
    // Submitted assessments are read-only until the student chooses to correct
    // them. Marking a teammate is easy to misclick and there was previously no
    // way back.
    const isLocked = Boolean(existingAssess) && !isEditing;

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <ConfirmDialog
                open={showConfirm}
                title="Submit Assessment?"
                message="Submit this assessment? Your teacher will see it straight away. You can still come back and correct it later if you need to."
                confirmLabel="Yes, Submit"
                onConfirm={handleConfirmSubmit}
                onCancel={() => setShowConfirm(false)}
            />
            <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl font-bold text-white">Peer & Self Assessment</h2>
            </div>
            
            <p className="text-sm text-slate-400 mb-8">
                Please evaluate your teamwork performance and that of your team members. 
                Your peer assessments are confidential and cannot be viewed by the recipients.
            </p>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar: Member List */}
                <div className="w-full md:w-1/3 flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Team Members</h3>
                    {teamMembers.map(member => {
                        const isSelected = selectedMemberEmail === member.email;
                        const isCompleted = assessments.some(a => a.assessed_email === member.email);
                        const self = member.email === userEmail;
                        
                        return (
                            <button
                                key={member.email}
                                onClick={() => handleSelectMember(member.email)}
                                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${
                                    isSelected 
                                    ? 'bg-[#292314] text-amber-500 border-amber-500/50 shadow-sm'
                                    : 'bg-[#1c1b14] text-slate-300 border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <div className="truncate">
                                    <div className="font-medium text-sm truncate flex items-center gap-2">
                                        {member.full_name}
                                        {self && <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded-full">You</span>}
                                    </div>
                                    <div className="text-xs opacity-60 truncate">{member.email}</div>
                                </div>
                                {isCompleted && (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-2" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Form Area */}
                <div className="w-full md:w-2/3 bg-[#1c1b14] border border-slate-800 rounded-xl p-5 sm:p-6">
                    {selectedMember ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="mb-4 pb-4 border-b border-slate-800 flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-200">
                                        Assessing: <span className="text-amber-400">{selectedMember.full_name}</span>
                                        {isSelf ? " (Self Assessment)" : " (Peer Assessment)"}
                                    </h3>
                                    {existingAssess && !isEditing && (
                                        <span className="text-xs text-emerald-500 mt-1 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3"/> You have completed this assessment
                                        </span>
                                    )}
                                    {isEditing && (
                                        <span className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                            <Pencil className="w-3 h-3"/> Editing — save to keep your changes
                                        </span>
                                    )}
                                </div>
                                {existingAssess && !isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(true)}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-900/40 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center gap-1.5 shrink-0"
                                    >
                                        <Pencil className="w-3.5 h-3.5" /> Correct my answers
                                    </button>
                                )}
                            </div>

                            <div className="space-y-5">
                                {indicators.map((ind, idx) => (
                                    <div key={idx} className="bg-[#15130e] border border-slate-800 rounded-lg p-4">
                                        <p className="text-sm text-slate-300 mb-3">{idx + 1}. {ind}</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[1, 2, 3, 4].map(score => (
                                                <button
                                                    type="button"
                                                    key={score}
                                                    disabled={isLocked}
                                                    onClick={() => {
                                                        const newQScores = [...qScores];
                                                        newQScores[idx] = score;
                                                        setQScores(newQScores);
                                                    }}
                                                    className={`py-2 text-xs font-medium rounded-lg border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                                                        qScores[idx] === score
                                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                                        : 'bg-[#1c1b14] border-slate-700 text-slate-400 hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    {score === 1 && "1 (Rarely)"}
                                                    {score === 2 && "2 (Sometimes)"}
                                                    {score === 3 && "3 (Often)"}
                                                    {score === 4 && "4 (Always)"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <div>
                                    <label className="block text-sm font-medium text-amber-400 mb-1">
                                        {isSelf ? "Write one thing I have done well:" : "Good things I noticed:"}
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={commentGood}
                                        disabled={isLocked}
                                        onChange={(e) => setCommentGood(e.target.value)}
                                        placeholder="Detailed feedback goes here..."
                                        className="w-full bg-[#110e08] border border-slate-700 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-amber-500 text-sm resize-y"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-red-400 mb-1">
                                        {isSelf ? "Write one thing I need to improve:" : "Suggestions for improvement:"}
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={commentImprove}
                                        disabled={isLocked}
                                        onChange={(e) => setCommentImprove(e.target.value)}
                                        placeholder="Constructive feedback goes here..."
                                        className="w-full bg-[#110e08] border border-slate-700 rounded-lg py-2 px-3 text-slate-200 focus:outline-none focus:border-red-500 text-sm resize-y"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelectMember(selectedMemberEmail!)}
                                        className="mr-3 px-4 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSubmitting || isLocked}
                                    className={`font-bold py-2.5 px-6 rounded-xl transition-all flex items-center gap-2 text-sm disabled:opacity-50 ${isLocked ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-400 text-[#1a160d]'}`}
                                >
                                    {isSubmitting ? (
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isLocked ? 'Assessment Submitted' : isEditing ? 'Save Changes' : 'Save Assessment'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="text-center text-slate-500 p-10">Select a team member to assess.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
