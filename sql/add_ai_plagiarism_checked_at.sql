ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS ai_plagiarism_checked_at timestamp with time zone;
