// ─────────────────────────────────────────────────────────────
// Grade derivation from a class name.
//
// class_name is free text on the roster: '7.1', '10.3', and whatever an admin
// pastes into the bulk import. The grade is the part before the dot.
//
// Everywhere else that grade is only ever compared against itself — the teacher
// filters build their options out of the same roster text they then filter on,
// so any spelling is internally consistent and looks fine. The themes table is
// the one place a derived grade meets a value stored separately, seeded as a
// bare numeral ('7', '10'). There, a stray space or a leading zero — ' 7.1',
// '07.1' — still reads correctly to a human and still matches no theme row,
// which leaves every group in that grade unable to pick a theme and therefore
// unable to submit a project at all.
//
// Normalizing in one place is what keeps those two sides agreeing.
// ─────────────────────────────────────────────────────────────

/**
 * The grade a class name belongs to, as a bare numeral:
 * '7.1' → '7', ' 07.2 ' → '7', '10' → '10'.
 *
 * A class name with no digits in its leading segment is returned trimmed but
 * otherwise untouched, so a school that names classes some other way keeps
 * whatever grouping it already had rather than collapsing to ''.
 */
export function gradeOf(className: string | null | undefined): string {
    const head = String(className ?? '').trim().split('.')[0].trim();
    const digits = head.replace(/\D/g, '');
    if (!digits) return head;
    return String(Number(digits));
}
