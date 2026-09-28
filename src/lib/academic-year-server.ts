import type { SupabaseClient } from '@supabase/supabase-js';
import { FALLBACK_ACADEMIC_YEAR, isValidAcademicYear } from '@/lib/academic-year';

// ─────────────────────────────────────────────────────────────
// The academic year for API routes.
//
// Separate from the browser version because there is no session-long cache to
// share: each request runs on its own, so each reads the setting. That is one
// extra round trip on routes that already call Gemini, and it means a rollover
// takes effect on the server without a redeploy, which is the whole point.
//
// Only the validation and the fallback are shared with the client module, so the
// two can never disagree about what a valid year looks like.
// ─────────────────────────────────────────────────────────────

/**
 * Read the academic year using the caller's own Supabase client.
 *
 * Pass the service-role client the route already built: app_settings is readable
 * by any authenticated user, but the routes hold an admin client anyway and this
 * avoids depending on the request's RLS context.
 */
export async function getAcademicYearServer(client: SupabaseClient): Promise<string> {
    const { data, error } = await client
        .from('app_settings')
        .select('value')
        .eq('key', 'academic_year')
        .maybeSingle();

    if (error) {
        console.error(
            `[academic-year] Could not read app_settings; falling back to ${FALLBACK_ACADEMIC_YEAR}.`,
            error,
        );
        return FALLBACK_ACADEMIC_YEAR;
    }

    const value = data?.value?.trim();
    if (!isValidAcademicYear(value)) {
        if (value) {
            console.error(
                `[academic-year] app_settings.academic_year is "${value}", not a YYYY/YYYY pair of consecutive years; falling back to ${FALLBACK_ACADEMIC_YEAR}.`,
            );
        }
        return FALLBACK_ACADEMIC_YEAR;
    }

    return value!;
}
