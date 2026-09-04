import type { PostgrestError } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// Paged reads.
//
// PostgREST caps a single response at its `db-max-rows` setting — 1000 in the
// self-hosted docker-compose default. Past that it returns the first 1000 rows
// with no error and no warning, so a teacher screen that fetches a whole
// academic year silently starts reporting on part of the data. Assessment
// scores are groups x rubric indicators, so a school passes 1000 at roughly
// thirty assessed groups.
//
// fetchAll keeps asking for the next window until a page comes back empty. It
// steps by however many rows actually arrived rather than by the page size, so
// it stays correct even when the server's cap is lower than PAGE_SIZE.
// ─────────────────────────────────────────────────────────────

/** Rows requested per round trip. The server may return fewer; that is handled. */
const PAGE_SIZE = 1000;

/** Refuse to spin forever if a query somehow never drains. */
const HARD_CAP = 100_000;

export interface PagedResult<T> {
    data: T[];
    error: PostgrestError | null;
    /** True when HARD_CAP stopped the read before the query was exhausted. */
    truncated: boolean;
}

/**
 * Read every row a query matches, one page at a time.
 *
 * Pass a function that applies `.range(from, to)` to an otherwise complete
 * query — filters, ordering and column selection all belong inside it:
 *
 *     const { data } = await fetchAll<Score>((from, to) =>
 *         supabase.from('assessment_scores')
 *             .select('*')
 *             .eq('academic_year', ACADEMIC_YEAR)
 *             .range(from, to)
 *     );
 *
 * On error the rows read so far are returned alongside it, matching how the
 * callers here already treat a partial result.
 */
export async function fetchAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<PagedResult<T>> {
    const rows: T[] = [];

    for (let from = 0; ;) {
        const { data, error } = await page(from, from + PAGE_SIZE - 1);

        if (error) return { data: rows, error, truncated: false };
        if (!data || data.length === 0) break;

        rows.push(...data);
        from += data.length;

        if (rows.length >= HARD_CAP) {
            console.error(`fetchAll stopped at the ${HARD_CAP}-row safety cap.`);
            return { data: rows, error: null, truncated: true };
        }
    }

    return { data: rows, error: null, truncated: false };
}
