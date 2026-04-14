-- ==============================================================================
-- STEAM Assessment Platform — Robust RLS & Triggers
-- ==============================================================================
-- This file contains all the Row Level Security (RLS) policies and PostgreSQL 
-- triggers for the application. It secures data so students only see/edit their
-- own group's data, while teachers have broader administrative access.
-- ==============================================================================

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ENABLE ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════
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

-- Drop existing policies to ensure clean state
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Create a helper function to easily check if the current user is a teacher
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- ------------------------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT TO authenticated
    USING (id = auth.uid() OR public.is_teacher());

CREATE POLICY "Users can update their own profile"
    ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
    
CREATE POLICY "System can insert profiles"
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "Teachers can view all profiles"
    ON profiles FOR SELECT TO authenticated
    USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- TEACHER EMAILS
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can check teacher emails whitelist"
    ON teacher_emails FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Only teachers can modify teacher emails"
    ON teacher_emails FOR ALL TO authenticated
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- STUDENT MASTER
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view student list"
    ON student_master FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Only teachers can modify student list"
    ON student_master FOR ALL TO authenticated
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- THEMES
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view themes"
    ON themes FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Only teachers can modify themes"
    ON themes FOR ALL TO authenticated
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());

-- ------------------------------------------------------------------------------
-- PROJECTS
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view projects"
    ON projects FOR SELECT TO authenticated
    USING (true);

-- Students can only insert projects for their own assigned group
CREATE POLICY "Students can create projects for their group"
    ON projects FOR INSERT TO authenticated
    WITH CHECK (
        public.is_teacher() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.student_master sm ON p.email = sm.email
            WHERE p.id = auth.uid()
            AND sm.class_name = projects.class_name
            AND sm.group_number = projects.group_number
            AND sm.academic_year = projects.academic_year
        )
    );

-- Students can only update projects for their own assigned group
CREATE POLICY "Students can update their group's projects"
    ON projects FOR UPDATE TO authenticated
    USING (
        public.is_teacher() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.student_master sm ON p.email = sm.email
            WHERE p.id = auth.uid()
            AND sm.class_name = projects.class_name
            AND sm.group_number = projects.group_number
            AND sm.academic_year = projects.academic_year
        )
    )
    WITH CHECK (
        public.is_teacher() OR 
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.student_master sm ON p.email = sm.email
            WHERE p.id = auth.uid()
            AND sm.class_name = projects.class_name
            AND sm.group_number = projects.group_number
            AND sm.academic_year = projects.academic_year
        )
    );

CREATE POLICY "Teachers have full access to projects"
    ON projects FOR ALL TO authenticated
    USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- LOGBOOKS
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view logbooks"
    ON logbooks FOR SELECT TO authenticated
    USING (true);

-- Students can only insert logbooks under their own email
CREATE POLICY "Students can add their own logbooks"
    ON logbooks FOR INSERT TO authenticated
    WITH CHECK (
        public.is_teacher() OR
        student_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- Students can update their own logbooks
CREATE POLICY "Students can update their own logbooks"
    ON logbooks FOR UPDATE TO authenticated
    USING (
        public.is_teacher() OR
        student_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- Students can delete their own logbooks
CREATE POLICY "Students can delete their own logbooks"
    ON logbooks FOR DELETE TO authenticated
    USING (
        public.is_teacher() OR
        student_email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Teachers have full access to logbooks"
    ON logbooks FOR ALL TO authenticated
    USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- RUBRICS & ASSESSMENT SETTINGS (Categories, Dimensions, Indicators)
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view assessment_categories"
    ON assessment_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can manage assessment_categories"
    ON assessment_categories FOR ALL TO authenticated USING (public.is_teacher());

CREATE POLICY "Anyone can view rubric_dimensions"
    ON rubric_dimensions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can manage rubric_dimensions"
    ON rubric_dimensions FOR ALL TO authenticated USING (public.is_teacher());

CREATE POLICY "Anyone can view rubric_indicators"
    ON rubric_indicators FOR SELECT TO authenticated USING (true);

CREATE POLICY "Teachers can manage rubric_indicators"
    ON rubric_indicators FOR ALL TO authenticated USING (public.is_teacher());

-- ------------------------------------------------------------------------------
-- ASSESSMENT SCORES
-- ------------------------------------------------------------------------------
CREATE POLICY "Anyone can view assessment scores"
    ON assessment_scores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Only teachers can manage assessment scores"
    ON assessment_scores FOR ALL TO authenticated
    USING (public.is_teacher())
    WITH CHECK (public.is_teacher());


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- ------------------------------------------------------------------------------
-- Auth Trigger: Auto-create Profile on Signup
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(
            (SELECT 'teacher' FROM public.teacher_emails WHERE email = NEW.email),
            'student'
        )
    )
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- Auto-Update Trigger: updated_at tracking
-- ------------------------------------------------------------------------------
-- Add updated_at columns if they don't exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE logbooks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE assessment_scores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_logbooks_updated_at ON logbooks;
CREATE TRIGGER set_logbooks_updated_at
    BEFORE UPDATE ON logbooks
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_assessment_scores_updated_at ON assessment_scores;
CREATE TRIGGER set_assessment_scores_updated_at
    BEFORE UPDATE ON assessment_scores
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();


-- ------------------------------------------------------------------------------
-- Data Integrity Trigger: Logbook Feedback Protection
-- ------------------------------------------------------------------------------
-- Ensure students cannot update the 'feedback' column of their own logbooks. 
-- Only teachers are allowed to update this column.
CREATE OR REPLACE FUNCTION public.protect_logbook_feedback()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_teacher() THEN
        -- Revert any attempts by non-teachers to modify teacher-only feedback
        NEW.feedback = OLD.feedback;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS logbook_feedback_protection ON logbooks;
CREATE TRIGGER logbook_feedback_protection
    BEFORE UPDATE ON logbooks
    FOR EACH ROW EXECUTE FUNCTION public.protect_logbook_feedback();


-- ------------------------------------------------------------------------------
-- Data Integrity Trigger: Project Teacher Fields Protection
-- ------------------------------------------------------------------------------
-- Ensure students cannot modify teacher assessment columns such as 
-- status, teacher_comment, or c5_generated_questions.
CREATE OR REPLACE FUNCTION public.protect_project_teacher_fields()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT public.is_teacher() THEN
        -- Revert any attempts by non-teachers to modify teacher columns
        NEW.status = OLD.status;
        NEW.teacher_comment = OLD.teacher_comment;
        NEW.c5_generated_questions = OLD.c5_generated_questions;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_teacher_fields_protection ON projects;
CREATE TRIGGER project_teacher_fields_protection
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.protect_project_teacher_fields();
