// Shared TypeScript interfaces used across the application

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
    id: number;
    message: string;
    type: ToastType;
}

export interface StudentInfo {
    full_name: string;
    class_name: string;
    group_number: number;
    email: string;
}

export interface TeamMember {
    full_name: string;
    email: string;
}

export interface ProjectData {
    id: string;
    class_name: string;
    group_number: number;
    title: string;
    abstract: string;
    google_doc_url: string | null;
    presentation_url?: string;
    status: string;
    theme_id: string;
    iteration?: number;
    teacher_comment?: string;
    created_at: string;
    additional_documents?: { type: string; url: string }[];
    c5_generated_questions?: string;
    themes?: {
        theme_name: string;
    } | null;
    ai_plagiarism_score?: number | null;
    ai_plagiarism_checked_at?: string | null;
}

export interface LogbookEntry {
    id: string;
    student_email: string;
    class_name?: string;
    group_number?: number;
    entry_date: string;
    task: string;
    result: string;
    feedback: string;
    photo_url?: string | null;
    created_at: string;
}

export interface Theme {
    id: string;
    theme_name: string;
}

export interface AssessmentCategory {
    id: string;
    code: string;
    name: string;
    rubric_type: string;
    sort_order: number;
}

export interface RubricDimension {
    id: string;
    category_id: string;
    name: string;
    sort_order: number;
}

export interface RubricIndicator {
    id: string;
    dimension_id: string;
    description: string;
    criteria?: Record<string, string>;
    sort_order: number;
}

export interface AssessmentScoreEntry {
    id: string;
    indicator_id: string;
    score: number;
    assessed_at: string;
    teacher_comment?: string;
    class_name?: string;
    group_number?: number;
    category_id?: string;
    academic_year?: string;
}

export interface TabItem {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

export interface ConfirmDialogState {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
}

export interface ProjectTeacherRecommendation {
    id: string;
    project_id: string;
    teacher_email: string;
    teacher_name: string;
    teacher_expertise: string;
    rank_level: 'High' | 'Medium' | 'Low';
    relevance_percentage: number;
    reason: string;
    created_at: string;
}
