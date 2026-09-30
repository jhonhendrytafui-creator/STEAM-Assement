'use client';

import React, { useState } from 'react';
import {
    UserCog, Check, Pencil, AlertTriangle, MessageCircle, GraduationCap, Briefcase,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { subjectLabel } from '@/lib/subjects';
import { GRADE_LEVELS } from '@/lib/grade';
import { PHONE_PREFIX, normalizeIdPhone, localPartOf, formatIdPhone } from '@/lib/phone';
import SubjectPicker from '@/components/ui/SubjectPicker';
import type { TeacherProfile, TeachingRole, ToastType } from '@/lib/types';

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
// What is required depends on the first answer. Someone who teaches has to give
// their subjects and grades -- subjects are what the project classifier matches
// on, so an empty list means they are never recommended for anything. Someone who
// does not teach or assess has neither, and being asked for both was a wall they
// could not get past. Name and WhatsApp number are asked of everyone.
//
// A teacher's own save goes through the save_teacher_profile RPC rather than a
// table write: teacher_emails carries is_admin, and a function can restrict the
// write to the profile columns where RLS cannot.
//
// An admin filling one in for somebody else (`mode="admin"`) cannot use that
// RPC -- it is deliberately scoped to the caller's own email -- so it writes
// teacher_emails directly, which the "Admins can manage teacher_emails" policy
// already allows. Same form, same validation, one difference: the phone number
// is optional, because an admin often will not have it. Without it the record
// is saved but not marked complete, so the teacher is still shown the form at
// sign-in with everything the admin entered already filled in.
// ─────────────────────────────────────────────────────────────

interface TeacherProfileFormProps {
    /** The record being edited: the reader's own, or in admin mode someone else's. */
    profile: TeacherProfile;
    /**
     * 'onboarding' blocks the portal behind this form, 'edit' renders it as the
     * reader's own tab, 'admin' fills one in on another teacher's behalf.
     */
    mode: 'onboarding' | 'edit' | 'admin';
    /** Re-read the profile so the parent can let them through, or show the new values. */
    onSaved: () => void | Promise<void>;
    showToast: (message: string, type: ToastType) => void;
    /** admin mode: close the editor without saving. */
    onCancel?: () => void;
}

const inputClass =
    'w-full bg-[#1c1b14] border border-slate-800 rounded-xl py-3 px-4 text-slate-200 ' +
    'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

export default function TeacherProfileForm({
    profile,
    mode,
    onSaved,
    showToast,
    onCancel,
}: TeacherProfileFormProps) {
    const [role, setRole] = useState<TeachingRole>(profile.teaching_role ?? 'teaching');
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

    const teaches = role === 'teaching';
    const adminMode = mode === 'admin';
    const who = adminMode ? 'they' : 'you';

    // Everything present, so the teacher can skip the sign-in form entirely.
    const isComplete = Boolean(
        fullName.trim() && normalizedPhone && (!teaches || (subjects.length > 0 && grades.length > 0)),
    );

    const validate = (): boolean => {
        const next: Record<string, string> = {};
        if (!fullName.trim()) next.fullName = `Please enter ${adminMode ? 'their' : 'your'} full name.`;
        // Only asked of, and only required of, someone who teaches.
        if (teaches && subjects.length === 0) next.subjects = `Choose at least one subject ${who} teach.`;
        if (teaches && grades.length === 0) next.grades = `Choose at least one grade level ${who} teach.`;
        if (!phoneLocal.trim()) {
            // Optional for an admin, who often will not have it: the record is
            // saved without it and the teacher is asked at sign-in instead.
            if (!adminMode) next.phone = 'Please enter your WhatsApp number.';
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

        // Sent empty for non-teaching staff so a change of role cannot leave
        // stale subjects behind, matching what the RPC stores.
        const nextSubjects = teaches ? subjects : [];
        const nextGrades = teaches ? grades : [];

        const { error } = adminMode
            // No RPC here: save_teacher_profile is scoped to the caller's own
            // email by design. teacher_emails is the source of truth and the
            // sync trigger mirrors this to profiles; is_admin is left alone.
            ? await supabase
                .from('teacher_emails')
                .update({
                    full_name: fullName.trim(),
                    teaching_role: role,
                    expertise_subjects: nextSubjects,
                    grade_levels: nextGrades,
                    phone_e164: normalizedPhone,
                    // Only a complete record lets them skip the sign-in form.
                    profile_completed_at: isComplete
                        ? (profile.profile_completed_at ?? new Date().toISOString())
                        : null,
                })
                .eq('email', profile.email)
            : await supabase.rpc('save_teacher_profile', {
                p_full_name: fullName.trim(),
                p_subjects: nextSubjects,
                p_grades: nextGrades,
                p_phone: normalizedPhone,
                p_teaching_role: role,
            });

        setSaving(false);

        if (error) {
            // The RPC and the CHECK constraints repeat every rule, so their
            // message is the useful one.
            showToast(error.message || 'Could not save the profile. Please try again.', 'error');
            return;
        }

        showToast(
            adminMode
                ? (isComplete
                    ? `Saved. ${fullName.trim()} will not be asked to fill the form.`
                    : `Saved. ${fullName.trim()} will still be asked for the missing details at sign-in.`)
                : mode === 'onboarding' ? 'Profile saved. Welcome!' : 'Profile updated.',
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
                    {onboarding
                        ? 'Complete your teacher profile'
                        : adminMode ? 'Edit teacher profile' : 'My Profile'}
                </h2>

                {onboarding ? (
                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 mb-8 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-100">
                            Before you can use the portal we need a few details about you. Start
                            with your role: if you do not teach or assess, we will not ask you for
                            subjects or grade levels. Your name is shown to students beside any
                            mark you give. This is a one-off — you can edit it later from My Profile.
                        </p>
                    </div>
                ) : adminMode ? (
                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 mb-8">
                        <p className="text-sm text-slate-300">
                            Filling this in for <span className="text-amber-300 font-semibold">{profile.email}</span>.
                            They can change it themselves later from My Profile.
                        </p>
                        <p className={'text-xs mt-2 ' + (isComplete ? 'text-emerald-400' : 'text-amber-400')}>
                            {isComplete
                                ? 'Complete — they will go straight into the portal at sign-in.'
                                : 'Incomplete — they will still be asked at sign-in, with this pre-filled.'}
                        </p>
                    </div>
                ) : (
                    <p className="text-slate-400 text-sm mb-8">
                        Your subjects decide which projects you are recommended for, and your name
                        is shown to students beside any mark you give. Change your role here if it
                        no longer fits.
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

                    {/* What kind of account this is. Asked first, because it
                        decides which of the fields below apply. */}
                    <div>
                        <span className="block text-sm font-semibold text-slate-300 mb-2">
                            {adminMode ? 'Their role at the school' : 'Your role at the school'}{' '}
                            <span className="text-amber-500">*</span>
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Your role at the school">
                            {([
                                {
                                    value: 'teaching' as TeachingRole,
                                    icon: GraduationCap,
                                    title: 'I teach and assess',
                                    blurb: 'You guide groups and mark their work. We will ask for your subjects and grade levels.',
                                },
                                {
                                    value: 'non_teaching' as TeachingRole,
                                    icon: Briefcase,
                                    title: 'I do not teach or assess',
                                    blurb: 'Office, library, counselling, leadership — portal access without teaching. No subjects or grades needed.',
                                },
                            ]).map(opt => {
                                const on = role === opt.value;
                                const Icon = opt.icon;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        onClick={() => setRole(opt.value)}
                                        className={
                                            'text-left rounded-xl border p-4 transition-all '
                                            + (on
                                                ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40'
                                                : 'bg-[#1c1b14] border-slate-800 hover:border-amber-500/40')
                                        }
                                    >
                                        <span className="flex items-center gap-2 mb-1">
                                            <Icon className={'w-4 h-4 ' + (on ? 'text-amber-400' : 'text-slate-500')} />
                                            <span className={'text-sm font-semibold ' + (on ? 'text-amber-300' : 'text-slate-300')}>
                                                {opt.title}
                                            </span>
                                            {on && <Check className="w-4 h-4 text-amber-400 ml-auto shrink-0" />}
                                        </span>
                                        <span className="text-xs text-slate-500 block">{opt.blurb}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Full name */}
                    <div>
                        <label htmlFor="tp-full-name" className="block text-sm font-semibold text-slate-300 mb-2">
                            {adminMode ? 'Their full name' : 'Full name'} <span className="text-amber-500">*</span>
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

                    {/* Subjects — teaching staff only */}
                    {teaches && (
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
                    )}

                    {/* Grade levels — teaching staff only */}
                    {teaches && (
                    <div>
                        <label className="block text-sm font-semibold text-slate-300 mb-2">
                            {adminMode ? 'Grade levels they teach' : 'Grade level you teach'}{' '}
                            <span className="text-amber-500">*</span>
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
                    )}

                    {!teaches && (
                        <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 flex items-start gap-3">
                            <Briefcase className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-400">
                                No subjects or grade levels needed. You will not appear in project
                                classification recommendations, which match teachers to projects by
                                subject. Change this any time from My Profile.
                            </p>
                        </div>
                    )}

                    {/* WhatsApp number — +62 fixed, only the rest is typed */}
                    <div>
                        <label htmlFor="tp-phone" className="block text-sm font-semibold text-slate-300 mb-2">
                            WhatsApp number{' '}
                            {adminMode
                                ? <span className="text-slate-500 text-xs font-normal">(optional — they can add it)</span>
                                : <span className="text-amber-500">*</span>}
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
                            No need for the leading 0 — 0857... is stored as{' '}
                            <span className="text-slate-400">+62 857...</span>.{' '}
                            {adminMode
                                ? 'Leave it blank if you do not have it.'
                                : 'Students and staff reach you through a WhatsApp button.'}
                        </p>
                        {normalizedPhone && (
                            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1.5">
                                <MessageCircle className="w-3.5 h-3.5" />
                                Saved as {formatIdPhone(normalizedPhone)}
                            </p>
                        )}
                        {errors.phone && <p className="text-red-400 text-xs mt-1.5">{errors.phone}</p>}
                    </div>

                    <div className={adminMode ? 'flex flex-col sm:flex-row gap-3' : ''}>
                    {adminMode && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="sm:w-40 bg-[#1c1b14] hover:bg-[#232118] border border-slate-800 text-slate-300 font-semibold py-4 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                    )}
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
                                : adminMode
                                    ? 'Save this teacher\u2019s profile'
                                    : 'Save changes'}
                    </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
