// ─────────────────────────────────────────────────────────────
// Indonesian mobile numbers, stored ready for a wa.me link.
//
// Stored shape is digits only, country code included, no plus and no leading
// zero: 6285712345678. That is exactly what wa.me wants in its path, so the
// link is a concatenation rather than another round of parsing.
//
// The form shows a fixed, non-editable +62 and takes only the rest, but people
// paste whole numbers into fields like this, so normalize defensively: 0857…,
// 857…, 62857… and +62 857-1234-5678 all have to land on the same value.
// save_teacher_profile() repeats this normalization and the same check in SQL,
// so a direct API call cannot store something wa.me would break on.
// ─────────────────────────────────────────────────────────────

/** The fixed country prefix shown beside the input and never edited by hand. */
export const PHONE_PREFIX = '+62';

/** Indonesian mobile: 62, then a subscriber number that always begins with 8. */
const E164_ID_MOBILE = /^628[0-9]{7,12}$/;

/**
 * Normalize anything a teacher might type into the stored form, or return null
 * when it cannot be one.
 *
 *   '85712345678'        -> '6285712345678'
 *   '085712345678'       -> '6285712345678'
 *   '+62 857-1234-5678'  -> '6285712345678'
 *   '12345'              -> null
 */
export function normalizeIdPhone(input: string | null | undefined): string | null {
    let digits = String(input ?? '').replace(/\D/g, '');
    if (!digits) return null;

    // Drop a country code the reader included themselves, so the leading-zero
    // strip below cannot mistake part of it for a trunk prefix.
    if (digits.startsWith('62')) digits = digits.slice(2);

    // 0857… is how the number is written locally; the 0 is a trunk prefix that
    // does not belong in an international number.
    digits = digits.replace(/^0+/, '');

    const e164 = `62${digits}`;
    return E164_ID_MOBILE.test(e164) ? e164 : null;
}

/** True when a stored value is a usable Indonesian mobile number. */
export function isValidIdPhone(stored: string | null | undefined): boolean {
    return E164_ID_MOBILE.test(String(stored ?? ''));
}

/**
 * The WhatsApp link for a stored number, or null when there is nothing to link.
 * Used as the href of the WhatsApp button beside a teacher's name.
 */
export function waMeLink(stored: string | null | undefined): string | null {
    return isValidIdPhone(stored) ? `https://wa.me/${stored}` : null;
}

/**
 * A stored number written out for reading: '6285712345678' -> '+62 857 1234 5678'.
 * Falls back to a plus and the digits when the grouping does not apply.
 */
export function formatIdPhone(stored: string | null | undefined): string {
    const s = String(stored ?? '');
    if (!isValidIdPhone(s)) return s ? `+${s}` : '';
    const local = s.slice(2);
    const parts = [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean);
    return `${PHONE_PREFIX} ${parts.join(' ')}`;
}

/**
 * The part of a stored number that belongs in the input box, i.e. everything
 * after the fixed +62. Used to pre-fill the form from a saved value.
 */
export function localPartOf(stored: string | null | undefined): string {
    const s = String(stored ?? '');
    return s.startsWith('62') ? s.slice(2) : s;
}
