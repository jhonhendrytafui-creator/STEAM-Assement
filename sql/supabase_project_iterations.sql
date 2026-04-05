-- ============================================
-- Project Iteration & History Support
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop the existing unique constraint that forced 1 project per group
ALTER TABLE projects
DROP CONSTRAINT IF EXISTS projects_class_name_group_number_academic_year_key;

-- 2. Add the iteration tracker column (defaults to 1 for existing data)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS iteration INT DEFAULT 1;

-- 3. Add the teacher comment column to store feedback on this specific iteration
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS teacher_comment TEXT;

-- 4. Create a new unique constraint so a group can only have ONE OF EACH iteration number per year
ALTER TABLE projects
ADD CONSTRAINT projects_group_iteration_key UNIQUE NULLS NOT DISTINCT (class_name, group_number, academic_year, iteration);
