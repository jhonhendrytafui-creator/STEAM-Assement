// ─────────────────────────────────────────────────────────────
// The academic-year rules both sides share: what a valid year looks like, and
// the value to fall back on.
//
// They live here, not in src/lib/academic-year.ts, because that module is
// 'use client'. Imported from a route handler, every export of a 'use client'
// module is replaced by a client reference, and calling one throws "Attempted
// to call isValidAcademicYear() from the server". That is how every AI
// Pre-Check and every batch classification failed with a generic error from
// the day the year became editable: both routes read it through
// academic-year-server.ts, which took these two from the client module.
//
// Keep this file free of 'use client' and of anything browser-only, so server
// code can import it.
// ─────────────────────────────────────────────────────────────

/** Used only when app_settings has no usable value, and on a failed read. */
export const FALLBACK_ACADEMIC_YEAR = '2026/2027';

/** 'YYYY/YYYY' where the second year is the first plus one. */
export function isValidAcademicYear(value: string | null | undefined): boolean {
    const m = /^(\d{4})\/(\d{4})$/.exec(String(value ?? '').trim());
    if (!m) return false;
    return Number(m[2]) === Number(m[1]) + 1;
}
