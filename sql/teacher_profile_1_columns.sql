-- PART 1 of 4 -- Columns. Run parts 1, 2, 3, 4 in order.
-- Safe to re-run. See sql/README.md step 15 for what all four parts do and why.
--
-- Kept under 150 lines on purpose: the Supabase SQL Editor truncates a longer
-- paste, which fails with "unterminated dollar-quoted string" naming a line
-- nowhere near where the text actually ran out.

-- teacher_emails is the source of truth: the row exists before a teacher has
-- ever logged in, and Admin -> Teacher Access already edits it.
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS grade_levels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE teacher_emails ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- profiles is the mirror the app reads, kept in step by the trigger in part 2.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grade_levels TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_e164 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN teacher_emails.grade_levels IS
    'Grades this teacher teaches, as bare numerals: {7,8}. Mirrored to profiles.';
COMMENT ON COLUMN teacher_emails.phone_e164 IS
    'WhatsApp number, digits only, country code included, no plus: 6285712345678.';
COMMENT ON COLUMN teacher_emails.profile_completed_at IS
    'When the teacher completed their own profile. NULL means the portal shows them the onboarding form instead of the dashboard.';


-- Phone shape enforced in the database as well as the browser, so a direct API
-- call cannot store something the wa.me link would break on. 62 then an
-- Indonesian mobile number, which always begins 8: 10 to 15 digits total.
--
-- Digit and length tests rather than an anchored regex, so this file holds no
-- dollar sign outside the tags below.
DO $do_phone_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'teacher_emails_phone_e164_check'
    ) THEN
        ALTER TABLE teacher_emails ADD CONSTRAINT teacher_emails_phone_e164_check
            CHECK (
                phone_e164 IS NULL
                OR (phone_e164 !~ '[^0-9]'
                    AND left(phone_e164, 3) = '628'
                    AND length(phone_e164) BETWEEN 10 AND 15)
            );
    END IF;
END
$do_phone_check$;


-- The assessor's name, stored beside the existing assessed_by reference.
-- Denormalized on purpose: RLS lets a student read only their own profiles row,
-- so the student dashboard cannot resolve assessed_by to a name.
ALTER TABLE assessment_scores ADD COLUMN IF NOT EXISTS assessed_by_name TEXT;

COMMENT ON COLUMN assessment_scores.assessed_by_name IS
    'Name of the teacher who gave this mark, captured at save time. NULL reads as "Not Recorded".';

-- Backfill from assessed_by wherever it was recorded. Marks older than that
-- column keep NULL and show "Not Recorded" -- an honest gap, not a guess.
UPDATE assessment_scores s
   SET assessed_by_name = p.full_name
  FROM profiles p
 WHERE s.assessed_by = p.id
   AND s.assessed_by_name IS NULL
   AND NULLIF(btrim(p.full_name), '') IS NOT NULL;


DO $do_part1_done$
BEGIN
    RAISE NOTICE '== PART 1 of 4 COMPLETE (columns) == now run part 2';
    RAISE NOTICE 'Marks naming their assessor: %, reading Not Recorded: %',
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NOT NULL),
        (SELECT COUNT(*) FROM assessment_scores WHERE assessed_by_name IS NULL);
END
$do_part1_done$;

-- END OF PART 1
