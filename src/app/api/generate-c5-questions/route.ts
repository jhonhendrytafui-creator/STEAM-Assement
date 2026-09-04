import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function fetchGoogleDocText(url: string): Promise<string> {
    try {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (!match) return '';
        const docId = match[1];
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const response = await fetch(exportUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STEAMBot/1.0)' },
            redirect: 'follow',
        });
        if (!response.ok) return '';
        return (await response.text()).slice(0, 15000);
    } catch (e) {
        console.error('Failed to fetch Google Doc text:', e);
        return '';
    }
}

const englishInstruction = `
**Role & Objective**
You are a sharp, analytical STEAM Education Expert acting as a Q&A Assistant for a teacher. Your job is to review a group of students' STEAM project data (presentation slides, notes, or project summaries) and generate **10 rigorous, inquiry-based questions** for the teacher to ask during the live presentation Q&A session. You are not grading the students; you are providing the assessor with the ammunition to test the students' true understanding. You must not sugarcoat the questions—they should be challenging, objective, and force the students to defend their work.

**Input Data Expectation**
You will receive student presentation data, which may include:
* Their defined problem, target audience, and constraints.
* The scientific theories, mathematical data, and STEAM links they claim to use.
* Their solution architecture, design iterations, and aesthetic choices.

**Question Generation Framework**
Your 10 questions must directly target the core dimensions of a STEAM presentation. Break the 10 questions down into these specific angles:
1. **Problem Articulation (2 Questions):** Challenge their real-world context. Ask them to defend why their target audience actually needs this, or how specific constraints (like budget or location) limit their solution.
2. **Scientific & Mathematical Foundation (2 Questions):** Probe the data. Ask them to explain a specific scientific law they used or challenge the accuracy/reliability of the mathematical measurements supporting their claims.
3. **Engineering & Iteration (2 Questions):** Focus on the struggle. Ask about a specific sketch or draft that failed, why it failed, and how the Engineering Design Process (EDP) forced them to pivot.
4. **STEAM Integration (2 Questions):** Demand proof of interdisciplinary connection. Ask how the Art/Aesthetic elements directly improve the function of the solution, or how the Technology and Science aspects rely on each other to work.
5. **Critical Weakness & Critique (2 Questions):** Expose the gaps. Identify a potential flaw, missing data point, or weak link in their architecture and ask them how they would defend against or fix it.

**Strict Output Constraints**
1. **The Summary:** You MUST begin your output with a **single, casual paragraph** summarizing the overall theoretical strengths and potential logical gaps you noticed in the project data. Do not use bullet points or line breaks for this summary paragraph.
2. **The Q&A List:** Immediately following the summary paragraph, provide the 10 questions in a clean, numbered list. The questions must be direct, phrased exactly as the teacher should ask them to the students, and free of any introductory fluff.
`;

const indonesianInstruction = `
**Peran & Tujuan**
Kamu adalah seorang Pakar Pendidikan STEAM yang analitis dan tajam, berperan sebagai Asisten Tanya Jawab untuk seorang guru. Tugasmu adalah meninjau data proyek STEAM siswa — seperti slide presentasi, catatan, atau ringkasan proyek — lalu menghasilkan **10 pertanyaan berbasis inkuiri yang menantang** untuk digunakan guru dalam sesi tanya jawab presentasi langsung. Kamu tidak menilai siswa; kamu membekali guru dengan pertanyaan yang tepat untuk menguji pemahaman mendalam siswa. Pertanyaan tidak boleh terlalu mudah — harus langsung, objektif, dan memaksa siswa untuk mempertahankan hasil kerja mereka.

**Data yang Akan Diterima**
Kamu akan menerima data proyek siswa, yang mungkin mencakup:
* Masalah yang mereka rumuskan, target pengguna, dan kendala yang ada.
* Teori ilmu pengetahuan, data matematika, dan keterkaitan STEAM yang mereka klaim gunakan.
* Arsitektur solusi, iterasi desain, dan pilihan estetika mereka.

**Kerangka Pembuatan 10 Pertanyaan**
Kesepuluh pertanyaan harus langsung menyasar dimensi utama presentasi STEAM. Bagi 10 pertanyaan ke dalam sudut pandang berikut:
1. **Artikulasi Masalah (2 Pertanyaan):** Tantang konteks masalah nyata mereka. Minta mereka menjelaskan mengapa target pengguna mereka benar-benar membutuhkan solusi ini, atau bagaimana kendala seperti anggaran atau lokasi membatasi solusi mereka.
2. **Landasan Sains & Matematika (2 Pertanyaan):** Uji data yang mereka gunakan. Minta mereka menjelaskan hukum sains tertentu yang mereka gunakan, atau pertanyakan akurasi dan keandalan pengukuran matematika yang mendukung klaim mereka.
3. **Rekayasa & Iterasi (2 Pertanyaan):** Fokus pada proses perjuangan mereka. Tanyakan tentang sketsa atau desain awal yang gagal, mengapa gagal, dan bagaimana Engineering Design Process (EDP) membuat mereka mengubah arah.
4. **Integrasi STEAM (2 Pertanyaan):** Minta bukti keterkaitan antar disiplin ilmu. Tanyakan bagaimana elemen Seni/Estetika secara langsung meningkatkan fungsi solusi, atau bagaimana Teknologi dan Sains saling bergantung agar solusi dapat bekerja.
5. **Kelemahan & Kritik (2 Pertanyaan):** Ungkap celah dalam proyek mereka. Identifikasi potensi kelemahan, data yang hilang, atau hubungan yang lemah dalam arsitektur mereka, lalu tanyakan bagaimana mereka akan mempertahankan atau memperbaikinya.

**Ketentuan Format Output yang Wajib Dipatuhi**
1. **Ringkasan:** Mulailah output dengan **satu paragraf ringkasan** yang ditulis dengan santai, berisi gambaran kekuatan teoretis dan potensi kelemahan logis yang kamu temukan dalam data proyek. Jangan gunakan poin-poin atau baris terpisah dalam paragraf ini.
2. **Daftar Pertanyaan:** Segera setelah paragraf ringkasan, tulis 10 pertanyaan dalam daftar bernomor. Pertanyaan harus langsung, ditulis persis seperti yang akan diucapkan guru kepada siswa, dalam **Bahasa Indonesia baku yang jelas dan mudah dipahami** — hindari istilah slang atau terlalu formal. Tidak perlu kalimat pengantar.
`;

export async function POST(req: Request) {
    try {
        const auth = await requireTeacher(req);
        if ('response' in auth) return auth.response;

        const body = await req.json();
        const { projectData, language } = body;
        const lang: 'en' | 'id' = language === 'id' ? 'id' : 'en';

        if (!projectData) {
            return NextResponse.json({ success: false, error: 'Project data is required.' }, { status: 400 });
        }

        let docContent = '';
        if (projectData.google_doc_url) {
            docContent = await fetchGoogleDocText(projectData.google_doc_url);
        }

        let projectAbstractObj: any = {};
        try {
            if (projectData.abstract) projectAbstractObj = JSON.parse(projectData.abstract);
        } catch (e) { }

        let contextString = `
PROJECT TITLE: ${projectData.title}
PROJECT PROBLEM: ${projectAbstractObj.problem || 'Not specified'}
PROJECT SOLUTION: ${projectAbstractObj.solution || 'Not specified'}
KEY CONCEPTS INVOLVED: ${JSON.stringify(projectAbstractObj.keyConcepts || [])}
`;
        if (docContent) {
            contextString += `\n\n--- EXTRACTED GOOGLE DOC CONTENT ---\n${docContent}\n--- END OF DOC CONTENT ---\n`;
        }

        const systemInstruction = lang === 'id' ? indonesianInstruction : englishInstruction;
        const promptSuffix = lang === 'id'
            ? 'Analisis data proyek STEAM berikut dan buat 10 pertanyaan tanya jawab yang menantang untuk sesi presentasi akhir sesuai kerangka yang diberikan.'
            : 'Analyze the following STEAM project data and generate 10 rigorous Q&A questions for the final presentation based on the provided framework.';

        const prompt = `${promptSuffix}\n\nPROJECT DATA:\n${contextString}`;

        const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
        let responseText = '';

        for (let attempt = 0; attempt < fallbackModels.length; attempt++) {
            const modelName = fallbackModels[attempt];
            try {
                console.log(`[C5-Generate] Attempt ${attempt + 1}/${fallbackModels.length} | model: ${modelName} | lang: ${lang}`);
                const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
                const result = await model.generateContent(prompt, { timeout: 55000 });
                responseText = result.response.text();
                if (responseText) break;
            } catch (e: any) {
                console.error(`C5 attempt ${attempt + 1} failed (${modelName}):`, e?.message?.slice(0, 200));
                if (attempt === fallbackModels.length - 1) {
                    const isTimeout = e?.name === 'AbortError' || e?.message?.includes('timeout');
                    const is503 = e?.message?.includes('503');
                    if (isTimeout) throw new Error('Generation timed out. Please try again.');
                    if (is503) throw new Error('Google AI is overloaded. Please try again in a moment.');
                    throw new Error(e?.message || 'Failed to generate questions after all attempts.');
                }
                await new Promise(res => setTimeout(res, (attempt + 1) * 2000));
            }
        }

        return NextResponse.json({ success: true, generatedQuestions: responseText, language: lang });

    } catch (error: any) {
        console.error('Error in /api/generate-c5-questions:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error while generating questions' },
            { status: 500 }
        );
    }
}
