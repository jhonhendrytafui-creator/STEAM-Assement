-- ==============================================================================
-- Security Hardening — run this once in the Supabase SQL Editor
-- ==============================================================================
-- Closes the database-side findings from the September 2026 audit.
--
--   1. Makes rls_and_triggers.sql safe to re-run (its drop loop used to remove
--      policies from tables it never rebuilds)
--   2. Rebuilds the project INSERT/UPDATE policies as group-scoped, whichever
--      of the two older files is currently live
--   3. Replaces protect_project_teacher_fields() with an allow-list, so newly
--      added teacher columns are protected automatically
--   4. Scopes assessment_scores and logbooks reads to the student's own group
--   5. Locks the AI pre-check counter to the service role
--   6. Adds app_settings so the academic year is data, not a code constant
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run this AFTER sql/add_admin_role.sql.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 0: PRE-FLIGHT — what is actually live right now?
-- ══════════════════════════════════════════════════════════════════════════════
-- Run this on its own first and keep the output. If you see
-- "Students can update projects", the permissive full_schema.sql policies are
-- live and any student can currently edit any group's project.
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
END;
$$;

-- True when the signed-in user belongs to the given group in the given year.
-- SECURITY DEFINER so the lookup is not itself filtered by RLS on student_master.
CREATE OR REPLACE FUNCTION public.in_group(
    p_class_name TEXT,
    p_group_number INT,
    p_academic_year TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.student_master sm ON sm.email = p.email
        WHERE p.id = auth.uid()
          AND sm.class_name = p_class_name
          AND sm.group_number = p_group_number
          AND sm.academic_year = p_academic_year
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.in_group(TEXT, INT, TEXT) TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: PROJECTS — group-scoped writes, teacher columns protected
-- ══════════════════════════════════════════════════════════════════════════════
-- Removes the permissive versions from full_schema.sql if they are present.

DROP POLICY IF EXISTS "Authenticated users can insert projects"        ON projects;
DROP POLICY IF EXISTS "Students can update projects"                   ON projects;
DROP POLICY IF EXISTS "Students can create projects for their group"   ON projects;
DROP POLICY IF EXISTS "Students can update their group's projects"     ON projects;

CREATE POLICY "Students can create projects for their group"
ON projects FOR INSERT TO authenticated
WITH CHECK (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);

CREATE POLICY "Students can update their group's projects"
ON projects FOR UPDATE TO authenticated
USING (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
)
WITH CHECK (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);

-- ── Teacher-only columns ──────────────────────────────────────────────
-- The previous trigger listed the columns to protect, so every column added
-- afterwards (ai_plagiarism_score, c5_generated_questions_en/_id, ...) was
-- left writable by students. This version lists the columns students MAY
-- write and restores everything else from the old row, so new columns are
-- protected by default.

CREATE OR REPLACE FUNCTION public.protect_project_teacher_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_student_writable TEXT[] := ARRAY[
        'title', 'abstract', 'theme_id',
        'google_doc_url', 'presentation_url', 'additional_documents'
    ];
    v_col TEXT;
    v_new JSONB;
    v_old JSONB;
BEGIN
    IF public.is_teacher() THEN
        RETURN NEW;
    END IF;

    v_new := to_jsonb(NEW);
    v_old := to_jsonb(OLD);

    -- Start from the old row, then re-apply only the student-writable columns.
    FOR v_col IN SELECT jsonb_object_keys(v_new) LOOP
        IF NOT (v_col = ANY (v_student_writable)) THEN
            v_new := jsonb_set(v_new, ARRAY[v_col], v_old -> v_col);
        END IF;
    END LOOP;

    NEW := jsonb_populate_record(NEW, v_new);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_teacher_fields_protection ON projects;
CREATE TRIGGER project_teacher_fields_protection
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.protect_project_teacher_fields();


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: ASSESSMENT SCORES — students see only their own group
-- ══════════════════════════════════════════════════════════════════════════════
-- Previously SELECT USING (true): any student could read the whole year
-- group's marks.

DROP POLICY IF EXISTS "Authenticated can read assessment_scores" ON assessment_scores;
DROP POLICY IF EXISTS "Anyone can view assessment scores"        ON assessment_scores;
DROP POLICY IF EXISTS "Students read own group scores"           ON assessment_scores;

CREATE POLICY "Students read own group scores"
ON assessment_scores FOR SELECT TO authenticated
USING (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: LOGBOOKS — students see only their own group
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated users can read logbooks" ON logbooks;
DROP POLICY IF EXISTS "Anyone can view logbooks"              ON logbooks;
DROP POLICY IF EXISTS "Students read own group logbooks"      ON logbooks;

CREATE POLICY "Students read own group logbooks"
ON logbooks FOR SELECT TO authenticated
USING (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);

-- Students may only insert rows under their own email and their own group.
DROP POLICY IF EXISTS "Authenticated users can insert logbooks" ON logbooks;
DROP POLICY IF EXISTS "Students can add their own logbooks"     ON logbooks;

CREATE POLICY "Students can add their own logbooks"
ON logbooks FOR INSERT TO authenticated
WITH CHECK (
    public.is_teacher()
    OR (
        student_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
        AND public.in_group(class_name, group_number, academic_year)
    )
);


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: AI PRE-CHECK QUOTA — service role only
-- ══════════════════════════════════════════════════════════════════════════════
-- The counter was writable by any authenticated user, so a student could reset
-- it from the browser console. /api/precheck now counts it server-side with the
-- service role key, which bypasses RLS, so the browser needs no write access.

DROP POLICY IF EXISTS "Students can update their group's quota" ON ai_precheck_usage;
DROP POLICY IF EXISTS "Anyone can view ai_precheck_usage"       ON ai_precheck_usage;
DROP POLICY IF EXISTS "Read own group quota"                    ON ai_precheck_usage;

CREATE POLICY "Read own group quota"
ON ai_precheck_usage FOR SELECT TO authenticated
USING (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);

-- No INSERT / UPDATE / DELETE policy: only the service role can change counts.


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: APP SETTINGS — academic year as data
-- ══════════════════════════════════════════════════════════════════════════════
-- Lets the year be rolled over from the admin screen instead of editing
-- src/lib/constants.ts and redeploying.

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_by  TEXT
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings"   ON app_settings;
DROP POLICY IF EXISTS "Admins can write app_settings"  ON app_settings;

CREATE POLICY "Anyone can read app_settings"
ON app_settings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can write app_settings"
ON app_settings FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Seed with the year the code currently hardcodes. Change it here when you
-- roll over, or from Admin → Students once the UI reads this value.
INSERT INTO app_settings (key, value)
VALUES ('academic_year', '2026/2027')
ON CONFLICT (key) DO NOTHING;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: MAKE rls_and_triggers.sql SAFE TO RE-RUN
-- ══════════════════════════════════════════════════════════════════════════════
-- That file opens with a loop that drops EVERY policy in the public schema, but
-- only rebuilds policies for the original ten tables. Re-running it today would
-- silently strip the policies from peer_assessments, project_votes,
-- ai_precheck_usage, project_teacher_recommendations, admin_audit_log and
-- app_settings — RLS stays on, so those features start failing with permission
-- errors and no obvious cause.
--
-- Nothing to execute here: edit sql/rls_and_triggers.sql so its drop loop reads
--
--     WHERE schemaname = 'public'
--       AND tablename IN (
--           'profiles','teacher_emails','student_master','themes','projects',
--           'logbooks','assessment_categories','rubric_dimensions',
--           'rubric_indicators','assessment_scores'
--       )
--
-- That change ships in this commit. This note records why.


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════
-- Expect group-scoped project policies and no "Students can update projects":
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname='public' AND tablename IN
--     ('projects','assessment_scores','logbooks','ai_precheck_usage')
--   ORDER BY tablename, policyname;
--
-- Expect exactly one row, the current year:
--   SELECT * FROM app_settings WHERE key = 'academic_year';
