-- PART 3 of 4 -- The self-service save. Run parts 1 and 2 first.
-- Safe to re-run. Kept under 150 lines so the SQL Editor cannot truncate it.
--
-- A teacher has to write their own teacher_emails row and must not be able to
-- write is_admin on it. RLS cannot restrict an UPDATE to a column list, so the
-- write goes through this function instead of a table grant: it touches four
-- columns, always for the caller's own email, and never is_admin.

CREATE OR REPLACE FUNCTION public.save_teacher_profile(
    p_full_name  TEXT,
    p_subjects   TEXT[],
    p_grades     TEXT[],
    p_phone      TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_save_profile$
DECLARE
    v_email TEXT;
    v_name  TEXT := btrim(COALESCE(p_full_name, ''));
    v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
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

    -- Every field is required: this form gates access to the portal, so a
    -- half-filled save would defeat it.
    IF v_name = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;
    IF COALESCE(array_length(p_subjects, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Choose at least one subject.';
    END IF;
    IF COALESCE(array_length(p_grades, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Choose at least one grade level.';
    END IF;
    IF NOT (p_grades <@ ARRAY['7','8','9','10','11','12']) THEN
        RAISE EXCEPTION 'Grade levels must be between 7 and 12.';
    END IF;

    -- Normalize the same way the browser does, so a pasted 0857..., 62857... or
    -- +62857... all land as 62857.... The leading 0 is a local trunk prefix and
    -- does not belong in an international number.
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

    -- is_admin is deliberately absent from the column list and the update.
    INSERT INTO public.teacher_emails (
        email, full_name, expertise_subjects, grade_levels, phone_e164, profile_completed_at
    )
    VALUES (v_email, v_name, p_subjects, p_grades, v_phone, NOW())
    ON CONFLICT (email) DO UPDATE
       SET full_name            = EXCLUDED.full_name,
           expertise_subjects   = EXCLUDED.expertise_subjects,
           grade_levels         = EXCLUDED.grade_levels,
           phone_e164           = EXCLUDED.phone_e164,
           profile_completed_at = NOW();

    -- The part 2 trigger mirrors that to profiles, but only for a row that
    -- already exists. Cover the first-login ordering explicitly.
    UPDATE public.profiles
       SET full_name            = v_name,
           expertise_subjects   = p_subjects,
           grade_levels         = p_grades,
           phone_e164           = v_phone,
           profile_completed_at = NOW()
     WHERE id = auth.uid();

    -- Marks already given by this teacher carry a snapshot of their name.
    -- Refresh those, so a student is not left reading "Not Recorded" for an
    -- assessment whose author is known.
    UPDATE public.assessment_scores
       SET assessed_by_name = v_name
     WHERE assessed_by = auth.uid();
END
$fn_save_profile$;

REVOKE ALL ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT) TO authenticated;


DO $do_part3_done$
BEGIN
    RAISE NOTICE '== PART 3 of 4 COMPLETE (save function) == now run part 4';
END
$do_part3_done$;

-- END OF PART 3
