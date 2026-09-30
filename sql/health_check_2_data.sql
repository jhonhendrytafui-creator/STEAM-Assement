-- ============================================================================
-- HEALTH CHECK, PART 2 of 2: DATA -- read-only, changes nothing.
-- ============================================================================
-- Part 1 asks whether the objects exist. This asks whether the contents let
-- students and teachers actually work: themes per grade, who owes a profile,
-- whether classification has anyone to assign to.
--
-- Run part 1 first. If a row there says FIX, this will fail with a "column does
-- not exist" error rather than tell you anything useful.
-- ============================================================================

WITH yr AS (
    SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'academic_year'),
                    '2026/2027') AS y
),
checks AS (

SELECT 10 AS ord, 'Data' AS area, 'Active academic year' AS item,
    CASE WHEN (SELECT y FROM yr) ~ '^[0-9]{4}/[0-9]{4}$' THEN 'OK'
         ELSE 'FIX: set it in Admin -> Academic Year' END AS status,
    (SELECT y FROM yr) AS detail

UNION ALL SELECT 11, 'Data', 'Every grade on the roster has themes',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM (SELECT DISTINCT split_part(TRIM(class_name),'.',1) g
                       FROM student_master WHERE academic_year=(SELECT y FROM yr)) s
        WHERE NOT EXISTS (SELECT 1 FROM themes t
                          WHERE t.grade=s.g AND t.academic_year=(SELECT y FROM yr)))
    THEN 'OK' ELSE 'FIX: add them in Admin -> Project Themes' END,
    COALESCE((SELECT 'grades with none: ' || string_agg(s.g, ', ' ORDER BY s.g::INT)
        FROM (SELECT DISTINCT split_part(TRIM(class_name),'.',1) g
              FROM student_master WHERE academic_year=(SELECT y FROM yr)) s
        WHERE NOT EXISTS (SELECT 1 FROM themes t
                          WHERE t.grade=s.g AND t.academic_year=(SELECT y FROM yr))),
        'all grades covered')

UNION ALL SELECT 12, 'Data', 'Students on the roster this year',
    CASE WHEN (SELECT COUNT(*) FROM student_master WHERE academic_year=(SELECT y FROM yr)) > 0
    THEN 'OK' ELSE 'FIX: import them in Admin -> Students & Groups' END,
    (SELECT COUNT(*)::TEXT || ' student(s)' FROM student_master WHERE academic_year=(SELECT y FROM yr))

UNION ALL SELECT 13, 'Data', 'Teachers who still owe a profile',
    CASE WHEN (SELECT COUNT(*) FROM teacher_emails WHERE profile_completed_at IS NULL) = 0
    THEN 'OK' ELSE 'They are shown the form on next sign-in; nothing to fix' END,
    (SELECT COUNT(*)::TEXT || ' of ' || (SELECT COUNT(*) FROM teacher_emails)::TEXT
     FROM teacher_emails WHERE profile_completed_at IS NULL)

UNION ALL SELECT 14, 'Data', 'Teaching staff ready for classification',
    CASE WHEN EXISTS (SELECT 1 FROM teacher_emails
        WHERE COALESCE(teaching_role,'teaching')='teaching'
          AND COALESCE(array_length(expertise_subjects,1),0) > 0
          AND COALESCE(array_length(grade_levels,1),0) > 0)
    THEN 'OK' ELSE 'FIX: no teacher has BOTH subjects and grades; classification will refuse' END,
    (SELECT COUNT(*)::TEXT || ' teacher(s) with subjects + grades' FROM teacher_emails
     WHERE COALESCE(teaching_role,'teaching')='teaching'
       AND COALESCE(array_length(expertise_subjects,1),0) > 0
       AND COALESCE(array_length(grade_levels,1),0) > 0)

UNION ALL SELECT 15, 'Data', 'Grades with students but no teacher for them',
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM (SELECT DISTINCT split_part(TRIM(class_name),'.',1) g
                       FROM student_master WHERE academic_year=(SELECT y FROM yr)) s
        WHERE NOT EXISTS (SELECT 1 FROM teacher_emails te
            WHERE COALESCE(teaching_role,'teaching')='teaching' AND s.g = ANY(te.grade_levels)))
    THEN 'OK' ELSE 'Those grades cannot be classified until a teacher lists them' END,
    COALESCE((SELECT 'uncovered: ' || string_agg(s.g, ', ' ORDER BY s.g::INT)
        FROM (SELECT DISTINCT split_part(TRIM(class_name),'.',1) g
              FROM student_master WHERE academic_year=(SELECT y FROM yr)) s
        WHERE NOT EXISTS (SELECT 1 FROM teacher_emails te
            WHERE COALESCE(teaching_role,'teaching')='teaching' AND s.g = ANY(te.grade_levels))),
        'every grade covered')

UNION ALL SELECT 16, 'Data', 'Marks that can name their assessor',
    'FYI',
    (SELECT COUNT(*) FILTER (WHERE assessed_by_name IS NOT NULL)::TEXT || ' named, '
          || COUNT(*) FILTER (WHERE assessed_by_name IS NULL)::TEXT || ' "Not Recorded"'
     FROM assessment_scores)

UNION ALL SELECT 17, 'Data', 'Activity log entries recorded so far',
    'FYI',
    (SELECT COUNT(*)::TEXT || ' entry(ies) -- starts empty, fills as students work'
     FROM group_activity_log)
)

SELECT area, item, status, detail FROM checks ORDER BY ord;
