-- C2 (Ask & Research): wording revision proposed by the SMA teachers,
-- adjusted where it would weaken the Success Criteria thread. Safe to re-run.
--
-- Changes the text of four indikator IN PLACE, so every C2 score already given
-- stays attached to its indikator. Do NOT use sql/seed_c2_rubric.sql for this:
-- it deletes every C2 score before re-creating the rubric.
--
--   #1 Problem Description   SMA wording ("facts and data from reliable resources")
--   #2 Relevance & Constraints  SMA wording, keeping "measurable" and the
--                            Success Criteria note: C3, C4 and C5 all test the
--                            project against these constraints
--   #4 Knowledge Synthesis   SMA wording ("gather, analyse ... evidence-based")
--   #7 The Mechanism         SMA wording without "briefly", which contradicted
--                            Level 4; keeps input -> process -> output
--   #3, #5, #6, #8           unchanged
--
-- The 1-4 level descriptions are not changed, so existing scores stay valid.
--
-- It also removes a note that sql/revise_c2_c5_rubrics.sql added by mistake.
-- That script picked "the indikator in position 2", but every dimension has a
-- position 2, so "The limits listed here become the project's official Success
-- Criteria ..." landed on #2, #4 and #7, in the indikator text and in Level 4,
-- once for every time the script was run. The note now appears once, on #2.

DO $do_c2$
DECLARE
    v_cat     UUID;
    v_before  INT;
    v_after   INT;
    v_n       INT;
    v_row     RECORD;
    v_note    CONSTANT TEXT := '\s*\(?The limits listed here become the project''s official Success Criteria, used in every later phase\.\)?';
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C2';
    IF v_cat IS NULL THEN
        RAISE EXCEPTION 'There is no C2 rubric in this database.';
    END IF;
    SELECT count(*) INTO v_before FROM assessment_scores WHERE category_id = v_cat;

    -- 1. The misplaced note, from every C2 indikator text and every level.
    UPDATE rubric_indicators i
       SET description = btrim(regexp_replace(i.description, v_note, '', 'g')),
           criteria = (SELECT jsonb_object_agg(e.key, btrim(regexp_replace(e.value, v_note, '', 'g')))
                         FROM jsonb_each_text(i.criteria) e)
      FROM rubric_dimensions d
     WHERE i.dimension_id = d.id AND d.category_id = v_cat
       AND (i.description ~ v_note OR i.criteria::text ~ v_note);

    -- 2. The new wording. Each indikator is found by its name, and must be
    --    found exactly once, or nothing at all is changed.
    FOR v_row IN SELECT * FROM (VALUES
        ('Problem Description%',
         'Problem Description (Causes, Impact & Facts) — Does the student explain the causes and impacts of the problem using clear facts and data obtained from reliable resources, rather than relying solely on personal opinions?'),
        ('Relevance & Constraints%',
         'Relevance & Constraints — Is the problem relevant to the student''s/user''s life, and have they identified clear, appropriate and measurable constraints (e.g. budget, size, time, materials) that need to be considered throughout the project? (These constraints become the project''s official Success Criteria, used in every later phase.)'),
        ('Knowledge Synthesis%',
         'Knowledge Synthesis — Does the student effectively gather, analyse, and connect relevant data from reliable resources to make logical, evidence-based, and actionable decisions for their project design?'),
        ('The%Mechanism%',
         'The Mechanism — Does the student clearly explain how the product/prototype works: its main functions and the process (input → process → output) that makes it operate?')
    ) AS t(pattern, new_text) LOOP
        UPDATE rubric_indicators i
           SET description = v_row.new_text
          FROM rubric_dimensions d
         WHERE i.dimension_id = d.id AND d.category_id = v_cat
           AND i.description ILIKE v_row.pattern;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n <> 1 THEN
            RAISE EXCEPTION 'Expected one C2 indikator starting "%", found %. Nothing was changed.',
                replace(v_row.pattern, '%', ''), v_n;
        END IF;
    END LOOP;

    SELECT count(*) INTO v_after FROM assessment_scores WHERE category_id = v_cat;
    IF v_after <> v_before THEN
        RAISE EXCEPTION 'C2 scores changed from % to %. Nothing was changed.', v_before, v_after;
    END IF;

    INSERT INTO admin_audit_log (actor_email, action, target, details, academic_year)
    VALUES ('sql-editor', 'rubric.revise_wording', 'C2',
            jsonb_build_object('file', 'sql/revise_c2_wording_2026.sql', 'indikator', jsonb_build_array(1, 2, 4, 7)),
            (SELECT value FROM app_settings WHERE key = 'academic_year'));

    RAISE NOTICE '== C2 WORDING REVISED. All % existing C2 scores kept. ==', v_after;
    FOR v_row IN
        SELECT left(i.description, 90) AS text
          FROM rubric_indicators i JOIN rubric_dimensions d ON d.id = i.dimension_id
         WHERE d.category_id = v_cat
         ORDER BY d.sort_order, i.sort_order
    LOOP
        RAISE NOTICE '  %...', v_row.text;
    END LOOP;
END
$do_c2$;
