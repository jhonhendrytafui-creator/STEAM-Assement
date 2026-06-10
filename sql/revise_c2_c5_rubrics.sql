-- ==============================================================================
-- UPDATE C2 (Ask & Research)
-- ==============================================================================
-- Add the success criteria note to Indicator 2 of C2
UPDATE rubric_indicators
SET criteria = jsonb_set(
    COALESCE(criteria, '{}'::jsonb),
    '{4}',
    to_jsonb(COALESCE(criteria->>'4', '') || ' The limits listed here become the project''s official Success Criteria, used in every later phase.')
)
WHERE dimension_id IN (
    SELECT id FROM rubric_dimensions 
    WHERE category_id = (SELECT id FROM assessment_categories WHERE code = 'C2')
)
AND sort_order = 2;

-- Alternatively, update the description if criteria isn't being used for this text
UPDATE rubric_indicators
SET description = description || ' (The limits listed here become the project''s official Success Criteria, used in every later phase.)'
WHERE dimension_id IN (
    SELECT id FROM rubric_dimensions 
    WHERE category_id = (SELECT id FROM assessment_categories WHERE code = 'C2')
)
AND sort_order = 2;


-- ==============================================================================
-- REVISE C3, C4, C5 (Wipe existing dimensions and indicators, then re-insert)
-- ==============================================================================

-- Delete existing dimensions (this cascades and deletes indicators too)
DELETE FROM rubric_dimensions WHERE category_id IN (
    SELECT id FROM assessment_categories WHERE code IN ('C3', 'C4', 'C5')
);

DO $$
DECLARE
    c3_id UUID;
    c4_id UUID;
    c5_id UUID;
    
    dim_c3_1 UUID;
    dim_c3_2 UUID;
    dim_c3_3 UUID;
    dim_c3_4 UUID;
    dim_c3_5 UUID;

    dim_c4_1 UUID;
    dim_c4_2 UUID;
    dim_c4_3 UUID;
    dim_c4_4 UUID;
    dim_c4_5 UUID;
    dim_c4_6 UUID;

    dim_c5_1 UUID;
    dim_c5_2 UUID;
    dim_c5_3 UUID;
    dim_c5_4 UUID;
    dim_c5_5 UUID;
BEGIN
    -- Get Category IDs
    SELECT id INTO c3_id FROM assessment_categories WHERE code = 'C3';
    SELECT id INTO c4_id FROM assessment_categories WHERE code = 'C4';
    SELECT id INTO c5_id FROM assessment_categories WHERE code = 'C5';

    -----------------------------------------------------------------------------
    -- C3: Imagine & Plan (8 indicators)
    -----------------------------------------------------------------------------
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c3_id, 'Ideation & Selection', 1) RETURNING id INTO dim_c3_1;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c3_id, 'Execution & Planning', 2) RETURNING id INTO dim_c3_2;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c3_id, 'Design Spec & Success Criteria', 3) RETURNING id INTO dim_c3_3;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c3_id, 'Risk & Contingency', 4) RETURNING id INTO dim_c3_4;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c3_id, 'STEAM Application in the Design', 5) RETURNING id INTO dim_c3_5;

    -- C3 Indicators
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (dim_c3_1, 'Divergent Ideas — Did the group brainstorm several different solution ideas before choosing?', 1,
    '{"1": "Only one idea is shown. No brainstorming is visible.", "2": "Two ideas are mentioned, but the second is not real (a throwaway option).", "3": "Three or more genuinely different solution ideas are described.", "4": "Many distinct ideas are explored, including at least one bold or unusual approach, showing real creative range."}'::jsonb),
    
    (dim_c3_1, 'Convergent Choice — Did they choose using clear criteria, not just "the easiest one"?', 2,
    '{"1": "No reason for the choice, or ''because it is easy.''", "2": "A reason is given, but it is opinion-based and ignores the Success Criteria.", "3": "The chosen idea is compared against the others using the C2 Success Criteria.", "4": "Uses a structured method (e.g., a decision matrix scoring each idea against weighted criteria) to justify the winner objectively."}'::jsonb),
    
    (dim_c3_2, 'Materials & Budget — Is there a complete parts list with a realistic budget?', 3,
    '{"1": "No materials or budget listed.", "2": "Some materials listed; budget missing or unrealistic.", "3": "Comprehensive parts list with a realistic budget.", "4": "Exhaustive list with a detailed, priced budget that respects the C2 cost constraint."}'::jsonb),
    
    (dim_c3_2, 'Timeline & Tasks — Is there a clear, sequenced timeline of who does what, by when?', 4,
    '{"1": "No timeline or task breakdown.", "2": "Vague timeline; tasks not assigned.", "3": "Clear, sequenced timeline with tasks assigned to group members.", "4": "Realistic timeline with dependencies and milestones, showing genuine engineering project management."}'::jsonb),
    
    (dim_c3_3, 'Visual / Blueprint — Is there a diagram, sketch, or blueprint that matches the plan?', 5,
    '{"1": "No visual provided.", "2": "Visual is messy or does not match the written plan.", "3": "Clear visual that maps to the plan.", "4": "High-quality labeled blueprint/diagram that a stranger could build from."}'::jsonb),
    
    (dim_c3_3, 'Measurable Success Criteria & Test Plan — Did they define how they will test whether the prototype works?', 6,
    '{"1": "No success criteria; ''it should just work.''", "2": "States a vague goal (''it should be good'') with no test described.", "3": "Lists measurable targets and a basic plan to test them.", "4": "Defines precise, measurable targets tied to the C2 constraints AND a clear procedure for testing each one."}'::jsonb),
    
    (dim_c3_4, 'Risk Assessment & Plan B — Did they predict specific problems and prepare backups?', 7,
    '{"1": "Ignores risk; assumes perfect execution.", "2": "Only generic risks (''it might break''); no real Plan B.", "3": "Identifies realistic risks with basic mitigation ideas.", "4": "Sharp, specific risk foresight with a strong, actionable Plan B for each."}'::jsonb),
    
    (dim_c3_5, 'Planned Application — Does the design explicitly require STEAM concepts to function (not just decorate)?', 8,
    '{"1": "STEAM concepts are absent or decorative.", "2": "The design leans on one discipline; others are bolted on.", "3": "The design plan applies 1–2 STEAM concepts to make the solution function.", "4": "The design requires multiple STEAM disciplines working together; remove one and the plan fails."}'::jsonb);

    -----------------------------------------------------------------------------
    -- C4: Create, Test & Improve / Logbook (9 indicators)
    -----------------------------------------------------------------------------
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Structure & Consistency', 1) RETURNING id INTO dim_c4_1;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Problem-Solving Loop', 2) RETURNING id INTO dim_c4_2;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Testing & Evidence', 3) RETURNING id INTO dim_c4_3;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Reflection', 4) RETURNING id INTO dim_c4_4;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Depth of Task Description', 5) RETURNING id INTO dim_c4_5;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c4_id, 'Collaboration & Contribution', 6) RETURNING id INTO dim_c4_6;

    -- C4 Indicators
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (dim_c4_1, 'Organization & Dates — Is the log dated, ordered, and easy to follow?', 1,
    '{"1": "Incoherent; few entries, no dates.", "2": "Disorganized; missing dates or large gaps.", "3": "Clear structure; most dates present; logical flow.", "4": "Professional log: every work session dated, ordered, and instantly readable."}'::jsonb),
    
    (dim_c4_2, 'Failures & Fixes — Does it document specific problems and the steps taken to solve them?', 2,
    '{"1": "Only successes shown; no struggle.", "2": "Problems listed without solutions or detail.", "3": "Problems and their follow-up solutions are recorded.", "4": "Each failure is analyzed (why it failed) with the full iteration path from problem to fix."}'::jsonb),
    
    (dim_c4_2, 'Plan Fidelity — When they deviated from the C3 plan, did they record why?', 3,
    '{"1": "No reference to the original plan.", "2": "Deviations happen silently.", "3": "Notes when the build differed from the plan.", "4": "Explains every deviation with a clear engineering reason for the change."}'::jsonb),
    
    (dim_c4_3, 'Tests & Data — Do they record actual tests with results or measurements?', 4,
    '{"1": "No testing; assumes it works.", "2": "Mentions testing vaguely; no results.", "3": "Records tests with basic results against the Success Criteria.", "4": "Logs structured tests with real measurements/data and compares them to the C2/C3 targets."}'::jsonb),
    
    (dim_c4_3, 'Evidence-Based Decisions — Do test results drive the next change?', 5,
    '{"1": "Changes are random or cosmetic.", "2": "Changes are made, but not because of test data.", "3": "Test results clearly motivate at least one design change.", "4": "A documented loop of test → measure → decide → change recurs throughout the build."}'::jsonb),
    
    (dim_c4_4, 'Honest Self-Assessment — Is there genuine reflection on struggle and growth?', 6,
    '{"1": "None.", "2": "Superficial (''today went well'').", "3": "Recognizes progress and key learning moments.", "4": "Deep, honest reflection balancing struggles, achievements, and what they learned as makers."}'::jsonb),
    
    (dim_c4_5, 'Descriptive Precision — Do entries say exactly what was done?', 7,
    '{"1": "Missing or just phase names.", "2": "Vague/repetitive (''did research,'' ''worked on it'').", "3": "Clear entries specifying the work done, with minor gaps.", "4": "Vivid, precise descriptions leaving zero ambiguity about each session''s technical work."}'::jsonb),
    
    (dim_c4_6, 'Division of Labor — Does the log show who did what and how the team coordinated?', 8,
    '{"1": "No sign of who did anything.", "2": "Work appears done by one person, or roles are unclear.", "3": "Entries show tasks shared across named members.", "4": "Clear, balanced contribution from all members, with coordination visible across entries."}'::jsonb),
    
    (dim_c4_6, 'Team Decision-Making — Are disagreements or joint decisions documented?', 9,
    '{"1": "None.", "2": "Decisions appear with no discussion.", "3": "Records that the team made key decisions together.", "4": "Documents how the team debated options and resolved disagreements to reach decisions."}'::jsonb);

    -----------------------------------------------------------------------------
    -- C5: Communicate / Presentation (9 indicators)
    -----------------------------------------------------------------------------
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c5_id, 'Problem Framing', 1) RETURNING id INTO dim_c5_1;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c5_id, 'Explaining the Solution', 2) RETURNING id INTO dim_c5_2;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c5_id, 'Evidence of the EDP Journey', 3) RETURNING id INTO dim_c5_3;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c5_id, 'Delivery & Visual Aids', 4) RETURNING id INTO dim_c5_4;
    
    INSERT INTO rubric_dimensions (category_id, name, sort_order) VALUES
    (c5_id, 'Q&A Defense', 5) RETURNING id INTO dim_c5_5;

    -- C5 Indicators
    INSERT INTO rubric_indicators (dimension_id, description, sort_order, criteria) VALUES
    (dim_c5_1, 'Story & Significance — Do they make the audience care about the problem and its target user?', 1,
    '{"1": "Problem unclear; no audience.", "2": "States the problem and audience flatly, no ''why it matters.''", "3": "Frames the problem clearly and explains why it matters to a specific group.", "4": "Opens with a compelling hook that makes the problem''s significance vivid and undeniable."}'::jsonb),
    
    (dim_c5_2, 'How It Works — Can they explain the mechanism (Input → Process → Output) to an audience?', 2,
    '{"1": "Treats the solution as ''magic.''", "2": "Says what it does, not how.", "3": "Walks through the logic of how the solution works.", "4": "Crystal-clear technical walkthrough an outsider could follow."}'::jsonb),
    
    (dim_c5_2, 'STEAM Reasoning — Do they explain which STEAM concepts make it work and how they connect?', 3,
    '{"1": "No STEAM concepts named.", "2": "Names concepts but not how they connect.", "3": "Explains how 1–2 STEAM concepts drive the solution.", "4": "Shows the disciplines working together, with clear interdependence."}'::jsonb),
    
    (dim_c5_3, 'Showing the Process — Do they present iterations, failures, and tests (not just the polished result)?', 4,
    '{"1": "Shows only the final product.", "2": "Mentions ''we changed some things'' with no detail.", "3": "Shows at least one real iteration with its before/after.", "4": "Presents the full journey — failures, tests, and improvements — as proof of engineering thinking."}'::jsonb),
    
    (dim_c5_3, 'Limitations & Next Steps — Do they honestly state what''s still weak and what they''d do next?', 5,
    '{"1": "Claims it is perfect / ignores limits.", "2": "Vague (''we could improve it'').", "3": "Names a real limitation and a next step.", "4": "Sharp, honest critique of their own work with a credible improvement roadmap."}'::jsonb),
    
    (dim_c5_4, 'Participation & Timing — Is speaking time shared and well-paced?', 6,
    '{"1": "One person dominates; poor timing.", "2": "Uneven sharing; rushed or overlong.", "3": "Reasonably even participation and pacing.", "4": "Seamless hand-offs; every member contributes; tightly timed."}'::jsonb),
    
    (dim_c5_4, 'Visual Aids & Demo — Are slides/model/demo clear and supportive?', 7,
    '{"1": "Missing or cluttered.", "2": "Visuals present but distracting or hard to read.", "3": "Clear visuals; prototype shown.", "4": "Polished visuals and an effective live demo that strengthens the message."}'::jsonb),
    
    (dim_c5_5, 'Depth Under Pressure — Can they answer unscripted, challenging questions with real understanding?', 8,
    '{"1": "Cannot answer; freezes or guesses.", "2": "Answers surface-level; struggles with follow-ups.", "3": "Answers most questions correctly and with reasons.", "4": "Answers confidently with evidence, even on tough, unexpected questions."}'::jsonb),
    
    (dim_c5_5, 'Intellectual Honesty — Do they handle the limits of their knowledge well?', 9,
    '{"1": "Bluffs or invents answers.", "2": "Deflects or hides gaps.", "3": "Admits when unsure.", "4": "Admits unknowns gracefully and proposes how they''d find the answer."}'::jsonb);

END $$;
