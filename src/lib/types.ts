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
    ai_plagiarism_check_count?: number | null;
    c5_generated_questions_en?: string | null;
    c5_generated_questions_id?: string | null;
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
    /** Who gave this mark. NULL on marks taken before this was recorded. */
    assessed_by?: string | null;
    /** Their name, captured at save time. NULL shows as "Not Recorded". */
    assessed_by_name?: string | null;
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

/**
 * Whether someone with portal access actually teaches. Office staff, a
 * librarian or a head needs the dashboards but has no subject expertise and no
 * grade level, so the onboarding form asks them for neither.
 */
export type TeachingRole = 'teaching' | 'non_teaching';

export interface TeacherProfile {
    id: string;
    email: string;
    role: string;
    full_name?: string | null;
    expertise?: string | null;
    is_admin?: boolean;
    /** 'teaching' (teaches and assesses) or 'non_teaching' (neither). */
    teaching_role?: TeachingRole | null;
    /** Subject ids from src/lib/subjects.ts. Empty for non-teaching staff. */
    expertise_subjects?: string[] | null;
    /** Grades taught, as bare numerals: ['7', '8']. Empty for non-teaching staff. */
    grade_levels?: string[] | null;
    /** WhatsApp number, digits only with country code: '6285712345678'. */
    phone_e164?: string | null;
    /** NULL until the teacher has completed their own profile; gates the portal. */
    profile_completed_at?: string | null;
}

export interface StudentRecord {
    id: string;
    email: string;
    full_name: string;
    class_name: string;
    group_number: number;
    academic_year: string;
    created_at?: string;
}

export interface TeacherEmailRecord {
    id: string;
    email: string;
    is_admin: boolean;
    created_at?: string;
    full_name?: string | null;
    /** Subject ids from src/lib/subjects.ts. Empty means classification skips them. */
    expertise_subjects?: string[];
    /** Grades taught, as bare numerals: ['7', '8']. */
    grade_levels?: string[];
    /** 'teaching' or 'non_teaching'. */
    teaching_role?: TeachingRole;
    /** WhatsApp number, digits only with country code: '6285712345678'. */
    phone_e164?: string | null;
    /** NULL until the teacher has completed their own profile. */
    profile_completed_at?: string | null;
    /** Filled in from profiles — null when the teacher has never logged in. */
    has_logged_in?: boolean;
}

export interface AdminAuditEntry {
    id: string;
    actor_email: string;
    action: string;
    target: string | null;
    details: Record<string, unknown>;
    academic_year: string | null;
    created_at: string;
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
