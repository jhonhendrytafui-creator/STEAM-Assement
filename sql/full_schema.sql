-- ================================================================
-- STEAM Assessment Platform — Full Database Schema
-- ================================================================
-- This single file creates everything you need from scratch.
-- Run this in the Supabase SQL Editor on a FRESH project.
--
-- What's included:
--   1. profiles table (linked to Supabase Auth)
--   2. teacher_emails table (for role auto-assignment)
--   3. student_master table
--   4. themes table
--   5. projects table (with iterations, presentation, documents)
--   6. logbooks table
--   7. assessment_categories table (rubric-based)
--   8. rubric_dimensions table
--   9. rubric_indicators table
--  10. assessment_scores table
--  11. All RLS policies
--  12. Auth trigger for auto-creating profiles
--  13. Seed data: assessment categories, rubric dimensions/indicators, themes
--
-- Generated: 2026-04-06
-- ================================================================


-- ════════════════════════════════════════════════════════════════
-- SECTION 1: CORE AUTH TABLES
-- ════════════════════════════════════════════════════════════════

-- 1.1 Profiles (linked to auth.users via id)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'student',  -- 'student', 'teacher'
    full_name TEXT,
    school TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Teacher Emails (whitelist for auto-assigning teacher role)
CREATE TABLE IF NOT EXISTS teacher_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════
-- SECTION 2: STUDENT & PROJECT TABLES
-- ════════════════════════════════════════════════════════════════

-- 2.1 Student Master (source of truth for group assignments)
-- NOTE: email is unique PER academic_year, not globally.
-- This allows the same student to have different class/group each year.
CREATE TABLE IF NOT EXISTS student_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    class_name TEXT NOT NULL,               -- e.g., '7.1', '7.2', '8.1', '10.3'
    group_number INT NOT NULL,              -- e.g., 1, 2, 3, 4...
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email, academic_year)
);

-- 2.2 Themes (teacher-defined, per grade, per year)
CREATE TABLE IF NOT EXISTS themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_name TEXT NOT NULL,
    grade TEXT NOT NULL,                     -- e.g., '7', '8', '9', '10', '11', '12'
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Projects (supports multiple iterations per group)
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    theme_id UUID REFERENCES themes(id),
    title TEXT NOT NULL,
    abstract TEXT,
    google_doc_url TEXT,
    presentation_url TEXT,                  -- Legacy Canva presentation link
    additional_documents JSONB DEFAULT '[]'::jsonb,  -- Array of {type, url} objects
    status TEXT DEFAULT 'pending',           -- 'pending', 'approved', 'revision', 'disapproved'
    iteration INT DEFAULT 1,                -- Iteration number for resubmissions
    teacher_comment TEXT,                   -- Teacher feedback on this specific iteration
    c5_generated_questions TEXT,            -- AI-generated presentation questions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT projects_group_iteration_key
        UNIQUE NULLS NOT DISTINCT (class_name, group_number, academic_year, iteration)
);

-- 2.4 Logbooks (individual entries, visible to entire group)
CREATE TABLE IF NOT EXISTS logbooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    student_email TEXT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    task TEXT NOT NULL,
    result TEXT,
    feedback TEXT,                           -- teacher feedback (nullable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════
-- SECTION 3: ASSESSMENT & RUBRIC TABLES
-- ════════════════════════════════════════════════════════════════

-- 3.1 Assessment Categories (the 8 assessments: C1–C5, BCM, ENG, IND)
CREATE TABLE IF NOT EXISTS assessment_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,              -- 'C1', 'C2', 'BCM', 'ENG', etc.
    name TEXT NOT NULL,                     -- 'Abstract Approval', 'Presentation', etc.
    rubric_type TEXT NOT NULL DEFAULT 'scale_4',  -- 'checklist', 'scale_3', 'scale_4', 'scale_5'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 Rubric Dimensions (groups of indicators within a category)
CREATE TABLE IF NOT EXISTS rubric_dimensions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                     -- e.g., 'Critical Thinking', 'Collaboration'
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.3 Rubric Indicators (individual criteria within a dimension)
CREATE TABLE IF NOT EXISTS rubric_indicators (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dimension_id UUID NOT NULL REFERENCES rubric_dimensions(id) ON DELETE CASCADE,
    description TEXT NOT NULL,              -- The indicator text
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.4 Assessment Scores (per-indicator per-group scores)
CREATE TABLE IF NOT EXISTS assessment_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    category_id UUID NOT NULL REFERENCES assessment_categories(id) ON DELETE CASCADE,
    indicator_id UUID NOT NULL REFERENCES rubric_indicators(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,           -- 0-1 for checklist, 1-3/4/5 for scales
    teacher_comment TEXT,                   -- General feedback from the teacher for this specific score evaluation
    assessed_by UUID REFERENCES profiles(id),
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year, indicator_id)
);


-- ════════════════════════════════════════════════════════════════
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════

-- 4.0 Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE logbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_dimensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_scores ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 4.1 profiles policies
-- ─────────────────────────────────────────────
CREATE POLICY "Users can read own profile"
ON profiles FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Teachers can read all profiles"
ON profiles FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.2 teacher_emails policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated can read teacher_emails"
ON teacher_emails FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage teacher_emails"
ON teacher_emails FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.3 student_master policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated users can read student_master"
ON student_master FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage student_master"
ON student_master FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.4 themes policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated users can read themes"
ON themes FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage themes"
ON themes FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.5 projects policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated users can read projects"
ON projects FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert projects"
ON projects FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Students can update projects"
ON projects FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Teachers can manage projects"
ON projects FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.6 logbooks policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated users can read logbooks"
ON logbooks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert logbooks"
ON logbooks FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Students can delete own logbook entries"
ON logbooks FOR DELETE TO authenticated
USING (student_email = (SELECT email FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Teachers can manage logbooks"
ON logbooks FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.7 assessment_categories policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated can read assessment_categories"
ON assessment_categories FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage assessment_categories"
ON assessment_categories FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.8 rubric_dimensions policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated can read rubric_dimensions"
ON rubric_dimensions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage rubric_dimensions"
ON rubric_dimensions FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.9 rubric_indicators policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated can read rubric_indicators"
ON rubric_indicators FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage rubric_indicators"
ON rubric_indicators FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- ─────────────────────────────────────────────
-- 4.10 assessment_scores policies
-- ─────────────────────────────────────────────
CREATE POLICY "Authenticated can read assessment_scores"
ON assessment_scores FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Teachers can manage assessment_scores"
ON assessment_scores FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);


-- ════════════════════════════════════════════════════════════════
-- SECTION 5: AUTH TRIGGER — Auto-create profile on signup
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            (SELECT 'teacher' FROM public.teacher_emails WHERE email = NEW.email),
            'student'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Drop the trigger if it already exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ════════════════════════════════════════════════════════════════
-- SECTION 6: SEED DATA — Assessment Categories
-- ════════════════════════════════════════════════════════════════

INSERT INTO assessment_categories (code, name, rubric_type, sort_order) VALUES
('C1', 'Abstract Approval', 'scale_4', 1),
('C2', 'Ask & Research', 'scale_4', 2),
('C3', 'Imagine & Plan', 'scale_4', 3),
('C4', 'Logbook & Process', 'scale_4', 4),
('C5', 'Presentation Delivery', 'scale_4', 5),
('BCM', 'Business Canvas Model', 'scale_4', 6),
('ENG', 'English', 'scale_4', 7),
('IND', 'Bahasa Indonesia', 'scale_4', 8)
ON CONFLICT (code) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- SECTION 7: SEED DATA — Rubric Dimensions & Indicators
-- ════════════════════════════════════════════════════════════════

-- ── C1: Abstract Approval ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C1';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C1 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    -- Dimension: Title
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Title', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'The title is easy for teachers or colleagues to understand in terms of its meaning and purpose.', 1),
    (v_dim, 'The title and topic reflect originality or an uncommon approach.', 2),
    (v_dim, 'The title is concise and directly highlights the core of the project.', 3);

    -- Dimension: Problem and Solution
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Problem and Solution', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'The problem presented is relevant and connected to the theme selected.', 1),
    (v_dim, 'The problem presented is relevant and connected to students'' real-life context.', 2),
    (v_dim, 'The proposed solution demonstrates potential for applying conceptual understanding of the subject area.', 3),
    (v_dim, 'The topic has the potential to integrate more than one STEAM field.', 4),
    (v_dim, 'The main concept aligns with students'' level of ability and grade.', 5);

    -- Dimension: Other
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Other', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'The title is submitted on time.', 1);
END $$;

-- ── C2: Ask & Research ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C2';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C2 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Ask', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Problem Elaboration & Impact', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Research', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Research Quality & Source Diversity', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Interdisciplinary', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'STEAM Interdisciplinary Connection', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Analysis', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Critical Analysis & Opportunity', 1);
END $$;

-- ── C3: Imagine & Plan ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C3';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C3 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Execution', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Execution & Planning (Materials, Budget, Timeline)', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Design', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Concept, Design & Rationale', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Risk', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Risk Assessment & Contingency', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'STEAM', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'STEAM Application in the Build', 1);
END $$;

-- ── C4: Logbook & Process ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C4';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C4 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Structure', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Structural Integrity & Consistency', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Iteration', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Problem-Solving Loop & Iteration', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Reflection', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Reflection on Progress & Honest Assessment', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Task', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES (v_dim, 'Depth of Task Description', 1);
END $$;

-- ── C5: Presentation Delivery ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C5';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C5 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Problem Articulation', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'The group clearly defines a specific research question, justifies why the problem truly matters to a specific audience, and realistically accounts for real-world constraints like budget or materials.', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Scientific Foundation & Math', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'Student present a factual accuracy of their science, how well they use hard mathematical data to support their claims, and whether they explicitly prove the connection between at least two different STEAM fields', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Solution & Architecture', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'The final product actually solves the stated problem, looking for clear documentation of the Engineering Design Process (EDP), proof of testing and design iterations, and the effective use of art/aesthetics.', 1);

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Presentation Delivery', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim, 'Students are able to evenly share the stage, utilize organized and helpful visual aids, and confidently defend their project with deep knowledge during an unscripted Q&A session.', 1);
END $$;


-- ════════════════════════════════════════════════════════════════
-- SECTION 8: SEED DATA — Themes (Grades 7–12)
-- ════════════════════════════════════════════════════════════════

-- Grade 7
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Clean Water & Sanitation', '7', '2025/2026'),
('Healthy Living & Nutrition', '7', '2025/2026'),
('Simple Machines & Daily Life', '7', '2025/2026'),
('Weather & Climate Awareness', '7', '2025/2026'),
('Waste Reduction at School', '7', '2025/2026'),
('Plants & Urban Gardening', '7', '2025/2026');

-- Grade 8
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Sustainable Transportation', '8', '2025/2026'),
('Ocean & Marine Conservation', '8', '2025/2026'),
('Smart Agriculture', '8', '2025/2026'),
('Disaster Preparedness', '8', '2025/2026'),
('Energy Efficiency at Home', '8', '2025/2026'),
('Biodiversity & Habitat Protection', '8', '2025/2026');

-- Grade 9
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Space Exploration & Astronomy', '9', '2025/2026'),
('Artificial Intelligence & Ethics', '9', '2025/2026'),
('Biomedical Engineering', '9', '2025/2026'),
('Sustainable Fashion', '9', '2025/2026'),
('Robotics & Automation', '9', '2025/2026'),
('Smart City Design', '9', '2025/2026');

-- Grade 10
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Renewable Energy', '10', '2025/2026'),
('Waste Management and Recycling', '10', '2025/2026'),
('Water Conservation', '10', '2025/2026'),
('Green City Design', '10', '2025/2026'),
('Climate Change', '10', '2025/2026'),
('Food Estate', '10', '2025/2026'),
('Ecosystem and Biodiversity', '10', '2025/2026'),
('Polution', '10', '2025/2026');

-- Grade 11
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Lingkungan & Produk Ramah Lingkungan', '11', '2025/2026'),
('Kesehatan & Gaya Hidup Sehat', '11', '2025/2026'),
('Teknologi & Inovasi Digital', '11', '2025/2026'),
('Produk Kreatif Berbasis Seni & Budaya', '11', '2025/2026'),
('Solusi Kebutuhan Sehari-hari', '11', '2025/2026'),
('Transportasi & Mobilitas', '11', '2025/2026'),
('Pendidikan', '11', '2025/2026');

-- Grade 12
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Energi dan Lingkungan Berkelanjutan', '12', '2025/2026'),
('Ketahanan dan Kemanusiaan', '12', '2025/2026'),
('Pertanian dan Pangan Modern', '12', '2025/2026'),
('Rekayasa dan Desain Mekanis', '12', '2025/2026'),
('Teknologi Digital dan Aplikasi', '12', '2025/2026'),
('Edukasi dan Seni Interaktif', '12', '2025/2026');


-- ════════════════════════════════════════════════════════════════
-- DONE! Your database is now fully set up.
-- ════════════════════════════════════════════════════════════════
-- Next steps:
--   1. Add teacher emails to the teacher_emails table
--   2. Configure Google OAuth in Supabase Auth settings
--   3. Your app is ready to use!
-- ════════════════════════════════════════════════════════════════
