-- Add per-language columns for C5 generated questions
ALTER TABLE projects ADD COLUMN IF NOT EXISTS c5_generated_questions_en TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS c5_generated_questions_id TEXT;

-- Backfill: treat existing data as English
UPDATE projects
SET c5_generated_questions_en = c5_generated_questions
WHERE c5_generated_questions IS NOT NULL AND c5_generated_questions_en IS NULL;
