CREATE TABLE IF NOT EXISTS ai_precheck_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name TEXT NOT NULL,
    group_number INT NOT NULL,
    academic_year TEXT NOT NULL,
    usage_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name, group_number, academic_year)
);

ALTER TABLE ai_precheck_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ai_precheck_usage"
    ON ai_precheck_usage FOR SELECT TO authenticated
    USING (true);

-- Allow students to insert/update their group's quota
CREATE POLICY "Students can update their group's quota"
    ON ai_precheck_usage FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);
