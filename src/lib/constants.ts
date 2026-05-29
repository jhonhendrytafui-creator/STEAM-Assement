import {
    Globe, FlaskConical, Sparkles, Users, Monitor, Database,
    Lock, Cpu, Wrench, Plus, Paintbrush, BookOpen, Calculator, TrendingUp
} from 'lucide-react';

// Current academic year — single source of truth
export const ACADEMIC_YEAR = '2026/2027';

// STEAM subject definitions used across student and teacher dashboards
export const SUBJECTS = [
    { id: 'biology_marine', label: 'Biology & Marine Biology', group: 'Science (S)', icon: Globe },
    { id: 'chemistry', label: 'Chemistry', group: 'Science (S)', icon: FlaskConical },
    { id: 'physics', label: 'Physics', group: 'Science (S)', icon: Sparkles },
    { id: 'environmental_science', label: 'Environmental Science', group: 'Science (S)', icon: Globe },
    { id: 'astronomy', label: 'Astronomy', group: 'Science (S)', icon: Sparkles },
    { id: 'geology_meteorology', label: 'Geology & Meteorology', group: 'Science (S)', icon: Globe },
    { id: 'psychology', label: 'Psychology', group: 'Science (S)', icon: Users },

    { id: 'cs_programming', label: 'Computer Science & Programming', group: 'Technology (T)', icon: Monitor },
    { id: 'it', label: 'Information Technology (IT)', group: 'Technology (T)', icon: Database },
    { id: 'cybersecurity_data', label: 'Cybersecurity & Data Science', group: 'Technology (T)', icon: Lock },
    { id: 'ai_ml', label: 'Artificial Intelligence & Machine Learning', group: 'Technology (T)', icon: Cpu },
    { id: 'robotics', label: 'Robotics', group: 'Technology (T)', icon: Wrench },
    { id: 'web_development', label: 'Web Development', group: 'Technology (T)', icon: Globe },

    { id: 'civil_structural', label: 'Civil & Structural Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'mechanical', label: 'Mechanical Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'aerospace', label: 'Aerospace Engineering', group: 'Engineering (E)', icon: Wrench },
    { id: 'electrical_electronic', label: 'Electrical & Electronic Engineering', group: 'Engineering (E)', icon: Cpu },
    { id: 'chemical', label: 'Chemical Engineering', group: 'Engineering (E)', icon: FlaskConical },
    { id: 'biomedical', label: 'Biomedical Engineering', group: 'Engineering (E)', icon: Plus },

    { id: 'visual_design', label: 'Visual Arts & Design', group: 'Arts (A)', icon: Paintbrush },
    { id: 'graphic_digital', label: 'Graphic Design & Digital Media', group: 'Arts (A)', icon: Monitor },
    { id: 'industrial_product', label: 'Industrial/Product Design', group: 'Arts (A)', icon: Wrench },
    { id: 'architecture', label: 'Architecture', group: 'Arts (A)', icon: Paintbrush },
    { id: 'creative_language', label: 'Creative Arts & Language Arts', group: 'Arts (A)', icon: BookOpen },
    { id: 'performing_arts', label: 'Performing Arts', group: 'Arts (A)', icon: Users },

    { id: 'calculus_linear', label: 'Calculus & Linear Algebra', group: 'Mathematics (M)', icon: Calculator },
    { id: 'statistics_probability', label: 'Statistics & Probability', group: 'Mathematics (M)', icon: TrendingUp },
    { id: 'differential_equations', label: 'Differential Equations', group: 'Mathematics (M)', icon: Calculator },
    { id: 'discrete_mathematics', label: 'Discrete Mathematics', group: 'Mathematics (M)', icon: Calculator },
    { id: 'financial_mathematics', label: 'Financial Mathematics', group: 'Mathematics (M)', icon: TrendingUp },
];
