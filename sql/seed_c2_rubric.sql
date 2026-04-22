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
     'Goals & Constraints — The ability to define the project''s "Must-Haves" (Goals) and its "Boundaries" (Limits like cost, size, or time).',
     1,
     '{"1":"Only a general problem is mentioned. No specific goals or limits are listed to guide the building process.","2":"Lists some basic limits (e.g., ''it must be small''), but they are too vague to measure or test.","3":"Clearly lists the project''s goals and provides specific limits (e.g., ''Must be made of wood and cost under $10'').","4":"Provides a professional list of technical requirements with measurable data (e.g., ''Must weigh <500g and operate for 2 hours'')."}'
    ),
    (v_dim_problem_id,
     'User Analysis — The ability to identify the target audience and understand their specific "Pain Points" (struggles).',
     2,
     '{"1":"No mention of who will use the solution. The project feels like it is for ''no one in particular.''","2":"Identifies a general group (e.g., ''students'') but does not explain what specific trouble they are having.","3":"Clearly identifies the user group and explains the specific problem they face in their daily life.","4":"Demonstrates deep empathy; explains exactly how the user''s life will change/improve once the solution is made."}'
    );

    -- --- II. Information Literacy Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_info_literacy_id,
     'Source Quality — The ability to find and use trustworthy evidence from a variety of reliable places.',
     1,
     '{"1":"No sources are cited. Information seems based only on the student''s personal opinion or ''common sense.''","2":"Uses only one type of source (e.g., one YouTube video) or uses untrustworthy sites like personal blogs.","3":"Uses 2–3 reliable sources such as educational websites (.edu), government reports, or expert interviews.","4":"Uses a wide range of professional sources and cites them correctly to prove the project is based on facts."}'
    ),
    (v_dim_info_literacy_id,
     'Knowledge Synthesis — The ability to apply research facts to create a better project design.',
     2,
     '{"1":"Research is simply copied and pasted. The student does not explain why this information is in the report.","2":"Information is rewritten in the student''s own words, but it is not linked to any design choices.","3":"Student explains the research and describes how a specific fact will help them build their prototype.","4":"Student perfectly explains the ''Research → Action'' link (e.g., ''Research says X, so I will build my project using Y'')."}'
    );

    -- --- III. Precedent Study Indicator ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_precedent_id,
     'Existing Solutions — The ability to analyze products that already exist to find a "gap" for a new solution.',
     1,
     '{"1":"Student does not look for other ideas or wrongly claims that ''nothing like this exists in the world.''","2":"Finds one similar idea but does not explain how it works or what its strengths and weaknesses are.","3":"Analyzes 1–2 similar products and identifies what can be improved or what they will do differently.","4":"Performs a ''Competitive Analysis''; compares multiple solutions to prove why their new design is necessary."}'
    );

    -- --- IV. STEAM Foundation Indicators ---
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim_steam_id,
     'Theoretical Accuracy — The ability to use correct scientific laws, math formulas, and technical vocabulary.',
     1,
     '{"1":"Scientific or mathematical explanations are missing or contain major factual errors.","2":"Uses very simple language to explain the theory but avoids using technical terms or formulas.","3":"Correctly explains the scientific/math principles (e.g., Friction, Gravity, or Ratios) that make the project work.","4":"Uses advanced technical terms and relevant formulas (e.g., V=IR or Area = πr²) to prove a deep understanding."}'
    ),
    (v_dim_steam_id,
     'The "Mechanism" — The ability to explain the "Input → Process → Output" logic of the prototype.',
     2,
     '{"1":"No explanation of how the parts work together. It is treated like ''magic.''","2":"Explains what the solution does, but cannot explain the step-by-step logic of how it happens.","3":"Provides a clear logic flow (e.g., ''The sensor sends a signal to the motor, which then pulls the lever'').","4":"Provides a highly detailed ''Technical Walkthrough'' of every physical or digital interaction in the system."}'
    ),
    (v_dim_steam_id,
     'Subject Integration — The ability to show how different subjects (S.T.E.A.M.) are "fused" together.',
     3,
     '{"1":"Subjects are listed as a separate, unrelated list. They do not seem to help each other.","2":"Shows a simple link where one subject is used for a small task (e.g., ''I use math to measure the wood'').","3":"Shows a functional link where one subject is required for another to work (e.g., ''The Math helps the Engineering be stable'').","4":"Demonstrates ''Interdependence''; proves that the project cannot function if any of the STEAM pillars are removed."}'
    );

END $$;
