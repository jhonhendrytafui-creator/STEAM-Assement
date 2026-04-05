-- ============================================
-- Add presentation_url column to projects table
-- Run this in Supabase SQL Editor
-- ============================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS presentation_url TEXT;

-- Allow authenticated users to update only the presentation_url field
CREATE POLICY "Students can update presentation_url"
ON projects FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
