-- Science rubrics, part 1 of 2: the two rubrics. Safe to re-run.
-- Needs sql/subject_rubrics_2_english.sql (it defines seed_subject_rubric).
--
-- From the school's Science content rubrics (Rubrik Penilaian Konten Science,
-- kelas 7-9). They score the science content and scientific reasoning of the
-- STEAM project; product looks and engineering are not scored here.
--   SCI-WRT  Semester 1, written work: poster (7), infografis (8), paper (9)
--   SCI-PRS  Semester 2, presentation, with the product/prototype in 8 and 9
-- Like English and Bahasa Indonesia, they open once C1 is approved, can be
-- used in any order, and show for every grade.
--
-- Both documents score as (total / 40) x 100, so all ten indikator count the
-- same (10% each) and no weights are stored. An admin can set weights later
-- from Admin -> Rubric Weights. Re-running never touches a rubric that already
-- has criteria, so marks and weights an admin has changed are kept.

DO $do_science$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'seed_subject_rubric') THEN
        RAISE EXCEPTION 'Run sql/subject_rubrics_1_weights.sql and sql/subject_rubrics_2_english.sql first.';
    END IF;

    RAISE NOTICE '%', public.seed_subject_rubric('SCI-WRT', NULL, 'Science Writing', 11, 'Indikator', $json$[
      {"description": "Pemahaman Masalah secara Ilmiah (Scientific Understanding of the Problem)", "criteria": {
        "1": "Masalah dijelaskan hanya dengan pendapat. 0 konsep Science disebut.",
        "2": "Ada 1 konsep Science, tetapi penjelasan hanya 1 kalimat atau ada 1 kesalahan.",
        "3": "Ada 1–2 konsep Science yang benar. Siswa menjelaskan apa masalahnya dan mengapa masalah itu terjadi.",
        "4": "Ada minimal 2 konsep Science yang benar. Siswa menjelaskan apa masalahnya, mengapa terjadi, dan apa dampaknya pada konteks proyek."}},
      {"description": "Ketepatan Konsep Science (Accuracy of Scientific Concepts)", "criteria": {
        "1": "3 atau lebih kesalahan konsep (miskonsepsi).",
        "2": "2 kesalahan konsep, atau konsep sudah benar, tetapi penjelasannya tidak lengkap.",
        "3": "Maksimal 1 kesalahan kecil yang tidak mengubah kesimpulan. Penjelasan sesuai konteks proyek.",
        "4": "0 kesalahan dan menyebut minimal 1 faktor yang memengaruhi konsep."}},
      {"description": "Penalaran Sebab-Akibat (Scientific Cause-and-Effect Reasoning)", "criteria": {
        "1": "0 hubungan sebab-akibat, atau hubungan yang ditulis salah.",
        "2": "1 hubungan sebab-akibat, tetapi tanpa alasan mengapa.",
        "3": "Minimal 2 hubungan sebab-akibat yang logis dan dijelaskan dengan konsep Science.",
        "4": "Minimal 3 hubungan sebab-akibat yang saling berantai dan didukung minimal 1 evidence."}},
      {"description": "Kesesuaian Konsep dengan Masalah (Relevance of Science to the Problem)", "criteria": {
        "1": "0 konsep yang berkaitan dengan masalah.",
        "2": "1 konsep berkaitan dengan masalah, tetapi kaitannya tidak dijelaskan.",
        "3": "Semua konsep yang dipilih berkaitan dengan masalah dan kaitannya dijelaskan.",
        "4": "Semua konsep berkaitan dan setiap konsep utama disertai alasan mengapa penting."}},
      {"description": "Kualitas dan Kredibilitas Sumber (Quality & Credibility of Scientific Sources)", "criteria": {
        "1": "0 sumber kredibel (tidak ada sumber, atau hanya media sosial/blog tanpa penulis). Saran: berlaku untuk semua kelas.",
        "2": "1 sumber kredibel. Saran: 1-2 sumber (kelas 9).",
        "3": "2 sumber kredibel dan relevan. Saran: 3-4 sumber (kelas 9).",
        "4": "3 atau lebih sumber kredibel dan relevan, dari jenis berbeda, dan siswa menjelaskan alasan memilihnya. Saran: minimal 5 sumber (kelas 9)."}},
      {"description": "Penggunaan Evidence Science (Use of Scientific Evidence)", "criteria": {
        "1": "0 evidence (data, fakta, atau hasil percobaan).",
        "2": "1 evidence, atau evidence ada tetapi tidak berhubungan dengan klaim.",
        "3": "2 evidence yang relevan dan mendukung klaim.",
        "4": "Minimal 3 evidence yang relevan, termasuk minimal 1 data berupa angka (tabel, grafik, atau hasil ukur)."}},
      {"description": "Hubungan Evidence dan Klaim (Connection between Evidence and Scientific Claims)", "criteria": {
        "1": "Tidak ada klaim yang dihubungkan dengan evidence.",
        "2": "1 klaim utama punya evidence, tetapi hubungannya tidak dijelaskan.",
        "3": "2 klaim utama punya evidence dan siswa menjelaskan bagaimana evidence itu mendukung klaim.",
        "4": "Seperti Level 3, ditambah menyebut minimal 1 keterbatasan evidence (misal data sedikit) dan 0 (tidak ada) kesimpulan yang melebihi evidence."}},
      {"description": "Hubungan Science dengan Solusi (Science–Solution Connection)", "criteria": {
        "1": "0 konsep Science dipakai dalam solusi.",
        "2": "1 konsep disebut berkaitan dengan solusi, tetapi hanya tempelan (jika dihapus, solusi tidak berubah).",
        "3": "Minimal 1 konsep Science dijelaskan cara kerjanya dalam solusi (bagian solusi mana yang memakainya).",
        "4": "Minimal 2 konsep dijelaskan, dan minimal 1 bagian/fungsi/ciri solusi ditentukan oleh konsep Science (mis. pemilihan bahan atau ukuran)."}},
      {"description": "Kelayakan Ilmiah Solusi (Scientific Feasibility of the Proposed Solution)", "criteria": {
        "1": "Solusi bertentangan dengan prinsip Science, atau 0 alasan ilmiah.",
        "2": "Solusi masuk akal, tetapi hanya 1 alasan ilmiah yang lemah dan 0 kondisi keberhasilan disebut.",
        "3": "Solusi masuk akal, didukung minimal 1 prinsip Science, dan menyebut minimal 1 kondisi agar berhasil.",
        "4": "Didukung minimal 2 prinsip Science, menyebut minimal 2 kondisi/batasan, dan minimal 1 risiko beserta cara mengatasinya."}},
      {"description": "Keterpaduan Konsep Science (Integration of Scientific Concepts)", "criteria": {
        "1": "Hanya 1 konsep atau konsep berdiri sendiri-sendiri (0 hubungan antarkonsep).",
        "2": "Minimal 2 konsep disebut, tetapi 0 hubungan antarkonsep yang dijelaskan.",
        "3": "Minimal 2 konsep, dengan 1 hubungan antarkonsep dijelaskan dan mendukung solusi.",
        "4": "Minimal 2 hubungan antarkonsep dijelaskan dan mendukung solusi. Jika hanya 1 bidang Science: minimal 3 konsep dalam bidang itu saling terhubung."}}
    ]$json$::jsonb);

    RAISE NOTICE '%', public.seed_subject_rubric('SCI-PRS', NULL, 'Science Presentation', 12, 'Indikator', $json$[
      {"description": "Penerapan Science dalam Solusi (Application of Science in the Solution)", "criteria": {
        "1": "0 konsep Science diterapkan; hanya disebut sebagai informasi tambahan.",
        "2": "1 konsep diterapkan, tetapi hubungannya dengan fungsi solusi tidak konsisten (hanya sebagian bagian solusi yang berkaitan).",
        "3": "Minimal 1 konsep diterapkan dengan tepat dan berkontribusi pada fungsi solusi/prototype. Siswa dapat menunjuk bagian solusi mana yang memakainya.",
        "4": "Minimal 2 konsep diterapkan, dan minimal 1 fungsi/performa/batasan solusi ditentukan langsung oleh konsep Science serta dijelaskan siswa."}},
      {"description": "Penjelasan Cara Kerja Solusi secara Ilmiah (Scientific Explanation of How the Solution Works)", "criteria": {
        "1": "0 alasan ilmiah. Siswa tidak dapat menjelaskan cara kerja solusi dengan Science.",
        "2": "Cara kerja dijelaskan hanya berupa deskripsi (apa yang terjadi), dengan maksimal 1 alasan ilmiah.",
        "3": "Menjelaskan bagaimana dan mengapa solusi bekerja dengan minimal 2 alasan ilmiah yang tepat.",
        "4": "Minimal 3 alasan ilmiah yang saling berkaitan dan menyebut minimal 1 faktor yang memengaruhi performa solusi."}},
      {"description": "Konsistensi Konsep Science dan Solusi (Consistency between Scientific Concept and Solution)", "criteria": {
        "1": "Ada minimal 1 cara kerja solusi yang bertentangan dengan konsep yang diklaim.",
        "2": "Sebagian konsisten, tetapi ada minimal 1 ketidaksesuaian yang tidak dijelaskan siswa.",
        "3": "0 ketidaksesuaian: semua konsep yang diklaim sesuai dengan cara kerja solusi.",
        "4": "0 ketidaksesuaian dan siswa menyebut minimal 1 kondisi/batas berlakunya konsep (mis. suhu, jumlah, ukuran)."}},
      {"description": "Kriteria Keberhasilan Ilmiah (Scientific Success Criteria)", "criteria": {
        "1": "0 kriteria keberhasilan.",
        "2": "Minimal 1 kriteria, tetapi umum dan tidak bisa diukur (misal. “berhasil”, “bagus”).",
        "3": "Minimal 2 kriteria yang jelas, relevan, dan bisa diamati/diukur (ada angka, satuan, atau ciri yang bisa dilihat).",
        "4": "Minimal 3 kriteria dengan target angka/satuan, dikaitkan dengan minimal 1 prinsip Science dan minimal 1 batasan proyek (waktu, biaya, bahan)."}},
      {"description": "Pengujian / Validasi (Scientific Testing / Validation)", "criteria": {
        "1": "0 pengujian atau pengujian tidak berkaitan dengan tujuan solusi.",
        "2": "1 kali uji sederhana, langkah atau variabel tidak jelas.",
        "3": "Uji sesuai tujuan, langkah ditulis, minimal 1 variabel jelas (yang diubah/diukur), dilakukan minimal 2 kali.",
        "4": "Uji dilakukan minimal 3 kali (atau 3 kondisi berbeda) dengan minimal 2 variabel/kondisi jelas (diubah, diukur, dijaga tetap) dan cukup untuk menilai solusi."}},
      {"description": "Penggunaan & Penafsiran Data (Use & Interpretation of Data/Evidence)", "criteria": {
        "1": "0 hasil uji/evidence dipakai untuk menjelaskan solusi.",
        "2": "Hasil disajikan, tetapi penafsiran hanya 1 kalimat atau ada 2 atau lebih kesalahan tafsir.",
        "3": "Hasil disajikan (tabel/grafik) dan ditafsirkan dengan benar (maksimal 1 kesalahan kecil) untuk menjelaskan performa solusi.",
        "4": "Menunjukkan minimal 1 pola atau perbandingan (Contoh: sebelum-sesudah, kondisi A vs B) dan 0 kesimpulan yang melebihi data."}},
      {"description": "Analisis Hasil dan Keterbatasan (Scientific Analysis of Results & Limitations)", "criteria": {
        "1": "Hasil hanya disebutkan, 0 penjelasan ilmiah.",
        "2": "Minimal 1 penjelasan sederhana, tetapi 0 keterbatasan disebut atau penyebab hasil tidak dianalisis.",
        "3": "Hasil dijelaskan dengan minimal 1 konsep Science dan menyebut minimal 1 keterbatasan yang relevan.",
        "4": "Hasil dijelaskan dengan minimal 2 konsep Science yang dihubungkan ke data, menyebut minimal 2 kemungkinan penyebab hasil, dan minimal 2 keterbatasan."}},
      {"description": "Perbaikan Berdasarkan Science (Science-Based Improvement)", "criteria": {
        "1": "0 perbaikan, atau perbaikan tanpa alasan Science.",
        "2": "Minimal 1 perbaikan diusulkan, tetapi alasan ilmiahnya umum (tidak menyebut hasil uji atau konsep).",
        "3": "Minimal 1 perbaikan yang didasarkan pada hasil uji/evidence dan dijelaskan dengan konsep Science.",
        "4": "Minimal 2 perbaikan (atau 1 perbaikan dipilih dari 2 pilihan) yang dibenarkan dengan evidence."}},
      {"description": "Komunikasi Ilmiah (Scientific Communication)", "criteria": {
        "1": "4 atau lebih istilah Science dipakai keliru, atau penjelasan tidak bisa diikuti.",
        "2": "2-3 istilah Science keliru, atau urutan penjelasan melompat-lompat.",
        "3": "Maksimal 1 istilah keliru dan penjelasan runtut (masalah → cara kerja → hasil).",
        "4": "0 istilah keliru, runtut, dan menghubungkan konsep, evidence, dan keputusan proyek (minimal 1 kaitan untuk masing-masing)."}},
      {"description": "Pertahanan Ilmiah & Tanya Jawab (Scientific Defense & Q&A)", "criteria": {
        "1": "0-1 dari 5 pertanyaan guru dijawab benar, atau jawaban menunjukkan miskonsepsi.",
        "2": "2 dari 5 pertanyaan dijawab benar (jawaban benar + alasan Science).",
        "3": "3 dari 5 pertanyaan dijawab benar dengan alasan Science yang tepat.",
        "4": "4-5 dari 5 pertanyaan dijawab benar dan siswa mempertahankan klaim saat ditanya lanjutan dengan minimal 1 evidence."}}
    ]$json$::jsonb);
END
$do_science$;

DO $do_done$ BEGIN RAISE NOTICE '== PART 1 OF 2 DONE: Science rubrics =='; END $do_done$;
