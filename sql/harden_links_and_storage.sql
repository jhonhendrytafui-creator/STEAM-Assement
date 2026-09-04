-- ==============================================================================
-- FIX: unchecked links, and photos anyone could delete
-- ==============================================================================
-- Two holes left over from the audit:
--
--   1. Students write projects.google_doc_url, projects.presentation_url, every
--      url inside projects.additional_documents, and logbooks.photo_url. The
--      only validation was startsWith('http') in the browser, which anyone can
--      skip by calling Supabase directly — the RLS policies permit the write.
--      Teachers click those links from the assessment and submissions screens.
--
--   2. The logbook_photos policies allowed any signed-in user to delete or
--      overwrite any object in the bucket, including another group's photos.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run this AFTER sql/fix_silent_rls_failures.sql.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: LINK VALIDATION
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_safe_link(p_url TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
    -- Empty is fine — these columns are all optional. Anything present has to
    -- be an absolute http(s) address, which rules out javascript:, data:,
    -- file: and friends.
    SELECT p_url IS NULL
        OR btrim(p_url) = ''
        OR btrim(p_url) ~* '^https?://[^[:space:]<>"'']+$';
$$;

CREATE OR REPLACE FUNCTION public.validate_project_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_doc JSONB;
BEGIN
    IF NOT public.is_safe_link(NEW.google_doc_url) THEN
        RAISE EXCEPTION 'The project document link must start with http:// or https://';
    END IF;

    IF NOT public.is_safe_link(NEW.presentation_url) THEN
        RAISE EXCEPTION 'The presentation link must start with http:// or https://';
    END IF;

    IF NEW.additional_documents IS NOT NULL
       AND jsonb_typeof(NEW.additional_documents) = 'array' THEN
        FOR v_doc IN SELECT * FROM jsonb_array_elements(NEW.additional_documents) LOOP
            IF NOT public.is_safe_link(v_doc ->> 'url') THEN
                RAISE EXCEPTION 'Each document link must start with http:// or https:// (got "%")',
                    left(COALESCE(v_doc ->> 'url', ''), 60);
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- Named so it sorts AFTER project_teacher_fields_protection: Postgres fires
-- BEFORE ROW triggers in name order, and this must see the row that trigger
-- settled on, not the one the browser sent.
DROP TRIGGER IF EXISTS validate_project_links ON projects;
CREATE TRIGGER validate_project_links
    BEFORE INSERT OR UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.validate_project_links();


CREATE OR REPLACE FUNCTION public.validate_logbook_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_safe_link(NEW.photo_url) THEN
        RAISE EXCEPTION 'The photo link must start with http:// or https://';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_logbook_links ON logbooks;
CREATE TRIGGER validate_logbook_links
    BEFORE INSERT OR UPDATE ON logbooks
    FOR EACH ROW EXECUTE FUNCTION public.validate_logbook_links();


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: LOGBOOK PHOTOS — only your own group's folder
-- ══════════════════════════════════════════════════════════════════════════════
-- Object keys are built by the student dashboard as
--     <year>/<class>/Group_<n>/<file>
-- with the year's slash swapped for a hyphen and spaces in the class name
-- swapped for underscores. This reverses that to check the caller belongs to
-- the group whose folder they are writing to.

CREATE OR REPLACE FUNCTION public.owns_logbook_photo(p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_parts TEXT[];
    v_year  TEXT;
    v_class TEXT;
    v_group INT;
BEGIN
    v_parts := storage.foldername(p_name);
    IF v_parts IS NULL OR array_length(v_parts, 1) < 3 THEN
        RETURN FALSE;
    END IF;

    v_year  := replace(v_parts[1], '-', '/');
    v_class := v_parts[2];

    BEGIN
        v_group := replace(v_parts[3], 'Group_', '')::INT;
    EXCEPTION WHEN others THEN
        RETURN FALSE;
    END;

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.student_master sm ON sm.email = p.email
        WHERE p.id = auth.uid()
          AND replace(sm.class_name, ' ', '_') = v_class
          AND sm.group_number = v_group
          AND sm.academic_year = v_year
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owns_logbook_photo(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_safe_link(TEXT) TO authenticated;

DROP POLICY IF EXISTS "logbook_photos auth insert" ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos auth update" ON storage.objects;
DROP POLICY IF EXISTS "logbook_photos auth delete" ON storage.objects;

-- Reading stays open: the bucket is public and the app renders the URLs
-- directly in <img> tags, which carry no session.
CREATE POLICY "logbook_photos auth insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'logbook_photos'
    AND (public.is_teacher() OR public.owns_logbook_photo(name))
);

CREATE POLICY "logbook_photos auth update"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'logbook_photos'
    AND (public.is_teacher() OR public.owns_logbook_photo(name))
)
WITH CHECK (
    bucket_id = 'logbook_photos'
    AND (public.is_teacher() OR public.owns_logbook_photo(name))
);

CREATE POLICY "logbook_photos auth delete"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'logbook_photos'
    AND (public.is_teacher() OR public.owns_logbook_photo(name))
);


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════
-- Expect true, true, false, false:
--   SELECT public.is_safe_link('https://docs.google.com/x'),
--          public.is_safe_link(NULL),
--          public.is_safe_link('javascript:alert(1)'),
--          public.is_safe_link('data:text/html,<script>');
--
-- Expect two rows:
--   SELECT tgname FROM pg_trigger
--   WHERE tgname IN ('validate_project_links', 'validate_logbook_links');
--
-- Expect four logbook_photos rows, three of them scoped:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'storage' AND policyname LIKE 'logbook_photos%';
