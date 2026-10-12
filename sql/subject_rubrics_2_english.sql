-- Subject rubrics, part 2 of 4: the English rubrics. Safe to re-run.
--
-- English and Bahasa Indonesia are assessed outside the C1-C5 sequence: they
-- open once C1 is approved and can be used in any order (src/lib/rubric.ts).
-- Text and weights are from the school's rubric documents.

-- Creates a rubric once. A category that already has criteria is left exactly
-- as it is, so re-running never touches marks or weights an admin has changed.
-- p_legacy_code names an older, empty category to turn into this rubric rather
-- than add a second one beside it (the old empty 'ENG' and 'IND').
CREATE OR REPLACE FUNCTION public.seed_subject_rubric(
    p_code TEXT, p_legacy_code TEXT, p_name TEXT, p_sort INT, p_dimension TEXT, p_criteria JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $fn_seed$
DECLARE
    v_cat UUID;
    v_dim UUID;
    v_row JSONB;
    v_n   INT := 0;
BEGIN
    SELECT id INTO v_cat FROM assessment_categories WHERE code = p_code;
    IF v_cat IS NULL AND p_legacy_code IS NOT NULL THEN
        UPDATE assessment_categories ac
           SET code = p_code, name = p_name, rubric_type = 'scale_4', sort_order = p_sort
         WHERE ac.code = p_legacy_code
           AND NOT EXISTS (SELECT 1 FROM rubric_dimensions d WHERE d.category_id = ac.id)
        RETURNING id INTO v_cat;
    END IF;
    IF v_cat IS NULL THEN
        INSERT INTO assessment_categories (code, name, rubric_type, sort_order)
        VALUES (p_code, p_name, 'scale_4', p_sort) RETURNING id INTO v_cat;
    END IF;

    IF EXISTS (SELECT 1 FROM rubric_dimensions WHERE category_id = v_cat) THEN
        RETURN format('%s: already has criteria, left as it is', p_code);
    END IF;

    INSERT INTO rubric_dimensions (category_id, name, sort_order)
    VALUES (v_cat, p_dimension, 1) RETURNING id INTO v_dim;
    FOR v_row IN SELECT value FROM jsonb_array_elements(p_criteria) LOOP
        v_n := v_n + 1;
        INSERT INTO rubric_indicators (dimension_id, description, criteria, weight, sort_order)
        VALUES (v_dim, v_row ->> 'description', v_row -> 'criteria', (v_row ->> 'weight')::numeric, v_n);
    END LOOP;
    RETURN format('%s: created with %s criteria', p_code, v_n);
END
$fn_seed$;

-- Only the SQL editor runs this. Supabase grants new functions to anon and
-- authenticated by default, so those are revoked by name.
REVOKE ALL ON FUNCTION public.seed_subject_rubric(TEXT, TEXT, TEXT, INT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

DO $do_english$
BEGIN
    RAISE NOTICE '%', public.seed_subject_rubric('ENG-INF', 'ENG', 'English Infographic', 7, 'Criteria', $json$[
      {"description": "Language Accuracy (Grammar, Spelling & Punctuation)", "weight": 25, "criteria": {
        "4": "Consistently accurate; sentence structures suit an infographic and the text looks polished.",
        "3": "Mostly accurate; minor errors do not affect meaning.",
        "2": "Meaning is understandable, but recurring errors are noticeable.",
        "1": "Frequent errors in grammar, spelling, or punctuation make the text difficult to understand."}},
      {"description": "Vocabulary & STEAM Terminology", "weight": 15, "criteria": {
        "4": "Precise, varied, and context-appropriate vocabulary that keeps the infographic easy to understand.",
        "3": "Appropriate vocabulary and relevant STEAM terms are used accurately.",
        "2": "Basic vocabulary and some STEAM terms are used, but word choice is repetitive or imprecise.",
        "1": "Vocabulary is very limited or inaccurate; STEAM terms are often misused."}},
      {"description": "Clarity & Conciseness", "weight": 30, "criteria": {
        "4": "Even complex ideas are precise and easy to understand, expressed efficiently without losing accuracy.",
        "3": "Information is clear, accurate, and concise with sufficient detail.",
        "2": "Main ideas are understandable, but some explanations are unclear, incomplete, or wordy.",
        "1": "Information is vague or confusing, and the text is too wordy or too limited to communicate meaning."}},
      {"description": "Organization & Infographic Language", "weight": 20, "criteria": {
        "4": "Flows smoothly and purposefully; brief, readable language is well matched to the visual format.",
        "3": "Logically organized, with concise headings, labels, and captions that connect clearly.",
        "2": "Some organization is evident, but the flow is inconsistent and text is still too long or labels are inconsistent.",
        "1": "Poorly organized; long paragraphs or unclear labels are used; connections between sections are unclear."}},
      {"description": "Paraphrasing & Own Words", "weight": 10, "criteria": {
        "4": "Information is paraphrased naturally and effectively while keeping the original meaning accurate.",
        "3": "Information is generally expressed in the student's own words.",
        "2": "Attempts to paraphrase, but wording stays very close to the original source.",
        "1": "Information is largely copied directly from sources."}}
    ]$json$::jsonb);

    RAISE NOTICE '%', public.seed_subject_rubric('ENG-PRS', NULL, 'English Presentation', 8, 'Criteria', $json$[
      {"description": "Written English on Slides / Canva (Accuracy, Clarity & Conciseness)", "weight": 20, "criteria": {
        "4": "Consistently accurate and polished; text is concise and purposeful, highlighting only essential information.",
        "3": "Written English is generally accurate; text is concise, clear, and supports the spoken presentation.",
        "2": "Several language errors, but meaning is understandable; some slides are wordy, vague, or overloaded.",
        "1": "Frequent grammar, spelling, or wording errors; text is unclear, too long, or repetitive."}},
      {"description": "Spoken Grammar & Vocabulary (incl. STEAM Terminology)", "weight": 25, "criteria": {
        "4": "Accurate and varied sentence structures; precise, discipline-appropriate vocabulary used naturally and effectively.",
        "3": "Spoken grammar is generally accurate; appropriate, varied vocabulary and STEAM terms are used accurately.",
        "2": "Sentences are understandable, but recurring grammar errors sometimes affect clarity; vocabulary is basic or imprecise.",
        "1": "Frequent grammar errors or incomplete sentences interfere with meaning; vocabulary is very limited and STEAM terms are misused."}},
      {"description": "Coherence & Organization of Spoken Ideas", "weight": 15, "criteria": {
        "4": "Ideas are highly coherent, with smooth transitions that create a unified group presentation.",
        "3": "Ideas are clear and logical, with appropriate transitions connecting speakers and sections.",
        "2": "Main ideas are understandable, but transitions between speakers or sections are sometimes weak.",
        "1": "Ideas are difficult to follow, disconnected, or in an unclear sequence."}},
      {"description": "Pronunciation, Intonation & Fluency", "weight": 25, "criteria": {
        "4": "Consistently clear, with effective stress, rhythm, and intonation; speaks smoothly and naturally without heavy reliance on read or memorized text.",
        "3": "Pronunciation is clear; stress and intonation support meaning; speech is generally smooth with limited reliance on notes.",
        "2": "Generally understandable, but pronunciation or intonation sometimes causes difficulty; noticeable hesitation or reliance on notes.",
        "1": "Pronunciation often makes the group hard to understand; long pauses, word-for-word reading, or excessive fillers."}},
      {"description": "Response to Questions (Q&A)", "weight": 15, "criteria": {
        "4": "Responds clearly, elaborates when needed, and uses accurate, effective English to clarify or defend ideas.",
        "3": "Responds to most questions clearly and relevantly using appropriate English.",
        "2": "Responds to basic questions, but answers are brief, hesitant, or linguistically limited.",
        "1": "Difficulty understanding or answering questions in English; answers are often unclear or irrelevant."}}
    ]$json$::jsonb);
END
$do_english$;

DO $do_done$ BEGIN RAISE NOTICE '== PART 2 OF 4 DONE: English rubrics =='; END $do_done$;
