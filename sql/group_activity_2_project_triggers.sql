-- PART 2 of 3 -- Triggers on projects. Run part 1 first. Safe to re-run.
--
-- A submission, a document link, and the teacher's decision are the three
-- things a group most needs to see a record of.

-- ---------------------------------------------------------------------------
-- A new project row is a submission, or a resubmission of a later iteration.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_project_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_log_project_insert$
BEGIN
    PERFORM public.log_group_activity(
        NEW.class_name, NEW.group_number, NEW.academic_year,
        CASE WHEN COALESCE(NEW.iteration, 1) > 1
             THEN 'project.resubmitted' ELSE 'project.submitted' END,
        CASE WHEN COALESCE(NEW.iteration, 1) > 1
             THEN 'Resubmitted the project as iteration ' || COALESCE(NEW.iteration, 1)
                  || ': "' || COALESCE(NEW.title, 'Untitled') || '"'
             ELSE 'Submitted the project "' || COALESCE(NEW.title, 'Untitled') || '"' END,
        jsonb_build_object('title', NEW.title, 'iteration', COALESCE(NEW.iteration, 1))
    );
    RETURN NEW;
END
$fn_log_project_insert$;

DROP TRIGGER IF EXISTS on_project_insert_log ON projects;
CREATE TRIGGER on_project_insert_log
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.log_project_insert();


-- ---------------------------------------------------------------------------
-- Updates. One row per thing that actually changed, so a single save that
-- touches two fields reads as two events rather than one vague one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_log_project_update$
DECLARE
    v_old_docs INT := jsonb_array_length(COALESCE(OLD.additional_documents, '[]'::jsonb));
    v_new_docs INT := jsonb_array_length(COALESCE(NEW.additional_documents, '[]'::jsonb));
BEGIN
    -- The main project document.
    IF COALESCE(NEW.google_doc_url, '') IS DISTINCT FROM COALESCE(OLD.google_doc_url, '') THEN
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'project.document_linked',
            CASE WHEN COALESCE(OLD.google_doc_url, '') = ''
                 THEN 'Linked the project document'
                 ELSE 'Changed the project document link' END,
            '{}'::jsonb
        );
    END IF;

    -- Supporting documents. The count is what a reader cares about; the link
    -- itself is on the Project Document tab.
    IF v_new_docs > v_old_docs THEN
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'project.document_added',
            'Added a supporting document (' || v_new_docs || ' now attached)',
            jsonb_build_object('count', v_new_docs)
        );
    ELSIF v_new_docs < v_old_docs THEN
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'project.document_removed',
            'Removed a supporting document (' || v_new_docs || ' left)',
            jsonb_build_object('count', v_new_docs)
        );
    END IF;

    -- The teacher's decision. Recorded in the group's own log so they see it
    -- where they see everything else, attributed to the teacher who made it.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'project.status_changed',
            'Project marked as ' || COALESCE(NEW.status, 'unknown'),
            jsonb_build_object('from', OLD.status, 'to', NEW.status)
        );
    END IF;

    -- Presentation questions are generated for the group, not by them.
    IF COALESCE(NEW.c5_generated_questions, '') IS DISTINCT FROM COALESCE(OLD.c5_generated_questions, '') THEN
        PERFORM public.log_group_activity(
            NEW.class_name, NEW.group_number, NEW.academic_year,
            'project.questions_generated',
            'Presentation questions were generated for this project',
            '{}'::jsonb
        );
    END IF;

    RETURN NEW;
END
$fn_log_project_update$;

DROP TRIGGER IF EXISTS on_project_update_log ON projects;
CREATE TRIGGER on_project_update_log
    AFTER UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.log_project_update();


DO $do_part2_done$
BEGIN
    RAISE NOTICE '== PART 2 of 3 COMPLETE (project triggers) == now run part 3';
END
$do_part2_done$;

-- END OF PART 2
