// ─────────────────────────────────────────────────────────────
// The chapters of a student's project document.
//
// Each STEAM phase assesses its own part of the Google Doc: C2 chapters 1-2,
// C3 chapters 3-4. The AI used to receive the whole document, cut at 15,000
// characters, and was only asked to "focus" on its chapters: it could still
// score from the wrong chapter, and in a long document chapters 3-4 were often
// cut off before C3 ever saw them. This finds the chapters in the plain-text
// export so each phase is sent only its own.
//
// Headings are written in several ways, so all of these count, at the start
// of a line, in any letter case: "BAB 1", "BAB I", "Chapter 2", "Section 3:",
// "Bagian IV", but not a numbered subsection such as "Section 2.1". A table
// of contents lists the same headings, but each of its entries runs only to
// the next one, so for every chapter the longest stretch under its heading is
// the chapter itself.
// ─────────────────────────────────────────────────────────────

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

const HEADING = /^[ \t]*(?:bab|chapter|section|bagian)[ \t]+(\d{1,2}|viii|vii|vi|iv|v|iii|ii|i)(?![\w]|\.\d)/gim;

function chapterNumber(token: string): number | null {
    const n = /^\d+$/.test(token) ? Number(token) : ROMAN[token.toLowerCase()];
    return n && n >= 1 && n <= 12 ? n : null;
}

export interface ChapterExtract {
    /** The text of the chapters asked for that were found, in document order. */
    text: string;
    /** Chapters asked for that were found. */
    found: number[];
    /** Chapters asked for that have no heading in the document. */
    missing: number[];
}

/**
 * The given chapters of a document, or null when the document has no chapter
 * headings at all (then the caller should fall back to the whole document).
 */
export function extractChapters(doc: string, chapters: readonly number[]): ChapterExtract | null {
    const headings: Array<{ chapter: number; start: number }> = [];
    for (const m of doc.matchAll(HEADING)) {
        const chapter = chapterNumber(m[1]);
        if (chapter !== null && m.index !== undefined) headings.push({ chapter, start: m.index });
    }
    if (headings.length === 0) return null;

    // The longest stretch under each heading: a table-of-contents entry runs
    // only to the next entry, the chapter itself runs to the next chapter.
    const best = new Map<number, { start: number; end: number }>();
    headings.forEach((h, i) => {
        const end = i + 1 < headings.length ? headings[i + 1].start : doc.length;
        const current = best.get(h.chapter);
        if (!current || end - h.start > current.end - current.start) best.set(h.chapter, { start: h.start, end });
    });

    const found = chapters.filter(c => best.has(c));
    const text = found
        .map(c => best.get(c)!)
        .sort((a, b) => a.start - b.start)
        .map(s => doc.slice(s.start, s.end).trim())
        .join('\n\n');
    return { text, found, missing: chapters.filter(c => !best.has(c)) };
}
