-- Admin edits to a teacher profile reach the marks that teacher gave.
-- One file, safe to re-run.
--
-- save_teacher_profile() already refreshes assessment_scores.assessed_by_name
-- when a teacher saves their own profile, so a mark stops reading "Not
-- Recorded" once they set their name. An admin filling the profile in on their
-- behalf writes teacher_emails directly -- the RPC is scoped to the caller's own
-- email by design -- and so did not.
--
-- Moving that refresh into the sync trigger covers both paths from one place,
-- and means it can no longer be missed by whichever route is added next.

CREATE OR REPLACE FUNCTION public.sync_teacher_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_sync_teacher$
BEGIN
    UPDATE public.profiles
    SET role                 = 'teacher',
        is_admin             = NEW.is_admin,
        teaching_role        = NEW.teaching_role,
        expertise_subjects   = NEW.expertise_subjects,
        grade_levels         = NEW.grade_levels,
        phone_e164           = COALESCE(NEW.phone_e164, profiles.phone_e164),
        profile_completed_at = COALESCE(NEW.profile_completed_at, profiles.profile_completed_at),
        full_name            = COALESCE(NEW.full_name, profiles.full_name)
    WHERE profiles.email = NEW.email;

    -- Only when the name actually changed: this trigger also fires for an
    -- is_admin toggle, and there is no reason to rewrite score rows for that.
    IF TG_OP = 'UPDATE'
       AND NEW.full_name IS DISTINCT FROM OLD.full_name
       AND NULLIF(btrim(COALESCE(NEW.full_name, '')), '') IS NOT NULL
    THEN
        UPDATE public.assessment_scores s
           SET assessed_by_name = NEW.full_name
          FROM public.profiles p
         WHERE p.email = NEW.email
           AND s.assessed_by = p.id;
    END IF;

    RETURN NEW;
END
$fn_sync_teacher$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();


DO $do_done$
BEGIN
    RAISE NOTICE '== ADMIN PROFILE EDIT READY ==';
    RAISE NOTICE 'Marks naming their assessor: %, reading Not Recorded: %',
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NOT NULL),
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NULL);
    RAISE NOTICE 'The second number falls as teachers, or an admin on their behalf, set names.';
END
$do_done$;

-- END OF FILE
