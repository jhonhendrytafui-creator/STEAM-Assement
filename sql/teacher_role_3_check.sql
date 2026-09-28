-- PART 3 of 3 -- Check that parts 1 and 2 landed. Safe to re-run.
-- If you do not see "ALL 3 PARTS COMPLETE", something did not reach the
-- database -- this names which part.

DO $do_self_check$
DECLARE
    v_missing TEXT[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='teacher_emails' AND column_name='teaching_role')
        THEN v_missing := array_append(v_missing, 'part 1: teacher_emails.teaching_role'); END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='profiles' AND column_name='teaching_role')
        THEN v_missing := array_append(v_missing, 'part 1: profiles.teaching_role'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p
                   WHERE p.proname='save_teacher_profile' AND p.pronargs=5)
        THEN v_missing := array_append(v_missing, 'part 2: 5-argument save_teacher_profile()'); END IF;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration incomplete. Missing -- %', array_to_string(v_missing, '; ');
    END IF;

    RAISE NOTICE '== ALL 3 PARTS COMPLETE. TEACHING ROLE READY ==';
    RAISE NOTICE 'Teaching: %, non-teaching: %',
        (SELECT COUNT(*) FROM teacher_emails WHERE teaching_role = 'teaching'),
        (SELECT COUNT(*) FROM teacher_emails WHERE teaching_role = 'non_teaching');
END
$do_self_check$;

-- END OF PART 3
