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

// ─── Dynamic Rubric Context Builder ─────────────────
// Builds rubric text from the DB-stored criteria on each indicator
function buildDynamicRubricContext(indicators: any[]): string {
    return indicators.map(ind => {
        const criteria = ind.criteria || {};
        const levels = Object.entries(criteria)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, desc]) => `  ${level}: ${desc}`)
            .join('\n');

        if (!levels) {
            return `Indicator: "${ind.description}"\n  (No specific criteria defined — use generic 1-4 scale)`;
        }
        return `Indicator: "${ind.description}"\n${levels}`;
    }).join('\n\n');
}

// ─── Dynamic Scoring Logic Builder ──────────────────
// Calculates max score and percentage thresholds dynamically
function buildScoringLogic(indicators: any[], maxScale: number = 4) {
    const indicatorCount = indicators.length;
    const maxScore = indicatorCount * maxScale;
    const approvedThreshold = Math.ceil(maxScore * 0.80);
    const revisionThreshold = Math.ceil(maxScore * 0.55);
    return { indicatorCount, maxScore, approvedThreshold, revisionThreshold };
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

        // Determine if this is a category without a decision status (C2, C3, C4)
        const lowerCat = categoryName.toLowerCase();
        const isC2 = lowerCat.includes('c2') || lowerCat.includes('ask');
        const isC3 = lowerCat.includes('c3') || lowerCat.includes('solution') || lowerCat.includes('execution') || lowerCat.includes('imagine') || lowerCat.includes('plan');
        const isC4 = lowerCat.includes('c4') || lowerCat.includes('logbook') || lowerCat.includes('process');
        const isC1 = lowerCat.includes('c1') || lowerCat.includes('abstract');
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
                        ? "A structured, critical feedback using numbered bullet points. For each indicator, state the score, WHY that score was given with specific evidence, and a concrete IMPROVE action. Be sharp and direct."
                    : isC1
                        ? "A structured, holistic feedback organized into clearly labeled sections: PROBLEM STATEMENT, PROPOSED SOLUTION, THEME ALIGNMENT, KEY CONCEPTS, TITLE, and OVERALL VERDICT. Each section uses bullet points. Do NOT use emojis. Do NOT mention raw scores or percentages in the comment."
                    : "A single casual paragraph. If approved: encouraging with forward-looking guidance. If revision/disapproved: critical and thorough, listing ALL weak areas with what to fix. Do NOT mention scores or percentages."
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

        // ===== DYNAMIC RUBRIC CONTEXT (from DB criteria) =====
        const rubricContext = buildDynamicRubricContext(indicators);
        const { indicatorCount, maxScore, approvedThreshold, revisionThreshold } = buildScoringLogic(indicators);

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

        // ===== PERCENTAGE-BASED SCORING BLOCK (shared by all prompts) =====
        const scoringBlock = `
**Scoring & Decision Logic (Max ${maxScore} Points from ${indicatorCount} indicators × 4)**
1. Calculate the total score by adding the points from all ${indicatorCount} indicators.
2. Calculate the percentage: total / ${maxScore} × 100.
3. Determine the category:
  * ≥80% (${approvedThreshold}+ points): Exemplary — Outstanding work across the board.
  * 55–79% (${revisionThreshold}–${approvedThreshold - 1} points): Proficient — Solid but has noticeable gaps that need improvement.
  * <55% (below ${revisionThreshold} points): Developing/Beginning — Significant weaknesses; needs major revision.`;

        const decisionBlock = `
**Decision Logic (Max ${maxScore} Points from ${indicatorCount} indicators × 4)**
1. Calculate the total score by adding the points from all ${indicatorCount} indicators.
2. Calculate the percentage: total / ${maxScore} × 100.
3. Determine the final decision (suggested_status):
  * 'approved' (≥80%, ${approvedThreshold}+ points): Accepted. Green light to proceed.
  * 'revision' (55–79%, ${revisionThreshold}–${approvedThreshold - 1} points): Accepted with Revision. Needs improvements before proceeding.
  * 'disapproved' (<55%, below ${revisionThreshold} points): Not Accepted. Misses the mark on multiple fronts.`;


        if (isC2) {
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

You are evaluating content from the student's Google Doc. The Google Doc has 2 tabs: one for the cover and one for the body where all the project information is located. For the C2 Assessment, focus specifically on **Section 1 (Background)** and **Section 2 (STEAM Element)** from the document body tab.

**Student Project Info**
* Title: ${project.title}
* Problem Summary: ${problemDesc || 'See document content below.'}
* Solution Summary: ${solutionDesc || 'See document content below.'}
* Key Concepts: ${JSON.stringify(keyConcepts || {})}

**Student Document Content (from Google Doc — focus on Section 1: Background & Section 2: STEAM Element):**
<DOCUMENT>
${docText || 'No document content available. Assess based on the project data provided above.'}
</DOCUMENT>

**Evaluation Rubric (Score each indicator 1 to 4 using the criteria below)**
${rubricContext}

Assessment Indicators (you MUST score each one):
${JSON.stringify(indicators.map((i: any) => ({ id: i.id, description: i.description })), null, 2)}

${scoringBlock}

**Output Constraints**
You must output your evaluation in the 'teacher_comment' field using a **structured, critical format**. Be SHARP and DIRECT — do not sugarcoat. Use the following format:

**Overall: X/${maxScore} (Y%) — [Category: Exemplary/Proficient/Developing/Beginning]**

Then provide a numbered breakdown for EACH indicator:

For each indicator:
- **[Indicator Name] — Score: X/4**
   - WHY this score: [Cite specific evidence from their document]
   - IMPROVE: [Concrete, actionable step to raise their score]

Be brutally honest. If the work is weak, say so directly. Do NOT be generous — grade strictly according to the rubric criteria.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (isC3) {
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

**Evaluation Rubric (Score each indicator 1 to 4 using the criteria below)**
${rubricContext}

Assessment Indicators (you MUST score each one):
${JSON.stringify(indicators.map((i: any) => ({ id: i.id, description: i.description })), null, 2)}

${scoringBlock}

**Output Constraints**
You must output your evaluation in the 'teacher_comment' field using a **structured, critical format**. Be SHARP and DIRECT — do not sugarcoat. Use the following format:

**Overall: X/${maxScore} (Y%) — [Category: Exemplary/Proficient/Developing/Beginning]**

Then provide a numbered breakdown for EACH indicator:

For each indicator:
- **[Indicator Name] — Score: X/4**
   - WHY this score: [Cite specific evidence from their document]
   - IMPROVE: [Concrete, actionable step to raise their score]

Be brutally honest. If the work is weak, say so directly. Do NOT be generous — grade strictly according to the rubric criteria.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (isC4) {
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

**Evaluation Rubric (Score each indicator 1 to 4 using the criteria below)**
${rubricContext}

Assessment Indicators (you MUST score each one):
${JSON.stringify(indicators.map((i: any) => ({ id: i.id, description: i.description })), null, 2)}

${scoringBlock}

**Strict Output Constraints**
You MUST output your entire evaluation as a **single, casual paragraph** in the 'teacher_comment' field. Even though the tone is casual, the feedback must be sharp, objective, and analytical—no sugarcoating. Do not use bullet points, numbered lists, or line breaks. Within this single paragraph, you must naturally weave in:

1. The final score (e.g., X/${maxScore}, Y%) and the process category.
2. An objective compliment highlighting a specific strength in their documentation process.
3. A sharp, direct critique pointing out a specific weakness, vague task description, or flaw in their documentation logic.
4. A concrete, actionable suggestion on how to make the written logbook a stronger, more descriptive engineering document.

Do NOT include a 'suggested_status' field. Just provide 'scores' and 'teacher_comment'. Provide your output exactly matching the JSON schema.`;

        } else if (isC1) {
            // ===== C1: Project Proposal / Abstract =====
            prompt = `### System Instructions for STEAM Project Filtration API

**Role & Objective**
You are a STEAM Education Expert and Project Filtration System. Your job is to evaluate student project proposals (abstracts) to determine if they qualify as true STEAM projects. A valid STEAM project must focus on building a tangible prototype (physical or digital) that solves a real-world problem by meaningfully integrating multiple STEAM disciplines (Science, Technology, Engineering, Art, Mathematics).

Remember: This is an ABSTRACT — a short summary of the student's project idea. Your feedback should guide students to write a strong, well-explained abstract that clearly communicates their problem, solution, theme connection, and STEAM concepts.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting. Do NOT use any emojis in your feedback.**

**Input Data Expectation**
You will receive student proposals containing:
* Title: ${project.title}
* Problem: ${problemDesc || 'Not provided.'}
* Solution (Prototype): ${solutionDesc || 'Not provided.'}
* Key Concepts (STEAM subjects): ${JSON.stringify(keyConcepts || {})}
* Submission Status: On-time

**Evaluation Rubric (Score each indicator 1 to 4 using the criteria below)**
${rubricContext}

Assessment Indicators (you MUST score each one):
${JSON.stringify(indicators.map((i: any) => ({ id: i.id, description: i.description })), null, 2)}

${decisionBlock}

**Output Constraints**
You must output your evaluation in the 'teacher_comment' field using a **structured, sectioned format**. Do NOT mention raw scores or percentages in your comment. Do NOT use any emojis. Organize your feedback into the following clearly labeled sections. Use bullet points (starting with "- ") within each section.

The tone of your comment MUST change based on your suggested_status decision:
- If 'approved': Be encouraging but still give constructive forward-looking guidance in each section.
- If 'revision' or 'disapproved': Be critical and thorough. Point out every weakness clearly and tell the student exactly what to fix.

Use this exact structure:

---

PROBLEM STATEMENT
- Evaluate whether the student clearly explained the problem they want to solve.
- Is the problem contextual? Is it connected to the student's real life, their community, or a real-world situation they can relate to?
- Did the student explain WHY this problem matters and WHY they chose it?
- Is there a logical flow — from identifying the problem to explaining its impact?
- For an abstract, the student should at minimum show they understand the problem well enough to explain it clearly to someone else. Did they achieve this?
- If weak: Tell them exactly what is missing and guide them on how to strengthen their problem statement.

PROPOSED SOLUTION
- Does the proposed solution directly address the problem stated above? Does it make logical sense as a response to that specific problem?
- How good is the solution? Is it creative, practical, and feasible for the student's grade level?
- Did the student explain WHY they chose this particular solution over other options?
- Is the solution clearly a prototype (physical or digital product) and not just a presentation, poster, or research paper?
- If weak: Explain what does not make sense and suggest how to improve or rethink the solution.

THEME ALIGNMENT
- How well does the problem, the solution, and the overall project connect to the chosen theme?
- Is the connection natural and meaningful, or does it feel forced or superficial?
- If the theme connection is weak or missing: Point it out clearly and suggest how the student can better align their project with the theme.

KEY CONCEPTS (STEAM Integration)
- Are the chosen subjects (Science, Technology, Engineering, Art, Math) genuinely relevant to this project?
- Did the student correctly explain the specific concepts from each subject and how they apply to the project?
- CRITICAL: Some students just list subject names or write vague, nonsense explanations that do not actually connect to their project. If this is the case, call it out directly. Be specific about which concept is wrong or irrelevant.
- Are the subjects treated as separate tasks, or does the student show how they connect and support each other (interdisciplinary integration)?
- If an important STEAM field is missing from the project, suggest which one should be added and why.

TITLE
- Is the title clear, concise, and does it immediately communicate what the project is about?
- Is it creative and professional, or is it too vague, too long, or generic?
- If weak: Suggest a direction for improvement.

OVERALL VERDICT
- Provide a brief summary of the overall quality of this abstract.
- State the single most important thing the student should focus on improving first.
- If approved: Give forward-looking advice to prepare them for the next phase.
- If revision/disapproved: Clearly state the most critical issues that must be fixed before resubmission.

---

**CRITICAL RULES:**
1. For ANY indicator that you scored 2 or below, you MUST address it in the relevant section — explain WHY and give a specific suggestion.
2. If any Key Concept seems unrelated, forced, or incorrectly explained, you MUST flag it in the KEY CONCEPTS section.
3. Do NOT use emojis anywhere in your feedback.
4. Keep language simple and clear (ESL-friendly).
5. Each section header must be on its own line, followed by bullet points starting with "- ".

Provide your output exactly matching the JSON schema.`;

        } else {
            // ===== General prompt for other categories (BCM, ENG, IND, etc.) =====
            prompt = `You are an encouraging STEAM educator assistant. Your task is to review a student's STEAM project based on a specific rubric and provide scores and a single, casual feedback paragraph.

**LANGUAGE RULE: Write all feedback in simple, clear English. Use short sentences. Avoid difficult vocabulary. This is for students and teachers who use English as a second language (ESL). Make it easy to read but still professional for a school setting.**

You are assessing the category: "${categoryName}".

**Evaluation Rubric (Score each indicator 1 to 4 using the criteria below)**
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

Assessment Indicators (you MUST score each one):
${JSON.stringify(indicators.map((i: any) => ({ id: i.id, description: i.description })), null, 2)}

${decisionBlock}

FEEDBACK GUIDELINES:
1. Analyze the project data against EACH indicator using the rubric criteria above.
2. Provide an integer score (1-4) for EVERY indicator ID in your 'scores' map.
3. CRITICAL STEAM ENFORCEMENT: This is a STEAM project. It MUST combine Science, Tech, Engineering, Art, and Math. If the project reads like a simple, single-subject project with no clear interdisciplinary connection:
   - You MUST score it very low on any related indicators.
   - Your 'teacher_comment' MUST provide specific, firm criticism about this lack of integration.
   - You MUST NOT give an 'approved' status.
4. Your 'teacher_comment' MUST be a single casual, friendly paragraph. Always prioritize suggestions for improvement over just pointing out flaws. Mention ONE specific strength and ONE specific area to improve with a concrete suggestion.
5. Your 'suggested_status' should be:
   - 'approved' if the percentage is ≥80% AND the project shows true interdisciplinary STEAM integration.
   - 'revision' if the percentage is 55–79% OR if the project lacks STEAM integration.
   - 'disapproved' only if the percentage is below 55% and effort is completely absent.

Provide your output exactly matching the JSON schema.
`;
        }

        let responseText = '';
        let jsonPayload;
        let retries = 3;
        
        while (retries > 0) {
            try {
                const result = await model.generateContent(prompt);
                responseText = result.response.text();
                jsonPayload = JSON.parse(responseText);
                break; // Success, exit retry loop
            } catch (e: any) {
                retries--;
                console.error(`Gemini fetch error, retries left: ${retries}`, e);
                
                if (retries === 0) {
                    throw new Error(e?.message && e.message.includes('503') 
                        ? 'Google AI is currently overloaded (503). We automatically tried 3 times, but it is still busy. Please try again in a few minutes.' 
                        : (e.message || 'Failed to process AI response formatting.'));
                }
                
                // Wait for 2 seconds before retrying
                await new Promise(res => setTimeout(res, 2000));
            }
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
