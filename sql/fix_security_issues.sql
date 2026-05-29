-- ==============================================================================
-- Security Fix: Supabase Database Linter Issues
-- ==============================================================================
-- Run this in Supabase SQL Editor to fix all security warnings.
-- 
-- Issue 1 (ERROR): project_leaderboard view uses SECURITY DEFINER
-- Issue 2 (WARN): 5 functions have mutable search_path
-- ==============================================================================


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 1: project_leaderboard — Remove SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════════════════════
-- The view was implicitly created with SECURITY DEFINER, meaning it bypasses
-- RLS of the querying user. Recreate it with SECURITY INVOKER (default).

DROP VIEW IF EXISTS project_leaderboard;

CREATE VIEW project_leaderboard 
WITH (security_invoker = true)
AS
SELECT 
    p.id as project_id,
    p.class_name,
    p.group_number,
    p.title,
    p.academic_year,
    t.theme_name,
    COUNT(pv.id) as vote_count
FROM projects p
LEFT JOIN project_votes pv ON p.id = pv.project_id
LEFT JOIN themes t ON p.theme_id = t.id
GROUP BY p.id, p.class_name, p.group_number, p.title, p.academic_year, t.theme_name
HAVING COUNT(pv.id) > 0;

-- Re-grant access
GRANT SELECT ON project_leaderboard TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 2: is_teacher() — Set search_path
-- ══════════════════════════════════════════════════════════════════════════════
-- This function needs SECURITY DEFINER (to bypass RLS when checking profiles),
-- but it must have a fixed search_path to prevent search_path injection attacks.

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 3: set_current_timestamp_updated_at() — Set search_path
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 4: protect_logbook_feedback() — Set search_path
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_logbook_feedback()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_teacher() THEN
        NEW.feedback = OLD.feedback;
    END IF;
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 5: protect_project_teacher_fields() — Set search_path
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_project_teacher_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_teacher() THEN
        NEW.status = OLD.status;
        NEW.teacher_comment = OLD.teacher_comment;
        NEW.c5_generated_questions = OLD.c5_generated_questions;
    END IF;
    RETURN NEW;
END;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX 6: check_max_votes() — Set search_path
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_max_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM public.project_votes WHERE teacher_id = NEW.teacher_id) >= 3 THEN
        RAISE EXCEPTION 'A teacher can only vote for up to 3 projects';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Run after applying to confirm fixes
-- ══════════════════════════════════════════════════════════════════════════════
-- Check that no security_definer views remain:
-- SELECT viewname FROM pg_views WHERE schemaname = 'public';
-- 
-- Check that all functions have search_path set:
-- SELECT proname, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace;
