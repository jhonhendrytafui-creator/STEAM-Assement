-- ==============================================================================
-- Admin Role — give selected teacher emails extra management powers
-- ==============================================================================
-- Run this once in the Supabase SQL Editor.
--
-- What it adds:
--   1. profiles.is_admin        — the flag the app reads to show the Admin menu
--   2. teacher_emails.is_admin  — whitelist flag, so admin can be granted
--                                 BEFORE a teacher ever logs in
--   3. public.is_admin()        — helper used by RLS policies
--   4. admin_audit_log          — a record of every destructive admin action
--   5. RLS policies so admins can manage students, groups, teacher access,
--      projects and assessment data
--
-- IMPORTANT — set your first admin at the bottom of this file (Section 7).
-- Without that step nobody has the Admin menu.
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: COLUMNS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles       ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_admin IS
    'Teacher with platform admin rights: manage students, groups, teacher access and project data.';
COMMENT ON COLUMN teacher_emails.is_admin IS
    'Grants admin on first login. Kept in sync with profiles.is_admin by sync_teacher_admin_flag().';


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: HELPER FUNCTION
-- ══════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER so the check itself is not blocked by RLS on profiles.
-- Fixed search_path to avoid search_path injection (same pattern as is_teacher()).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'teacher'
          AND is_admin = TRUE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: KEEP profiles.is_admin IN SYNC WITH THE WHITELIST
-- ══════════════════════════════════════════════════════════════════════════════
-- When an admin flips the admin flag on teacher_emails, apply it immediately to
-- the matching profile (if that teacher has already logged in at least once).

CREATE OR REPLACE FUNCTION public.sync_teacher_admin_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.profiles
    SET role = 'teacher',
        is_admin = NEW.is_admin
    WHERE email = NEW.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_teacher_email_change ON teacher_emails;
CREATE TRIGGER on_teacher_email_change
    AFTER INSERT OR UPDATE ON teacher_emails
    FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_admin_flag();

-- Signup trigger: pick up both the teacher role and the admin flag.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_teacher BOOLEAN;
    v_is_admin   BOOLEAN;
BEGIN
    SELECT TRUE, COALESCE(te.is_admin, FALSE)
    INTO v_is_teacher, v_is_admin
    FROM public.teacher_emails te
    WHERE te.email = NEW.email;

    INSERT INTO public.profiles (id, email, role, is_admin)
    VALUES (
        NEW.id,
        NEW.email,
        CASE WHEN COALESCE(v_is_teacher, FALSE) THEN 'teacher' ELSE 'student' END,
        COALESCE(v_is_admin, FALSE)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: AUDIT LOG
-- ══════════════════════════════════════════════════════════════════════════════
-- Destructive admin actions (deleting students, wiping a group's projects,
-- revoking teacher access) are recorded here so they can be traced later.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_email   TEXT NOT NULL,
    action        TEXT NOT NULL,   -- e.g. 'student.delete', 'project.reset_group'
    target        TEXT,            -- human readable target, e.g. '10.2 / Group 3'
    details       JSONB DEFAULT '{}'::jsonb,
    academic_year TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON admin_audit_log (created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read admin_audit_log"   ON admin_audit_log;
DROP POLICY IF EXISTS "Admins can insert admin_audit_log" ON admin_audit_log;

CREATE POLICY "Admins can read admin_audit_log"
ON admin_audit_log FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can insert admin_audit_log"
ON admin_audit_log FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- The log is append-only: no UPDATE or DELETE policy exists, so not even an
-- admin can quietly rewrite history.


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: ADMIN RLS POLICIES
-- ══════════════════════════════════════════════════════════════════════════════
-- These grant admins full management rights. Existing teacher policies stay in
-- place, so nothing a teacher can do today breaks. To make "admin" a real
-- security boundary rather than only a UI gate, also run Section 6.

-- 5.1 profiles — admins may read every profile and adjust the admin flag
DROP POLICY IF EXISTS "Admins can read all profiles"   ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can read all profiles"
ON profiles FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
ON profiles FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5.2 teacher_emails — admins control who gets teacher/admin access
DROP POLICY IF EXISTS "Admins can manage teacher_emails" ON teacher_emails;
CREATE POLICY "Admins can manage teacher_emails"
ON teacher_emails FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5.3 student_master — admins manage the student roster and group assignments
DROP POLICY IF EXISTS "Admins can manage student_master" ON student_master;
CREATE POLICY "Admins can manage student_master"
ON student_master FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5.4 projects — admins may delete submissions so a group can start fresh
DROP POLICY IF EXISTS "Admins can manage projects" ON projects;
CREATE POLICY "Admins can manage projects"
ON projects FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5.5 assessment_scores / logbooks / themes — admins can clean these up too
DROP POLICY IF EXISTS "Admins can manage assessment_scores" ON assessment_scores;
CREATE POLICY "Admins can manage assessment_scores"
ON assessment_scores FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage logbooks" ON logbooks;
CREATE POLICY "Admins can manage logbooks"
ON logbooks FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage themes" ON themes;
CREATE POLICY "Admins can manage themes"
ON themes FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5.6 peer_assessments / ai_precheck_usage — needed for a full group reset
DO $$
BEGIN
    IF to_regclass('public.peer_assessments') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage peer_assessments" ON peer_assessments';
        EXECUTE 'CREATE POLICY "Admins can manage peer_assessments"
                 ON peer_assessments FOR ALL TO authenticated
                 USING (public.is_admin()) WITH CHECK (public.is_admin())';
    END IF;

    IF to_regclass('public.ai_precheck_usage') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage ai_precheck_usage" ON ai_precheck_usage';
        EXECUTE 'CREATE POLICY "Admins can manage ai_precheck_usage"
                 ON ai_precheck_usage FOR ALL TO authenticated
                 USING (public.is_admin()) WITH CHECK (public.is_admin())';
    END IF;

    IF to_regclass('public.project_votes') IS NOT NULL THEN
        EXECUTE 'DROP POLICY IF EXISTS "Admins can manage project_votes" ON project_votes';
        EXECUTE 'CREATE POLICY "Admins can manage project_votes"
                 ON project_votes FOR ALL TO authenticated
                 USING (public.is_admin()) WITH CHECK (public.is_admin())';
    END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6 (OPTIONAL): MAKE ADMIN A REAL BOUNDARY
-- ══════════════════════════════════════════════════════════════════════════════
-- Today EVERY teacher already has "FOR ALL" rights on student_master,
-- teacher_emails and projects, so hiding the Admin menu is a UI-level gate
-- only: a non-admin teacher could still call the API directly.
--
-- Uncomment this section to downgrade ordinary teachers to read-only on those
-- three tables and leave writes to admins. Do this only after you have set at
-- least one admin in Section 7 and confirmed you can log in as them, otherwise
-- nobody will be able to edit the roster.
--
-- Note: teachers keep full rights on projects.status / teacher_comment so they
-- can still approve, request revisions and grade.

-- DROP POLICY IF EXISTS "Teachers can manage student_master"  ON student_master;
-- DROP POLICY IF EXISTS "Teachers can manage teacher_emails"  ON teacher_emails;
--
-- -- Teachers keep approve/comment rights on projects, but not delete.
-- DROP POLICY IF EXISTS "Teachers can manage projects" ON projects;
-- CREATE POLICY "Teachers can update projects"
-- ON projects FOR UPDATE TO authenticated
-- USING (public.is_teacher())
-- WITH CHECK (public.is_teacher());


-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: SET YOUR FIRST ADMIN  ← EDIT THIS
-- ══════════════════════════════════════════════════════════════════════════════
-- Replace the email below with the teacher who should be the first admin.
-- Add more rows for more admins. Emails must be @sekolah.pahoa.sch.id, since
-- that is the only domain the login flow accepts.
--
-- Once one admin exists they can grant/revoke admin for everyone else from
-- Admin → Teacher Access, so you should not need to run SQL again.

INSERT INTO teacher_emails (email, is_admin)
VALUES ('CHANGE_ME@sekolah.pahoa.sch.id', TRUE)
ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;

-- The trigger in Section 3 applies this to the profile automatically if the
-- teacher has already logged in. This statement covers the case where the
-- trigger was not yet installed when they signed up.
UPDATE profiles
SET role = 'teacher', is_admin = TRUE
WHERE email IN (SELECT email FROM teacher_emails WHERE is_admin = TRUE);


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════
-- SELECT email, role, is_admin FROM profiles WHERE is_admin = TRUE;
-- SELECT email, is_admin FROM teacher_emails ORDER BY is_admin DESC, email;
