import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Google Doc Text Extraction ─────────────────────
async function fetchGoogleDocText(url: string): Promise<string> {
    try {
        // Extract Google Doc ID from URL
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) return '';
        const docId = match[1];

        // Fetch as plain text via Google's export URL
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const response = await fetch(exportUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STEAMBot/1.0)' },
            redirect: 'follow',
        });

        if (!response.ok) return '';
        const text = await response.text();
        // Limit to ~15000 chars to stay within token limits
        return text.slice(0, 15000);
    } catch (e) {
        console.error('Failed to fetch Google Doc text:', e);
        return '';
    }
}

// Rubric criteria from c1_prompt.md — gives the AI specific scoring guidance per category
function buildRubricContext(categoryName: string): string {
    const lowerCat = categoryName.toLowerCase();

    if (lowerCat.includes('title') || lowerCat.includes('judul')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Indicator: Meaning & Purpose
  1 (Beginning): Vague; hard to tell what the project is about.
  2 (Developing): Tells the topic, but the goal is slightly unclear.
  3 (Proficient): Clearly states what the project is and its goal.
  4 (Exemplary): Creative and immediately tells the "Why" and "What."

Indicator: Originality
  1 (Beginning): Very common/generic (e.g., 'The Volcano').
  2 (Developing): A standard topic with a small personal twist.
  3 (Proficient): An uncommon approach to a known problem.
  4 (Exemplary): Highly original; a unique perspective or niche topic.

Indicator: Concise & Core
  1 (Beginning): Too long or uses unnecessary jargon.
  2 (Developing): A bit wordy; contains extra info.
  3 (Proficient): Short and punchy; hits the main point.
  4 (Exemplary): Perfectly concise; uses a "hook" effectively.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    if (lowerCat.includes('problem') || lowerCat.includes('solution') || lowerCat.includes('masalah') || lowerCat.includes('solusi')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Indicator: Theme Connection
  1 (Beginning): No clear link to the assigned theme.
  2 (Developing): Loose link; requires some guessing.
  3 (Proficient): Solid connection; mentions the theme directly.
  4 (Exemplary): Seamless integration; the theme is the project's heart.

Indicator: Real-Life Context
  1 (Beginning): Abstract; no clear use for real people.
  2 (Developing): Hypothetical; could happen but feels distant.
  3 (Proficient): Directly linked to a common real-world issue.
  4 (Exemplary): Solves a specific, relatable "pain point" in their community.

Indicator: Conceptual Understanding
  1 (Beginning): Mentions subjects but no clear application.
  2 (Developing): Uses a concept but doesn't explain the "how."
  3 (Proficient): Shows a good grasp of the underlying subject theory.
  4 (Exemplary): Demonstrates deep understanding through a clever application.

Indicator: STEAM Integration
  1 (Beginning): Only uses 1 field (e.g., just Science).
  2 (Developing): Uses 2 fields but they feel separate.
  3 (Proficient): Naturally blends 2-3 STEAM fields together.
  4 (Exemplary): Truly interdisciplinary; fields work together for the solution.

Indicator: Ability & Grade Level
  1 (Beginning): Far too simple or way too complex for their age.
  2 (Developing): Slightly off-target for their current level.
  3 (Proficient): Appropriately challenging for their grade level.
  4 (Exemplary): Perfectly balanced; shows growth within their grade level.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    // C2: Ask & Research rubric
    if (lowerCat.includes('c2') || lowerCat.includes('ask') || lowerCat.includes('research')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Dimension: Ask (Problem Elaboration & Impact)
  4 (Excellent): Masterfully defines a clear problem relevant to the student's life. Explicitly breaks down causes and real-world impacts. Relies entirely on hard facts and data, not personal opinions or feelings.
  3 (Proficient): Clearly states the problem and touches on causes/impacts. Uses some data but might occasionally rely on assumptions or general statements.
  2 (Developing): The problem is vague. Briefly mentions causes/impacts but lacks depth. Heavily reliant on personal opinions rather than factual data.
  1 (Beginning): Unclear, irrelevant, lacks explanation of causes/impacts. Zero facts or data provided.

Dimension: Research Quality & Source Diversity
  4 (Excellent): Gathers highly credible data from academic resources. Elevates research by incorporating real-world data from expert interviews and/or deep analysis of existing solutions/products.
  3 (Proficient): Uses good, credible academic or online resources. May mention existing products but lacks deep analysis or expert input.
  2 (Developing): Research relies on basic, potentially non-credible sources. No mention of existing solutions, expert input, or deep academic literature.
  1 (Beginning): No meaningful research, data, or credible sources provided.

Dimension: STEAM Interdisciplinary Connection
  4 (Excellent): Masterfully explains how specific, advanced concepts from 2 or more STEAM fields intertwine to explain the problem and the theory behind it. Connections are deeply analyzed.
  3 (Proficient): Clearly explains the theoretical involvement of 2 or more STEAM fields. Connections make sense but might lack deep, critical analysis.
  2 (Developing): Mentions different STEAM fields but fails to clearly elaborate on how their theoretical concepts specifically connect to the problem.
  1 (Beginning): Focuses entirely on the theory of a single subject, missing the interdisciplinary nature of STEAM.

Dimension: Critical Analysis & Opportunity
  4 (Excellent): Brilliantly critiques the problem space and research. Uses the data to identify a specific, clear opportunity to create something genuinely new or significantly better than existing solutions.
  3 (Proficient): Analyzes the research well enough to spot an opportunity for a project, though the proposed innovation might be slightly standard or generic.
  2 (Developing): Takes data at face value without critical thought. Struggles to identify a clear, specific opportunity to improve upon existing solutions.
  1 (Beginning): Shows no critical analysis. Fails entirely to identify any opportunity to create a solution or improve upon existing ideas.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    // C3: Solution & Execution rubric
    if (lowerCat.includes('c3') || lowerCat.includes('execution') || lowerCat.includes('solution') || lowerCat.includes('imagine') || lowerCat.includes('plan')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

Dimension: Execution & Planning (Materials, Budget, Timeline)
  4 (Excellent): Exhaustive, sequential step-by-step execution plan. Comprehensive material list with a highly detailed, realistic budget/price list. Clear and actionable timeline.
  3 (Proficient): Solid plan and timeline. Material list is present, but the budget might lack minor details or execution steps skip minor transitional phases.
  2 (Developing): Timeline is vague or unrealistic. Material list is incomplete, or budget is entirely missing. Execution steps are out of order or lack necessary detail.
  1 (Beginning): No timeline, budget, or coherent execution steps are provided.

Dimension: Concept, Design & Rationale
  4 (Excellent): High-quality visual representation (diagram, illustration, blueprint) that perfectly maps to the plan. Exceptional, logical rationale defending exactly why this solution is the best choice over alternatives.
  3 (Proficient): Basic visual representation included. Rationale is present and makes sense, but justification could be stronger or more deeply analyzed.
  2 (Developing): Visuals are messy, confusing, or poorly described. Rationale is weak (e.g., "I chose this because it's easy to make").
  1 (Beginning): No visuals or diagrams provided or described. No rationale is given for the chosen solution.

Dimension: Risk Assessment & Contingency
  4 (Excellent): Sharp foresight identifying highly specific, realistic risks during the prototype building phase. Strong, actionable, and logical contingency plan ("Plan B") to mitigate these exact problems.
  3 (Proficient): Identifies potential risks and offers basic mitigation ideas or a general Plan B, though it may lack specific technical details.
  2 (Developing): Mentions only generic, surface-level risks (e.g., "it might break") and provides a poor or entirely missing contingency plan.
  1 (Beginning): Ignores risk assessment completely. Assumes a flawless execution with zero backup plan.

Dimension: STEAM Application in the Build
  4 (Excellent): The construction and function of the prototype explicitly require the application of multiple STEAM concepts. The "making" phase is a true interdisciplinary engineering and design challenge.
  3 (Proficient): The build process applies 1-2 STEAM concepts well, though execution might lean heavily toward a single discipline rather than a fully integrated approach.
  2 (Developing): The prototype barely utilizes the STEAM theories discussed in earlier chapters. The actual build is overly simplistic or disconnected from core concepts.
  1 (Beginning): The prototype has absolutely no connection to STEAM application; it operates more like a basic arts-and-crafts project than a functional STEAM solution.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    // C4: Logbook & Process rubric
    if (lowerCat.includes('c4') || lowerCat.includes('logbook') || lowerCat.includes('process')) {
        return `DETAILED RUBRIC FOR THIS CATEGORY ("${categoryName}"):

* **Dimension 1: Structural Integrity & Consistency**
* **4 (Excellent):** Professional organization. Entries for every date worked, highly readable structure, and exceptionally clear language documenting a logical start-to-finish progression.
* **3 (Proficient):** Clear structure and communicative language. Includes most relevant dates and entries, showing logical progression despite minor gaps.
* **2 (Developing):** Structure is somewhat disorganized, dates are missing, or entries skip major timeframes, making it hard to follow the project flow. Language is occasionally confusing.
* **1 (Beginning):** Completely incoherent mess. Few entries, no clear dates or timeline, impossible to understand the project progression.

* **Dimension 2: Problem-Solving Loop & Iteration (Failures & Fixes)**
* **4 (Excellent):** Candidly and precisely documents specific technical failures or struggles. Clearly details the iterative *process* taken to analyze why something failed and how they attempted to fix it ("Plan B" loop). There is a documented solution/follow-up for every single identified issue.
* **3 (Proficient):** Lists problems encountered and includes successful follow-up solutions. Shows that problem-solving occurred, though it might lack deep detail on the steps between failure and final solution.
* **2 (Developing):** Vaguely mentions difficulties or lists them without detail. Many problems identified lack corresponding solutions or follow-up actions.
* **1 (Beginning):** Documents only successes or surface-level work. Zero evidence of technical struggle, failure documentation, or iterative improvement.

* **Dimension 3: Reflection on Progress & Honest Assessment**
* **4 (Excellent):** Features a deep, honest self-reflection of the journey, balancing analysis of struggles against recognition of achievements and learning points. Evaluates *how* the process made them feel as makers.
* **3 (Proficient):** Includes reflective summaries that recognize progress and identify key learning milestones, though the analysis of personal growth or struggle could be deeper.
* **2 (Developing):** Reflection is highly superficial (e.g., "Today went well") and lacks any genuine analysis of struggles or successes. It reads like a dry checklist.
* **1 (Beginning):** No self-reflection or honest assessment included at all.

* **Dimension 4: Depth of Task Description (Replaces Tangible Evidence)**
* **4 (Excellent):** Activity descriptions are exceptionally detailed and articulate. The text paints a vivid, precise picture of exactly what specific technical, research, or building tasks were performed during that session, leaving no ambiguity about the work done.
* **3 (Proficient):** Activity descriptions are clear and specify what was done, though some technical details, materials used, or specific steps might be slightly generalized.
* **2 (Developing):** Task descriptions are overly vague or repetitive (e.g., "did research," "worked on project," "cut materials"). It is hard to know exactly what was accomplished during the session.
* **1 (Beginning):** Descriptions are missing, entirely uninformative, or just list the name of the project phase without explaining the actual work done.

Use these rubric descriptors to determine the exact score for each indicator.`;
    }

    // Fallback for other categories — use generic 1-4 guidance
    return `RUBRIC GUIDANCE FOR "${categoryName}":
Use the 1-4 scoring scale. Match each indicator's score to the level that best describes the student's work:
  1 (Beginning): Minimal effort, missing core requirements.
  2 (Developing): Some understanding shown but needs significant improvement.
  3 (Proficient): Meets expectations with solid, clear work.
  4 (Exemplary): Exceptional, creative, goes above and beyond.`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { project, categoryName, indicators, googleDocUrl, assessLogbooks } = body;

        if (!project || !categoryName || !indicators) {
            return NextResponse.json(
                { error: 'Missing required fields (project, categoryName, or indicators)' },
                { status: 400 }
            );
        }

        // Validate API Key
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'Server missing GEMINI_API_KEY configuration.' },
                { status: 500 }
            );
        }

        // Create dynamic schema properties for the scores based on indicators
        const scoreProperties: Record<string, any> = {};
        indicators.forEach((i: any) => {
            scoreProperties[i.id] = {
                type: SchemaType.INTEGER,
                description: `Score for indicator: ${i.description}`
            };
        });

        // Determine if this is a category without a decision status (C2, C3)
        const isC2 = categoryName.toLowerCase().includes('c2') || categoryName.toLowerCase().includes('ask');
        const isC3 = categoryName.toLowerCase().includes('c3') || categoryName.toLowerCase().includes('solution') || categoryName.toLowerCase().includes('execution') || categoryName.toLowerCase().includes('imagine') || categoryName.toLowerCase().includes('plan');
        const isC4 = categoryName.toLowerCase().includes('c4') || categoryName.toLowerCase().includes('logbook') || categoryName.toLowerCase().includes('process');
        const isNoStatusCategory = isC2 || isC3 || isC4;

        const responseSchemaProperties: Record<string, any> = {
            scores: {
                type: SchemaType.OBJECT,
                properties: scoreProperties,
                description: "A map of indicator IDs as string keys mapping to their assessed integer score values."
            },
            teacher_comment: {
                type: SchemaType.STRING,
                description: isC4 
                    ? "A single, coherent, casual paragraph providing sharp, objective feedback based on the logbook rubric. State the final score, process category, an objective compliment, a sharp critique, and an actionable suggestion."
                    : isNoStatusCategory
                        ? "A structured, critical feedback using numbered bullet points. For each of the 4 dimensions, state the score, WHY that score was given with specific evidence, and a concrete IMPROVE action. Be sharp and direct."
                        : "A single, casual, friendly feedback paragraph written directly to the student. Must mention one specific strength and one specific suggestion for improvement."
            }
        };
        const requiredFields = ["scores", "teacher_comment"];

        if (!isNoStatusCategory) {
            responseSchemaProperties.suggested_status = {
                type: SchemaType.STRING,
                description: "The suggested overarching status for the project based on the scores. MUST be exactly one of: 'approved', 'revision', 'disapproved'."
            };
            requiredFields.push("suggested_status");
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.2, // Low temperature for consistent grading
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: responseSchemaProperties,
                    required: requiredFields
                }
            }
        });

        // ===== RUBRIC-BASED PROMPT (from c1_prompt.md) =====
        // Build the rubric context string based on the category being assessed
        const rubricContext = buildRubricContext(categoryName);

        // Extract problem, solution, and key concepts from project abstract
        let problemDesc = project.problem_description || '';
        let solutionDesc = project.solution_description || '';
        let keyConcepts = project.key_concepts || {};

        if (project.abstract) {
            try {
                const parsedAbstract = typeof project.abstract === 'string' ? JSON.parse(project.abstract) : project.abstract;
                if (parsedAbstract.problem) problemDesc = parsedAbstract.problem;
                if (parsedAbstract.solution) solutionDesc = parsedAbstract.solution;
                if (parsedAbstract.keyConcepts) keyConcepts = parsedAbstract.keyConcepts;
            } catch (e) {
                console.error("Failed to parse project abstract:", e);
            }
        }

        let prompt = '';

        if (categoryName.toLowerCase().includes('c2') || categoryName.toLowerCase().includes('ask')) {
            // ===== C2: Ask & Research — reads Google Doc content =====
            let docText = '';
            const docUrl = googleDocUrl || project.google_doc_url;
            if (docUrl) {
                docText = await fetchGoogleDocText(docUrl);
            }

            prompt = `### System Instructions for STEAM Project Assessment API (Phase: Ask & Research)

**Role & Objective**
You are a STEAM Education Expert and Project Assessment AI. Your job is to evaluate the "Ask and Research" phase (Problem Description and Theoretical Literature) of a student's STEAM project. You will analyze how well the student defines a real-world problem, backs it up with credible research, connects interdisciplinary STEAM theories, and identifies a clear opportunity for innovation.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

You are evaluating content from the student's written document, focusing specifically on **Bab 1 (Introduction / Problem Description)** and **Bab 2 (Literature Review / Theoretical Framework)**.

**Student Project Info**
* Title: ${project.title}
* Problem Summary: ${problemDesc || 'See document content below.'}
* Solution Summary: ${solutionDesc || 'See document content below.'}
* Key Concepts: ${JSON.stringify(keyConcepts || {})}

**Student Document Content (from Google Doc — focus on Bab 1 & Bab 2):**
<DOCUMENT>
${docText || 'No document content available. Assess based on the project data provided above.'}
</DOCUMENT>

**Evaluation Rubric (Score each dimension 1 to 4)**
${rubricContext}

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

**Scoring Logic (Max 16 Points)**
Calculate the total score by adding the points from all 4 dimensions, then determine the category:
* 13 to 16 Points: Exemplary — Rock-solid foundation, fact-based, diverse research, strong STEAM connections, clear innovation gap.
* 9 to 12 Points: Proficient — Strong start but noticeable gaps in data, source diversity, or opportunity definition.
* 5 to 8 Points: Developing — Shaky foundation, relies on feelings over facts, thin research, weak interdisciplinary connection.
* 4 Points: Beginning — Fails to meet basic requirements of research and problem-definition.

**Output Constraints**
You must output your evaluation in the 'teacher_comment' field using a **structured, critical format**. Be SHARP and DIRECT — do not sugarcoat. Use the following format:

**Overall: X/16 — [Category: Exemplary/Proficient/Developing/Beginning]**

Then provide a numbered breakdown for EACH of the 4 dimensions:

1. **Ask (Problem Elaboration & Impact) — Score: X/4**
   - WHY this score: [Cite specific evidence from their document — what they did well or failed to do]
   - IMPROVE: [Concrete, actionable step to raise their score]

2. **Research (Quality & Source Diversity) — Score: X/4**
   - WHY this score: [Cite specific evidence — type of sources used, what's missing]
   - IMPROVE: [Specific suggestion, e.g. "Add at least 2 peer-reviewed journal sources" or "Conduct an expert interview"]

3. **Interdisciplinary (STEAM Connection) — Score: X/4**
   - WHY this score: [Which STEAM fields are present/missing, how deep is the connection]
   - IMPROVE: [Name the missing discipline and how to integrate it]

4. **Analysis (Critical Analysis & Opportunity) — Score: X/4**
   - WHY this score: [Did they critically analyze or just summarize? Is there a clear innovation gap?]
   - IMPROVE: [What kind of analysis or comparison should they add]

Be brutally honest. If the work is weak, say so directly. If a dimension deserves a 1 or 2, explain exactly what is missing. Do NOT be generous — grade strictly according to the rubric.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (categoryName.toLowerCase().includes('c3') || categoryName.toLowerCase().includes('solution') || categoryName.toLowerCase().includes('execution') || categoryName.toLowerCase().includes('imagine') || categoryName.toLowerCase().includes('plan')) {
            // ===== C3: Solution & Execution — reads Google Doc content =====
            let docText = '';
            const docUrl = googleDocUrl || project.google_doc_url;
            if (docUrl) {
                docText = await fetchGoogleDocText(docUrl);
            }

            prompt = `### System Instructions for STEAM Project Assessment API (Phase: Solution & Execution - C3)

**Role & Objective**
You are a sharp, objective STEAM Education Expert and Project Assessment AI. Your job is to evaluate the "Solution & Execution" phase (typically found in Bab 3 and Bab 4) of a student's STEAM project. You will analyze how well the student has planned the actual creation of their prototype, focusing heavily on execution steps, budgeting, visual design, risk mitigation, and how well the physical/digital build actually applies STEAM concepts. You must be fair and highly analytical. Do not sugarcoat your critiques.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

You are evaluating content from the student's written document, focusing specifically on **Bab 3 (Solution Design & Planning)** and **Bab 4 (Prototype Execution & Build)**.

**Student Project Info**
* Title: ${project.title}
* Problem Summary: ${problemDesc || 'See document content below.'}
* Solution Summary: ${solutionDesc || 'See document content below.'}
* Key Concepts: ${JSON.stringify(keyConcepts || {})}

**Student Document Content (from Google Doc — focus on Bab 3 & Bab 4):**
<DOCUMENT>
${docText || 'No document content available. Assess based on the project data provided above.'}
</DOCUMENT>

**Evaluation Rubric (Score each dimension 1 to 4)**
${rubricContext}

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

**Scoring Logic (Max 16 Points)**
Calculate the total score by adding the points from all 4 dimensions, then determine the category:
* 13 to 16 Points: Exemplary — Bulletproof execution plan, flawless budget/timeline, sharp risk mitigation, deeply integrated STEAM build.
* 9 to 12 Points: Proficient — Solid blueprint, but needs minor detailing in the budget, rationale, or contingency planning.
* 5 to 8 Points: Developing — Weak execution plan, missing visuals/budget, ignoring risks, or lacking STEAM application in the build.
* 4 Points: Beginning — Fails to provide a workable, logical solution plan.

**Output Constraints**
You must output your evaluation in the 'teacher_comment' field using a **structured, critical format**. Be SHARP and DIRECT — do not sugarcoat. Use the following format:

**Overall: X/16 — [Category: Exemplary/Proficient/Developing/Beginning]**

Then provide a numbered breakdown for EACH of the 4 dimensions:

1. **Execution & Planning (Materials, Budget, Timeline) — Score: X/4**
   - WHY this score: [Cite specific evidence from their document — what they did well or failed to do]
   - IMPROVE: [Concrete, actionable step to raise their score]

2. **Concept, Design & Rationale — Score: X/4**
   - WHY this score: [Cite specific evidence — quality of visuals, strength of rationale]
   - IMPROVE: [Specific suggestion, e.g. "Add a labeled diagram" or "Justify why this solution beats alternatives"]

3. **Risk Assessment & Contingency — Score: X/4**
   - WHY this score: [Are risks specific? Is there a real Plan B?]
   - IMPROVE: [What specific risks should they address and how]

4. **STEAM Application in the Build — Score: X/4**
   - WHY this score: [Which STEAM fields are applied in the build? Is it truly interdisciplinary?]
   - IMPROVE: [Which disciplines are missing and how to integrate them into the build]

Be brutally honest. If the work is weak, say so directly. If a dimension deserves a 1 or 2, explain exactly what is missing. Do NOT be generous — grade strictly according to the rubric.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (categoryName.toLowerCase().includes('c4') || categoryName.toLowerCase().includes('logbook') || categoryName.toLowerCase().includes('process')) {
            // ===== C4: Logbook & Process — reads assessLogbooks array =====
            let logbookText = '';
            if (assessLogbooks && Array.isArray(assessLogbooks)) {
                logbookText = assessLogbooks.map((l: any, i: number) => {
                    return `Log Entry ${i + 1}:\nDate: ${new Date(l.entry_date).toLocaleDateString()}\nAuthor: ${l.student_email}\nTask Describe: ${l.task}\nResult & Reflection: ${l.result}\nFeedback/Thoughts: ${l.feedback || 'None'}\n---`;
                }).join('\n');
            }

            prompt = `### System Instructions for STEAM Project Assessment API (Phase: Logbook & Process - C4)

**Role & Objective**
You are a sharp, analytical STEAM Education Expert and Project Assessment AI. Your job is to evaluate a student's project journal or logbook. The overriding objective of this assessment is to focus on the **process**, not just the final product. You will analyze how well the student documented their journey—including technical failures, personal struggles, unexpected achievements, the specific iterative steps taken to solve problems, and the depth of their written task descriptions. You must be fair and highly critical. Do not sugarcoat your assessments; provide objective feedback that helps students understand the value of engineering documentation.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

**Student Project Info**
* Title: ${project.title}
* Problem Summary: ${problemDesc || 'N/A'}

**Student Logbook Submissions:**
<LOGBOOKS>
${logbookText || 'No logbook entries available. Fail this assessment for lack of effort.'}
</LOGBOOKS>

**Evaluation Rubric (Score each dimension 1 to 4)**
${rubricContext}

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

**Scoring Logic & Categorization (Max 16 Points)**
Calculate the total score by adding the points from all 4 dimensions, then determine the project's process category:

* **13 to 16 Points: Exemplary** (Shows deep engagement with the engineering loop. The logbook is a highly descriptive true history of failure, iteration, and achievement).
* **9 to 12 Points: Proficient** (Solid documentation, covers the basics of progress, but needs deeper descriptive detail on tasks or struggles).
* **5 to 8 Points: Developing** (Weak documentation of struggle, vague task descriptions, superficial reflections, or inconsistent organization).
* **4 Points: Beginning** (Incomplete or incoherent record that is useless as documentation of process).

**Strict Output Constraints**
You MUST output your entire evaluation as a **single, casual paragraph** in the 'teacher_comment' field. Even though the tone is casual, the feedback must be sharp, objective, and analytical—no sugarcoating. Do not use bullet points, numbered lists, or line breaks. Within this single paragraph, you must naturally weave in:

1. The final score (e.g., X/16) and the process category.
2. An objective compliment highlighting a specific strength in their documentation process.
3. A sharp, direct critique pointing out a specific weakness, vague task description, or flaw in their documentation logic.
4. A concrete, actionable suggestion on how to make the written logbook a stronger, more descriptive engineering document.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (categoryName.toLowerCase().includes('c1') || categoryName.toLowerCase().includes('abstract')) {
            // New C1 specific prompt based on the latest 16-point rubric
            prompt = `### System Instructions for STEAM Project Filtration API

**Role & Objective**
You are a STEAM Education Expert and Project Filtration System. Your job is to evaluate student project proposals to determine if they qualify as true STEAM projects. A valid STEAM project must focus on building a tangible prototype (physical or digital) that solves a real-world problem by meaningfully integrating multiple STEAM disciplines (Science, Technology, Engineering, Art, Mathematics).

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

**Input Data Expectation**
You will receive student proposals containing:
* Title: ${project.title}
* Problem: ${problemDesc || 'Not provided.'}
* Solution (Prototype): ${solutionDesc || 'Not provided.'}
* Key Concepts (STEAM subjects): ${JSON.stringify(keyConcepts || {})}
* Submission Status: On-time

**Evaluation Rubric (Score each dimension 1 to 4)**
${rubricContext}

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

**Scoring & Decision Logic (Max 16 Points)**
1. Calculate the total score across the 4 dimensions.
2. Apply the **Time Modifier**: If the project was NOT submitted on time, automatically drop the final decision down by one tier.
3. Determine the final decision (suggested_status):
* 'approved' (13 to 16 Points): Accepted. Green light to start building the prototype.
* 'revision' (8 to 12 Points): Accepted with Revision. Needs tweaks to the title, real-world connection, subject integration, or prototype plan before building.
* 'disapproved' (4 to 7 Points): Not Accepted. Misses the mark on multiple fronts; needs a completely new idea.

**Output Constraints**
You must always output your final evaluation as a **single, casual paragraph** in the 'teacher_comment' field. This paragraph must naturally include:
1. The final decision and the total score out of 16.
2. A brief highlight of what they did well.
3. Specific feedback on what needs to be fixed based on the rubric.
4. **Key Concept Feedback**: Comment on the student's Key Concepts listed above. Mention which concepts connect well to their project. If any concept seems unrelated or forced, point it out. If an important STEAM field is missing from their key concepts, suggest it briefly.

Do not use bullet points or multiple paragraphs. Keep the language simple and clear (ESL-friendly). Provide your output exactly matching the JSON schema.`;

        } else {
            // General prompt for other categories
            prompt = `You are an encouraging STEAM educator assistant. Your task is to review a student's STEAM project based on a specific rubric and provide scores and a single, casual feedback paragraph.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

You are assessing the category: "${categoryName}".

CORE ASSESSMENT FOCUS:
- Interdisciplinary Purpose: How well are Science, Tech, Engineering, Art, and Math combined?
- Real-World Context: Is this a problem people actually face?
- Prototype Potential: Is there a clear path to building a physical or digital model?

SCORING SCALE (1-4):
- 1 (Beginning): Minimal effort, missing core requirements, vague or unclear.
- 2 (Developing): Shows some understanding but lacks depth or clarity. Needs significant improvement.
- 3 (Proficient): Meets expectations. Solid work that covers the requirements clearly.
- 4 (Exemplary): Exceptional work. Creative, thorough, and goes above and beyond.

${rubricContext}

STUDENT PROJECT DATA:
<TITLE>
${project.title}
</TITLE>
<PROBLEM>
${problemDesc || 'Not provided.'}
</PROBLEM>
<SOLUTION>
${solutionDesc || 'Not provided.'}
</SOLUTION>
<KEY_CONCEPTS>
${JSON.stringify(keyConcepts || {})}
</KEY_CONCEPTS>

Assessment Indicators (you MUST score each one using the 1-4 scale above):
${JSON.stringify(indicators, null, 2)}

FEEDBACK GUIDELINES:
1. Analyze the project data against EACH indicator using the rubric criteria above.
2. Provide an integer score (1-4) for EVERY indicator ID in your 'scores' map.
3. CRITICAL STEAM ENFORCEMENT: This is a STEAM project. It MUST combine Science, Tech, Engineering, Art, and Math. If the project reads like a simple, single-subject project (e.g. just a regular science experiment or just a math worksheet) with no clear interdisciplinary connection:
   - You MUST score it very low on any related indicators.
   - Your 'teacher_comment' MUST provide specific, firm criticism about this lack of integration, challenging them to add missing STEAM elements.
   - You MUST NOT give an 'approved' status.
4. Your 'teacher_comment' MUST be a single casual, friendly paragraph. Always prioritize suggestions for improvement over just pointing out flaws. Mention ONE specific strength and ONE specific area to improve with a concrete suggestion.
5. Your 'suggested_status' should be:
   - 'approved' if most scores are 3 or 4 AND the project shows true interdisciplinary STEAM integration.
   - 'revision' if most scores are 2 or below OR if the project lacks STEAM integration (single-subject).
   - 'disapproved' only if most scores are 1 and effort is completely absent.

Provide your output exactly matching the JSON schema.
`;
        }

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let jsonPayload;
        try {
            jsonPayload = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", responseText);
            return NextResponse.json({ error: 'Failed to process AI response formatting.' }, { status: 500 });
        }

        return NextResponse.json(jsonPayload);

    } catch (error: any) {
        console.error('AI Assessment Error:', error);
        return NextResponse.json(
            { error: error.message || 'An error occurred during AI assessment.' },
            { status: 500 }
        );
    }
}
