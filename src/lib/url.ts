// ─────────────────────────────────────────────────────────────
// Links that came out of the database.
//
// Students write projects.google_doc_url, projects.presentation_url, every
// url inside projects.additional_documents and logbooks.photo_url. The only
// check on any of them was `startsWith('http')` in the browser, which anyone
// can skip by calling Supabase directly — the RLS policies allow the write.
// Teachers then click those links from the assessment and submissions screens.
//
// sql/fix_silent_rls_failures.sql rejects a bad scheme at write time. This is
// the second half: rows already stored, or written before that script was run,
// still have to render safely.
// ─────────────────────────────────────────────────────────────

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Return the URL only when it is a well-formed http(s) address, otherwise null.
 *
 * Callers pass the result straight to href or src. `null` there renders an
 * element with no destination rather than a live link to something unexpected:
 *
 *     <a href={safeExternalUrl(project.google_doc_url) ?? undefined}>
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
    if (!raw) return null;

    try {
        // Relative values throw here, which is what we want: every one of these
        // columns is meant to hold an absolute link to somewhere else.
        const parsed = new URL(raw.trim());
        return ALLOWED_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
    } catch {
        return null;
    }
}

/** True when the value is a link this app is willing to render. */
export function isSafeExternalUrl(raw: string | null | undefined): boolean {
    return safeExternalUrl(raw) !== null;
}
