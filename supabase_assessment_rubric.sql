-- ============================================
-- STEAM Assessment — Rubric-Based Assessment Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ⚠️ Drop old simple assessment tables first
DROP TABLE IF EXISTS group_scores CASCADE;
DROP TABLE IF EXISTS assessment_categories CASCADE;

-- ============================================
-- 1. Assessment Categories (the 8 assessments)
-- ============================================
CREATE TABLE assessment_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,                 -- 'C1', 'C2', 'BCM', 'ENG', etc.
    name TEXT NOT NULL,                        -- 'Abstract Approval', 'Presentation', etc.
    rubric_type TEXT NOT NULL DEFAULT 'scale_4', -- 'checklist', 'scale_3', 'scale_4', 'scale_5'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Rubric Dimensions (groups of indicators)
-- ============================================
CREATE TABLE rubric_dimensions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                        -- e.g., 'Critical Thinking', 'Collaboration'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Rubric Indicators (individual criteria)
-- ============================================
CREATE TABLE rubric_indicators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dimension_id UUID NOT NULL REFERENCES rubric_dimensions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,                 -- The indicator text
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Assessment Scores (per-indicator per-group)
-- ============================================
CREATE TABLE assessment_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    category_id UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES rubric_indicators(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,              -- 0-1 for checklist, 1-3/4/5 for scales
    assessed_by UUID REFERENCES profiles(id),
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year, indicator_id)
);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;

-- ============================================
-- READ policies — all authenticated users can read
-- ============================================
CREATE POLICY "Authenticated can read assessment_categories"
ON assessment_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read rubric_dimensions"
ON rubric_dimensions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read rubric_indicators"
ON rubric_indicators FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can read assessment_scores"
ON assessment_scores FOR SELECT TO authenticated USING (true);

-- ============================================
-- WRITE policies — only teachers can manage
-- ============================================
CREATE POLICY "Teachers can manage assessment_categories"
ON assessment_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

CREATE POLICY "Teachers can manage rubric_dimensions"
ON rubric_dimensions FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

CREATE POLICY "Teachers can manage rubric_indicators"
ON rubric_indicators FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

CREATE POLICY "Teachers can manage assessment_scores"
ON assessment_scores FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ============================================
-- Seed the 8 Assessment Categories
-- ============================================
INSERT INTO assessment_categories (code, name, rubric_type, sort_order) VALUES
('C1', 'Abstract Approval', 'scale_4', 1),
('C2', 'Ask & Research', 'scale_4', 2),
('C3', 'Imagine & Plan', 'scale_4', 3),
('C4', 'Logbook', 'scale_4', 4),
('C5', 'Presentation', 'scale_4', 5),
('BCM', 'Business Canvas Model', 'scale_4', 6),
('ENG', 'English', 'scale_4', 7),
('IND', 'Bahasa Indonesia', 'scale_4', 8);
