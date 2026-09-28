-- PART 1 of 3 -- A teaching / non-teaching flag on the teacher record.
-- Run parts 1, 2, 3 in order. Safe to re-run.
--
-- Not everyone with portal access teaches: office staff, a librarian, a
-- counsellor, a head who only reads the dashboards. None of them has subject
-- expertise or a grade level, and the onboarding form demanded both before
-- letting anyone in. teaching_role records which of the two someone is, so the
-- form asks only what applies.
--
-- DEFAULT 'teaching' is deliberate: every row that exists today belongs to
-- someone who teaches, so nobody is re-prompted.

ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS teaching_role TEXT NOT NULL DEFAULT 'teaching';
ALTER TABLE profiles       ADD COLUMN IF NOT EXISTS teaching_role TEXT NOT NULL DEFAULT 'teaching';

COMMENT ON COLUMN teacher_emails.teaching_role IS
    '"teaching" (teaches and assesses; subjects and grades required) or "non_teaching" (neither; both left empty). Mirrored to profiles.';

DO $do_role_check$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_emails_teaching_role_check') THEN
        ALTER TABLE teacher_emails ADD CONSTRAINT teacher_emails_teaching_role_check
            CHECK (teaching_role IN ('teaching', 'non_teaching'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_teaching_role_check') THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_teaching_role_check
            CHECK (teaching_role IN ('teaching', 'non_teaching'));
    END IF;
END
$do_role_check$;


-- Carry it down to profiles when an admin edits teacher_emails. Same function as
-- before with teaching_role added; is_admin still comes from here and nowhere
-- else, which is what keeps the self-service save from being an escalation path.
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
    RETURN NEW;
END
$fn_sync_teacher$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();


-- And pick it up on first sign-in, so someone an admin has already marked
-- non-teaching is not asked for subjects they do not have.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_new_user$
DECLARE
    v_is_teacher BOOLEAN := FALSE;
    v_is_admin   BOOLEAN := FALSE;
    v_role       TEXT    := 'teaching';
    v_subjects   TEXT[]  := '{}';
    v_grades     TEXT[]  := '{}';
    v_full_name  TEXT;
    v_phone      TEXT;
    v_completed  TIMESTAMPTZ;
BEGIN
    SELECT TRUE,
           COALESCE(te.is_admin, FALSE),
           COALESCE(te.teaching_role, 'teaching'),
           COALESCE(te.expertise_subjects, '{}'),
           COALESCE(te.grade_levels, '{}'),
           te.full_name, te.phone_e164, te.profile_completed_at
      INTO v_is_teacher, v_is_admin, v_role, v_subjects, v_grades,
           v_full_name, v_phone, v_completed
      FROM public.teacher_emails te
     WHERE te.email = NEW.email;

    INSERT INTO public.profiles (
        id, email, role, is_admin, teaching_role, expertise_subjects,
        grade_levels, full_name, phone_e164, profile_completed_at
    )
    VALUES (
        NEW.id, NEW.email,
        CASE WHEN COALESCE(v_is_teacher, FALSE) THEN 'teacher' ELSE 'student' END,
        COALESCE(v_is_admin, FALSE),
        COALESCE(v_role, 'teaching'),
        COALESCE(v_subjects, '{}'),
        COALESCE(v_grades, '{}'),
        v_full_name, v_phone, v_completed
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END
$fn_new_user$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


DO $do_part1_done$
BEGIN
    RAISE NOTICE '== PART 1 of 3 COMPLETE (teaching_role column) == now run part 2';
END
$do_part1_done$;

-- END OF PART 1
