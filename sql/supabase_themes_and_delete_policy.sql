-- ============================================
-- Insert Themes for Grades 10, 11, 12
-- Run this in Supabase SQL Editor
-- ============================================

-- Grade 10
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Renewable Energy', '10', '2025/2026'),
('Waste Management and Recycling', '10', '2025/2026'),
('Water Conservation', '10', '2025/2026'),
('Green City Design', '10', '2025/2026'),
('Climate Change', '10', '2025/2026'),
('Food Estate', '10', '2025/2026'),
('Ecosystem and Biodiversity', '10', '2025/2026'),
('Polution', '10', '2025/2026');

-- Grade 11
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Lingkungan & Produk Ramah Lingkungan', '11', '2025/2026'),
('Kesehatan & Gaya Hidup Sehat', '11', '2025/2026'),
('Teknologi & Inovasi Digital', '11', '2025/2026'),
('Produk Kreatif Berbasis Seni & Budaya', '11', '2025/2026'),
('Solusi Kebutuhan Sehari-hari', '11', '2025/2026'),
('Transportasi & Mobilitas', '11', '2025/2026'),
('Pendidikan', '11', '2025/2026');

-- Grade 12
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Energi dan Lingkungan Berkelanjutan', '12', '2025/2026'),
('Ketahanan dan Kemanusiaan', '12', '2025/2026'),
('Pertanian dan Pangan Modern', '12', '2025/2026'),
('Rekayasa dan Desain Mekanis', '12', '2025/2026'),
('Teknologi Digital dan Aplikasi', '12', '2025/2026'),
('Edukasi dan Seni Interaktif', '12', '2025/2026');

-- ============================================
-- Allow students to delete their OWN logbook entries
-- ============================================
CREATE POLICY "Students can delete own logbook entries"
ON logbooks FOR DELETE TO authenticated
USING (student_email = (SELECT email FROM profiles WHERE id = auth.uid()));
