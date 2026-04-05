-- ============================================
-- STEAM Assessment — Seed Test Data
-- Grades 7–12, 10 classes per grade, 5 groups per class
-- 4 students per group
-- Run this in the Supabase SQL Editor
-- ============================================
-- IMPORTANT: This script only inserts into:
--   student_master, themes, projects, logbooks
-- It does NOT touch assessment_scores or any rubric tables.
-- ============================================

-- ============================================
-- 1. THEMES  (grades 7, 8, 9 — grades 10-12 already seeded)
-- ============================================

-- Grade 7
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Clean Water & Sanitation', '7', '2025/2026'),
('Healthy Living & Nutrition', '7', '2025/2026'),
('Simple Machines & Daily Life', '7', '2025/2026'),
('Weather & Climate Awareness', '7', '2025/2026'),
('Waste Reduction at School', '7', '2025/2026'),
('Plants & Urban Gardening', '7', '2025/2026');

-- Grade 8
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Sustainable Transportation', '8', '2025/2026'),
('Ocean & Marine Conservation', '8', '2025/2026'),
('Smart Agriculture', '8', '2025/2026'),
('Disaster Preparedness', '8', '2025/2026'),
('Energy Efficiency at Home', '8', '2025/2026'),
('Biodiversity & Habitat Protection', '8', '2025/2026');

-- Grade 9
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Space Exploration & Astronomy', '9', '2025/2026'),
('Artificial Intelligence & Ethics', '9', '2025/2026'),
('Biomedical Engineering', '9', '2025/2026'),
('Sustainable Fashion', '9', '2025/2026'),
('Robotics & Automation', '9', '2025/2026'),
('Smart City Design', '9', '2025/2026');

-- ============================================
-- 2. Helper: Build all seed data using PL/pgSQL
-- ============================================

DO $$
DECLARE
    v_grade INT;
    v_class INT;
    v_group INT;
    v_student INT;
    v_class_name TEXT;
    v_email TEXT;
    v_full_name TEXT;
    v_theme_id UUID;
    v_theme_ids UUID[];
    v_selected_theme UUID;
    v_title TEXT;
    v_problem TEXT;
    v_solution TEXT;
    v_abstract TEXT;
    v_doc_url TEXT;
    v_log_date DATE;
    v_log_task TEXT;
    v_log_result TEXT;
    v_student_email TEXT;

    -- Arrays of first names and last names for realistic names
    v_first_names TEXT[] := ARRAY[
        'Andi', 'Budi', 'Citra', 'Dewi', 'Eka',
        'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko',
        'Kevin', 'Lina', 'Maya', 'Nanda', 'Oscar',
        'Putri', 'Rizky', 'Sari', 'Taufik', 'Umi',
        'Vina', 'Wawan', 'Xena', 'Yusuf', 'Zahra',
        'Arif', 'Bella', 'Cahya', 'Dian', 'Elsa',
        'Farel', 'Grace', 'Hana', 'Ivan', 'Jasmine',
        'Karina', 'Leo', 'Mira', 'Nabil', 'Olivia'
    ];
    v_last_names TEXT[] := ARRAY[
        'Pratama', 'Wijaya', 'Kusuma', 'Sari', 'Putra',
        'Lestari', 'Hidayat', 'Nugroho', 'Rahayu', 'Santoso',
        'Permata', 'Setiawan', 'Handoko', 'Anggraini', 'Suryadi',
        'Maharani', 'Firmansyah', 'Wulandari', 'Prabowo', 'Hartono'
    ];

    -- Project titles per grade (we'll rotate through these)
    v_titles_7 TEXT[] := ARRAY[
        'Water Filter dari Bahan Daur Ulang',
        'Alat Pengukur Kualitas Air Sederhana',
        'Nutrition Tracker untuk Kantin Sekolah',
        'Mesin Sederhana untuk Membantu Petani',
        'Stasiun Cuaca Mini Berbasis Sensor',
        'Sistem Pemilahan Sampah Otomatis',
        'Vertical Garden untuk Ruang Kelas',
        'Alat Penyaring Udara dari Tanaman',
        'Smart Lunch Box dengan Indikator Nutrisi',
        'Komposter Mini untuk Sampah Organik Sekolah',
        'Pendeteksi Kadar pH Air Minum',
        'Aplikasi Panduan Gizi Harian Siswa',
        'Model Kincir Air Penghasil Listrik Mini',
        'Peta Digital Cuaca Lingkungan Sekolah',
        'Robot Pemungut Sampah dari Bahan Bekas',
        'Sistem Irigasi Tetes untuk Taman Sekolah',
        'Alat Ukur Kelembaban Tanah Sederhana',
        'Infografis Interaktif Piramida Makanan',
        'Jembatan dari Stik Es Krim Terkuat',
        'Rumah Kaca Mini untuk Budidaya Sayur',
        'Detektor Polusi Udara Portable',
        'Alat Destilasi Air Tenaga Surya',
        'Game Edukasi tentang Siklus Air',
        'Bioball Filter untuk Akuarium Sekolah',
        'Prototype Tempat Sampah Pintar',
        'Alat Penghemat Air untuk Wastafel',
        'Herbarium Digital Tanaman Obat',
        'Model Ekosistem dalam Botol',
        'Pengukur Intensitas Cahaya untuk Tanaman',
        'Poster Interaktif Rantai Makanan',
        'Alat Pendeteksi Hujan Otomatis',
        'Mini Greenhouse dari Botol Plastik Bekas',
        'Sistem Fermentasi Sederhana untuk Pupuk Cair',
        'Alat Peraga Lapisan Atmosfer Bumi',
        'Ensiklopedia Digital Hewan Langka Indonesia',
        'Alat Pengering Pakaian Tenaga Surya Sederhana',
        'Briket dari Sampah Kertas Sekolah',
        'Board Game Edukasi Kesehatan Lingkungan',
        'Alat Sederhana Pendeteksi Bakteri Air',
        'Prototype Atap Penampung Air Hujan',
        'Model Gunung Berapi dengan Reaksi Kimia',
        'Alat Pembersih Pantai Mini',
        'Sistem Aquaponik Skala Kecil',
        'Film Pendek Dokumenter Lingkungan Sekolah',
        'Prototype Sepeda Penghasil Listrik',
        'Alat Pengukur Kebisingan Lingkungan Sekolah',
        'Pengolahan Minyak Jelantah Menjadi Sabun',
        'Model Rumah Hemat Energi dari Kardus',
        'Biopori untuk Area Taman Sekolah',
        'Alat Peraga Sistem Pencernaan Manusia'
    ];

    v_titles_8 TEXT[] := ARRAY[
        'Sepeda Listrik dari Komponen Bekas',
        'Alat Pembersih Pantai Otomatis',
        'Sistem Hidroponik Tenaga Surya',
        'Simulasi Gempa untuk Model Bangunan',
        'Smart Home Energy Monitor',
        'Drone Pemantau Terumbu Karang',
        'Sistem Peringatan Banjir Berbasis IoT',
        'Alat Pengolah Limbah Rumah Tangga',
        'Transportasi Ramah Lingkungan untuk Sekolah',
        'Aplikasi Identifikasi Spesies Laut',
        'Prototype Kapal Pembersih Sungai',
        'Sistem Pemantauan Kualitas Udara',
        'Alat Konversi Energi Ombak Mini',
        'Model Evakuasi Bencana Berbasis Peta',
        'Panel Surya dari Bahan Bekas',
        'Budidaya Ikan Lele Sistem Bioflok',
        'Prototype Jembatan Tahan Gempa',
        'Alat Deteksi Kebocoran Gas Rumah',
        'Sistem Rainwater Harvesting untuk Sekolah',
        'Robot Penyortir Sampah Plastik',
        'Helm Sepeda dengan Lampu Sein Otomatis',
        'Filter Mikroplastik untuk Mesin Cuci',
        'Greenhouse Otomatis Berbasis Arduino',
        'Alat P3K Pintar untuk Bencana Alam',
        'Smart Plug Pengukur Konsumsi Listrik',
        'Terarium Ekosistem Laut Mini',
        'Prototype Rumah Tahan Gempa Skala Kecil',
        'Sistem Daur Ulang Air Wudhu',
        'Kompor Tenaga Surya Portable',
        'Aplikasi Edukasi Kesiapsiagaan Bencana',
        'Alat Pengusir Hama Ultrasonik',
        'Model Turbin Angin dari Bahan Daur Ulang',
        'Sistem Monitoring Tanaman Jarak Jauh',
        'Prototype Perahu Tenaga Surya',
        'Alat Deteksi Dini Tanah Longsor',
        'Bioreaktor Sederhana untuk Gas Metana',
        'Prototype Lampu Jalan Tenaga Surya',
        'Sistem Otomasi Pakan Ikan',
        'Alat Pengukur Arus Sungai Sederhana',
        'Model Breakwater untuk Pencegahan Abrasi',
        'Alat Penjernih Air Tenaga Gravitasi',
        'Prototype Bus Sekolah Ramah Lingkungan',
        'Sistem Peringatan Cuaca Ekstrem Lokal',
        'Alat Penetas Telur Otomatis Hemat Energi',
        'Model Mangrove untuk Perlindungan Pantai',
        'Prototype Charger Tenaga Kinetik',
        'Sistem Pencahayaan Hemat Energi untuk Kelas',
        'Alat Ukur Salinitas Air Laut',
        'Drone Penyebar Benih Tanaman',
        'Prototype Tempat Tinggal Darurat Bencana'
    ];

    v_titles_9 TEXT[] := ARRAY[
        'Teleskop DIY untuk Pengamatan Planet',
        'Chatbot Konsultasi Kesehatan Mental',
        'Prototype Monitor Detak Jantung',
        'Fashion dari Limbah Tekstil Industri',
        'Robot Line Follower untuk Gudang',
        'Model Kota Cerdas Skala Kecil',
        'Aplikasi AR untuk Pelajaran Astronomi',
        'AI Pendeteksi Penyakit Tanaman',
        'Alat Prostetik Tangan 3D Print',
        'Tas Ramah Lingkungan dari Serat Alam',
        'Drone Pemadam Kebakaran Mini',
        'Sistem Parkir Otomatis Berbasis Sensor',
        'Simulator Tata Surya Interaktif',
        'Sistem Rekomendasi Belajar Berbasis AI',
        'Alat Ukur Saturasi Oksigen Portabel',
        'Upcycling Fashion Show Sekolah',
        'Lengan Robot untuk Penyandang Disabilitas',
        'Smart Traffic Light Model',
        'Roket Air dengan Sistem Peluncuran Otomatis',
        'Chatbot Penerjemah Bahasa Isyarat',
        'Alat EKG Sederhana Berbasis Arduino',
        'Koleksi Busana dari Plastik Daur Ulang',
        'Robot Pelayan Kantin Sekolah',
        'Sistem Manajemen Energi Gedung Sekolah',
        'Planetarium Portabel untuk Presentasi',
        'Sistem Deteksi Plagiarisme Sederhana',
        'Monitor Postur Tubuh untuk Pelajar',
        'Pewarna Alam untuk Kain dari Limbah Sayur',
        'Robot Pembersih Lantai Otomatis',
        'Model Smart Building dengan IoT',
        'Aplikasi Peta Bintang Real-Time',
        'AI Penganalisis Sentimen Media Sosial',
        'Alat Bantu Dengar Amplifier Sederhana',
        'Sepatu dari Bahan Daur Ulang',
        'Conveyor Belt Otomatis Mini',
        'Sistem Irigasi Cerdas Berbasis Cuaca',
        'Model Satelit Cuaca Sederhana',
        'Sistem Absensi Wajah Sekolah',
        'Orthosis Kaki Cetak 3D',
        'Aksesoris Fashion dari E-Waste',
        'Robot Penyiraman Tanaman Otomatis',
        'Prototype Smart Classroom',
        'Lensa Teleskop dari Bahan Sederhana',
        'Virtual Lab Simulasi Fisika',
        'Tensimeter Digital Portable',
        'Batik Motif Fraktal Berbasis Algoritma',
        'Robot Sumo Mini Arduino',
        'Sistem Pencahayaan Adaptif untuk Kelas',
        'Sundial Digital dengan Sensor Cahaya',
        'AI Pengenalan Huruf Braille'
    ];

    v_titles_10 TEXT[] := ARRAY[
        'Panel Surya Portabel untuk Camping',
        'Mesin Pencacah Plastik Kompak',
        'Sistem Penampung Air Hujan Cerdas',
        'Model Kota Hijau Berkelanjutan',
        'Alat Monitor Emisi Karbon',
        'Aquaponik Berbasis Energi Terbarukan',
        'Prototype Turbin Angin Vertikal',
        'Sistem Filtrasi Air Abu-abu',
        'Alat Pengukur Jejak Karbon Harian',
        'Smart Composter dengan IoT',
        'Sistem PLTS Mikro untuk Rumah Tangga',
        'Alat Daur Ulang Kertas Otomatis',
        'Desalinasi Air Laut Tenaga Surya',
        'Taman Vertikal dengan Sistem Otomatis',
        'Monitor Kualitas Udara Dalam Ruangan',
        'Biogas Digester Skala Rumah Tangga',
        'Biopestisida dari Bahan Lokal',
        'Prototype Rumah Apung Tahan Banjir',
        'Sistem Urban Farming Otomatis',
        'Alat Penghitung Biodiversitas Lokal',
        'Prototipe Pembangkit Listrik Tenaga Mikro-Hidro',
        'Sistem Pengolahan Sampah Terpadu',
        'Alat Elektrolisis Air Sederhana',
        'Smart Garden dengan Sensor Kelembaban',
        'Prototype Kendaraan Tenaga Hidrogen',
        'Sistem Pengomposan Vermikultur',
        'Alat Deteksi Pencemaran Tanah',
        'Smart Irrigation Tenaga Surya',
        'Eco-Brick Builder Machine',
        'Peta Interaktif Ekosistem Lokal',
        'Prototype Lampu Lalu Lintas Tenaga Surya',
        'Sistem Monitoring Hutan dengan Drone',
        'Alat Pengolah Minyak Goreng Bekas',
        'Mini Wind Farm Simulator',
        'Smart Trash Can dengan Klasifikasi AI',
        'Bioplastik dari Pati Singkong',
        'Prototype Atap Hijau untuk Bangunan',
        'Alat Pengukur Polusi Suara',
        'Simulator Perubahan Iklim Interaktif',
        'Prototype Pembangkit Listrik Tenaga Gelombang',
        'Sistem Daur Ulang Air Sekolah',
        'Alat Uji Kualitas Tanah Digital',
        'Smart Pot dengan Auto-Watering',
        'Model Ekosistem Mangrove',
        'Prototype Mobil Tenaga Surya Mini',
        'Sistem Pemantauan Curah Hujan',
        'Alat Pemurni Udara Tenaga Tanaman',
        'Biochar dari Limbah Pertanian',
        'Prototype Rumah Hemat Energi Pasif',
        'Sistem Pengelolaan Limbah Elektronik'
    ];

    v_titles_11 TEXT[] := ARRAY[
        'Bioplastik dari Kulit Singkong',
        'Aplikasi Deteksi Gizi Buruk',
        'Platform E-Commerce UMKM Lokal',
        'Batik Digital dengan Motif Fraktal',
        'Dispenser Sabun Otomatis Anti-bakteri',
        'Smart Pill Reminder untuk Lansia',
        'Marketplace Hasil Bumi Petani',
        'Wayang Digital Interaktif',
        'Kemasan Makanan dari Rumput Laut',
        'Alat Cek Kolesterol Portable',
        'Sistem Inventaris Toko Otomatis',
        'Seni Instalasi dari Sampah Elektronik',
        'Sedotan dari Rumput Laut',
        'Fitness Tracker DIY Berbasis Arduino',
        'Chatbot Customer Service UMKM',
        'Mural Interaktif dengan Teknologi AR',
        'Kantong Belanja dari Serat Nanas',
        'Alat Deteksi Kadar Gula Darah Non-Invasif',
        'Platform Belajar Online Gamifikasi',
        'Gamelan Digital Portabel',
        'Piring Makan dari Daun Jati Press',
        'Alat Monitoring Tekanan Darah IoT',
        'Sistem POS untuk Warung Kecil',
        'Lukisan Generatif Berbasis Algoritma',
        'Pupuk Cair dari Limbah Dapur',
        'Aplikasi Panduan Pertolongan Pertama',
        'Prototype Vending Machine UMKM',
        'Alat Musik dari Barang Bekas',
        'Sabun Herbal dari Bahan Lokal',
        'Smart Helmet dengan Sensor Suhu',
        'Prototype Drone Pengantar Barang',
        'Kain Tenun dengan Pola Algoritma',
        'Teh Herbal Inovatif dari Rempah Lokal',
        'Alat Ukur Kadar Oksigen Ruangan',
        'E-Wallet Sekolah Berbasis QR Code',
        'Seni Kinetik dari Bahan Daur Ulang',
        'Tas Kulit Sintetis dari Nanas',
        'Activity Tracker untuk Anak ADHD',
        'Sistem Kasir Otomatis Mini Market',
        'Topeng Seni dari Bahan Ramah Lingkungan',
        'Straw dari Bahan Edible',
        'Alat Pendeteksi Stress Berbasis Sensor',
        'Prototype ATM Sampah Sekolah',
        'Patung Interaktif Responsif Suara',
        'Lilin Aromaterapi dari Minyak Jelantah',
        'Smart Mirror dengan Analisis Kesehatan',
        'Platform Crowdfunding Proyek Sosial',
        'Instalasi Cahaya Responsif Musik',
        'Sampo Natural dari Lidah Buaya',
        'Alat Terapi Pernapasan Portabel'
    ];

    v_titles_12 TEXT[] := ARRAY[
        'Mesin Pirolisis Plastik Skala Kecil',
        'Shelter Darurat Flat-Pack',
        'Sistem Pertanian Vertikal Otomatis',
        'Gearbox Transmisi CVT dari Bahan Lokal',
        'Aplikasi Pemantau Bencana Real-Time',
        'Instalasi Seni Cahaya Interaktif',
        'PLTS untuk Desa Terpencil',
        'Kit Purifikasi Air Darurat',
        'Smart Greenhouse Hidroponik Otomatis',
        'Prototype Suspensi Adaptif',
        'Platform Donasi Barang Bekas Berbasis Lokasi',
        'Animasi Edukasi Mitigasi Bencana',
        'Gasifikasi Biomassa untuk Memasak',
        'Tenda Darurat dengan Solar Cell',
        'Mesin Penanam Benih Otomatis',
        'Desain Roda Gigi Efisien 3D Print',
        'Sistem Peringatan Tsunami Lokal',
        'Game VR Edukasi Sejarah',
        'Alat Desalinasi Portable',
        'Prototype Stretcher Lipat Darurat',
        'Aeroponik Tower untuk Lahan Sempit',
        'Prototype Rem Regeneratif Sepeda',
        'Crowdsource Map Kerusakan Pasca Bencana',
        'Film Dokumenter Seni Tradisional 360°',
        'Bioetanol dari Limbah Buah',
        'Water Purifier Backpack',
        'Robot Penyortir Hasil Panen',
        'Prototype Engsel Pintu Otomatis',
        'Sistem Evakuasi Cerdas Gedung Sekolah',
        'Teater Boneka Mekanik Otomatis',
        'Kompor Biomassa Efisien',
        'Solar Cooker Parabolik Portable',
        'Drone Pemetaan Lahan Pertanian',
        'Prototype Diferensial Terbuka-Terkunci',
        'Sistem Komunikasi Darurat Low-Power',
        'Mural Digital Interaktif Komunitas',
        'Generator Termoelektrik dari Panas Buang',
        'First Aid Drone untuk Area Terpencil',
        'Sistem Fertigasi Otomatis Presisi',
        'Prototype Steering Rack dari Bahan Lokal',
        'Peta Evakuasi AR untuk Gedung Sekolah',
        'Seni Generatif Audio-Visual Real-Time',
        'Brick dari Abu Vulkanik',
        'Alat Sterilisasi UV Portabel',
        'Sistem Packing Otomatis Hasil Pertanian',
        'Prototype Flywheel Energy Storage',
        'Dashboard Monitoring Lingkungan Sekolah',
        'Permainan Board Game Edukasi Bencana',
        'Briket Bioarang dari Tempurung Kelapa',
        'Prototype Pompa Air Tenaga Angin'
    ];

    -- Problems and solutions arrays (we'll pair them with titles)
    v_problems TEXT[] := ARRAY[
        'Banyak siswa dan masyarakat sekitar tidak memiliki akses mudah terhadap solusi yang praktis untuk masalah ini. Kurangnya kesadaran dan alat yang memadai membuat permasalahan ini terus berlanjut tanpa penanganan yang efektif.',
        'Permasalahan ini berdampak langsung terhadap kehidupan sehari-hari. Tanpa adanya inovasi dan pendekatan baru, masalah ini akan semakin memburuk dan mempengaruhi kualitas hidup masyarakat.',
        'Di lingkungan sekolah maupun rumah, masalah ini sering diabaikan padahal memiliki dampak signifikan. Diperlukan pendekatan STEAM yang integratif untuk menemukan solusi yang kreatif dan berkelanjutan.',
        'Kurangnya pemanfaatan teknologi sederhana dalam mengatasi masalah lingkungan menjadi tantangan utama. Siswa perlu diajak untuk berpikir kritis dan menciptakan solusi nyata.',
        'Kondisi saat ini menunjukkan bahwa banyak sumber daya yang terbuang sia-sia. Dengan menerapkan prinsip sains dan rekayasa, kita dapat mengoptimalkan penggunaan sumber daya yang ada.'
    ];

    v_solutions TEXT[] := ARRAY[
        'Kami mengusulkan pembuatan prototype yang mengintegrasikan konsep sains, teknologi, dan seni untuk memberikan solusi praktis. Prototype ini dapat diproduksi dengan biaya rendah menggunakan bahan-bahan yang mudah didapat.',
        'Solusi yang kami ajukan melibatkan penggunaan sensor dan mikrokontroler sederhana untuk memantau dan mengendalikan variabel-variabel kunci. Sistem ini dirancang agar mudah digunakan oleh siapa saja.',
        'Kami merancang sebuah sistem terintegrasi yang menggabungkan prinsip-prinsip fisika, biologi, dan teknologi informasi. Pendekatan ini memungkinkan pemecahan masalah yang holistik dan berkelanjutan.',
        'Prototype kami menggunakan bahan daur ulang dan komponen elektronik sederhana untuk menciptakan alat yang fungsional. Desainnya dibuat modular sehingga mudah diperbaiki dan dikembangkan.',
        'Kami mengembangkan aplikasi dan alat bantu yang menerapkan konsep matematika dan rekayasa untuk mengoptimalkan proses. Solusi ini juga memperhatikan aspek estetika dan pengalaman pengguna.'
    ];

    v_log_tasks TEXT[] := ARRAY[
        'Melakukan riset awal dan studi literatur tentang topik proyek',
        'Membuat desain awal prototype dan sketsa rancangan',
        'Mengumpulkan bahan-bahan dan komponen yang dibutuhkan',
        'Merakit prototype versi pertama',
        'Melakukan pengujian awal dan mencatat hasilnya',
        'Memperbaiki desain berdasarkan hasil pengujian',
        'Membuat dokumentasi proses pembuatan',
        'Mempersiapkan presentasi dan materi demo',
        'Melakukan pengujian akhir prototype',
        'Menulis laporan akhir dan kesimpulan proyek',
        'Diskusi kelompok membahas pembagian tugas',
        'Survei lapangan untuk mengumpulkan data primer',
        'Menganalisis data hasil survei dan eksperimen',
        'Membuat poster ilmiah untuk pameran STEAM',
        'Konsultasi dengan guru pembimbing tentang progress'
    ];

    v_log_results TEXT[] := ARRAY[
        'Berhasil menemukan 5 referensi jurnal dan 3 video tutorial yang relevan dengan topik proyek kami',
        'Desain awal selesai digambar di kertas dan didigitalisasi menggunakan aplikasi desain',
        'Semua bahan berhasil dikumpulkan, termasuk komponen elektronik dari toko online',
        'Prototype versi pertama berhasil dirakit dan berfungsi dengan baik pada pengujian dasar',
        'Ditemukan beberapa kekurangan pada desain yang perlu diperbaiki, terutama bagian stabilitas',
        'Desain baru lebih stabil dan efisien, performa meningkat sekitar 30% dari versi sebelumnya',
        'Dokumentasi lengkap dengan foto dan video proses pembuatan sudah tersimpan di Google Drive',
        'Slide presentasi selesai dengan 15 halaman, termasuk demo video prototype',
        'Prototype lolos semua pengujian dengan hasil yang memuaskan',
        'Laporan akhir selesai dengan 20 halaman termasuk data, analisis, dan kesimpulan',
        'Pembagian tugas sudah disepakati: 2 orang riset, 1 orang desain, 1 orang dokumentasi',
        'Data survei dari 50 responden berhasil dikumpulkan dan direkap',
        'Analisis menunjukkan korelasi positif antara variabel X dan Y dengan r=0.82',
        'Poster A1 selesai didesain dan siap dicetak untuk pameran minggu depan',
        'Guru memberikan masukan positif dan saran perbaikan pada bagian metodologi'
    ];

    v_concept_subjects TEXT[] := ARRAY['mathematics', 'physics', 'biology', 'chemistry', 'technology', 'engineering', 'arts'];
    v_concept_texts TEXT[] := ARRAY[
        'Penerapan statistik dan pengukuran untuk analisis data eksperimen',
        'Konsep gaya, energi, dan hukum termodinamika dalam desain prototype',
        'Pemahaman ekosistem dan organisme dalam konteks masalah lingkungan',
        'Reaksi kimia dan sifat material yang digunakan dalam prototype',
        'Penggunaan sensor, mikrokontroler, dan pemrograman dasar',
        'Prinsip desain mekanis dan proses fabrikasi prototype',
        'Estetika desain, presentasi visual, dan komunikasi kreatif'
    ];

    v_idx INT;
    v_title_idx INT;

BEGIN
    -- Loop through each grade
    FOR v_grade IN 7..12 LOOP
        -- Get theme IDs for this grade
        SELECT array_agg(id) INTO v_theme_ids
        FROM themes
        WHERE grade = v_grade::TEXT
          AND academic_year = '2025/2026';

        -- Loop through 10 classes per grade
        FOR v_class IN 1..10 LOOP
            v_class_name := v_grade || '.' || v_class;

            -- Loop through 5 groups per class
            FOR v_group IN 1..5 LOOP

                -- ========== INSERT STUDENTS (4 per group) ==========
                FOR v_student IN 1..4 LOOP
                    v_idx := ((v_grade - 7) * 200 + (v_class - 1) * 20 + (v_group - 1) * 4 + v_student);
                    v_email := 'student_' || v_class_name || '_g' || v_group || '_' || v_student || '@test.pahoa.sch.id';
                    v_full_name := v_first_names[((v_idx - 1) % array_length(v_first_names, 1)) + 1] || ' ' ||
                                   v_last_names[((v_idx + 7) % array_length(v_last_names, 1)) + 1];

                    INSERT INTO student_master (email, full_name, class_name, group_number, academic_year)
                    VALUES (v_email, v_full_name, v_class_name, v_group, '2025/2026')
                    ON CONFLICT (email) DO NOTHING;
                END LOOP;

                -- ========== INSERT PROJECT (1 per group) ==========
                -- Pick a theme (rotate through available themes)
                IF v_theme_ids IS NOT NULL AND array_length(v_theme_ids, 1) > 0 THEN
                    v_selected_theme := v_theme_ids[((v_group + v_class - 2) % array_length(v_theme_ids, 1)) + 1];
                ELSE
                    v_selected_theme := NULL;
                END IF;

                -- Pick a title based on grade
                v_title_idx := ((v_class - 1) * 5 + v_group);
                CASE v_grade
                    WHEN 7 THEN v_title := v_titles_7[((v_title_idx - 1) % array_length(v_titles_7, 1)) + 1];
                    WHEN 8 THEN v_title := v_titles_8[((v_title_idx - 1) % array_length(v_titles_8, 1)) + 1];
                    WHEN 9 THEN v_title := v_titles_9[((v_title_idx - 1) % array_length(v_titles_9, 1)) + 1];
                    WHEN 10 THEN v_title := v_titles_10[((v_title_idx - 1) % array_length(v_titles_10, 1)) + 1];
                    WHEN 11 THEN v_title := v_titles_11[((v_title_idx - 1) % array_length(v_titles_11, 1)) + 1];
                    WHEN 12 THEN v_title := v_titles_12[((v_title_idx - 1) % array_length(v_titles_12, 1)) + 1];
                END CASE;

                -- Build the abstract JSON
                v_problem := v_problems[((v_title_idx - 1) % array_length(v_problems, 1)) + 1];
                v_solution := v_solutions[((v_title_idx - 1) % array_length(v_solutions, 1)) + 1];

                v_abstract := json_build_object(
                    'problem', v_problem,
                    'solution', v_solution,
                    'keyConcepts', json_build_array(
                        json_build_object(
                            'subject', v_concept_subjects[((v_title_idx - 1) % array_length(v_concept_subjects, 1)) + 1],
                            'concept', v_concept_texts[((v_title_idx - 1) % array_length(v_concept_texts, 1)) + 1]
                        ),
                        json_build_object(
                            'subject', v_concept_subjects[((v_title_idx + 2) % array_length(v_concept_subjects, 1)) + 1],
                            'concept', v_concept_texts[((v_title_idx + 2) % array_length(v_concept_texts, 1)) + 1]
                        ),
                        json_build_object(
                            'subject', v_concept_subjects[((v_title_idx + 4) % array_length(v_concept_subjects, 1)) + 1],
                            'concept', v_concept_texts[((v_title_idx + 4) % array_length(v_concept_texts, 1)) + 1]
                        )
                    )
                )::TEXT;

                v_doc_url := 'https://docs.google.com/document/d/test-' || v_class_name || '-g' || v_group || '/edit';

                INSERT INTO projects (class_name, group_number, academic_year, theme_id, title, abstract, google_doc_url, status, iteration)
                VALUES (v_class_name, v_group, '2025/2026', v_selected_theme, v_title, v_abstract, v_doc_url, 'approved', 1)
                ON CONFLICT DO NOTHING;

                -- ========== INSERT LOGBOOKS (3 entries per group) ==========
                FOR v_student IN 1..3 LOOP
                    v_student_email := 'student_' || v_class_name || '_g' || v_group || '_' || v_student || '@test.pahoa.sch.id';
                    v_log_date := '2026-01-15'::DATE + (v_student * 7 + v_group + v_class);

                    v_idx := ((v_class - 1) * 15 + (v_group - 1) * 3 + v_student);
                    v_log_task := v_log_tasks[((v_idx - 1) % array_length(v_log_tasks, 1)) + 1];
                    v_log_result := v_log_results[((v_idx - 1) % array_length(v_log_results, 1)) + 1];

                    INSERT INTO logbooks (class_name, group_number, academic_year, student_email, entry_date, task, result)
                    VALUES (v_class_name, v_group, '2025/2026', v_student_email, v_log_date, v_log_task, v_log_result);
                END LOOP;

            END LOOP; -- groups
        END LOOP; -- classes
    END LOOP; -- grades

    RAISE NOTICE 'Seed complete! Created data for grades 7-12, 10 classes each, 5 groups per class.';
    RAISE NOTICE 'Total students: ~1200, Total projects: ~300, Total logbook entries: ~900';
END $$;
