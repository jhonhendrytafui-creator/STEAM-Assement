-- ================================================================
-- Repair: themes missing for the current academic year
-- ================================================================
-- Symptom this fixes
--   A grade 7 student reported being unable to pick a theme on Project
--   Submission. The dropdown had nothing in it, and because handleSubmit
--   refuses a submission with no theme_id, every group in that grade was
--   blocked from submitting a project at all. Grades 10-12 were unaffected,
--   which is what made it look like a grade 7 problem.
--
-- Why it happened
--   The app reads themes WHERE grade = <student's grade> AND academic_year =
--   ACADEMIC_YEAR, and ACADEMIC_YEAR is '2026/2027' (src/lib/constants.ts).
--
--   full_schema.sql seeds themes for '2025/2026' only, so it contributes
--   nothing to the current year. The current year's themes come from two
--   scripts that were never listed in sql/README.md's run order:
--
--     seed_themes_2026_2027.sql        grades 7-12
--     override_themes_grade_10_11_12.sql   grades 10, 11, 12 only
--
--   Run the override without the base seed and grades 10-12 get themes while
--   7, 8 and 9 get none. That matches the report exactly.
--
-- What this script does
--   Fills in the current year's themes for any grade that has none, and leaves
--   every grade that already has themes completely alone — so the grade 10-12
--   override themes are preserved, and re-running this is a no-op. Safe to run
--   on production, and safe to run repeatedly.
--
--   It is written per-grade rather than as one statement so that a partially
--   seeded database is repaired grade by grade.
-- ================================================================


-- ─────────────────────────────────────────────────────────────
-- 1. Stop duplicates being possible at all
-- ─────────────────────────────────────────────────────────────
-- themes had no uniqueness constraint, so any re-run of a seed script silently
-- doubled the dropdown. Added here rather than in the seeds because this is the
-- script that is meant to be re-run.
--
-- If duplicates already exist the index cannot be created; the script reports
-- that and carries on rather than aborting, so the seeding below still happens.
DO $$
BEGIN
    BEGIN
        CREATE UNIQUE INDEX IF NOT EXISTS themes_name_grade_year_key
            ON themes (theme_name, grade, academic_year);
    EXCEPTION WHEN unique_violation THEN
        RAISE WARNING
            'themes already contains duplicate (theme_name, grade, academic_year) rows; '
            'unique index not created. Run the duplicate report at the end of this file.';
    END;
END $$;


-- ─────────────────────────────────────────────────────────────
-- 2. Seed the current year, per grade, only where it is empty
-- ─────────────────────────────────────────────────────────────

-- Grade 7
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '7', '2026/2027'
FROM (VALUES
    ('Clean Water & Sanitation'),
    ('Healthy Living & Nutrition'),
    ('Simple Machines & Daily Life'),
    ('Weather & Climate Awareness'),
    ('Waste Reduction at School'),
    ('Plants & Urban Gardening')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '7' AND academic_year = '2026/2027'
);

-- Grade 8
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '8', '2026/2027'
FROM (VALUES
    ('Sustainable Transportation'),
    ('Ocean & Marine Conservation'),
    ('Smart Agriculture'),
    ('Disaster Preparedness'),
    ('Energy Efficiency at Home'),
    ('Biodiversity & Habitat Protection')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '8' AND academic_year = '2026/2027'
);

-- Grade 9
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '9', '2026/2027'
FROM (VALUES
    ('Space Exploration & Astronomy'),
    ('Artificial Intelligence & Ethics'),
    ('Biomedical Engineering'),
    ('Sustainable Fashion'),
    ('Robotics & Automation'),
    ('Smart City Design')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '9' AND academic_year = '2026/2027'
);

-- Grade 10 — the override_themes_grade_10_11_12.sql set.
-- Skipped entirely if that script has already run.
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '10', '2026/2027'
FROM (VALUES
    ('Sustainable Environment'),
    ('Green Innovation'),
    ('Smart Environment'),
    ('Living in Harmony with Nature')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '10' AND academic_year = '2026/2027'
);

-- Grade 11
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '11', '2026/2027'
FROM (VALUES
    ('Smart Agriculture & Food Security'),
    ('Future sustainable food'),
    ('Zero Food Waste'),
    ('Sustainable Culinary Innovation')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '11' AND academic_year = '2026/2027'
);

-- Grade 12
INSERT INTO themes (theme_name, grade, academic_year)
SELECT theme_name, '12', '2026/2027'
FROM (VALUES
    ('AI for sustainable future'),
    ('Digital Transformation'),
    ('Creating a Smart Digital Society'),
    ('Technology for humanity'),
    ('Future smart business')
) AS t(theme_name)
WHERE NOT EXISTS (
    SELECT 1 FROM themes WHERE grade = '12' AND academic_year = '2026/2027'
);


-- ─────────────────────────────────────────────────────────────
-- 3. Verify — every grade on the roster should now have themes
-- ─────────────────────────────────────────────────────────────
-- Derives the grades actually in use from student_master rather than assuming
-- 7-12, so a school running different grades sees the truth. Any row with
-- theme_count = 0 is still a grade that cannot submit.
--
--   SELECT g.grade, COUNT(t.id) AS theme_count
--   FROM (
--       SELECT DISTINCT split_part(TRIM(class_name), '.', 1) AS grade
--       FROM student_master
--       WHERE academic_year = '2026/2027'
--   ) g
--   LEFT JOIN themes t
--          ON t.grade = g.grade
--         AND t.academic_year = '2026/2027'
--   GROUP BY g.grade
--   ORDER BY g.grade::INT;

-- If the unique index above warned, this lists what to clean up first:
--
--   SELECT theme_name, grade, academic_year, COUNT(*) AS copies
--   FROM themes
--   GROUP BY theme_name, grade, academic_year
--   HAVING COUNT(*) > 1
--   ORDER BY grade, theme_name;

-- Note on class naming: the verify query trims but does not otherwise normalize
-- class_name. A roster row stored as '07.1' derives grade '07' and matches no
-- theme row. The app now normalizes this (src/lib/grade.ts), but the roster
-- itself is worth correcting so the two agree:
--
--   SELECT DISTINCT class_name
--   FROM student_master
--   WHERE academic_year = '2026/2027'
--     AND class_name <> TRIM(class_name)
--          OR class_name ~ '^0';
