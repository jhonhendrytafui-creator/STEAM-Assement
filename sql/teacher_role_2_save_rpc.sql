-- PART 2 of 3 -- save_teacher_profile, with the teaching / non-teaching choice.
-- Run part 1 first. Safe to re-run.
--
-- The 4-argument version is dropped and replaced by a 5-argument one whose new
-- argument DEFAULTs to 'teaching', so a browser still running the old code keeps
-- working. Dropping the old signature first avoids two candidates for a
-- 4-argument call.

DROP FUNCTION IF EXISTS public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.save_teacher_profile(
    p_full_name     TEXT,
    p_subjects      TEXT[],
    p_grades        TEXT[],
    p_phone         TEXT,
    p_teaching_role TEXT DEFAULT 'teaching'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_save_profile$
DECLARE
    v_email    TEXT;
    v_name     TEXT := btrim(COALESCE(p_full_name, ''));
    v_phone    TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    v_role     TEXT := COALESCE(NULLIF(btrim(p_teaching_role), ''), 'teaching');
    v_subjects TEXT[];
    v_grades   TEXT[];
BEGIN
    -- Whose profile this is comes from the session, not from an argument, so one
    -- teacher cannot write another's row.
    SELECT p.email INTO v_email
      FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role = 'teacher';

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Only a signed-in teacher can save a teacher profile.';
    END IF;

    IF v_role NOT IN ('teaching', 'non_teaching') THEN
        RAISE EXCEPTION 'Role must be either teaching or non_teaching.';
    END IF;

    -- Required of everybody: a name and a reachable number.
    IF v_name = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;

    IF left(v_phone, 2) = '62' THEN
        v_phone := substr(v_phone, 3);
    END IF;
    v_phone := regexp_replace(v_phone, '^0+', '');
    v_phone := '62' || v_phone;

    IF NOT (v_phone !~ '[^0-9]'
            AND left(v_phone, 3) = '628'
            AND length(v_phone) BETWEEN 10 AND 15) THEN
        RAISE EXCEPTION 'Enter a valid Indonesian mobile number, for example 85712345678.';
    END IF;

    IF v_role = 'teaching' THEN
        -- Subjects decide which projects they are recommended for; grades say who
        -- they teach. Neither is optional for someone who teaches.
        IF COALESCE(array_length(p_subjects, 1), 0) = 0 THEN
            RAISE EXCEPTION 'Choose at least one subject.';
        END IF;
        IF COALESCE(array_length(p_grades, 1), 0) = 0 THEN
            RAISE EXCEPTION 'Choose at least one grade level.';
        END IF;
        IF NOT (p_grades <@ ARRAY['7','8','9','10','11','12']) THEN
            RAISE EXCEPTION 'Grade levels must be between 7 and 12.';
        END IF;
        v_subjects := p_subjects;
        v_grades   := p_grades;
    ELSE
        -- Stored empty, not merely ignored: a non-teaching account carrying
        -- subjects would contradict itself on the Teacher Access list, and the
        -- classifier already skips anyone with none, which is right here.
        v_subjects := '{}';
        v_grades   := '{}';
    END IF;

    -- is_admin is deliberately absent from the column list and the update.
    INSERT INTO public.teacher_emails (
        email, full_name, teaching_role, expertise_subjects,
        grade_levels, phone_e164, profile_completed_at
    )
    VALUES (v_email, v_name, v_role, v_subjects, v_grades, v_phone, NOW())
    ON CONFLICT (email) DO UPDATE
       SET full_name            = EXCLUDED.full_name,
           teaching_role        = EXCLUDED.teaching_role,
           expertise_subjects   = EXCLUDED.expertise_subjects,
           grade_levels         = EXCLUDED.grade_levels,
           phone_e164           = EXCLUDED.phone_e164,
           profile_completed_at = NOW();

    -- The part 1 trigger mirrors that to profiles, but only for a row that
    -- already exists; cover the first-login ordering explicitly.
    UPDATE public.profiles
       SET full_name            = v_name,
           teaching_role        = v_role,
           expertise_subjects   = v_subjects,
           grade_levels         = v_grades,
           phone_e164           = v_phone,
           profile_completed_at = NOW()
     WHERE id = auth.uid();

    -- Marks already given by this teacher carry a snapshot of their name.
    UPDATE public.assessment_scores
       SET assessed_by_name = v_name
     WHERE assessed_by = auth.uid();
END
$fn_save_profile$;

REVOKE ALL ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT, TEXT) TO authenticated;


DO $do_part2_done$
BEGIN
    RAISE NOTICE '== PART 2 of 3 COMPLETE (save function) == now run part 3';
END
$do_part2_done$;

-- END OF PART 2
