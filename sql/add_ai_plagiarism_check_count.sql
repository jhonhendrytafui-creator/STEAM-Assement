-- Add scan counter to projects table (default 0, incremented each time AI check is run)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_plagiarism_check_count INTEGER DEFAULT 0;

-- Set existing scanned projects to count = 1 so they don't start at 0
UPDATE projects SET ai_plagiarism_check_count = 1 WHERE ai_plagiarism_score IS NOT NULL AND ai_plagiarism_check_count = 0;
