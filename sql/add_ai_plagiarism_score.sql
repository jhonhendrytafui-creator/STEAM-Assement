ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS ai_plagiarism_score integer;
