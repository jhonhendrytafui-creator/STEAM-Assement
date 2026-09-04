'use client';

import DOMPurify from 'dompurify';

// ─────────────────────────────────────────────────────────────
// Logbook entries are written with TipTap and stored as raw HTML. TipTap only
// sanitises what someone types into the editor — it does not sanitise what
// reaches the database, and RLS lets a student write any string to their own
// logbook row. Without this, a crafted entry would execute in the browser of
// the next teacher who opens that group's logbook, with that teacher's
// privileges.
//
// Everything the editor's toolbar can produce is allowed; nothing else is.
// ─────────────────────────────────────────────────────────────

const ALLOWED_TAGS = [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
    'ul', 'ol', 'li', 'blockquote',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span',
];

/**
 * Sanitise stored rich text for rendering. Returns a string that is safe to
 * pass to dangerouslySetInnerHTML.
 *
 * Server-side (during SSR) `window` is absent and DOMPurify cannot run, so we
 * strip all tags and return the plain text instead of risking raw HTML.
 */
export function sanitizeRichText(html: string | null | undefined): string {
    if (!html) return '';

    if (typeof window === 'undefined') {
        return html.replace(/<[^>]*>/g, '');
    }

    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        // No attributes at all: the toolbar produces none, and this rules out
        // href/src/style and every on* handler in one go.
        ALLOWED_ATTR: [],
        // Block anything that could smuggle markup back in.
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'img'],
        USE_PROFILES: { html: true },
    });
}
