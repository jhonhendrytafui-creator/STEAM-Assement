-- ============================================
-- Seed Rubric for C2 (Ask & Research)
-- Aligned with c2_rubric_update.md
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_category_id UUID;
    v_dim_problem_id UUID;
    v_dim_info_literacy_id UUID;
    v_dim_precedent_id UUID;
    v_dim_steam_id UUID;
BEGIN
    -- 1. Get the category ID for C2
    SELECT id INTO v_category_id FROM assessment_categories WHERE code = 'C2';

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Category C2 not found. Please ensure it is seeded in assessment_categories first.';
    END IF;

    -- Clear existing C2 scores (they reference old indicator IDs)
    DELETE FROM assessment_scores WHERE category_id = v_category_id;
    -- Clear existing dimensions for C2 (cascades to indicators)
    DELETE FROM rubric_dimensions WHERE category_id = v_category_id;

    -- 2. Insert Dimensions

    -- I. Problem Definition
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Problem Definition', 1)
    RETURNING id INTO v_dim_problem_id;

    -- II. Information Literacy
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Information Literacy', 2)
    RETURNING id INTO v_dim_info_literacy_id;

    -- III. Precedent Study
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'Precedent Study', 3)
    RETURNING id INTO v_dim_precedent_id;

    -- IV. STEAM Foundation
    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_category_id, 'STEAM Foundation', 4)
    RETURNING id INTO v_dim_steam_id;

    -- 3. Insert Indicators (with criteria JSONB for tooltip display)

    -- --- I. Problem Definition Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_problem_id,
     'Problem Description (Causes, Impact & Facts) — Does the student describe the problem''s causes and impact using clear facts and data, rather than just personal opinions?',
     1,
     '{"1":"The problem is vague. The student uses only personal feelings/opinions to explain the issue, with no mention of causes or impact.","2":"Mentions the causes or the impact, but the description is hard to understand and relies mostly on personal opinions.","3":"Clearly explains the causes and the impact of the problem. Uses basic facts and data to support their description.","4":"Describes the problem''s exact causes and impact using strong facts and data (zero personal opinions). The description is crystal clear and professional."}'
    ),
    (v_dim_problem_id,
     'Relevance & Constraints — Is the problem relevant to the student''s/user''s life, and do they set clear technical limits (budget, size, etc.)?',
     2,
     '{"1":"The problem is not relevant to the student''s life. No specific goals or limits are listed to guide the building process.","2":"The problem has weak relevance. Lists some basic limits (e.g., ''it must be small''), but they are too vague to measure.","3":"The problem is clearly relevant to the student/user. Lists specific, measurable goals and limits (e.g., ''cost under $10'').","4":"Highly relevant to the student''s daily life. Shows deep empathy and provides a professional list of technical requirements with measurable data."}'
    );

    -- --- II. Information Literacy Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_info_literacy_id,
     'Source Quality (Academic & Expert Data) — Does the student gather data from highly credible resources, specifically academic resources and expert interviews?',
     1,
     '{"1":"No credible sources are cited. Information comes from untrustworthy sites, personal blogs, or hearsay.","2":"Uses only one type of source (e.g., one YouTube video) or general websites. Does not use academic or expert data.","3":"Gathers solid data from credible resources. Includes information from either an academic resource OR an expert interview.","4":"Gathers data from highly credible resources, requiring the use of both academic resources AND an expert interview to back every claim."}'
    ),
    (v_dim_info_literacy_id,
     'Knowledge Synthesis — Does the student effectively connect their gathered data to make logical, actionable decisions for their project design?',
     2,
     '{"1":"Research is simply copied and pasted. The student does not explain why this data is in the report.","2":"Information is rewritten in the student''s own words, but it is not linked to any design choices.","3":"Student explains the research and describes how a specific piece of data will help them build their prototype.","4":"Student perfectly explains the ''Research → Action'' link (e.g., ''Expert data says X, so I will build my project using Y'')."}'
    );

    -- --- III. Precedent Study Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_precedent_id,
     'Existing Solutions & Opportunity — Does the student provide data from existing products and identify a specific, clear opportunity to create something new or better?',
     1,
     '{"1":"Student does not look for other ideas or wrongly claims that ''nothing like this exists in the world.''","2":"Finds one similar product but does not provide data on how it works or what its strengths/weaknesses are.","3":"Provides basic data on 1-2 existing solutions and identifies what can be improved or what they will do differently.","4":"Provides detailed data from existing solutions and uses it to identify a specific, clear opportunity to create something entirely new or significantly better."}'
    );

    -- --- IV. STEAM Foundation Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_steam_id,
     'Theoretical Accuracy — Does the student correctly and precisely apply the relevant scientific laws, math formulas, and technical vocabulary?',
     1,
     '{"1":"Scientific or mathematical explanations are missing or contain major factual errors.","2":"Uses very simple language to explain the theory but avoids using technical terms or formulas.","3":"Correctly explains the scientific/math principles (e.g., Friction, Gravity, or Ratios) that make the project work.","4":"Uses advanced technical terms and relevant formulas (e.g., V=IR or Area = πr²) to prove a deep understanding."}'
    ),
    (v_dim_steam_id,
     'The "Mechanism" — Does the student clearly explain the step-by-step physical or digital logic (Input → Process → Output) that makes the prototype work?',
     2,
     '{"1":"No explanation of how the parts work together. It is treated like ''magic.''","2":"Explains what the solution does, but cannot explain the step-by-step logic of how it happens.","3":"Provides a clear logic flow (e.g., ''The sensor sends a signal to the motor, which then pulls the lever'').","4":"Provides a highly detailed ''Technical Walkthrough'' of every physical or digital interaction in the system."}'
    ),
    (v_dim_steam_id,
     'Subject Integration — Does the student demonstrate a clear, interdependent connection showing how the different S.T.E.A.M. subjects are necessary for the project to succeed?',
     3,
     '{"1":"Subjects are listed as a separate, unrelated list. They do not seem to help each other.","2":"Shows a simple link where one subject is used for a small task (e.g., ''I use math to measure the wood'').","3":"Shows a functional link where one subject is required for another to work (e.g., ''The Math helps the Engineering be stable'').","4":"Demonstrates ''Interdependence''; proves that the project cannot function if any of the STEAM pillars are removed."}'
    );

END $$;
