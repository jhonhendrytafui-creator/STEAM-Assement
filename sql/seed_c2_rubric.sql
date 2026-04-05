-- ============================================
-- Seed Rubric for C2 (Ask & Research)
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_category_id UUID;
    v_dim_ask_id UUID;
    v_dim_research_id UUID;
    v_dim_interdisciplinary_id UUID;
    v_dim_analysis_id UUID;
BEGIN
    -- 1. Get the category ID for C2
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C2';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C2 not found. Please ensure it is seeded in assessment_categories first.';
    END IF;

    -- Optional: Clear existing dimensions for C2 to prevent duplicates if run multiple times
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 2. Insert Dimensions

    -- Ask
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Ask', 1)
    RETURNING id INTO v_dim_ask_id;

    -- Research
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Research', 2)
    RETURNING id INTO v_dim_research_id;

    -- Interdisciplinary
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Interdisciplinary', 3)
    RETURNING id INTO v_dim_interdisciplinary_id;

    -- Analysis
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Analysis', 4)
    RETURNING id INTO v_dim_analysis_id;

    -- 3. Insert Indicators (one per dimension)

    -- --- Ask Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_ask_id, 'Problem Elaboration & Impact', 1);

    -- --- Research Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_research_id, 'Research Quality & Source Diversity', 1);

    -- --- Interdisciplinary Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_interdisciplinary_id, 'STEAM Interdisciplinary Connection', 1);

    -- --- Analysis Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order) VALUES
    (v_dim_analysis_id, 'Critical Analysis & Opportunity', 1);

END $$;
