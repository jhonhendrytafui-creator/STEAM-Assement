-- Subject rubrics, part 3 of 4: the Bahasa Indonesia rubrics. Safe to re-run.
-- Needs part 2 (it defines seed_subject_rubric).
--
-- The Infografis document gives no bobot per indikator, so it carries no
-- weights and its five indikator count equally (20% each). An admin can set
-- weights later from Admin -> Rubric Weights.

DO $do_indonesian$
BEGIN
    RAISE NOTICE '%', public.seed_subject_rubric('IND-INF', 'IND', 'Bahasa Indonesia Infografis', 9, 'Indikator', $json$[
      {"description": "Ketepatan Ejaan dan Tanda Baca", "criteria": {
        "1": "Banyak kesalahan ejaan dan tanda baca sehingga sebagian informasi sulit dipahami.",
        "2": "Masih ada beberapa kesalahan yang berulang, tetapi gagasan utama tetap dapat dipahami.",
        "3": "Umumnya tepat; kesalahan kecil tidak mengganggu pemahaman.",
        "4": "Sangat konsisten dan tepat pada judul, subjudul, isi, label, serta keterangan gambar."}},
      {"description": "Kebakuan, Pilihan Kata, dan Istilah", "criteria": {
        "1": "Banyak kata tidak baku atau kurang tepat; istilah tidak konsisten sehingga membingungkan.",
        "2": "Sudah memakai beberapa kata baku, tetapi masih ada pilihan kata atau istilah yang kurang tepat/konsisten.",
        "3": "Kata baku dan istilah tepat serta konsisten sehingga informasi mudah dipahami.",
        "4": "Kata baku, tepat, dan efektif; istilah konsisten dan dijelaskan singkat bila perlu."}},
      {"description": "Keefektifan Kalimat dan Penggunaan Bahasa Sendiri", "criteria": {
        "1": "Banyak kalimat tidak lengkap, bertele-tele, atau sulit dipahami; teks sebagian besar disalin dari sumber.",
        "2": "Sebagian kalimat efektif, tetapi masih ada yang terlalu panjang atau berulang; beberapa bagian masih mirip sumber.",
        "3": "Kalimat ringkas, lengkap, dan logis; sebagian besar informasi diparafrasekan tanpa mengubah makna.",
        "4": "Kalimat padat, jelas, dan bervariasi; seluruh informasi diparafrasekan dengan bahasa sendiri sesuai karakter infografis."}},
      {"description": "Kejelasan, Keringkasan, dan Keruntutan Informasi", "criteria": {
        "1": "Informasi terlalu sedikit/padat dan tidak fokus; urutan membingungkan sehingga pesan utama sulit ditangkap.",
        "2": "Pesan utama dapat ditemukan, tetapi masih ada informasi berulang atau kurang penting; hubungan antarbagian belum selalu jelas.",
        "3": "Informasi ringkas, relevan, dan runtut; hubungan judul, subjudul, dan isi jelas.",
        "4": "Informasi diseleksi sangat baik, padat makna, dan padu; hubungan antarbagian dipertegas lewat judul, label, atau keterangan."}},
      {"description": "Keterbacaan dan Komunikasi Visual", "criteria": {
        "1": "Didominasi paragraf panjang; tata letak, ukuran, atau warna menghambat pembacaan dan pesan utama tidak jelas.",
        "2": "Sudah ada poin/label dan teks cukup terbaca, tetapi beberapa elemen visual masih kurang jelas atau terlalu padat.",
        "3": "Judul, poin, dan label dipakai efektif; teks dan visual mudah dibaca serta mendukung informasi.",
        "4": "Tata letak, tipografi, warna, dan ilustrasi menonjolkan informasi penting; setiap unsur punya fungsi jelas."}}
    ]$json$::jsonb);

    RAISE NOTICE '%', public.seed_subject_rubric('IND-PRS', NULL, 'Bahasa Indonesia Presentasi', 10, 'Indikator', $json$[
      {"description": "Bahasa Tertulis dan Keringkasan Teks pada Media (PPT/Canva)", "weight": 25, "criteria": {
        "1": "Banyak kesalahan ejaan, tanda baca, atau kata baku; teks terlalu panjang/sedikit sehingga tidak berfungsi mendukung presentasi.",
        "2": "Masih ada beberapa kesalahan, tetapi makna dapat dipahami; sebagian teks ringkas, sebagian masih panjang atau berulang.",
        "3": "Bahasa tertulis umumnya sesuai kaidah; teks ringkas, jelas, dan mendukung penjelasan lisan tanpa dibaca penuh.",
        "4": "Bahasa tertulis konsisten tepat dan baku; teks padat, terstruktur, dan hanya memuat informasi penting."}},
      {"description": "Ragam Bahasa Lisan, Diksi, dan Istilah", "weight": 25, "criteria": {
        "1": "Didominasi ragam tidak baku/tidak sesuai konteks akademik; diksi atau istilah sering tidak tepat dan merancukan.",
        "2": "Mulai memakai bahasa baku dan santun, tetapi masih sering bercampur ragam lain; diksi/istilah kadang kurang tepat.",
        "3": "Bahasa baku, santun, dan sesuai konteks akademik; diksi dan istilah tepat serta konsisten.",
        "4": "Ragam baku, santun, dan fleksibel tanpa terdengar kaku; diksi dan istilah presisi dalam menyampaikan gagasan."}},
      {"description": "Keefektifan Kalimat dan Kejelasan Penyampaian Lisan", "weight": 20, "criteria": {
        "1": "Kalimat sering tidak lengkap atau berbelit; pelafalan, intonasi, atau kelancaran menghambat pemahaman.",
        "2": "Sebagian kalimat jelas, tetapi masih berulang; penyampaian cukup dipahami meski kadang tersendat atau terlalu cepat/lambat.",
        "3": "Kalimat efektif dan mudah dipahami; pelafalan jelas serta intonasi dan kelancaran mendukung audiens.",
        "4": "Kalimat efektif dan variatif; penyampaian sangat jelas, lancar, dan terkontrol dengan intonasi yang menegaskan makna."}},
      {"description": "Keruntutan dan Keterpaduan Penyampaian Kelompok", "weight": 15, "criteria": {
        "1": "Penyampaian terputus-putus; urutan sulit diikuti.",
        "2": "Urutan cukup dapat diikuti, tetapi transisi antarbagian/antaranggota belum mulus.",
        "3": "Runtut; hubungan antarbagian dan perpindahan antaranggota jelas.",
        "4": "Presentasi terasa satu kesatuan yang padu; transisi dan pembagian peran saling memperkuat."}},
      {"description": "Kemampuan Merespons Pertanyaan (Q&A)", "weight": 15, "criteria": {
        "1": "Kesulitan memahami atau menjawab pertanyaan; jawaban tidak relevan atau sulit dipahami.",
        "2": "Dapat menjawab pertanyaan dasar, tetapi jawaban singkat, kurang runtut, atau bahasanya kurang tepat.",
        "3": "Menjawab sebagian besar pertanyaan secara relevan, jelas, runtut, dan dengan bahasa yang tepat.",
        "4": "Menjawab relevan dan terstruktur, mampu memperjelas/mengembangkan jawaban dengan bahasa yang efektif."}}
    ]$json$::jsonb);
END
$do_indonesian$;

DO $do_done$ BEGIN RAISE NOTICE '== PART 3 OF 4 DONE: Bahasa Indonesia rubrics =='; END $do_done$;
