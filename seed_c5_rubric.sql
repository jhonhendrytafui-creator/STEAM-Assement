-- ============================================
-- Seed Rubric for C5 (Presentation Delivery)
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add new column to projects table to save generated C5 questions
ALTER TABLE projects ADD COLUMN IF NOT EXISTS c5_generated_questions TEXT;

DO $$
DECLARE
    v_category_id UUID;
    v_dim_problem_id UUID;
    v_dim_sci_id UUID;
    v_dim_solution_id UUID;
    v_dim_presentation_id UUID;
BEGIN
    -- 2. Insert C5 into assessment_categories if it doesn't exist
    INSERT INTO assessment_categories (code, name, rubric_type, sort_order)
    SELECT 'C5', 'Presentation Delivery', 'cale_4', 5
    WHERE NOT EXISTS (
        SELECT 1 FROM assessment_categories WHERE code = 'C5'
    );

    -- 3. Get the category ID for C5
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C5';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C5 not found after attempted insert.';
    END IF;

    -- Clear existing dimensions for C5 to prevent duplicates if re-run
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 4. Insert Dimensions

    -- Problem Articulation
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Problem Articulation', 1)
    RETURNING id INTO v_dim_problem_id;

    -- Scientific Foundation & Math
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Scientific Foundation & Math', 2)
    RETURNING id INTO v_dim_sci_id;

    -- Solution & Architecture
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Solution & Architecture', 3)
    RETURNING id INTO v_dim_solution_id;

    -- Presentation Delivery
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Presentation Delivery', 4)
    RETURNING id INTO v_dim_presentation_id;

    -- 5. Insert Indicators (one per dimension)

    -- --- Problem Articulation Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_problem_id, 'The group clearly defines a specific research question, justifies why the problem truly matters to a specific audience, and realistically accounts for real-world constraints like budget or materials.', 1);

    -- --- Scientific Foundation & Math Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_sci_id, 'Student present a factual accuracy of their science, how well they use hard mathematical data to support their claims, and whether they explicitly prove the connection between at least two different STEAM fields', 1);

    -- --- Solution & Architecture Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_solution_id, 'The final product actually solves the stated problem, looking for clear documentation of the Engineering Design Process (EDP), proof of testing and design iterations, and the effective use of art/aesthetics.', 1);

    -- --- Presentation Delivery Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_presentation_id, 'Students are able to evenly share the stage, utilize organized and helpful visual aids, and confidently defend their project with deep knowledge during an unscripted Q&A session.', 1);

END $$;
