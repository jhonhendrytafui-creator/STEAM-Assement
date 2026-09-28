-- PART 4 of 4 -- Read policy, and the check that all four parts landed.
-- Run parts 1, 2 and 3 first. Safe to re-run.

-- The onboarding form pre-fills from whatever an admin already entered, so the
-- teacher confirms rather than retypes. Reading the whole table stays
-- admin-only; this is one row, the caller's own.
DROP POLICY IF EXISTS "Teachers read own teacher_emails row" ON teacher_emails;
CREATE POLICY "Teachers read own teacher_emails row"
ON teacher_emails FOR SELECT TO authenticated
USING (
    email = (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid())
);


-- Asserts everything parts 1 to 3 should have created. If a part was skipped or
-- a paste was cut short, this names exactly what is missing instead of leaving
-- the migration quietly half-applied.
DO $do_self_check$
DECLARE
    v_missing TEXT[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='grade_levels')
        THEN v_missing := array_append(v_missing, 'part 1: teacher_emails.grade_levels'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='phone_e164')
        THEN v_missing := array_append(v_missing, 'part 1: teacher_emails.phone_e164'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='profile_completed_at')
        THEN v_missing := array_append(v_missing, 'part 1: teacher_emails.profile_completed_at'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='grade_levels')
        THEN v_missing := array_append(v_missing, 'part 1: profiles.grade_levels'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='phone_e164')
        THEN v_missing := array_append(v_missing, 'part 1: profiles.phone_e164'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='profile_completed_at')
        THEN v_missing := array_append(v_missing, 'part 1: profiles.profile_completed_at'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='assessment_scores' AND column_name='assessed_by_name')
        THEN v_missing := array_append(v_missing, 'part 1: assessment_scores.assessed_by_name'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname='teacher_emails_phone_e164_check')
        THEN v_missing := array_append(v_missing, 'part 1: phone CHECK constraint'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_teacher_email_change')
        THEN v_missing := array_append(v_missing, 'part 2: trigger on_teacher_email_change'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='on_auth_user_created')
        THEN v_missing := array_append(v_missing, 'part 2: trigger on_auth_user_created'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='save_teacher_profile')
        THEN v_missing := array_append(v_missing, 'part 3: function save_teacher_profile()'); END IF;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration incomplete. Missing -- %', array_to_string(v_missing, '; ');
    END IF;

    RAISE NOTICE '== ALL 4 PARTS COMPLETE. TEACHER PROFILE MIGRATION DONE ==';
    RAISE NOTICE 'Teachers who will see the onboarding form: %',
        (SELECT COUNT(*) FROM teacher_emails WHERE profile_completed_at IS NULL);
    RAISE NOTICE 'Marks naming their assessor: %, reading Not Recorded: %',
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NOT NULL),
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NULL);
END
$do_self_check$;

-- END OF PART 4
--
-- Who still owes a profile:
--   SELECT email, full_name, expertise_subjects, grade_levels, phone_e164
--   FROM teacher_emails WHERE profile_completed_at IS NULL ORDER BY email;
--
-- To let one teacher in without the form:
--   UPDATE teacher_emails SET profile_completed_at = NOW() WHERE email = '...';
