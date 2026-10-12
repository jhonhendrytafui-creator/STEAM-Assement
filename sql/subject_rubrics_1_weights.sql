-- Subject rubrics, part 1 of 4: criterion weights. Safe to re-run.
--
-- Weights belong to a rubric's criteria (rubric_indicators), the rows a teacher
-- scores 1-4. NULL means "equal share", and a rubric uses its weights only when
-- every criterion has one (see src/lib/rubric.ts). Every rubric that exists
-- today has none, so every score stays exactly what it was until an admin sets
-- weights for a rubric.

ALTER TABLE rubric_indicators ADD COLUMN IF NOT EXISTS weight NUMERIC;

DO $do_check$
BEGIN
    ALTER TABLE rubric_indicators ADD CONSTRAINT rubric_indicators_weight_range
        CHECK (weight IS NULL OR (weight >= 0 AND weight <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END
$do_check$;

-- Every teacher can write the rubric tables ("Teachers can manage
-- rubric_indicators"), so hiding the admin screen alone would not stop a
-- teacher changing weights through the API. This does: a weight can only be
-- changed by an admin, or from the SQL editor (no signed-in user).
CREATE OR REPLACE FUNCTION public.guard_rubric_weight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_guard$
BEGIN
    IF NEW.weight IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.weight END)
       AND auth.uid() IS NOT NULL
       AND NOT public.is_admin()
    THEN
        RAISE EXCEPTION 'Only an admin can change rubric weights.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END
$fn_guard$;

DROP TRIGGER IF EXISTS guard_rubric_weight ON rubric_indicators;
CREATE TRIGGER guard_rubric_weight
    BEFORE INSERT OR UPDATE OF weight ON rubric_indicators
    FOR EACH ROW EXECUTE FUNCTION public.guard_rubric_weight();

-- The admin screen saves through this, all or nothing. p_weights maps every
-- criterion id of the rubric to a percentage; together they must make 100.
-- NULL or '{}' puts the rubric back on equal weights. Audited.
CREATE OR REPLACE FUNCTION public.set_rubric_weights(p_category_id UUID, p_weights JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_set$
DECLARE
    v_code  TEXT;
    v_ids   UUID[];
    v_total NUMERIC;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only an admin can change rubric weights.' USING ERRCODE = '42501';
    END IF;

    SELECT code INTO v_code FROM assessment_categories WHERE id = p_category_id;
    IF v_code IS NULL THEN
        RAISE EXCEPTION 'That rubric does not exist.';
    END IF;

    IF p_weights IS NULL OR p_weights = '{}'::jsonb THEN
        UPDATE rubric_indicators i SET weight = NULL
          FROM rubric_dimensions d
         WHERE i.dimension_id = d.id AND d.category_id = p_category_id;
    ELSE
        SELECT array_agg(i.id) INTO v_ids
          FROM rubric_indicators i JOIN rubric_dimensions d ON d.id = i.dimension_id
         WHERE d.category_id = p_category_id;

        IF (SELECT count(*) FROM jsonb_object_keys(p_weights)) <> COALESCE(array_length(v_ids, 1), 0)
           OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_weights) k WHERE NOT (k::uuid = ANY (v_ids)))
        THEN
            RAISE EXCEPTION 'Give a weight for every criterion of this rubric, and only those.';
        END IF;

        IF EXISTS (SELECT 1 FROM jsonb_each(p_weights) e
                    WHERE jsonb_typeof(e.value) <> 'number'
                       OR e.value::numeric < 0 OR e.value::numeric > 100)
        THEN
            RAISE EXCEPTION 'Each weight must be a number from 0 to 100.';
        END IF;

        SELECT sum(e.value::numeric) INTO v_total FROM jsonb_each(p_weights) e;
        IF abs(v_total - 100) > 0.01 THEN
            RAISE EXCEPTION 'Weights must add up to 100%% (these add up to %).', round(v_total, 2) || '%';
        END IF;

        UPDATE rubric_indicators i SET weight = (p_weights ->> i.id::text)::numeric
          FROM rubric_dimensions d
         WHERE i.dimension_id = d.id AND d.category_id = p_category_id;
    END IF;

    INSERT INTO admin_audit_log (actor_email, action, target, details, academic_year)
    VALUES (
        COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), 'unknown'),
        'rubric.set_weights',
        v_code,
        jsonb_build_object('weights', COALESCE(p_weights, '{}'::jsonb)),
        (SELECT value FROM app_settings WHERE key = 'academic_year')
    );
END
$fn_set$;

-- Supabase grants new functions to anon by default; REVOKE FROM PUBLIC alone
-- would leave that grant in place.
REVOKE ALL ON FUNCTION public.set_rubric_weights(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rubric_weights(UUID, JSONB) TO authenticated;

DO $do_done$ BEGIN RAISE NOTICE '== PART 1 OF 4 DONE: weights column, guard, set_rubric_weights =='; END $do_done$;
