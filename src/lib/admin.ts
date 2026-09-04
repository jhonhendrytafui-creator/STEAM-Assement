'use client';

import { supabase } from '@/lib/supabase/client';
import { ACADEMIC_YEAR } from '@/lib/constants';

// Tables that hold data belonging to a single group for one academic year.
// Used when an admin resets a group so they can start fresh.
export type GroupResetScope =
    | 'projects'
    | 'assessment_scores'
    | 'logbooks'
    | 'peer_assessments'
    | 'precheck_quota';

export interface GroupRef {
    class_name: string;
    group_number: number;
}

export const groupLabel = (group: GroupRef) => `${group.class_name} / Group ${group.group_number}`;

/**
 * Append a row to admin_audit_log. Failures are swallowed on purpose: an audit
 * write must never block or roll back the action the admin just performed, and
 * the table may not exist yet if sql/add_admin_role.sql has not been run.
 */
export async function logAdminAction(
    actorEmail: string | null | undefined,
    action: string,
    target: string,
    details: Record<string, unknown> = {},
): Promise<void> {
    if (!actorEmail) return;
    try {
        await supabase.from('admin_audit_log').insert({
            actor_email: actorEmail,
            action,
            target,
            details,
            academic_year: ACADEMIC_YEAR,
        });
    } catch (e) {
        console.warn('admin_audit_log write failed:', e);
    }
}

/**
 * Delete every trace of a group's work for the current academic year, limited
 * to the scopes requested. Returns the scopes that failed so the caller can
 * report an honest result instead of a blanket "done".
 */
export async function resetGroupData(
    group: GroupRef,
    scopes: GroupResetScope[],
): Promise<{ failed: { scope: GroupResetScope; message: string }[] }> {
    const failed: { scope: GroupResetScope; message: string }[] = [];

    const runDelete = async (scope: GroupResetScope, table: string) => {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('class_name', group.class_name)
            .eq('group_number', group.group_number)
            .eq('academic_year', ACADEMIC_YEAR);
        if (error) failed.push({ scope, message: error.message });
    };

    // Order matters: assessment scores and votes reference projects, so remove
    // the dependants before the projects themselves.
    if (scopes.includes('assessment_scores')) await runDelete('assessment_scores', 'assessment_scores');
    if (scopes.includes('peer_assessments')) await runDelete('peer_assessments', 'peer_assessments');
    if (scopes.includes('logbooks')) await runDelete('logbooks', 'logbooks');
    if (scopes.includes('projects')) await runDelete('projects', 'projects');

    if (scopes.includes('precheck_quota')) {
        const { error } = await supabase
            .from('ai_precheck_usage')
            .update({ usage_count: 0 })
            .eq('class_name', group.class_name)
            .eq('group_number', group.group_number)
            .eq('academic_year', ACADEMIC_YEAR);
        if (error) failed.push({ scope: 'precheck_quota', message: error.message });
    }

    return { failed };
}

/** Grade number from a class name, e.g. "10.2" -> "10". */
export const gradeOf = (className: string) => String(className).split('.')[0];

/** Basic sanity check for the only email domain the login flow accepts. */
export const ALLOWED_EMAIL_DOMAIN = '@sekolah.pahoa.sch.id';

export function isValidSchoolEmail(email: string): boolean {
    const trimmed = email.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.endsWith(ALLOWED_EMAIL_DOMAIN);
}
