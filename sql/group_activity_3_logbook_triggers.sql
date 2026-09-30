-- PART 3 of 3 -- Logbook and peer-assessment triggers, then the check.
-- Run parts 1 and 2 first. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Logbook entries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_logbook_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_log_logbook$
DECLARE
    v_task TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Trimmed: the log is a timeline, not a second copy of the entry.
        v_task := left(COALESCE(NEW.task, ''), 60);
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'logbook.added',
            'Added a logbook entry for ' || COALESCE(NEW.entry_date::TEXT, 'an unspecified date')
                || CASE WHEN v_task <> '' THEN ': "' || v_task
                        || CASE WHEN length(COALESCE(NEW.task, '')) > 60 THEN '..."' ELSE '"' END
                   ELSE '' END,
            jsonb_build_object('entry_date', NEW.entry_date)
        );
        RETURN NEW;
    END IF;

    -- DELETE. Recorded because a group member can remove their own entry, and
    -- that is exactly the kind of change the others should be able to see.
    PERFORM public.log_group_activity(
        OLD.class_name, OLD.group_number, OLD.academic_year,
        'logbook.deleted',
        'Deleted a logbook entry from ' || COALESCE(OLD.entry_date::TEXT, 'an unspecified date'),
        jsonb_build_object('entry_date', OLD.entry_date)
    );
    RETURN OLD;
END
$fn_log_logbook$;

DROP TRIGGER IF EXISTS on_logbook_insert_log ON logbooks;
CREATE TRIGGER on_logbook_insert_log
    AFTER INSERT ON logbooks
    FOR EACH ROW EXECUTE FUNCTION public.log_logbook_change();

DROP TRIGGER IF EXISTS on_logbook_delete_log ON logbooks;
CREATE TRIGGER on_logbook_delete_log
    AFTER DELETE ON logbooks
    FOR EACH ROW EXECUTE FUNCTION public.log_logbook_change();


-- ---------------------------------------------------------------------------
-- Peer assessment
-- ---------------------------------------------------------------------------
-- That someone completed one is useful to the group. WHO they rated is not
-- recorded: the tab tells students "your peer assessments are confidential and
-- cannot be viewed by the recipients", and naming the subject in a log the
-- whole group reads would break that promise.
CREATE OR REPLACE FUNCTION public.log_peer_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_log_peer$
BEGIN
    PERFORM public.log_group_activity(
        NEW.class_name, NEW.group_number, NEW.academic_year,
        'peer.submitted',
        'Completed a peer or self assessment',
        '{}'::jsonb
    );
    RETURN NEW;
END
$fn_log_peer$;

DROP TRIGGER IF EXISTS on_peer_assessment_log ON peer_assessments;
CREATE TRIGGER on_peer_assessment_log
    AFTER INSERT ON peer_assessments
    FOR EACH ROW EXECUTE FUNCTION public.log_peer_assessment();


-- ---------------------------------------------------------------------------
-- Check that all three parts landed
-- ---------------------------------------------------------------------------
DO $do_self_check$
DECLARE
    v_missing TEXT[] := '{}';
BEGIN
    IF to_regclass('public.group_activity_log') IS NULL
        THEN v_missing := array_append(v_missing, 'part 1: group_activity_log table'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_group_activity')
        THEN v_missing := array_append(v_missing, 'part 1: log_group_activity()'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'activity_actor')
        THEN v_missing := array_append(v_missing, 'part 1: activity_actor()'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_project_insert_log')
        THEN v_missing := array_append(v_missing, 'part 2: on_project_insert_log'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_project_update_log')
        THEN v_missing := array_append(v_missing, 'part 2: on_project_update_log'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_logbook_insert_log')
        THEN v_missing := array_append(v_missing, 'part 3: on_logbook_insert_log'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_logbook_delete_log')
        THEN v_missing := array_append(v_missing, 'part 3: on_logbook_delete_log'); END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_peer_assessment_log')
        THEN v_missing := array_append(v_missing, 'part 3: on_peer_assessment_log'); END IF;

    IF COALESCE(array_length(v_missing, 1), 0) > 0 THEN
        RAISE EXCEPTION 'Migration incomplete. Missing -- %', array_to_string(v_missing, '; ');
    END IF;

    RAISE NOTICE '== ALL 3 PARTS COMPLETE. GROUP ACTIVITY LOG READY ==';
    RAISE NOTICE 'Entries so far: % (the log starts empty and fills from now on)',
        (SELECT COUNT(*) FROM group_activity_log);
END
$do_self_check$;

-- END OF PART 3
