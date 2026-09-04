'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, Plus, Trash2, RefreshCw, KeyRound, UserCheck, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { logAdminAction, isValidSchoolEmail, ALLOWED_EMAIL_DOMAIN } from '@/lib/admin';
import type { TeacherEmailRecord, ToastType } from '@/lib/types';

interface AdminAccessTabProps {
    adminEmail: string | null;
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

export default function AdminAccessTab({ adminEmail, showToast, showConfirm }: AdminAccessTabProps) {
    const [teachers, setTeachers] = useState<TeacherEmailRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newEmail, setNewEmail] = useState('');
    const [newIsAdmin, setNewIsAdmin] = useState(false);

    // The query is awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh below adds the spinner for manual reloads.
    const fetchTeachers = useCallback(async () => {
        const { data, error } = await supabase
            .from('teacher_emails')
            .select('*')
            .order('email');

        if (error) {
            showToast('Could not load teacher access list: ' + error.message, 'error');
            setLoading(false);
            return;
        }

        // Mark who has actually signed in at least once.
        const { data: profiles } = await supabase
            .from('profiles')
            .select('email')
            .eq('role', 'teacher');
        const loggedIn = new Set((profiles ?? []).map(p => p.email));

        setTeachers((data ?? []).map(t => ({ ...t, has_logged_in: loggedIn.has(t.email) })) as TeacherEmailRecord[]);
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        fetchTeachers();
    }, [fetchTeachers]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchTeachers();
    };

    const adminCount = teachers.filter(t => t.is_admin).length;

    const handleAdd = async () => {
        const email = newEmail.trim().toLowerCase();
        if (!isValidSchoolEmail(email)) {
            showToast(`Enter a valid ${ALLOWED_EMAIL_DOMAIN} email address.`, 'warning');
            return;
        }
        setSaving(true);
        const { error } = await supabase
            .from('teacher_emails')
            .insert({ email, is_admin: newIsAdmin });
        setSaving(false);

        if (error) {
            showToast(
                error.code === '23505'
                    ? `${email} already has teacher access.`
                    : 'Could not grant access: ' + error.message,
                'error',
            );
            return;
        }
        await logAdminAction(adminEmail, 'teacher.grant_access', email, { is_admin: newIsAdmin });
        showToast(
            `${email} can now sign in as a teacher${newIsAdmin ? ' with admin rights' : ''}.`,
            'success',
        );
        setNewEmail('');
        setNewIsAdmin(false);
        fetchTeachers();
    };

    const handleToggleAdmin = (teacher: TeacherEmailRecord) => {
        const promoting = !teacher.is_admin;

        // Never let the last admin drop their own rights — that would lock
        // everyone out of the admin menu and require another SQL run.
        if (!promoting && adminCount <= 1) {
            showToast('This is the only admin. Promote another teacher first.', 'warning');
            return;
        }
        if (!promoting && teacher.email === adminEmail?.toLowerCase()) {
            showConfirm(
                'Remove your own admin rights?',
                'You will lose the Admin menu immediately and another admin will have to grant it back.',
                () => applyAdminToggle(teacher, promoting),
                'Remove my admin',
            );
            return;
        }
        applyAdminToggle(teacher, promoting);
    };

    const applyAdminToggle = async (teacher: TeacherEmailRecord, promoting: boolean) => {
        const { error } = await supabase
            .from('teacher_emails')
            .update({ is_admin: promoting })
            .eq('id', teacher.id);

        if (error) {
            showToast('Could not change admin rights: ' + error.message, 'error');
            return;
        }

        // The DB trigger keeps profiles in sync, but write it directly too so
        // this still works if the trigger has not been installed yet.
        await supabase.from('profiles').update({ is_admin: promoting }).eq('email', teacher.email);

        await logAdminAction(
            adminEmail,
            promoting ? 'teacher.grant_admin' : 'teacher.revoke_admin',
            teacher.email,
            {},
        );
        showToast(
            promoting
                ? `${teacher.email} is now an admin.`
                : `Admin rights removed from ${teacher.email}.`,
            'success',
        );
        fetchTeachers();
    };

    const handleRevoke = (teacher: TeacherEmailRecord) => {
        if (teacher.is_admin && adminCount <= 1) {
            showToast('This is the only admin. Promote another teacher before revoking this one.', 'warning');
            return;
        }
        showConfirm(
            'Revoke teacher access',
            `Remove ${teacher.email} from the teacher list? They will be treated as a student on their next login. Their existing grading and comments are kept.`,
            async () => {
                const { error } = await supabase.from('teacher_emails').delete().eq('id', teacher.id);
                if (error) {
                    showToast('Could not revoke access: ' + error.message, 'error');
                    return;
                }
                await supabase
                    .from('profiles')
                    .update({ role: 'student', is_admin: false })
                    .eq('email', teacher.email);

                await logAdminAction(adminEmail, 'teacher.revoke_access', teacher.email, {});
                showToast(`Access revoked for ${teacher.email}.`, 'success');
                fetchTeachers();
            },
            'Revoke',
        );
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <ShieldCheck className="text-amber-500" />
                        Teacher Access
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        {teachers.length} teacher account(s), {adminCount} with admin rights.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="text-xs bg-[#292314] text-slate-300 border border-amber-900/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-[#3d341e] transition-colors self-start"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

            {/* Add teacher */}
            <div className="bg-[#1c1b14] border border-amber-500/20 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-1">Give a teacher access</h3>
                <p className="text-xs text-slate-400 mb-3">
                    Add the email before they log in. On their first sign-in they land on the teacher
                    portal instead of the student one. Only {ALLOWED_EMAIL_DOMAIN} addresses can sign in.
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                    <input
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder={`teacher.name${ALLOWED_EMAIL_DOMAIN}`}
                        className="flex-1 min-w-[240px] bg-[#1a1811] border border-slate-800 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={newIsAdmin}
                            onChange={e => setNewIsAdmin(e.target.checked)}
                            className="accent-amber-500"
                        />
                        Also make admin
                    </label>
                    <button
                        onClick={handleAdd}
                        disabled={saving}
                        className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-[#1a160d] hover:bg-amber-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <Plus className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Grant access'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500 text-sm">Loading teacher list...</div>
            ) : teachers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-slate-600" />
                    No teacher emails registered yet.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[620px]">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                <th className="py-2 pr-4">Email</th>
                                <th className="py-2 pr-4">Status</th>
                                <th className="py-2 pr-4">Role</th>
                                <th className="py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.map(t => (
                                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-[#1c1b14]">
                                    <td className="py-3 pr-4 text-slate-200">
                                        {t.email}
                                        {t.email === adminEmail?.toLowerCase() && (
                                            <span className="ml-2 text-xs text-amber-500/70">(you)</span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        {t.has_logged_in ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                                                <UserCheck className="w-3.5 h-3.5" /> Signed in
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-500">Never signed in</span>
                                        )}
                                    </td>
                                    <td className="py-3 pr-4">
                                        {t.is_admin ? (
                                            <span className="inline-flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-1 rounded-full">
                                                <KeyRound className="w-3 h-3" /> Admin
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-slate-800/60 text-slate-400 border border-slate-700 px-2 py-1 rounded-full">
                                                Teacher
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-3 text-right whitespace-nowrap">
                                        <button
                                            onClick={() => handleToggleAdmin(t)}
                                            className="text-xs px-3 py-1.5 rounded-lg border border-amber-900/40 text-slate-300 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                        >
                                            {t.is_admin ? 'Remove admin' : 'Make admin'}
                                        </button>
                                        <button aria-label="Remove this teacher"
                                            onClick={() => handleRevoke(t)}
                                            className="p-2 ml-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors align-middle"
                                            title="Revoke teacher access"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
