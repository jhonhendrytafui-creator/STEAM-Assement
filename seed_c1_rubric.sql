-- ============================================
-- Seed Rubric for C1 (Abstract Approval)
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_category_id UUID;
    v_dim_title_id UUID;
    v_dim_problem_id UUID;
    v_dim_other_id UUID;
BEGIN
    -- 1. Get the category ID for C1
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C1';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C1 not found. Please ensure it is seeded in assessment_categories first.';
    END IF;

    -- Optional: Clear existing dimensions for C1 to prevent duplicates if run multiple times
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 2. Insert Dimensions
    -- Title
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Title', 1)
    RETURNING id INTO v_dim_title_id;

    -- Problem and Solution
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Problem and Solution', 2)
    RETURNING id INTO v_dim_problem_id;

    -- Other
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Other', 3)
    RETURNING id INTO v_dim_other_id;

    -- 3. Insert Indicators
    
    -- --- Title Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_title_id, 'The title is easy for teachers or colleagues to understand in terms of its meaning and purpose.', 1),
    (v_dim_title_id, 'The title and topic reflect originality or an uncommon approach.', 2),
    (v_dim_title_id, 'The title is concise and directly highlights the core of the project.', 3);

    -- --- Problem and Solution Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_problem_id, 'The problem presented is relevant and connected to the theme selected.', 1),
    (v_dim_problem_id, 'The problem presented is relevant and connected to students'' real-life context.', 2),
    (v_dim_problem_id, 'The proposed solution demonstrates potential for applying conceptual understanding of the subject area.', 3),
    (v_dim_problem_id, 'The topic has the potential to integrate more than one STEAM field.', 4),
    (v_dim_problem_id, 'The main concept aligns with students'' level of ability and grade.', 5);

    -- --- Other Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_other_id, 'The title is submitted on time.', 1);

END $$;
