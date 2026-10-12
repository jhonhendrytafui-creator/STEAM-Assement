-- Subject rubrics, part 4 of 4: check that parts 1-3 landed. Read-only, safe
-- to re-run. If you do not see "ALL 4 PARTS COMPLETE", something did not reach
-- the database -- the error names which part to run again.

DO $do_self_check$
DECLARE
    v_missing TEXT[] := '{}';
    v_rubric  RECORD;
    v_count   INT;
    v_weights INT;
    v_total   NUMERIC;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'rubric_indicators' AND column_name = 'weight')
        THEN v_missing := array_append(v_missing, 'part 1: rubric_indicators.weight'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rubric_indicators_weight_range')
        THEN v_missing := array_append(v_missing, 'part 1: weight range check'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'guard_rubric_weight' AND NOT tgisinternal)
        THEN v_missing := array_append(v_missing, 'part 1: guard_rubric_weight trigger'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_rubric_weights' AND pronargs = 2)
        THEN v_missing := array_append(v_missing, 'part 1: set_rubric_weights()'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_subject_rubric')
        THEN v_missing := array_append(v_missing, 'part 2: seed_subject_rubric()'); END IF;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration incomplete. Missing -- %', array_to_string(v_missing, '; ');
    END IF;

    -- Each rubric exists with its five criteria. Weights are all set or all
    -- empty; a part-weighted rubric would quietly score as equal weights.
    FOR v_rubric IN
        SELECT * FROM (VALUES ('ENG-INF', 'part 2'), ('ENG-PRS', 'part 2'),
                              ('IND-INF', 'part 3'), ('IND-PRS', 'part 3')) AS r(code, part)
    LOOP
        SELECT count(i.id), count(i.weight), sum(i.weight)
          INTO v_count, v_weights, v_total
          FROM assessment_categories c
          LEFT JOIN rubric_dimensions d ON d.category_id = c.id
          LEFT JOIN rubric_indicators i ON i.dimension_id = d.id
         WHERE c.code = v_rubric.code;

        IF v_count = 0 THEN
            v_missing := array_append(v_missing,
                format('%s: %s (no criteria)', v_rubric.part, v_rubric.code));
        ELSIF v_weights NOT IN (0, v_count) THEN
            v_missing := array_append(v_missing,
                format('%s has weights on only %s of %s criteria; set them in Admin -> Rubric Weights',
                       v_rubric.code, v_weights, v_count));
        ELSIF v_weights > 0 AND abs(v_total - 100) > 0.01 THEN
            v_missing := array_append(v_missing,
                format('%s weights add up to %s, not 100', v_rubric.code, round(v_total, 2)));
        END IF;
    END LOOP;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Rubrics not ready -- %', array_to_string(v_missing, '; ');
    END IF;

    RAISE NOTICE '== ALL 4 PARTS COMPLETE. SUBJECT RUBRICS AND WEIGHTS READY ==';

    FOR v_rubric IN
        SELECT c.code, c.name, count(i.id) AS criteria,
               CASE WHEN count(i.weight) = count(i.id) AND count(i.id) > 0
                    THEN string_agg(trim_scale(round(i.weight, 2))::text, ' / ' ORDER BY d.sort_order, i.sort_order)
                    ELSE 'equal' END AS weights
          FROM assessment_categories c
          LEFT JOIN rubric_dimensions d ON d.category_id = c.id
          LEFT JOIN rubric_indicators i ON i.dimension_id = d.id
         GROUP BY c.code, c.name, c.sort_order
         ORDER BY c.sort_order
    LOOP
        RAISE NOTICE '%  %  (% criteria, weights: %)',
            rpad(v_rubric.code, 8), v_rubric.name, v_rubric.criteria, v_rubric.weights;
    END LOOP;

    -- The old, empty 'English' / 'Bahasa Indonesia' categories are converted by
    -- parts 2 and 3. One still here had criteria of its own, so it was kept.
    IF EXISTS (SELECT 1 FROM assessment_categories WHERE code IN ('ENG', 'IND')) THEN
        RAISE NOTICE 'Note: the older ENG / IND rubric still exists beside the new ones because it already had criteria. Nothing was changed in it.';
    END IF;
END
$do_self_check$;

-- END OF PART 4
