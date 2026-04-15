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
    criteria JSONB DEFAULT '{}'::jsonb,     -- Likert scale criteria: {"1":"...","2":"...","3":"...","4":"..."}
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

-- ── C1: Abstract Approval (from c1_rubic_update.md) ──
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C1';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C1 not found'; END IF;
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    -- Dimension 1: Project Title (1 indicator)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Project Title', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Clarity & Creativity', 1, '{"1":"Title is vague or unrelated (e.g., ''My Project'').","2":"Title is descriptive but generic (e.g., ''The Solar Car'').","3":"Title clearly reflects the problem or solution.","4":"Title is catchy, professional, and reflects the STEAM nature of the project."}');

    -- Dimension 2: Problem Statement (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Problem Statement', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Contextuality & Relevance', 1, '{"1":"The problem is abstract or has no link to real-life situations.","2":"The problem is common but lacks a specific local or personal context.","3":"The problem is clearly linked to a real-life situation in the student''s community.","4":"The problem is a significant, real-world issue that is personally or socially relevant."}'),
    (v_dim, 'Depth & Logic', 2, '{"1":"Explanation is too brief or lacks any logical reasoning.","2":"Explanation is clear but lacks evidence or a cause-and-effect structure.","3":"The problem is well-explained with a logical flow from cause to impact.","4":"The problem is analyzed deeply with clear evidence and a highly structured argument."}'),
    (v_dim, 'Significance', 3, '{"1":"The problem is trivial and does not really need a solution.","2":"The problem is minor; the solution provides very little benefit.","3":"Solving this problem provides a clear benefit to a specific group of people.","4":"Solving this problem has a high impact or addresses a critical need."}');

    -- Dimension 3: Proposed Solution (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Proposed Solution', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Rationale & Choice', 1, '{"1":"No reason is given for choosing the solution.","2":"The reason for the choice is weak or based only on ease of making.","3":"Explains why the solution was chosen based on its ability to solve the problem.","4":"Provides a compelling, evidence-based argument for why this is the best solution."}'),
    (v_dim, 'Methodology (The How)', 2, '{"1":"No plan for how the prototype will be built.","2":"A vague plan is provided, but it lacks specific steps or materials.","3":"A clear, step-by-step plan for building the prototype is described.","4":"A highly detailed, realistic plan is provided, showing a clear Engineering Design mindset."}'),
    (v_dim, 'Feasibility', 3, '{"1":"The solution is impossible to build with available resources.","2":"The solution is overly ambitious and likely to fail without major changes.","3":"The solution is realistic and can be built within the school''s timeline/budget.","4":"The solution is expertly balanced between being challenging and highly achievable."}');

    -- Dimension 4: Key Concepts (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Key Concepts', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Subject Relevance', 1, '{"1":"Subject choices seem random or unrelated to the project.","2":"Only one subject is correctly identified as relevant.","3":"Two or more subjects are identified with clear relevance to the project.","4":"Multiple subjects (3+) are integrated naturally and are essential to the project."}'),
    (v_dim, 'Conceptual Accuracy', 2, '{"1":"Concepts are mentioned but incorrectly defined or applied.","2":"Concepts are correctly named but the explanation of how they apply is weak.","3":"Concepts are correctly defined and have a clear link to the project''s function.","4":"Demonstrates a deep, accurate understanding of how specific concepts drive the project."}'),
    (v_dim, 'Interdisciplinary Link', 3, '{"1":"No connection shown between the chosen subjects.","2":"Subjects are treated as separate tasks rather than integrated ideas.","3":"Shows how one subject supports another (e.g., Math used to calculate Science data).","4":"Clearly demonstrates how subjects melt together to create a unified STEAM solution."}');
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
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Problem Elaboration & Impact', 1, '{"1":"Unclear, irrelevant, lacks explanation of causes/impacts. Zero facts or data provided.","2":"The problem is vague. Briefly mentions causes/impacts but lacks depth. Heavily reliant on personal opinions rather than factual data.","3":"Clearly states the problem and touches on causes/impacts. Uses some data but might occasionally rely on assumptions or general statements.","4":"Masterfully defines a clear problem relevant to the student''s life. Explicitly breaks down causes and real-world impacts. Relies entirely on hard facts and data, not personal opinions."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Research', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Research Quality & Source Diversity', 1, '{"1":"No meaningful research, data, or credible sources provided.","2":"Research relies on basic, potentially non-credible sources. No mention of existing solutions, expert input, or deep academic literature.","3":"Uses good, credible academic or online resources. May mention existing products but lacks deep analysis or expert input.","4":"Gathers highly credible data from academic resources. Elevates research by incorporating real-world data from expert interviews and/or deep analysis of existing solutions/products."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Interdisciplinary', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'STEAM Interdisciplinary Connection', 1, '{"1":"Focuses entirely on the theory of a single subject, missing the interdisciplinary nature of STEAM.","2":"Mentions different STEAM fields but fails to clearly elaborate on how their theoretical concepts specifically connect to the problem.","3":"Clearly explains the theoretical involvement of 2 or more STEAM fields. Connections make sense but might lack deep, critical analysis.","4":"Masterfully explains how specific, advanced concepts from 2 or more STEAM fields intertwine to explain the problem and theory. Connections are deeply analyzed."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Analysis', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Critical Analysis & Opportunity', 1, '{"1":"Shows no critical analysis. Fails entirely to identify any opportunity to create a solution or improve upon existing ideas.","2":"Takes data at face value without critical thought. Struggles to identify a clear, specific opportunity to improve upon existing solutions.","3":"Analyzes the research well enough to spot an opportunity for a project, though the proposed innovation might be slightly standard or generic.","4":"Brilliantly critiques the problem space and research. Uses data to identify a specific, clear opportunity to create something genuinely new or significantly better than existing solutions."}');
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
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Execution & Planning (Materials, Budget, Timeline)', 1, '{"1":"No timeline, budget, or coherent execution steps are provided.","2":"Timeline is vague or unrealistic. Material list is incomplete, or budget is entirely missing. Execution steps are out of order or lack necessary detail.","3":"Solid plan and timeline. Material list is present, but the budget might lack minor details or execution steps skip minor transitional phases.","4":"Exhaustive, sequential step-by-step execution plan. Comprehensive material list with a highly detailed, realistic budget/price list. Clear and actionable timeline."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Design', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Concept, Design & Rationale', 1, '{"1":"No visuals or diagrams provided or described. No rationale is given for the chosen solution.","2":"Visuals are messy, confusing, or poorly described. Rationale is weak (e.g., I chose this because it is easy to make).","3":"Basic visual representation included. Rationale is present and makes sense, but justification could be stronger or more deeply analyzed.","4":"High-quality visual representation (diagram, illustration, blueprint) that perfectly maps to the plan. Exceptional, logical rationale defending exactly why this solution is the best choice over alternatives."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Risk', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Risk Assessment & Contingency', 1, '{"1":"Ignores risk assessment completely. Assumes a flawless execution with zero backup plan.","2":"Mentions only generic, surface-level risks (e.g., it might break) and provides a poor or entirely missing contingency plan.","3":"Identifies potential risks and offers basic mitigation ideas or a general Plan B, though it may lack specific technical details.","4":"Sharp foresight identifying highly specific, realistic risks during the prototype building phase. Strong, actionable, and logical contingency plan (Plan B) to mitigate these exact problems."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'STEAM', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'STEAM Application in the Build', 1, '{"1":"The prototype has absolutely no connection to STEAM application; it operates more like a basic arts-and-crafts project than a functional STEAM solution.","2":"The prototype barely utilizes the STEAM theories discussed in earlier chapters. The actual build is overly simplistic or disconnected from core concepts.","3":"The build process applies 1-2 STEAM concepts well, though execution might lean heavily toward a single discipline rather than a fully integrated approach.","4":"The construction and function of the prototype explicitly require the application of multiple STEAM concepts. The making phase is a true interdisciplinary engineering and design challenge."}');
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
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Structural Integrity & Consistency', 1, '{"1":"Completely incoherent mess. Few entries, no clear dates or timeline, impossible to understand the project progression.","2":"Structure is somewhat disorganized, dates are missing, or entries skip major timeframes, making it hard to follow the project flow. Language is occasionally confusing.","3":"Clear structure and communicative language. Includes most relevant dates and entries, showing logical progression despite minor gaps.","4":"Professional organization. Entries for every date worked, highly readable structure, and exceptionally clear language documenting a logical start-to-finish progression."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Iteration', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Problem-Solving Loop & Iteration', 1, '{"1":"Documents only successes or surface-level work. Zero evidence of technical struggle, failure documentation, or iterative improvement.","2":"Vaguely mentions difficulties or lists them without detail. Many problems identified lack corresponding solutions or follow-up actions.","3":"Lists problems encountered and includes successful follow-up solutions. Shows that problem-solving occurred, though it might lack deep detail on the steps between failure and final solution.","4":"Candidly and precisely documents specific technical failures or struggles. Clearly details the iterative process taken to analyze why something failed and how they attempted to fix it. Documented solution for every issue."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Reflection', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Reflection on Progress & Honest Assessment', 1, '{"1":"No self-reflection or honest assessment included at all.","2":"Reflection is highly superficial (e.g., Today went well) and lacks any genuine analysis of struggles or successes. It reads like a dry checklist.","3":"Includes reflective summaries that recognize progress and identify key learning milestones, though the analysis of personal growth or struggle could be deeper.","4":"Features a deep, honest self-reflection of the journey, balancing analysis of struggles against recognition of achievements and learning points. Evaluates how the process made them feel as makers."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Task', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Depth of Task Description', 1, '{"1":"Descriptions are missing, entirely uninformative, or just list the name of the project phase without explaining the actual work done.","2":"Task descriptions are overly vague or repetitive (e.g., did research, worked on project, cut materials). It is hard to know exactly what was accomplished during the session.","3":"Activity descriptions are clear and specify what was done, though some technical details, materials used, or specific steps might be slightly generalized.","4":"Activity descriptions are exceptionally detailed and articulate. The text paints a vivid, precise picture of exactly what specific technical, research, or building tasks were performed during that session, leaving no ambiguity about the work done."}');
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
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'The group clearly defines a specific research question, justifies why the problem truly matters to a specific audience, and realistically accounts for real-world constraints like budget or materials.', 1, '{"1":"Fails to define the problem, audience, or constraints entirely.","2":"Vague problem and generic audience with little context.","3":"Clearly states the problem and audience but lacks deep justification or detailed constraints.","4":"Masterfully defines the problem, deeply justifies its significance to a specific target audience, and thoroughly accounts for real-world constraints."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Scientific Foundation & Math', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Student present a factual accuracy of their science, how well they use hard mathematical data to support their claims, and whether they explicitly prove the connection between at least two different STEAM fields', 1, '{"1":"Major factual errors, no mathematical backing, and zero STEAM integration.","2":"Shaky scientific theories, weak math, and forced interdisciplinary links.","3":"Mostly accurate science and math with clear STEAM connections.","4":"Flawless scientific accuracy, precise mathematical data supporting their claims, and explicit links between at least two STEAM fields."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Solution & Architecture', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'The final product actually solves the stated problem, looking for clear documentation of the Engineering Design Process (EDP), proof of testing and design iterations, and the effective use of art/aesthetics.', 1, '{"1":"Does not solve the problem and shows zero evidence of design iteration or visual planning.","2":"Partially solves the problem but lacks evidence of testing, iteration, or clear visuals.","3":"A solid solution with good EDP documentation and helpful visuals.","4":"The prototype directly solves the problem with exceptional documentation of the Engineering Design Process (EDP), clear iterations, and strong aesthetic choices."}');

    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Presentation Delivery', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Students are able to evenly share the stage, utilize organized and helpful visual aids, and confidently defend their project with deep knowledge during an unscripted Q&A session.', 1, '{"1":"Poor delivery, missing visuals, and a complete inability to answer questions.","2":"Uneven speaking time, cluttered slides, and significant struggle during the Q&A.","3":"Even participation and clear visuals, with adequate but surface-level Q&A answers.","4":"Seamless, equal team participation, highly organized visual aids, and confident, deeply knowledgeable answers during the Q&A."}');
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
