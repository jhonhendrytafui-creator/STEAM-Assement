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


-- ================================================================
-- Step 3: BACKFILL C2 criteria (from previously-hardcoded tooltips)
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
