-- Create Peer Assessments Table
CREATE TABLE IF NOT EXISTS peer_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL,
    assessor_email TEXT NOT NULL,
    assessed_email TEXT NOT NULL,
    q1_score INT NOT NULL,
    q2_score INT NOT NULL,
    q3_score INT NOT NULL,
    q4_score INT NOT NULL,
    q5_score INT NOT NULL,
    q6_score INT NOT NULL,
    comment_good TEXT NOT NULL,
    comment_improve TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year, assessor_email, assessed_email)
);

-- Row Level Security
ALTER TABLE peer_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can insert their own assessments"
ON peer_assessments FOR INSERT TO authenticated
WITH CHECK (
    assessor_email = (SELECT email FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Students can read assessments they created"
ON peer_assessments FOR SELECT TO authenticated
USING (
    assessor_email = (SELECT email FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Teachers can read all assessments"
ON peer_assessments FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);
