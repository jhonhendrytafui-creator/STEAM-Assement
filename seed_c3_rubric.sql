-- ============================================
-- Seed Rubric for C3 (Solution & Execution)
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_category_id UUID;
    v_dim_execution_id UUID;
    v_dim_design_id UUID;
    v_dim_risk_id UUID;
    v_dim_steam_id UUID;
BEGIN
    -- 1. Get the category ID for C3
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C3';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C3 not found. Please ensure it is seeded in assessment_categories first.';
    END IF;

    -- Optional: Clear existing dimensions for C3 to prevent duplicates if run multiple times
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 2. Insert Dimensions

    -- Execution
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Execution', 1)
    RETURNING id INTO v_dim_execution_id;

    -- Design
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Design', 2)
    RETURNING id INTO v_dim_design_id;

    -- Risk
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Risk', 3)
    RETURNING id INTO v_dim_risk_id;

    -- STEAM
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'STEAM', 4)
    RETURNING id INTO v_dim_steam_id;

    -- 3. Insert Indicators (one per dimension)

    -- --- Execution Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_execution_id, 'Execution & Planning (Materials, Budget, Timeline)', 1);

    -- --- Design Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_design_id, 'Concept, Design & Rationale', 1);

    -- --- Risk Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_risk_id, 'Risk Assessment & Contingency', 1);

    -- --- STEAM Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_steam_id, 'STEAM Application in the Build', 1);

END $$;
