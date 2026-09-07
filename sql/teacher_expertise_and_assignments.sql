-- ==============================================================================
-- Teacher subject expertise, and project assignment
-- ==============================================================================
-- Two things this adds:
--
--   1. Expertise an admin can actually edit. It lived only on profiles, which
--      is created by the signup trigger, so a teacher who had never logged in
--      had nowhere to put it — and no screen wrote to it at all. Classification
--      failed with "No teachers have their subject expertise configured" and
--      there was no way to fix that from inside the app. It moves to
--      teacher_emails, the list admins already manage, and syncs down to
--      profiles so existing readers keep working.
--
--      It also becomes a list of subject ids from src/lib/subjects.ts rather
--      than free text, so the classifier matches on ids instead of guessing
--      whether "Math" and "Mathematics" are the same thing. The old free-text
--      column is kept and migrated, not dropped.
--
--   2. project_assignments — the decision, one row per project. The existing
--      project_teacher_recommendations table holds the AI's ranked shortlist;
--      this holds what was actually chosen, in either mode.
--
-- SAFE TO RE-RUN. Every statement is idempotent.
-- Run this AFTER sql/harden_links_and_storage.sql.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: EXPERTISE AS ADMIN-OWNED DATA
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS expertise_subjects TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expertise TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expertise_subjects TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN teacher_emails.expertise_subjects IS
    'Subject ids from src/lib/subjects.ts. Set by an admin; mirrored to profiles.';


-- ── Carry over anything already typed into the old free-text column ──────────
-- add_project_classification.sql seeded profiles.expertise with random words
-- like 'Math' or 'Food'. Map the ones that correspond to a real subject id and
-- leave the rest alone rather than guessing.

DO $$
DECLARE
    v_map JSONB := '{
        "math": "calculus_linear",
        "mathematics": "calculus_linear",
        "biology": "biology_marine",
        "physics": "physics",
        "chemistry": "chemistry",
        "computer": "cs_programming",
        "computer science": "cs_programming",
        "music": "performing_arts",
        "product design": "industrial_product",
        "visual arts": "visual_design",
        "language": "creative_language",
        "business": "financial_mathematics",
        "robotics": "robotics"
    }'::JSONB;
    r RECORD;
    v_id TEXT;
BEGIN
    FOR r IN
        SELECT p.email, p.expertise
        FROM public.profiles p
        WHERE p.role = 'teacher'
          AND p.expertise IS NOT NULL
          AND btrim(p.expertise) <> ''
          AND COALESCE(array_length(p.expertise_subjects, 1), 0) = 0
    LOOP
        v_id := v_map ->> lower(btrim(r.expertise));
        IF v_id IS NOT NULL THEN
            UPDATE public.profiles
               SET expertise_subjects = ARRAY[v_id]
             WHERE email = r.email;
            UPDATE public.teacher_emails
               SET expertise_subjects = ARRAY[v_id]
             WHERE email = r.email
               AND COALESCE(array_length(expertise_subjects, 1), 0) = 0;
        END IF;
    END LOOP;
END $$;


-- ── Keep profiles in step with the admin list ───────────────────────────────
-- Extends the existing sync trigger rather than adding a second one.

CREATE OR REPLACE FUNCTION public.sync_teacher_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET role               = 'teacher',
        is_admin           = NEW.is_admin,
        expertise_subjects = NEW.expertise_subjects,
        full_name          = COALESCE(NEW.full_name, profiles.full_name)
    WHERE profiles.email = NEW.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();


-- ── And pick it up when the teacher first signs in ──────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_teacher BOOLEAN := FALSE;
    v_is_admin   BOOLEAN := FALSE;
    v_subjects   TEXT[]  := '{}';
    v_full_name  TEXT;
BEGIN
    SELECT TRUE,
           COALESCE(te.is_admin, FALSE),
           COALESCE(te.expertise_subjects, '{}'),
           te.full_name
      INTO v_is_teacher, v_is_admin, v_subjects, v_full_name
      FROM public.teacher_emails te
     WHERE te.email = NEW.email;

    INSERT INTO public.profiles (id, email, role, is_admin, expertise_subjects, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN COALESCE(v_is_teacher, FALSE) THEN 'teacher' ELSE 'student' END,
        COALESCE(v_is_admin, FALSE),
        COALESCE(v_subjects, '{}'),
        v_full_name
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: THE ASSIGNMENT ITSELF
-- ══════════════════════════════════════════════════════════════════════════════
-- One row per project. mode records which question was asked:
--   'teacher' — this group is guided by this teacher
--   'subject' — this project belongs to this subject, whoever teaches it

CREATE TABLE IF NOT EXISTS project_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mode           TEXT NOT NULL CHECK (mode IN ('teacher', 'subject')),
    teacher_email  TEXT,
    teacher_name   TEXT,
    subject_id     TEXT,
    relevance      INT  NOT NULL DEFAULT 0,
    -- 'expertise' exact subject, 'discipline' same STEAM letter, 'balance' load only
    basis          TEXT,
    reason         TEXT,
    assigned_by    TEXT,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS project_assignments_teacher_idx
    ON project_assignments (teacher_email);

ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers read all assignments"      ON project_assignments;
DROP POLICY IF EXISTS "Students read own group assignment" ON project_assignments;
DROP POLICY IF EXISTS "Teachers manage assignments"        ON project_assignments;

CREATE POLICY "Teachers read all assignments"
ON project_assignments FOR SELECT TO authenticated
USING (public.is_teacher());

-- A group can see who is guiding them, which is the point of assigning.
CREATE POLICY "Students read own group assignment"
ON project_assignments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects pr
        WHERE pr.id = project_assignments.project_id
          AND public.in_group(pr.class_name, pr.group_number, pr.academic_year)
    )
);

CREATE POLICY "Teachers manage assignments"
ON project_assignments FOR ALL TO authenticated
USING (public.is_teacher())
WITH CHECK (public.is_teacher());


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: TIGHTEN THE RECOMMENDATION TABLE WHILE WE ARE HERE
-- ══════════════════════════════════════════════════════════════════════════════
-- add_project_classification.sql let any authenticated user — every student —
-- insert, update and delete rows in project_teacher_recommendations.

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON project_teacher_recommendations;
DROP POLICY IF EXISTS "Enable insert for authenticated users"          ON project_teacher_recommendations;
DROP POLICY IF EXISTS "Enable delete for authenticated users"          ON project_teacher_recommendations;
DROP POLICY IF EXISTS "Enable update for authenticated users"          ON project_teacher_recommendations;
DROP POLICY IF EXISTS "Teachers read recommendations"                  ON project_teacher_recommendations;
DROP POLICY IF EXISTS "Teachers manage recommendations"                ON project_teacher_recommendations;

CREATE POLICY "Teachers read recommendations"
ON project_teacher_recommendations FOR SELECT TO authenticated
USING (public.is_teacher());

CREATE POLICY "Teachers manage recommendations"
ON project_teacher_recommendations FOR ALL TO authenticated
USING (public.is_teacher())
WITH CHECK (public.is_teacher());


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════
-- Who still has no subjects set (these are the ones to fill in on the Access tab):
--   SELECT email, expertise_subjects FROM teacher_emails
--   WHERE COALESCE(array_length(expertise_subjects, 1), 0) = 0;
--
-- Expect the columns to exist:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'teacher_emails' ORDER BY column_name;
--
-- Expect three policies, all teacher-gated:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'project_assignments' ORDER BY policyname;
