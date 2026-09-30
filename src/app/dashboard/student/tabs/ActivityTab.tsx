'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { academicYear } from '@/lib/academic-year';
import { fetchAll } from '@/lib/supabase/fetchAll';
import GroupActivityFeed from '@/components/ui/GroupActivityFeed';
import type { ActivityEntry } from '@/lib/activity';
import type { StudentInfo, ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// What the group has been doing, and who did it.
//
// Every member can submit the project, write logbook entries and change the
// document links, so without this there was no way for the group to see who
// had actually done any of it. The rows come from database triggers, so this
// is a read-only view of something nobody can edit -- including the reader.
// ─────────────────────────────────────────────────────────────

interface ActivityTabProps {
    studentInfo: StudentInfo;
    teamMembers: { full_name: string; email: string }[];
    userEmail: string | null;
    showToast: (message: string, type: ToastType) => void;
}

export default function ActivityTab({
    studentInfo, teamMembers, userEmail, showToast,
}: ActivityTabProps) {
    const [entries, setEntries] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // The query is awaited before any setState, so mounting this tab does not
    // cascade renders. handleRefresh adds the spinner for a manual reload.
    const fetchEntries = useCallback(async () => {
        if (!studentInfo) return;

        const { data, error } = await fetchAll<ActivityEntry>((from, to) => supabase
            .from('group_activity_log')
            .select('*')
            .eq('class_name', studentInfo.class_name)
            .eq('group_number', studentInfo.group_number)
            .eq('academic_year', academicYear())
            .order('created_at', { ascending: false })
            .range(from, to));

        if (error) {
            showToast('Could not load the activity log: ' + error.message, 'error');
            setLoading(false);
            return;
        }
        setEntries(data);
        setLoading(false);
    }, [studentInfo, showToast]);

    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    const handleRefresh = async () => {
        setLoading(true);
        await fetchEntries();
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Activity className="text-amber-500" />
                        Group Activity
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Everything your group has done, and who did it. Everyone in{' '}
                        {studentInfo?.class_name} Group {studentInfo?.group_number} sees this, and so
                        does your teacher.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    aria-label="Reload the activity log"
                    className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                >
                    <RefreshCw className={'w-4 h-4' + (loading ? ' animate-spin' : '')} />
                </button>
            </div>

            <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-slate-400">
                    Entries are recorded automatically and cannot be edited or deleted by anyone,
                    including your teacher. Peer assessments show only that one was completed —
                    never who it was about, so they stay confidential.
                </p>
            </div>

            <GroupActivityFeed
                entries={entries}
                members={teamMembers}
                currentUserEmail={userEmail}
                loading={loading}
                emptyMessage="Nothing recorded yet. Your group's actions will appear here from now on."
            />
        </div>
    );
}
