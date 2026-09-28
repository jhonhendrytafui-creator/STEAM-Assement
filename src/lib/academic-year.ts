'use client';

import { supabase } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────
// The academic year, as data.
//
// It used to be a compile-time constant, so rolling the school over meant
// editing src/lib/constants.ts and redeploying. That is also how grades 7-9
// came to have no themes: the year moved in code while the data for the new
// year was never seeded, and nothing in the app could tell anyone.
//
// The value now lives in app_settings, one row, key 'academic_year'. Almost
// every query in the app is scoped by it, so reading the wrong one does not
// error -- it silently returns another year's data, or nothing at all. That
// shapes the design here:
//
//   - loadAcademicYear() is awaited once, before any year-scoped query, at the
//     top of each dashboard's data load. Nothing renders until it resolves.
//   - academicYear() is the synchronous read every call site uses. If it is
//     ever reached before the load resolved it falls back to the constant and
//     logs loudly, rather than returning '' and quietly matching no rows.
//   - A year is only accepted in 'YYYY/YYYY' form with consecutive years, so a
//     typo like '2026/2028' or '26/27' cannot be saved and orphan every row.
// ─────────────────────────────────────────────────────────────

/** Used only when app_settings has no usable value, and on a failed read. */
export const FALLBACK_ACADEMIC_YEAR = '2026/2027';

const SETTING_KEY = 'academic_year';

let cached: string | null = null;
let inflight: Promise<string> | null = null;

/** 'YYYY/YYYY' where the second year is the first plus one. */
export function isValidAcademicYear(value: string | null | undefined): boolean {
    const m = /^(\d{4})\/(\d{4})$/.exec(String(value ?? '').trim());
    if (!m) return false;
    return Number(m[2]) === Number(m[1]) + 1;
}

/** The year after the one given: '2026/2027' -> '2027/2028'. */
export function nextAcademicYear(value: string): string {
    const m = /^(\d{4})\/(\d{4})$/.exec(value.trim());
    if (!m) return value;
    const start = Number(m[1]) + 1;
    return `${start}/${start + 1}`;
}

/**
 * Read the year from app_settings and cache it for the rest of the session.
 *
 * Await this before the first year-scoped query. Concurrent callers share one
 * request. Pass force to re-read after an admin has changed it.
 */
export async function loadAcademicYear(force = false): Promise<string> {
    if (cached && !force) return cached;
    if (inflight && !force) return inflight;

    inflight = (async () => {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', SETTING_KEY)
            .maybeSingle();

        if (error) {
            // Falling back is better than blocking the dashboard, but this must
            // be visible: every query after it is scoped to the fallback year.
            console.error(
                `Could not read the academic year from app_settings; falling back to ${FALLBACK_ACADEMIC_YEAR}.`,
                error,
            );
            cached = FALLBACK_ACADEMIC_YEAR;
            return FALLBACK_ACADEMIC_YEAR;
        }

        const value = data?.value?.trim();
        if (!isValidAcademicYear(value)) {
            if (value) {
                console.error(
                    `app_settings.academic_year is "${value}", which is not a YYYY/YYYY pair of consecutive years; falling back to ${FALLBACK_ACADEMIC_YEAR}.`,
                );
            }
            cached = FALLBACK_ACADEMIC_YEAR;
            return FALLBACK_ACADEMIC_YEAR;
        }

        const resolved: string = value!;
        cached = resolved;
        return resolved;
    })();

    try {
        return await inflight;
    } finally {
        inflight = null;
    }
}

/**
 * The academic year every year-scoped query should use.
 *
 * Synchronous by design: it replaces a constant at 70-odd call sites, several of
 * them in render paths. Correct only once loadAcademicYear() has resolved, which
 * both dashboards guarantee before rendering anything.
 */
export function academicYear(): string {
    if (cached) return cached;
    console.error(
        'academicYear() was read before loadAcademicYear() resolved. '
        + `Using ${FALLBACK_ACADEMIC_YEAR}. Await loadAcademicYear() earlier in this screen's data load.`,
    );
    return FALLBACK_ACADEMIC_YEAR;
}

/** True once the year has actually been read from the database. */
export function isAcademicYearLoaded(): boolean {
    return cached !== null;
}

/**
 * Change the year for everybody. Admin-only, enforced by the
 * "Admins can write app_settings" policy rather than by this function.
 *
 * Returns an error message rather than throwing, matching how the admin screens
 * already report failures.
 */
export async function saveAcademicYear(
    next: string,
    adminEmail: string | null | undefined,
): Promise<{ error: string | null }> {
    const value = next.trim();
    if (!isValidAcademicYear(value)) {
        return { error: 'Enter the year as YYYY/YYYY with consecutive years, for example 2027/2028.' };
    }

    const { error } = await supabase
        .from('app_settings')
        .upsert(
            { key: SETTING_KEY, value, updated_at: new Date().toISOString(), updated_by: adminEmail ?? null },
            { onConflict: 'key' },
        );

    if (error) return { error: error.message };

    cached = value;
    return { error: null };
}

/** Forget the cached value, so the next loadAcademicYear() re-reads it. */
export function clearAcademicYearCache(): void {
    cached = null;
}
