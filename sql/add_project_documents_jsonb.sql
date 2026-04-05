-- ============================================
-- Update Projects Table to Support Multiple Documents
-- Run this in Supabase SQL Editor
-- ============================================

-- Add additional_documents JSONB column to support Website, Canva, Presentation links, etc.
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS additional_documents JSONB DEFAULT '[]'::jsonb;
