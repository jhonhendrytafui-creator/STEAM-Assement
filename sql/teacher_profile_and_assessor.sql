-- ==============================================================================
-- Teacher self-service profile, and the assessor behind every mark
-- ==============================================================================
-- Two things this adds:
--
--   1. A teacher profile the teacher fills in themselves, once, before the
--      portal will let them in: full name, subject expertise, the grades they
--      teach, and a WhatsApp number. Expertise already existed but only an
--      admin could set it, so it stayed empty; grade level and phone had
--      nowhere to live at all.
--
--      teacher_emails stays the source of truth -- it is the row that exists
--      before a teacher has ever logged in, and the row the Admin -> Teacher
--      Access screen already edits. The existing sync trigger mirrors it down
--      to profiles, which is what the app reads.
--
--   2. assessment_scores.assessed_by_name -- the name of the teacher who gave
--      the mark, stored alongside the existing assessed_by reference.
--
--      assessed_by has been written since the column was added, but nothing
--      displayed it, and students cannot resolve it: RLS on profiles lets a
--      student read only their own row, so a join to get the teacher's name
--      returns nothing. Storing the name on the score row is what lets a
--      student see who marked them without opening up profiles to them.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run AFTER sql/teacher_expertise_and_assignments.sql.
-- ==============================================================================


-- ==============================================================================
-- SECTION 1: COLUMNS
-- ==============================================================================

-- Source of truth: editable by an admin before the teacher's first login.
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS grade_levels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Mirror, kept in step by sync_teacher_admin_flag(). This is what the app reads.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grade_levels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN teacher_emails.grade_levels IS
    'Grades this teacher teaches, as bare numerals: {7,8}. Mirrored to profiles.';
COMMENT ON COLUMN teacher_emails.phone_e164 IS
    'WhatsApp number, digits only, Indonesian country code included and no plus: 6285712345678. Built into a wa.me link in the UI.';
COMMENT ON COLUMN teacher_emails.profile_completed_at IS
    'When the teacher completed their own profile. NULL means the portal shows them the onboarding form instead of the dashboard.';

-- Phone shape is enforced here as well as in the browser, so a direct API call
-- cannot store something the wa.me link would silently break on.
-- 62 then an Indonesian mobile number, which always begins 8: 10 to 15 digits.
--
-- Written as digit and length tests rather than the anchored regex this started
-- as, so that the file contains no dollar sign outside the named function-body
-- tags below. That is defensive rather than a fix for anything: it keeps a tool
-- that looks for dollar-quoted bodies without tracking quoted strings from
-- having anything to trip over. Please keep it that way.
DO $do_phone_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teacher_emails_phone_e164_check'
    ) THEN
        ALTER TABLE teacher_emails ADD CONSTRAINT teacher_emails_phone_e164_check
            CHECK (
                phone_e164 IS NULL
                OR (phone_e164 !~ '[^0-9]'
                    AND left(phone_e164, 3) = '628'
                    AND length(phone_e164) BETWEEN 10 AND 15)
            );
    END IF;
END
$do_phone_check$;


-- ==============================================================================
-- SECTION 2: THE ASSESSOR'S NAME ON EVERY MARK
-- ==============================================================================

ALTER TABLE assessment_scores ADD COLUMN IF NOT EXISTS assessed_by_name TEXT;

COMMENT ON COLUMN assessment_scores.assessed_by_name IS
    'Name of the teacher who gave this mark, captured at save time. Denormalized on purpose: RLS lets a student read only their own profiles row, so assessed_by cannot be resolved to a name from the student dashboard.';

-- Backfill from assessed_by wherever it was recorded. Scores older than the
-- assessed_by column keep a NULL here and the UI shows "Not Recorded" -- that is
-- an honest gap rather than a guess at who marked it.
UPDATE assessment_scores s
   SET assessed_by_name = p.full_name
  FROM profiles p
 WHERE s.assessed_by = p.id
   AND s.assessed_by_name IS NULL
   AND NULLIF(btrim(p.full_name), '') IS NOT NULL;


-- ==============================================================================
-- SECTION 3: CARRY THE NEW COLUMNS DOWN TO profiles
-- ==============================================================================
-- Extends the existing trigger rather than adding a second one. is_admin still
-- comes from teacher_emails and from nowhere else, which is what keeps the
-- self-service form in section 4 from being an escalation path.

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
END;
$fn_sync_teacher$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();


-- -- And pick it all up when the teacher first signs in ----------------------

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
END;
$fn_new_user$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==============================================================================
-- SECTION 4: THE SELF-SERVICE SAVE
-- ==============================================================================
-- A teacher has to be able to write their own teacher_emails row, and must not
-- be able to write is_admin on it. Rather than granting UPDATE on the table and
-- relying on a column list -- which RLS cannot express -- the write goes through
-- this function, which touches only the four profile fields and always for the
-- caller's own email.
--
-- SECURITY DEFINER for that reason, with a fixed search_path, same pattern as
-- is_teacher() and in_group().

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
    -- Whose profile this is, established from the session and not from an
    -- argument, so one teacher cannot write another's row.
    SELECT p.email INTO v_email
      FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role = 'teacher';

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Only a signed-in teacher can save a teacher profile.';
    END IF;

    -- Every field is required: this is the form that gates access to the portal,
    -- so a half-filled save would defeat it.
    IF v_name = '' THEN
        RAISE EXCEPTION 'Full name is required.';
    END IF;
    IF COALESCE(array_length(p_subjects, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Choose at least one subject.';
    END IF;
    IF COALESCE(array_length(p_grades, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Choose at least one grade level.';
    END IF;

    -- Accept what the browser sends and normalize the same way it does, so a
    -- pasted 0857..., 62857... or +62857... all land as 62857...
    IF left(v_phone, 2) = '62' THEN
        v_phone := substr(v_phone, 3);
    END IF;
    v_phone := regexp_replace(v_phone, '^0+', '');
    v_phone := '62' || v_phone;

    -- Same test as the CHECK constraint above, and written the same way for the
    -- same reason.
    IF NOT (v_phone !~ '[^0-9]'
            AND left(v_phone, 3) = '628'
            AND length(v_phone) BETWEEN 10 AND 15) THEN
        RAISE EXCEPTION 'Enter a valid Indonesian mobile number, for example 85712345678.';
    END IF;

    IF NOT (p_grades <@ ARRAY['7','8','9','10','11','12']) THEN
        RAISE EXCEPTION 'Grade levels must be between 7 and 12.';
    END IF;

    -- is_admin is deliberately absent from both the column list and the update.
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

    -- The trigger above mirrors that to profiles, but only for a row that
    -- already exists. Cover the first-login ordering explicitly.
    UPDATE public.profiles
       SET full_name            = v_name,
           expertise_subjects   = p_subjects,
           grade_levels         = p_grades,
           phone_e164           = v_phone,
           profile_completed_at = NOW()
     WHERE id = auth.uid();

    -- Marks already given by this teacher carry a snapshot of their name. Now
    -- that they have set it properly, refresh those so a student is not left
    -- looking at "Not Recorded" for an assessment whose author is known.
    UPDATE public.assessment_scores
       SET assessed_by_name = v_name
     WHERE assessed_by = auth.uid();
END;
$fn_save_profile$;

REVOKE ALL ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_teacher_profile(TEXT, TEXT[], TEXT[], TEXT) TO authenticated;


-- ==============================================================================
-- SECTION 5: LET A TEACHER READ THEIR OWN teacher_emails ROW
-- ==============================================================================
-- The onboarding form pre-fills from whatever an admin already entered, so the
-- teacher confirms rather than retypes. Reading the whole table stays
-- admin-only; this is one row, the caller's own.

DROP POLICY IF EXISTS "Teachers read own teacher_emails row" ON teacher_emails;
CREATE POLICY "Teachers read own teacher_emails row"
ON teacher_emails FOR SELECT TO authenticated
USING (
    email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
);


-- ==============================================================================
-- SECTION 6: SELF-CHECK
-- ==============================================================================
-- This file is long enough that a partial copy-paste is a real hazard: a paste
-- cut off inside one of the function bodies above fails with "unterminated
-- dollar-quoted string", naming a line a long way from where the text actually
-- ran out. So the last thing it does is confirm that everything it should have
-- created is really there.
--
-- If you do not see the "TEACHER PROFILE MIGRATION COMPLETE" notice, what
-- reached the database was not the whole file -- paste it again in full rather
-- than assuming the parts that did run are enough.

DO $do_self_check$
DECLARE
    v_missing TEXT[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='grade_levels')
        THEN v_missing := v_missing || 'teacher_emails.grade_levels'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='phone_e164')
        THEN v_missing := v_missing || 'teacher_emails.phone_e164'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='profile_completed_at')
        THEN v_missing := v_missing || 'teacher_emails.profile_completed_at'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='grade_levels')
        THEN v_missing := v_missing || 'profiles.grade_levels'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='phone_e164')
        THEN v_missing := v_missing || 'profiles.phone_e164'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='profile_completed_at')
        THEN v_missing := v_missing || 'profiles.profile_completed_at'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='assessment_scores' AND column_name='assessed_by_name')
        THEN v_missing := v_missing || 'assessment_scores.assessed_by_name'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='save_teacher_profile')
        THEN v_missing := v_missing || 'function save_teacher_profile()'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='sync_teacher_admin_flag')
        THEN v_missing := v_missing || 'function sync_teacher_admin_flag()'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='handle_new_user')
        THEN v_missing := v_missing || 'function handle_new_user()'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_teacher_email_change')
        THEN v_missing := v_missing || 'trigger on_teacher_email_change'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created')
        THEN v_missing := v_missing || 'trigger on_auth_user_created'; END IF;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration incomplete. Missing: %', array_to_string(v_missing, ', ');
    END IF;

    RAISE NOTICE '== TEACHER PROFILE MIGRATION COMPLETE ==';
    RAISE NOTICE 'Teachers still to complete their profile: %',
        (SELECT COUNT(*) FROM teacher_emails WHERE profile_completed_at IS NULL);
    RAISE NOTICE 'Marks naming their assessor: %, reading Not Recorded: %',
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NOT NULL),
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NULL);
END
$do_self_check$;


-- ==============================================================================
-- VERIFY
-- ==============================================================================
-- New columns present:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'teacher_emails'
--     AND column_name IN ('grade_levels','phone_e164','profile_completed_at');
--
-- Who still has to complete their profile (these teachers see the form):
--   SELECT email, full_name, expertise_subjects, grade_levels, phone_e164
--   FROM teacher_emails WHERE profile_completed_at IS NULL ORDER BY email;
--
-- How many marks can name their assessor, and how many will read
-- "Not Recorded":
--   SELECT COUNT(*) FILTER (WHERE assessed_by_name IS NOT NULL) AS named,
--          COUNT(*) FILTER (WHERE assessed_by_name IS NULL)     AS not_recorded
--   FROM assessment_scores;
