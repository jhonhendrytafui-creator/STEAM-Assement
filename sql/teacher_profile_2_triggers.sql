-- PART 2 of 4 -- Sync triggers. Run part 1 first.
-- Safe to re-run. Kept under 150 lines so the SQL Editor cannot truncate it.
--
-- Both functions already exist; these are the same functions extended to carry
-- the columns part 1 added. is_admin still comes from teacher_emails and
-- nowhere else, which is what keeps the self-service save in part 3 from being
-- an escalation path.

-- Admin edits teacher_emails -> profiles follows.
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
        expertise_subjects   = NEW.expertise_subjects,
        grade_levels         = NEW.grade_levels,
        phone_e164           = COALESCE(NEW.phone_e164, profiles.phone_e164),
        profile_completed_at = COALESCE(NEW.profile_completed_at, profiles.profile_completed_at),
        full_name            = COALESCE(NEW.full_name, profiles.full_name)
    WHERE profiles.email = NEW.email;
    RETURN NEW;
END
$fn_sync_teacher$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();


-- And pick it all up when the teacher first signs in, so a teacher whose row an
-- admin already completed is not shown the onboarding form.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_new_user$
DECLARE
    v_is_teacher BOOLEAN := FALSE;
    v_is_admin   BOOLEAN := FALSE;
    v_subjects   TEXT[]  := '{}';
    v_grades     TEXT[]  := '{}';
    v_full_name  TEXT;
    v_phone      TEXT;
    v_completed  TIMESTAMPTZ;
BEGIN
    SELECT TRUE,
           COALESCE(te.is_admin, FALSE),
           COALESCE(te.expertise_subjects, '{}'),
           COALESCE(te.grade_levels, '{}'),
           te.full_name,
           te.phone_e164,
           te.profile_completed_at
      INTO v_is_teacher, v_is_admin, v_subjects, v_grades,
           v_full_name, v_phone, v_completed
      FROM public.teacher_emails te
     WHERE te.email = NEW.email;

    INSERT INTO public.profiles (
        id, email, role, is_admin, expertise_subjects,
        grade_levels, full_name, phone_e164, profile_completed_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN COALESCE(v_is_teacher, FALSE) THEN 'teacher' ELSE 'student' END,
        COALESCE(v_is_admin, FALSE),
        COALESCE(v_subjects, '{}'),
        COALESCE(v_grades, '{}'),
        v_full_name,
        v_phone,
        v_completed
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END
$fn_new_user$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


DO $do_part2_done$
BEGIN
    RAISE NOTICE '== PART 2 of 4 COMPLETE (triggers) == now run part 3';
END
$do_part2_done$;

-- END OF PART 2
