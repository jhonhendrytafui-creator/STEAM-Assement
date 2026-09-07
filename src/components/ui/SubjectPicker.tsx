'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { subjectsByGroup, subjectLabel } from '@/lib/subjects';

// ─────────────────────────────────────────────────────────────
// Grouped picker for STEAM subject ids.
//
// The ids come from src/lib/subjects.ts, the same list students choose their
// key concepts from, so a teacher's expertise and a project's needs are
// comparable without any string matching in between.
// ─────────────────────────────────────────────────────────────

interface SubjectPickerProps {
    /** Currently selected subject ids. */
    value: string[];
    /** Called with the new selection when the reader saves. */
    onSave: (subjects: string[]) => void;
    onCancel: () => void;
    /** Who or what is being edited, shown in the heading. */
    title: string;
    saving?: boolean;
}

export default function SubjectPicker({ value, onSave, onCancel, title, saving }: SubjectPickerProps) {
    const [selected, setSelected] = useState<string[]>(value);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const returnFocusTo = useRef<Element | null>(null);

    useEffect(() => {
        returnFocusTo.current = document.activeElement;
        closeRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            (returnFocusTo.current as HTMLElement | null)?.focus?.();
        };
    }, [onCancel]);

    const toggle = (id: string) =>
        setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={onCancel}
        >
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="subject-picker-title"
                onClick={e => e.stopPropagation()}
                className="bg-[#1a1811] border border-amber-900/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl"
            >
                <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-800">
                    <div>
                        <h3 id="subject-picker-title" className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                            Pick every subject this teacher can guide. Projects are matched against
                            these, and a teacher with no subjects is left out of assignment.
                        </p>
                    </div>
                    <button
                        ref={closeRef}
                        onClick={onCancel}
                        aria-label="Close subject picker"
                        className="p-2 text-slate-500 hover:text-white transition-colors shrink-0"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar p-5 space-y-5">
                    {subjectsByGroup().map(({ group, subjects }) => (
                        <fieldset key={group} className="border-0 p-0 m-0">
                            <legend className="text-[11px] font-semibold uppercase tracking-wider text-amber-500/80 mb-2">
                                {group}
                            </legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {subjects.map(s => {
                                    const on = selected.includes(s.id);
                                    return (
                                        <label
                                            key={s.id}
                                            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer select-none transition-colors ${
                                                on
                                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                                                    : 'bg-[#1c1b14] border-slate-800 text-slate-400 hover:border-slate-600'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => toggle(s.id)}
                                                className="accent-amber-500"
                                            />
                                            {s.label}
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-800">
                    <p className="text-xs text-slate-500">
                        {selected.length === 0
                            ? 'No subjects selected'
                            : `${selected.length} selected: ${selected.map(subjectLabel).join(', ')}`}
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 text-sm rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onSave(selected)}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-bold rounded-lg bg-amber-500 text-[#1a160d] hover:bg-amber-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" aria-hidden="true" />
                            {saving ? 'Saving...' : 'Save subjects'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
