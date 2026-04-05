-- ============================================
-- Seed Rubric for C4 (Logbook & Process)
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_category_id UUID;
    v_dim_structure_id UUID;
    v_dim_iteration_id UUID;
    v_dim_reflection_id UUID;
    v_dim_task_id UUID;
BEGIN
    -- 0. Insert C4 into assessment_categories if it doesn't exist
    INSERT INTO assessment_categories (code, name, rubric_type, sort_order)
    SELECT 'C4', 'Logbook & Process', 'Logbook Evaluation', 4
    WHERE NOT EXISTS (
        SELECT 1 FROM assessment_categories WHERE code = 'C4'
    );

    -- 1. Get the category ID for C4
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C4';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C4 not found after attempted insert.';
    END IF;

    -- Clear existing dimensions for C4 to prevent duplicates
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 2. Insert Dimensions

    -- Structure
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Structure', 1)
    RETURNING id INTO v_dim_structure_id;

    -- Iteration
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Iteration', 2)
    RETURNING id INTO v_dim_iteration_id;

    -- Reflection
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Reflection', 3)
    RETURNING id INTO v_dim_reflection_id;

    -- Task
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Task', 4)
    RETURNING id INTO v_dim_task_id;

    -- 3. Insert Indicators (one per dimension)

    -- --- Structure Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_structure_id, 'Structural Integrity & Consistency', 1);

    -- --- Iteration Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_iteration_id, 'Problem-Solving Loop & Iteration', 1);

    -- --- Reflection Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_reflection_id, 'Reflection on Progress & Honest Assessment', 1);

    -- --- Task Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_task_id, 'Depth of Task Description', 1);

END $$;
