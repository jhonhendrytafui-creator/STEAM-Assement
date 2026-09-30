-- ============================================================================
-- HEALTH CHECK, PART 1 of 2: SCHEMA -- read-only, changes nothing.
-- ============================================================================
-- Is every object the app needs actually there?
--
-- Reads only the system catalogs, never the new tables or columns themselves,
-- so it runs on any database -- including one where a migration did not land,
-- which is exactly when you need it. Run part 2 once every row here says OK.
--
-- Read the "status" column: OK, or FIX with what to do.
-- ============================================================================

WITH col AS (
    SELECT table_name AS t, column_name AS c FROM information_schema.columns
    WHERE table_schema = 'public'
),

checks AS (

-- ── Schema: the columns each migration added ────────────────────────────────
SELECT 1 AS ord, 'Schema' AS area, 'Migration 15: teacher profile' AS item,
    CASE WHEN (SELECT COUNT(*) FROM col WHERE (t,c) IN
        (('teacher_emails','grade_levels'),('teacher_emails','phone_e164'),
         ('teacher_emails','profile_completed_at'),('profiles','grade_levels'),
         ('profiles','phone_e164'),('profiles','profile_completed_at'),
         ('assessment_scores','assessed_by_name'))) = 7
    THEN 'OK' ELSE 'FIX: re-run sql/teacher_profile_1..4' END AS status,
    '' AS detail

UNION ALL SELECT 2, 'Schema', 'Migration 16: teaching role',
    CASE WHEN (SELECT COUNT(*) FROM col WHERE c = 'teaching_role'
               AND t IN ('teacher_emails','profiles')) = 2
    THEN 'OK' ELSE 'FIX: re-run sql/teacher_role_1..3' END, ''

UNION ALL SELECT 3, 'Schema', 'Migration 17: activity log table',
    CASE WHEN to_regclass('public.group_activity_log') IS NOT NULL
    THEN 'OK' ELSE 'FIX: re-run sql/group_activity_1..3' END, ''

-- ── Functions and triggers ──────────────────────────────────────────────────
UNION ALL SELECT 4, 'Functions', 'save_teacher_profile takes 5 arguments',
    CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='save_teacher_profile' AND pronargs=5)
    THEN 'OK' ELSE 'FIX: re-run sql/teacher_role_2_save_rpc.sql' END,
    'The profile form sends 5; a 4-argument version means part 2 did not land'

UNION ALL SELECT 5, 'Functions', 'RLS helpers is_teacher / in_group / is_admin',
    CASE WHEN (SELECT COUNT(DISTINCT proname) FROM pg_proc
               WHERE proname IN ('is_teacher','in_group','is_admin')) = 3
    THEN 'OK' ELSE 'FIX: re-run sql/harden_security.sql and add_admin_role.sql' END, ''

UNION ALL SELECT 6, 'Triggers', 'Activity log: all 5 triggers',
    CASE WHEN (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN
        ('on_project_insert_log','on_project_update_log','on_logbook_insert_log',
         'on_logbook_delete_log','on_peer_assessment_log')) = 5
    THEN 'OK' ELSE 'FIX: re-run sql/group_activity_2 and _3' END,
    'Without these nothing is recorded, silently'

UNION ALL SELECT 7, 'Triggers', 'Profile sync + first login',
    CASE WHEN (SELECT COUNT(*) FROM pg_trigger WHERE tgname IN
        ('on_teacher_email_change','on_auth_user_created')) = 2
    THEN 'OK' ELSE 'FIX: re-run sql/teacher_role_1_column.sql' END, ''

-- ── Security: the activity log must stay unforgeable ────────────────────────
UNION ALL SELECT 8, 'Security', 'Activity log is append-only',
    -- No write policy is only reassuring once the table is actually there:
    -- a missing table also has no policies.
    CASE WHEN to_regclass('public.group_activity_log') IS NULL THEN 'n/a: table missing, see above'
         WHEN NOT EXISTS (SELECT 1 FROM pg_policies
             WHERE tablename='group_activity_log' AND cmd IN ('INSERT','UPDATE','DELETE','ALL'))
         THEN 'OK'
         ELSE 'FIX: a write policy exists on group_activity_log; entries could be forged' END,
    'There should be exactly one policy, for SELECT'

UNION ALL SELECT 9, 'Security', 'Activity log RLS enabled',
    CASE WHEN EXISTS (SELECT 1 FROM pg_class WHERE relname='group_activity_log' AND relrowsecurity)
    THEN 'OK' ELSE 'FIX: ALTER TABLE group_activity_log ENABLE ROW LEVEL SECURITY' END, ''
)

SELECT area, item, status, detail FROM checks ORDER BY ord;
