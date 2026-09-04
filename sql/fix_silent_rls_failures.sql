-- ==============================================================================
-- FIX: writes that RLS rejects without reporting an error
-- ==============================================================================
-- PostgREST does not fail an UPDATE or DELETE that no policy permits. It
-- matches zero rows and returns 200 with an empty body. Client code that only
-- checks `error` therefore shows "Saved successfully" while nothing was
-- written. Three places in this app hit that:
--
--   1. peer_assessments — students can INSERT and SELECT their own rows, but
--      no UPDATE policy was ever created. Editing an already-submitted peer
--      assessment reports success and changes nothing. Since individual marks
--      are now weighted by peer assessment, this quietly feeds stale ratings
--      into grades.
--
--   2. assessment_scores — SubmitProjectTab deletes the group's C1 scores when
--      a project is resubmitted, so the new iteration starts clean. Students
--      have no DELETE policy there (correctly — they must not be able to erase
--      marks), so the reset never happened. Moved to a trigger below, which
--      runs with the table owner's rights and needs no student permission.
--
--   3. logbooks — kept as-is; the UPDATE/DELETE policies from
--      rls_and_triggers.sql are the ones in force and they are correct.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run this AFTER sql/harden_security.sql.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 0: PRE-FLIGHT — confirm the gap before closing it
-- ══════════════════════════════════════════════════════════════════════════════
-- Expect rows for INSERT and SELECT only. If an UPDATE row is already listed,
-- this file has been run before and there is nothing to fix.
--
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'peer_assessments'
--   ORDER BY cmd;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: PEER ASSESSMENTS — let a student correct their own submission
-- ══════════════════════════════════════════════════════════════════════════════
-- Scoped exactly like the INSERT policy: the assessor may only touch rows they
-- wrote. WITH CHECK repeats the condition so a student cannot re-point a row at
-- another assessor on the way out.

DROP POLICY IF EXISTS "Students can update their own assessments" ON peer_assessments;

CREATE POLICY "Students can update their own assessments"
ON peer_assessments FOR UPDATE TO authenticated
USING (
    assessor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
    assessor_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
);

-- Deliberately no DELETE policy. Nothing in the app deletes a peer assessment,
-- and a student withdrawing a rating after their group has seen it is not a
-- workflow this app supports.


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: C1 RESET — do it in the database, not from the browser
-- ══════════════════════════════════════════════════════════════════════════════
-- Fires when a group submits a revised abstract (iteration 2+). The previous
-- C1 marks belong to the version the teacher sent back, so they are cleared
-- and the teacher re-approves against the new text.
--
-- SECURITY DEFINER so it runs as the function owner: students still hold no
-- DELETE right on assessment_scores, which is what we want.

CREATE OR REPLACE FUNCTION public.reset_c1_scores_on_resubmission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_c1_category_id UUID;
BEGIN
    IF COALESCE(NEW.iteration, 1) <= 1 THEN
        RETURN NEW;
    END IF;

    SELECT id INTO v_c1_category_id
    FROM public.assessment_categories
    WHERE code = 'C1';

    IF v_c1_category_id IS NULL THEN
        RETURN NEW;
    END IF;

    DELETE FROM public.assessment_scores
    WHERE class_name    = NEW.class_name
      AND group_number  = NEW.group_number
      AND academic_year = NEW.academic_year
      AND category_id   = v_c1_category_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_c1_on_resubmission ON projects;
CREATE TRIGGER reset_c1_on_resubmission
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.reset_c1_scores_on_resubmission();


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: LOGBOOK PHOTOS — make the bucket script re-runnable
-- ══════════════════════════════════════════════════════════════════════════════
-- add_logbook_photo.sql creates four storage policies with CREATE POLICY and no
-- DROP, so a second run aborts on "policy already exists" and every statement
-- after it is skipped. The names are also generic enough to collide with
-- policies belonging to other buckets. Recreate them scoped and idempotent.

INSERT INTO storage.buckets (id, name, public)
VALUES ('logbook_photos', 'logbook_photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access"                ON storage.objects;
DROP POLICY IF EXISTS "Auth Insert"                  ON storage.objects;
DROP POLICY IF EXISTS "Auth Update"                  ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete"                  ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos public read"   ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos auth insert"   ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos auth update"   ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos auth delete"   ON storage.objects;

CREATE POLICY "logbook_photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logbook_photos');

CREATE POLICY "logbook_photos auth insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'logbook_photos');

CREATE POLICY "logbook_photos auth update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'logbook_photos')
WITH CHECK (bucket_id = 'logbook_photos');

CREATE POLICY "logbook_photos auth delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'logbook_photos');


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════
-- Expect INSERT, SELECT, SELECT, UPDATE (plus the admin ALL policy):
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename='peer_assessments' ORDER BY cmd;
--
-- Expect one row:
--   SELECT tgname FROM pg_trigger WHERE tgname = 'reset_c1_on_resubmission';
--
-- Expect four logbook_photos rows:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname='storage' AND policyname LIKE 'logbook_photos%';
