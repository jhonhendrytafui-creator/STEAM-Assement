-- ================================================================
-- Table: project_votes
-- Limits a teacher to 3 votes maximum via a trigger.
-- ================================================================

CREATE TABLE IF NOT EXISTS project_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, teacher_id)
);

ALTER TABLE project_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read project_votes"
ON project_votes FOR SELECT TO authenticated
USING (true);

-- Allow teachers to insert if they are authenticated and have teacher role
CREATE POLICY "Teachers can insert project_votes"
ON project_votes FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

-- Allow teachers to delete only their own votes
CREATE POLICY "Teachers can delete own project_votes"
ON project_votes FOR DELETE TO authenticated
USING (teacher_id = auth.uid());

-- Trigger to enforce maximum of 3 votes per teacher
CREATE OR REPLACE FUNCTION check_max_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM project_votes WHERE teacher_id = NEW.teacher_id) >= 3 THEN
        RAISE EXCEPTION 'A teacher can only vote for up to 3 projects';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_votes ON project_votes;
CREATE TRIGGER enforce_max_votes
BEFORE INSERT ON project_votes
FOR EACH ROW EXECUTE FUNCTION check_max_votes();


-- ================================================================
-- View: project_leaderboard
-- Aggregates the votes per project.
-- ================================================================
CREATE OR REPLACE VIEW project_leaderboard AS
SELECT 
    p.id as project_id,
    p.class_name,
    p.group_number,
    p.title,
    p.academic_year,
    t.theme_name,
    COUNT(pv.id) as vote_count
FROM projects p
LEFT JOIN project_votes pv ON p.id = pv.project_id
LEFT JOIN themes t ON p.theme_id = t.id
GROUP BY p.id, p.class_name, p.group_number, p.title, p.academic_year, t.theme_name
HAVING COUNT(pv.id) > 0;

-- Grant access to the view
GRANT SELECT ON project_leaderboard TO authenticated;
