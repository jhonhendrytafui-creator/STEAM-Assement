-- ================================================================
-- Migration: Add criteria JSONB column to rubric_indicators
-- and reseed C1 rubric from c1_rubic_update.md
-- ================================================================
-- Run this in your Supabase SQL Editor on a LIVE database.
-- This is safe to run multiple times (idempotent).
-- ================================================================

-- Step 1: Add the column if it doesn't exist
ALTER TABLE rubric_indicators ADD COLUMN IF NOT EXISTS criteria JSONB DEFAULT '{}'::jsonb;

-- ================================================================
-- Step 2: RESEED C1 — Delete old dimensions/indicators, insert new
-- ================================================================
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C1';
    IF v_cat IS NULL THEN RAISE EXCEPTION 'C1 not found'; END IF;

    -- Delete old C1 scores (they reference old indicator IDs)
    DELETE FROM assessment_scores WHERE category_id = v_cat;
    -- Delete old C1 dimensions (cascades to indicators)
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    -- Dimension 1: Project Title (1 indicator)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Project Title', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Clarity & Creativity — Does the project title clearly communicate the purpose of the project while being original and engaging?', 1, '{"1":"Title is vague or unrelated (e.g., ''My Project'').","2":"Title is descriptive but generic (e.g., ''The Solar Car'').","3":"Title clearly reflects the problem or solution.","4":"Title is catchy, professional, and reflects the STEAM nature of the project."}');

    -- Dimension 2: Problem Statement (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Problem Statement', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Contextuality & Relevance — Is the problem connected to a real-life situation that the student or their community actually experiences?', 1, '{"1":"The problem is abstract or has no link to real-life situations.","2":"The problem is common but lacks a specific local or personal context.","3":"The problem is clearly linked to a real-life situation in the student''s community.","4":"The problem is a significant, real-world issue that is personally or socially relevant."}'),
    (v_dim, 'Depth & Logic — Does the student explain the problem clearly with logical reasoning, evidence, and a cause-and-effect structure?', 2, '{"1":"Explanation is too brief or lacks any logical reasoning.","2":"Explanation is clear but lacks evidence or a cause-and-effect structure.","3":"The problem is well-explained with a logical flow from cause to impact.","4":"The problem is analyzed deeply with clear evidence and a highly structured argument."}'),
    (v_dim, 'Significance — Is this problem worth solving? Does the solution provide real benefit to a specific group of people?', 3, '{"1":"The problem is trivial and does not really need a solution.","2":"The problem is minor; the solution provides very little benefit.","3":"Solving this problem provides a clear benefit to a specific group of people.","4":"Solving this problem has a high impact or addresses a critical need."}');

    -- Dimension 3: Proposed Solution (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Proposed Solution', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Rationale & Choice — Does the student explain why they chose this specific solution over other options?', 1, '{"1":"No reason is given for choosing the solution.","2":"The reason for the choice is weak or based only on ease of making.","3":"Explains why the solution was chosen based on its ability to solve the problem.","4":"Provides a compelling, evidence-based argument for why this is the best solution."}'),
    (v_dim, 'Methodology (The How) — Does the student describe a clear plan or steps for how the prototype will be built?', 2, '{"1":"No plan for how the prototype will be built.","2":"A vague plan is provided, but it lacks specific steps or materials.","3":"A clear, step-by-step plan for building the prototype is described.","4":"A highly detailed, realistic plan is provided, showing a clear Engineering Design mindset."}'),
    (v_dim, 'Feasibility — Is the proposed solution realistic and achievable given the student''s available resources, time, and budget?', 3, '{"1":"The solution is impossible to build with available resources.","2":"The solution is overly ambitious and likely to fail without major changes.","3":"The solution is realistic and can be built within the school''s timeline/budget.","4":"The solution is expertly balanced between being challenging and highly achievable."}');

    -- Dimension 4: Key Concepts (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Key Concepts', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Subject Relevance — Are the chosen STEAM subjects actually relevant and necessary for this project?', 1, '{"1":"Subject choices seem random or unrelated to the project.","2":"Only one subject is correctly identified as relevant.","3":"Two or more subjects are identified with clear relevance to the project.","4":"Multiple subjects (3+) are integrated naturally and are essential to the project."}'),
    (v_dim, 'Conceptual Accuracy — Does the student correctly understand and apply the scientific or technical concepts they mentioned?', 2, '{"1":"Concepts are mentioned but incorrectly defined or applied.","2":"Concepts are correctly named but the explanation of how they apply is weak.","3":"Concepts are correctly defined and have a clear link to the project''s function.","4":"Demonstrates a deep, accurate understanding of how specific concepts drive the project."}'),
    (v_dim, 'Interdisciplinary Link — Does the student show how different STEAM subjects work together, not just listed separately?', 3, '{"1":"No connection shown between the chosen subjects.","2":"Subjects are treated as separate tasks rather than integrated ideas.","3":"Shows how one subject supports another (e.g., Math used to calculate Science data).","4":"Clearly demonstrates how subjects melt together to create a unified STEAM solution."}');
END $$;


-- ================================================================
-- Step 3: BACKFILL C2 criteria (aligned with c2_rubric_update.md)
-- 4 dimensions, 8 indicators
-- ================================================================
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C2';
    IF v_cat IS NULL THEN RETURN; END IF;

    -- Delete and reseed to add criteria
    DELETE FROM rubric_dimensions WHERE category_id = v_cat;

    -- I. Problem Definition (2 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Problem Definition', 1) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Problem Description (Causes, Impact & Facts) — Does the student describe the problem''s causes and impact using clear facts and data, rather than just personal opinions?', 1, '{"1":"The problem is vague. The student uses only personal feelings/opinions to explain the issue, with no mention of causes or impact.","2":"Mentions the causes or the impact, but the description is hard to understand and relies mostly on personal opinions.","3":"Clearly explains the causes and the impact of the problem. Uses basic facts and data to support their description.","4":"Describes the problem''s exact causes and impact using strong facts and data (zero personal opinions). The description is crystal clear and professional."}'),
    (v_dim, 'Relevance & Constraints — Is the problem relevant to the student''s/user''s life, and do they set clear technical limits (budget, size, etc.)?', 2, '{"1":"The problem is not relevant to the student''s life. No specific goals or limits are listed to guide the building process.","2":"The problem has weak relevance. Lists some basic limits (e.g., ''it must be small''), but they are too vague to measure.","3":"The problem is clearly relevant to the student/user. Lists specific, measurable goals and limits (e.g., ''cost under $10'').","4":"Highly relevant to the student''s daily life. Shows deep empathy and provides a professional list of technical requirements with measurable data."}');

    -- II. Information Literacy (2 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Information Literacy', 2) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Source Quality (Academic & Expert Data) — Does the student gather data from highly credible resources, specifically academic resources and expert interviews?', 1, '{"1":"No credible sources are cited. Information comes from untrustworthy sites, personal blogs, or hearsay.","2":"Uses only one type of source (e.g., one YouTube video) or general websites. Does not use academic or expert data.","3":"Gathers solid data from credible resources. Includes information from either an academic resource OR an expert interview.","4":"Gathers data from highly credible resources, requiring the use of both academic resources AND an expert interview to back every claim."}'),
    (v_dim, 'Knowledge Synthesis — Does the student effectively connect their gathered data to make logical, actionable decisions for their project design?', 2, '{"1":"Research is simply copied and pasted. The student does not explain why this data is in the report.","2":"Information is rewritten in the student''s own words, but it is not linked to any design choices.","3":"Student explains the research and describes how a specific piece of data will help them build their prototype.","4":"Student perfectly explains the ''Research → Action'' link (e.g., ''Expert data says X, so I will build my project using Y'')."}');

    -- III. Precedent Study (1 indicator)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'Precedent Study', 3) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Existing Solutions & Opportunity — Does the student provide data from existing products and identify a specific, clear opportunity to create something new or better?', 1, '{"1":"Student does not look for other ideas or wrongly claims that ''nothing like this exists in the world.''","2":"Finds one similar product but does not provide data on how it works or what its strengths/weaknesses are.","3":"Provides basic data on 1-2 existing solutions and identifies what can be improved or what they will do differently.","4":"Provides detailed data from existing solutions and uses it to identify a specific, clear opportunity to create something entirely new or significantly better."}');

    -- IV. STEAM Foundation (3 indicators)
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES (v_cat, 'STEAM Foundation', 4) RETURNING id INTO v_dim;
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (v_dim, 'Theoretical Accuracy — Does the student correctly and precisely apply the relevant scientific laws, math formulas, and technical vocabulary?', 1, '{"1":"Scientific or mathematical explanations are missing or contain major factual errors.","2":"Uses very simple language to explain the theory but avoids using technical terms or formulas.","3":"Correctly explains the scientific/math principles (e.g., Friction, Gravity, or Ratios) that make the project work.","4":"Uses advanced technical terms and relevant formulas (e.g., V=IR or Area = πr²) to prove a deep understanding."}'),
    (v_dim, 'The "Mechanism" — Does the student clearly explain the step-by-step physical or digital logic (Input → Process → Output) that makes the prototype work?', 2, '{"1":"No explanation of how the parts work together. It is treated like ''magic.''","2":"Explains what the solution does, but cannot explain the step-by-step logic of how it happens.","3":"Provides a clear logic flow (e.g., ''The sensor sends a signal to the motor, which then pulls the lever'').","4":"Provides a highly detailed ''Technical Walkthrough'' of every physical or digital interaction in the system."}'),
    (v_dim, 'Subject Integration — Does the student demonstrate a clear, interdependent connection showing how the different S.T.E.A.M. subjects are necessary for the project to succeed?', 3, '{"1":"Subjects are listed as a separate, unrelated list. They do not seem to help each other.","2":"Shows a simple link where one subject is used for a small task (e.g., ''I use math to measure the wood'').","3":"Shows a functional link where one subject is required for another to work (e.g., ''The Math helps the Engineering be stable'').","4":"Demonstrates ''Interdependence''; proves that the project cannot function if any of the STEAM pillars are removed."}');
END $$;


-- ================================================================
-- Step 4: BACKFILL C3 criteria
-- ================================================================
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C3';
    IF v_cat IS NULL THEN RETURN; END IF;

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


-- ================================================================
-- Step 5: BACKFILL C4 criteria
-- ================================================================
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C4';
    IF v_cat IS NULL THEN RETURN; END IF;

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


-- ================================================================
-- Step 6: BACKFILL C5 criteria
-- ================================================================
DO $$
DECLARE
    v_cat UUID;
    v_dim UUID;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = 'C5';
    IF v_cat IS NULL THEN RETURN; END IF;

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


-- ================================================================
-- DONE! Criteria column added and all rubrics seeded.
-- ================================================================
