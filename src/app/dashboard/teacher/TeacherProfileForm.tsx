'use client';

import React, { useState } from 'react';
import { UserCog, Check, Pencil, AlertTriangle, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { subjectLabel } from '@/lib/subjects';
import { GRADE_LEVELS } from '@/lib/grade';
import { PHONE_PREFIX, normalizeIdPhone, localPartOf, formatIdPhone } from '@/lib/phone';
import SubjectPicker from '@/components/ui/SubjectPicker';
import type { TeacherProfile, ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// The teacher's own profile.
//
// Serves two jobs from one form. As a gate (`mode="onboarding"`) it is all the
// teacher portal renders until every field is filled — expertise and grade
// level were missing for most teachers, and expertise in particular is what the
// project classifier needs before it can recommend anybody. As a tab
// (`mode="edit"`) the same form lets them correct it later, because people
// change subjects between years.
//
// Every field here is required. The save goes through the save_teacher_profile
// RPC rather than a table write: teacher_emails carries is_admin, and a function
// can restrict the write to four columns where RLS cannot.
// ─────────────────────────────────────────────────────────────

interface TeacherProfileFormProps {
    profile: TeacherProfile;
    /** 'onboarding' blocks the portal behind this form; 'edit' renders it as a tab. */
    mode: 'onboarding' | 'edit';
    /** Re-read the profile so the parent can let them through, or show the new values. */
    onSaved: () => void | Promise<void>;
    showToast: (message: string, type: ToastType) => void;
}

const inputClass =
    'w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 ' +
    'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

export default function TeacherProfileForm({
    profile,
    mode,
    onSaved,
    showToast,
}: TeacherProfileFormProps) {
    const [fullName, setFullName] = useState(profile.full_name ?? '');
    const [subjects, setSubjects] = useState<string[]>(profile.expertise_subjects ?? []);
    const [grades, setGrades] = useState<string[]>(profile.grade_levels ?? []);
    // Only the part after the fixed +62 is editable, so the stored value is
    // split for display and rejoined on save.
    const [phoneLocal, setPhoneLocal] = useState(localPartOf(profile.phone_e164));
    const [pickingSubjects, setPickingSubjects] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const toggleGrade = (g: string) =>
        setGrades(prev => (prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]));

    const normalizedPhone = normalizeIdPhone(phoneLocal);

    const validate = (): boolean => {
        const next: Record<string, string> = {};
        if (!fullName.trim()) next.fullName = 'Please enter your full name.';
        if (subjects.length === 0) next.subjects = 'Choose at least one subject you teach.';
        if (grades.length === 0) next.grades = 'Choose at least one grade level you teach.';
        if (!phoneLocal.trim()) {
            next.phone = 'Please enter your WhatsApp number.';
        } else if (!normalizedPhone) {
            next.phone = 'That does not look like an Indonesian mobile number. Example: 85712345678';
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        if (!validate()) return;

        setSaving(true);
        const { error } = await supabase.rpc('save_teacher_profile', {
            p_full_name: fullName.trim(),
            p_subjects: subjects,
            p_grades: grades,
            p_phone: normalizedPhone,
        });
        setSaving(false);

        if (error) {
            // The RPC repeats every check, so its message is the useful one.
            showToast(error.message || 'Could not save your profile. Please try again.', 'error');
            return;
        }

        showToast(
            mode === 'onboarding' ? 'Profile saved. Welcome!' : 'Profile updated.',
            'success',
        );
        await onSaved();
    };

    const onboarding = mode === 'onboarding';

    return (
        <div className={onboarding ? 'min-h-screen bg-[#1c1b14] px-3 sm:px-6 py-8 sm:py-12' : ''}>
            {pickingSubjects && (
                <SubjectPicker
                    title="Subjects you teach"
                    value={subjects}
                    onSave={next => { setSubjects(next); setPickingSubjects(false); }}
                    onCancel={() => setPickingSubjects(false)}
                />
            )}

            <div
                className={
                    'bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl ' +
                    (onboarding ? 'max-w-2xl mx-auto' : '')
                }
            >
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <UserCog className="text-amber-500" />
                    {onboarding ? 'Complete your teacher profile' : 'My Profile'}
                </h2>

                {onboarding ? (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-100">
                            Before you can use the portal we need a few details about you. Your
                            subjects decide which projects you are recommended for, and your name
                            is shown to students beside any mark you give. This is a one-off —
                            you can edit it later from My Profile.
                        </p>
                    </div>
                ) : (
                    <p className="text-slate-400 text-sm mb-8">
                        Your subjects decide which projects you are recommended for, and your name
                        is shown to students beside any mark you give.
                    </p>
                )}

                <form onSubmit={handleSave} className="space-y-6">
                    {/* Email — identity, not editable here */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            School email
                        </label>
                        <div className="bg-[#171610] border border-slate-800 rounded-xl py-3 px-4 text-slate-500">
                            {profile.email}
                        </div>
                    </div>

                    {/* Full name */}
                    <div>
                        <label htmlFor="tp-full-name" className="block text-sm font-semibold text-slate-300 mb-2">
                            Full name <span className="text-amber-500">*</span>
                        </label>
                        <input
                            id="tp-full-name"
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className={inputClass}
                            placeholder="As you want students to see it"
                            aria-invalid={Boolean(errors.fullName)}
                        />
                        {errors.fullName && <p className="text-red-400 text-xs mt-1.5">{errors.fullName}</p>}
                    </div>

                    {/* Subjects */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Area of expertise <span className="text-amber-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {subjects.length > 0 ? (
                                subjects.map(id => (
                                    <span
                                        key={id}
                                        className="bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full px-3 py-1 text-xs font-medium"
                                    >
                                        {subjectLabel(id)}
                                    </span>
                                ))
                            ) : (
                                <span className="text-slate-500 text-sm">No subjects chosen yet.</span>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setPickingSubjects(true)}
                            className="inline-flex items-center gap-2 bg-[#1c1b14] hover:bg-[#232118] border border-slate-800 hover:border-amber-500/40 text-slate-300 rounded-xl py-2.5 px-4 text-sm font-medium transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            {subjects.length > 0 ? 'Change subjects' : 'Choose your subjects'}
                        </button>
                        {errors.subjects && <p className="text-red-400 text-xs mt-1.5">{errors.subjects}</p>}
                    </div>

                    {/* Grade levels */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            Grade level you teach <span className="text-amber-500">*</span>
                        </label>
                        <p className="text-xs text-slate-500 mb-3">Pick every grade you teach.</p>
                        <div className="flex flex-wrap gap-2">
                            {GRADE_LEVELS.map(g => {
                                const on = grades.includes(g);
                                return (
                                    <button
                                        key={g}
                                        type="button"
                                        onClick={() => toggleGrade(g)}
                                        aria-pressed={on}
                                        className={
                                            'rounded-xl px-5 py-2.5 text-sm font-semibold border transition-all ' +
                                            (on
                                                ? 'bg-amber-500 text-[#1a160d] border-amber-400'
                                                : 'bg-[#1c1b14] text-slate-400 border-slate-800 hover:border-amber-500/40')
                                        }
                                    >
                                        {on && <Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />}
                                        Grade {g}
                                    </button>
                                );
                            })}
                        </div>
                        {errors.grades && <p className="text-red-400 text-xs mt-1.5">{errors.grades}</p>}
                    </div>

                    {/* WhatsApp number — +62 fixed, only the rest is typed */}
                    <div>
                        <label htmlFor="tp-phone" className="block text-sm font-semibold text-slate-300 mb-2">
                            WhatsApp number <span className="text-amber-500">*</span>
                        </label>
                        <div className="flex items-stretch">
                            <span
                                aria-hidden="true"
                                className="inline-flex items-center bg-[#171610] border border-r-0 border-slate-800 rounded-l-xl px-4 text-slate-400 font-semibold select-none"
                            >
                                {PHONE_PREFIX}
                            </span>
                            <input
                                id="tp-phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                value={phoneLocal}
                                // Digits only. A leading 0 is accepted as it is typed and
                                // dropped on save, so 0857… behaves the way it reads.
                                onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, ''))}
                                className={inputClass + ' rounded-l-none'}
                                placeholder="85712345678"
                                aria-describedby="tp-phone-help"
                                aria-invalid={Boolean(errors.phone)}
                            />
                        </div>
                        <p id="tp-phone-help" className="text-xs text-slate-500 mt-1.5">
                            No need for the leading 0 — if you type 0857… we store it as{' '}
                            <span className="text-slate-400">+62 857…</span>. Students and staff
                            reach you through a WhatsApp button.
                        </p>
                        {normalizedPhone && (
                            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5">
                                <MessageCircle className="w-3.5 h-3.5" />
                                Saved as {formatIdPhone(normalizedPhone)}
                            </p>
                        )}
                        {errors.phone && <p className="text-red-400 text-xs mt-1.5">{errors.phone}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#1a160d] font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <div className="w-5 h-5 border-2 border-[#1a160d] border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Check className="w-5 h-5" />
                        )}
                        {saving
                            ? 'Saving...'
                            : onboarding
                                ? 'Save and enter the portal'
                                : 'Save changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}
