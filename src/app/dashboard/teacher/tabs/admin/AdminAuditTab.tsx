'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { AdminAuditEntry, ToastType } from '@/lib/types';

interface AdminAuditTabProps {
    showToast: (message: string, type: ToastType) => void;
}

// Human labels for the action codes written by lib/admin.ts and the admin tabs.
const ACTION_LABELS: Record<string, string> = {
    'student.create': 'Added student',
    'student.update': 'Edited student',
    'student.delete': 'Removed student',
    'student.bulk_import': 'Imported students',
    'student.bulk_move': 'Moved students',
    'teacher.grant_access': 'Granted teacher access',
    'teacher.revoke_access': 'Revoked teacher access',
    'teacher.grant_admin': 'Granted admin rights',
    'teacher.revoke_admin': 'Removed admin rights',
    'project.delete_iteration': 'Deleted a submission',
    'project.reset_group': 'Reset a group',
};

const DESTRUCTIVE = new Set([
    'student.delete', 'teacher.revoke_access', 'teacher.revoke_admin',
    'project.delete_iteration', 'project.reset_group',
]);

export default function AdminAuditTab({ showToast }: AdminAuditTabProps) {
    const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);

    // The query is awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh below adds the spinner for manual reloads.
    const fetchLog = useCallback(async () => {
        const { data, error } = await supabase
            .from('admin_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) {
            // The table only exists after sql/add_admin_role.sql has been run.
            setUnavailable(true);
            showToast('Audit log unavailable: ' + error.message, 'error');
        } else {
            setUnavailable(false);
            setEntries((data ?? []) as AdminAuditEntry[]);
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => {
        fetchLog();
    }, [fetchLog]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchLog();
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <ScrollText className="text-amber-500" />
                        Admin Activity Log
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        The 200 most recent admin actions. This log is append-only — entries cannot be edited or deleted.
                    </p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="text-xs bg-[#292314] text-slate-300 border border-amber-900/30 px-3 py-2 rounded-lg flex items-center gap-1.5 hover:bg-[#3d341e] transition-colors self-start"
                >
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500 text-sm">Loading activity...</div>
            ) : unavailable ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-200">
                        <p className="font-semibold mb-1">Audit log table not found</p>
                        <p className="opacity-80">Run <code>sql/add_admin_role.sql</code> in the Supabase SQL editor to create it.</p>
                    </div>
                </div>
            ) : entries.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No admin actions recorded yet.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                                <th className="py-2 pr-4">When</th>
                                <th className="py-2 pr-4">Who</th>
                                <th className="py-2 pr-4">Action</th>
                                <th className="py-2 pr-4">Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e.id} className="border-b border-slate-800/50 hover:bg-[#1c1b14]">
                                    <td className="py-2.5 pr-4 text-slate-500 text-xs whitespace-nowrap">
                                        {new Date(e.created_at).toLocaleString()}
                                    </td>
                                    <td className="py-2.5 pr-4 text-slate-400">{e.actor_email}</td>
                                    <td className="py-2.5 pr-4">
                                        <span className={DESTRUCTIVE.has(e.action) ? 'text-red-400' : 'text-slate-200'}>
                                            {ACTION_LABELS[e.action] ?? e.action}
                                        </span>
                                    </td>
                                    <td className="py-2.5 pr-4 text-slate-300">{e.target ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
