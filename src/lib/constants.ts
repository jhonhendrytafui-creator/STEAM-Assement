import {
    Globe, FlaskConical, Sparkles, Users, Monitor, Database,
    Lock, Cpu, Wrench, Plus, Paintbrush, BookOpen, Calculator, TrendingUp,
    type LucideIcon,
} from 'lucide-react';
import { SUBJECT_DEFS } from '@/lib/subjects';

// The academic year is no longer a constant: it lives in app_settings so an
// admin can roll the school over without a redeploy. Read it with
// academicYear() from '@/lib/academic-year' (or getAcademicYearServer() in an
// API route), and make sure loadAcademicYear() has been awaited first.
// FALLBACK_ACADEMIC_YEAR there is the value this constant used to hold.

// STEAM subject definitions used across student and teacher dashboards.
// The ids, labels and groups live in src/lib/subjects.ts, which carries no
// React import so the API routes and the assignment algorithm can use them
// too. This only attaches the icons.
const SUBJECT_ICONS: Record<string, LucideIcon> = {
    biology_marine: Globe, chemistry: FlaskConical, physics: Sparkles,
    environmental_science: Globe, astronomy: Sparkles, geology_meteorology: Globe,
    psychology: Users,

    cs_programming: Monitor, it: Database, cybersecurity_data: Lock,
    ai_ml: Cpu, robotics: Wrench, web_development: Globe,

    civil_structural: Wrench, mechanical: Wrench, aerospace: Wrench,
    electrical_electronic: Cpu, chemical: FlaskConical, biomedical: Plus,

    visual_design: Paintbrush, graphic_digital: Monitor, industrial_product: Wrench,
    architecture: Paintbrush, creative_language: BookOpen, performing_arts: Users,

    calculus_linear: Calculator, statistics_probability: TrendingUp,
    differential_equations: Calculator, discrete_mathematics: Calculator,
    financial_mathematics: TrendingUp,
};

export const SUBJECTS = SUBJECT_DEFS.map(s => ({
    ...s,
    icon: SUBJECT_ICONS[s.id] ?? Sparkles,
}));
