-- Add expertise column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expertise TEXT;

-- Create project_teacher_recommendations table
CREATE TABLE IF NOT EXISTS project_teacher_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    teacher_email TEXT,
    teacher_name TEXT,
    teacher_expertise TEXT,
    rank_level TEXT NOT NULL, -- 'High', 'Medium', 'Low'
    relevance_percentage INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure we don't have duplicate recommendations for the same project and teacher
    UNIQUE(project_id, teacher_email)
);

-- RLS for project_teacher_recommendations
ALTER TABLE project_teacher_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON project_teacher_recommendations
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON project_teacher_recommendations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Seed existing teachers with subjects from the approved list for testing
-- This sets a random expertise to any teacher who doesn't have one yet
DO $$ 
DECLARE
    subject_list TEXT[] := ARRAY['Math', 'Biology', 'Physics', 'Chemistry', 'Computer', 'Music', 'Food', 'Product Design', 'Business', 'Visual Arts', 'Language'];
    teacher_record RECORD;
BEGIN
    FOR teacher_record IN SELECT id FROM profiles WHERE role = 'teacher' AND (expertise IS NULL OR expertise = '') LOOP
        UPDATE profiles 
        SET expertise = subject_list[floor(random() * array_length(subject_list, 1) + 1)]
        WHERE id = teacher_record.id;
    END LOOP;
END $$;

