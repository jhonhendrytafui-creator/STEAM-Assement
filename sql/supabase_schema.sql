-- ============================================
-- STEAM Assessment — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Student Master (source of truth for group assignments)
CREATE TABLE student_master (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    class_name TEXT NOT NULL,        -- e.g., '7.1', '7.2', '8.1', '10.3'
    group_number INT NOT NULL,       -- e.g., 1, 2, 3, 4...
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Themes (teacher-defined, per grade, per year)
CREATE TABLE themes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_name TEXT NOT NULL,
    grade TEXT NOT NULL,              -- e.g., '7', '8', '9', '10', '11', '12'
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Projects (one per group)
CREATE TABLE projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    theme_id UUID REFERENCES themes(id),
    title TEXT NOT NULL,
    abstract TEXT,
    google_doc_url TEXT,
    status TEXT DEFAULT 'pending',    -- 'pending', 'approved', 'revision'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year)
);

-- 4. Logbooks (individual entries, visible to entire group)
CREATE TABLE logbooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    student_email TEXT NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    task TEXT NOT NULL,
    result TEXT,
    feedback TEXT,                     -- teacher feedback (nullable)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Assessment Categories (flexible, currently 8)
CREATE TABLE assessment_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    max_score INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Group Scores (one score per group per category, shared by all members)
CREATE TABLE group_scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '2025/2026',
    category_id UUID REFERENCES assessment_categories(id),
    score NUMERIC NOT NULL,
    assessed_by UUID REFERENCES profiles(id),
    notes TEXT,
    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year, category_id)
);

-- ============================================
-- Enable Row Level Security (RLS)
-- ============================================
ALTER TABLE student_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE logbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_scores ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all tables
CREATE POLICY "Authenticated users can read student_master" ON student_master FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read themes" ON themes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read projects" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read logbooks" ON logbooks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read assessment_categories" ON assessment_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read group_scores" ON group_scores FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert projects and logbooks
CREATE POLICY "Authenticated users can insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert logbooks" ON logbooks FOR INSERT TO authenticated WITH CHECK (true);

-- Allow teachers to manage all tables (insert/update/delete)
CREATE POLICY "Teachers can manage student_master" ON student_master FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Teachers can manage themes" ON themes FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Teachers can manage projects" ON projects FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Teachers can manage logbooks" ON logbooks FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Teachers can manage assessment_categories" ON assessment_categories FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
CREATE POLICY "Teachers can manage group_scores" ON group_scores FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
