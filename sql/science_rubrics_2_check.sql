-- Science rubrics, part 2 of 2: check that part 1 landed. Read-only, safe to
-- re-run. If you do not see "SCIENCE RUBRICS READY", the error says what is
-- missing.

DO $do_science_check$
DECLARE
    v_problems TEXT[] := '{}';
    v_rubric   RECORD;
    v_count    INT;
    v_weights  INT;
    v_total    NUMERIC;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'rubric_indicators' AND column_name = 'weight') THEN
        RAISE EXCEPTION 'Run sql/subject_rubrics_1_weights.sql to sql/subject_rubrics_4_check.sql first.';
    END IF;

    -- Each rubric exists with its ten indikator. Weights are all set or all
    -- empty; a part-weighted rubric would quietly score as equal weights.
    FOR v_rubric IN SELECT * FROM (VALUES ('SCI-WRT'), ('SCI-PRS')) AS r(code) LOOP
        SELECT count(i.id), count(i.weight), sum(i.weight)
          INTO v_count, v_weights, v_total
          FROM assessment_categories c
          LEFT JOIN rubric_dimensions d ON d.category_id = c.id
          LEFT JOIN rubric_indicators i ON i.dimension_id = d.id
         WHERE c.code = v_rubric.code;

        IF v_count = 0 THEN
            v_problems := array_append(v_problems,
                format('%s has no criteria; run sql/science_rubrics_1_seed.sql', v_rubric.code));
        ELSIF v_count <> 10 THEN
            v_problems := array_append(v_problems,
                format('%s has %s criteria, not the 10 in the school''s rubric', v_rubric.code, v_count));
        ELSIF v_weights NOT IN (0, v_count) THEN
            v_problems := array_append(v_problems,
                format('%s has weights on only %s of %s criteria; set them in Admin -> Rubric Weights',
                       v_rubric.code, v_weights, v_count));
        ELSIF v_weights > 0 AND abs(v_total - 100) > 0.01 THEN
            v_problems := array_append(v_problems,
                format('%s weights add up to %s, not 100', v_rubric.code, round(v_total, 2)));
        END IF;
    END LOOP;

    IF COALESCE(array_length(v_problems, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Science rubrics not ready -- %', array_to_string(v_problems, '; ');
    END IF;

    RAISE NOTICE '== SCIENCE RUBRICS READY ==';

    FOR v_rubric IN
        SELECT c.code, c.name, count(i.id) AS criteria,
               CASE WHEN count(i.weight) = count(i.id) AND count(i.id) > 0
                    THEN string_agg(trim_scale(round(i.weight, 2))::text, ' / ' ORDER BY d.sort_order, i.sort_order)
                    ELSE 'equal' END AS weights
          FROM assessment_categories c
          LEFT JOIN rubric_dimensions d ON d.category_id = c.id
          LEFT JOIN rubric_indicators i ON i.dimension_id = d.id
         WHERE c.code IN ('SCI-WRT', 'SCI-PRS')
         GROUP BY c.code, c.name, c.sort_order
         ORDER BY c.sort_order
    LOOP
        RAISE NOTICE '%  %  (% criteria, weights: %)',
            rpad(v_rubric.code, 8), v_rubric.name, v_rubric.criteria, v_rubric.weights;
    END LOOP;
END
$do_science_check$;

-- END OF PART 2
