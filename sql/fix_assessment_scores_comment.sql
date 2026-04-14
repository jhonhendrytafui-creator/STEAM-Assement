-- Fix missing 'teacher_comment' column in 'assessment_scores' table
-- Run this in your Supabase SQL Editor

ALTER TABLE assessment_scores ADD COLUMN IF NOT EXISTS teacher_comment TEXT;

-- Notify PostgREST to reload the schema cache so the API recognizes the new column immediately
NOTIFY pgrst, 'reload schema';
