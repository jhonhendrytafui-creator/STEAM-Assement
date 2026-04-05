-- ============================================
-- Fix student_master for multi-year support
-- Run this ONCE on your existing database
-- ============================================

-- 1. Drop the old UNIQUE constraint on email alone
ALTER TABLE student_master DROP CONSTRAINT IF EXISTS student_master_email_key;

-- 2. Add a new composite UNIQUE constraint: same email can exist in different years
ALTER TABLE student_master ADD CONSTRAINT student_master_email_year_key UNIQUE (email, academic_year);
