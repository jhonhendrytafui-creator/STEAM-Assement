-- PART 1 of 3 -- The group activity log table. Run parts 1, 2, 3 in order.
-- Safe to re-run.
--
-- Every member of a group can submit the project, add logbook entries and
-- change the document links, and nothing recorded which of them did what. This
-- is that record: one row per action, visible to the whole group and to
-- teachers.
--
-- Written by database triggers (parts 2 and 3), not by the browser:
--   * a trigger cannot be forgotten at a new write site, or skipped by a client;
--   * there is no INSERT policy below, so nobody can forge an entry -- the
--     trigger functions are SECURITY DEFINER and bypass RLS;
--   * no UPDATE or DELETE policy either, so the log is append-only and nobody
--     can quietly erase their own inactivity.

CREATE TABLE IF NOT EXISTS group_activity_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name    TEXT NOT NULL,
    group_number  INT  NOT NULL,
    academic_year TEXT NOT NULL,
    -- Snapshotted, not joined: a student can be moved to another group, and
    -- what they did here should not move or vanish with them.
    actor_email   TEXT,
    actor_name    TEXT,
    actor_role    TEXT NOT NULL DEFAULT 'student',
    action        TEXT NOT NULL,   -- machine key, e.g. 'project.submitted'
    summary       TEXT NOT NULL,   -- one human sentence, built at write time
    details       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE group_activity_log IS
    'Append-only record of what each group member did. Written by triggers only; no INSERT/UPDATE/DELETE policy exists, so it cannot be forged or erased from the app.';

-- One group newest-first is what both dashboards ask for; the second index is
-- for the teacher reading a whole year.
CREATE INDEX IF NOT EXISTS group_activity_log_group_idx
    ON group_activity_log (class_name, group_number, academic_year, created_at DESC);
CREATE INDEX IF NOT EXISTS group_activity_log_year_idx
    ON group_activity_log (academic_year, created_at DESC);

ALTER TABLE group_activity_log ENABLE ROW LEVEL SECURITY;

-- Read only, and deliberately no INSERT/UPDATE/DELETE policy (see the top).
DROP POLICY IF EXISTS "Group members and teachers read activity" ON group_activity_log;
CREATE POLICY "Group members and teachers read activity"
ON group_activity_log FOR SELECT TO authenticated
USING (
    public.is_teacher()
    OR public.in_group(class_name, group_number, academic_year)
);


-- Who is acting, resolved once so every trigger reports it the same way.
-- SECURITY DEFINER so the lookups are not themselves filtered by RLS, the same
-- pattern as is_teacher() and in_group(). A student's name comes from
-- student_master for that year, a teacher's from profiles; email is the
-- fallback so a row is never blank.
CREATE OR REPLACE FUNCTION public.activity_actor(p_academic_year TEXT)
RETURNS TABLE (email TEXT, name TEXT, actor_role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_activity_actor$
DECLARE
    v_email TEXT;
    v_role  TEXT;
    v_name  TEXT;
BEGIN
    SELECT p.email, p.role INTO v_email, v_role
      FROM public.profiles p
     WHERE p.id = auth.uid();

    IF v_email IS NULL THEN
        RETURN QUERY SELECT NULL::TEXT, 'System'::TEXT, 'system'::TEXT;  -- service role
        RETURN;
    END IF;

    IF v_role = 'teacher' THEN
        SELECT NULLIF(btrim(p.full_name), '') INTO v_name
          FROM public.profiles p WHERE p.email = v_email;
        RETURN QUERY SELECT v_email, COALESCE(v_name, v_email), 'teacher'::TEXT;
        RETURN;
    END IF;

    SELECT NULLIF(btrim(sm.full_name), '') INTO v_name
      FROM public.student_master sm
     WHERE sm.email = v_email
       AND sm.academic_year = p_academic_year;

    RETURN QUERY SELECT v_email, COALESCE(v_name, v_email), 'student'::TEXT;
END
$fn_activity_actor$;

GRANT EXECUTE ON FUNCTION public.activity_actor(TEXT) TO authenticated;


-- One place that writes a row, so every trigger agrees on the shape.
CREATE OR REPLACE FUNCTION public.log_group_activity(
    p_class_name    TEXT,
    p_group_number  INT,
    p_academic_year TEXT,
    p_action        TEXT,
    p_summary       TEXT,
    p_details       JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn_log_group_activity$
DECLARE
    a RECORD;
BEGIN
    SELECT * INTO a FROM public.activity_actor(p_academic_year);

    INSERT INTO public.group_activity_log (
        class_name, group_number, academic_year,
        actor_email, actor_name, actor_role, action, summary, details
    )
    VALUES (
        p_class_name, p_group_number, p_academic_year,
        a.email, a.name, a.actor_role, p_action, p_summary, COALESCE(p_details, '{}'::jsonb)
    );
END
$fn_log_group_activity$;


DO $do_part1_done$
BEGIN
    RAISE NOTICE '== PART 1 of 3 COMPLETE (activity log table) == now run part 2';
END
$do_part1_done$;

-- END OF PART 1
