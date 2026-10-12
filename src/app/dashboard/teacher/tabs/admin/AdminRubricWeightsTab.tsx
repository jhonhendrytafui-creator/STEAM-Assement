'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, RefreshCw, AlertTriangle, Save, Equal, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { effectiveWeights, hasCustomWeights, formatScore, groupRubrics } from '@/lib/rubric';
import type { AssessmentCategory, RubricDimension, RubricIndicator, ToastType } from '@/lib/types';

// ─────────────────────────────────────────────────────────────
// How much each criterion counts toward its rubric's score.
//
// A rubric with no weights counts every criterion equally, which is how every
// rubric worked before weights existed. Saving goes through the
// set_rubric_weights() RPC (sql/subject_rubrics_1_weights.sql): it checks the
// caller is an admin, that every criterion has a weight and that they add up to
// 100, writes them all at once and records the change in the activity log.
// Scores are worked out when they are shown, so a change applies at once to
// every group already assessed with that rubric.
// ─────────────────────────────────────────────────────────────

interface AdminRubricWeightsTabProps {
    showToast: (message: string, type: ToastType) => void;
    showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
    /** Called after a save, so the rest of the dashboard picks up the new weights. */
    onWeightsChanged: () => void;
}

const inputClass =
    'bg-[#1c1b14] border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 '
    + 'focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all';

/** n shares of 100 to two decimals that add up to exactly 100 (9 -> 11.11 x 8 + 11.12). */
function equalSplit(n: number): number[] {
    if (n === 0) return [];
    const base = Math.floor(10000 / n) / 100;
    const shares = Array.from({ length: n }, () => base);
    shares[n - 1] = Math.round((100 - base * (n - 1)) * 100) / 100;
    return shares;
}

const toNumber = (text: string): number | null => {
    if (text.trim() === '') return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
};

export default function AdminRubricWeightsTab({ showToast, showConfirm, onWeightsChanged }: AdminRubricWeightsTabProps) {
    const [categories, setCategories] = useState<AssessmentCategory[]>([]);
    const [dimensions, setDimensions] = useState<RubricDimension[]>([]);
    const [indicators, setIndicators] = useState<RubricIndicator[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [categoryId, setCategoryId] = useState('');
    // The form, as typed: criterion id -> percentage text.
    const [draft, setDraft] = useState<Record<string, string>>({});

    // Read fresh rather than from the dashboard's copy, so the screen always
    // shows what is stored now.
    const fetchData = useCallback(async () => {
        const [cats, dims, inds] = await Promise.all([
            supabase.from('assessment_categories').select('*').order('sort_order'),
            supabase.from('rubric_dimensions').select('*').order('sort_order'),
            supabase.from('rubric_indicators').select('*').order('sort_order'),
        ]);
        const error = cats.error ?? dims.error ?? inds.error;
        if (error) {
            showToast('Could not load the rubrics: ' + error.message, 'error');
            setLoading(false);
            return;
        }
        setCategories(cats.data ?? []);
        setDimensions(dims.data ?? []);
        setIndicators(inds.data ?? []);
        setLoading(false);
    }, [showToast]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const { phases, others } = useMemo(() => groupRubrics(categories), [categories]);

    // Open on the first rubric that has criteria, preferring the subject rubrics
    // since those are the ones that come weighted.
    useEffect(() => {
        if (categoryId || categories.length === 0) return;
        const hasCriteria = (c: AssessmentCategory) => dimensions.some(d => d.category_id === c.id);
        const first = others.find(hasCriteria) ?? phases.find(hasCriteria) ?? categories[0];
        setCategoryId(first.id);
    }, [categories, dimensions, phases, others, categoryId]);

    const category = categories.find(c => c.id === categoryId) ?? null;
    const rubricDims = useMemo(
        () => dimensions.filter(d => d.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order),
        [dimensions, categoryId],
    );
    const criteria = useMemo(
        () => rubricDims.flatMap(d => indicators
            .filter(i => i.dimension_id === d.id)
            .sort((a, b) => a.sort_order - b.sort_order)),
        [rubricDims, indicators],
    );

    const storedCount = criteria.filter(c => c.weight !== null && c.weight !== undefined).length;
    const isWeighted = storedCount === criteria.length && criteria.length > 0 && hasCustomWeights(criteria);
    const isPartial = storedCount > 0 && storedCount < criteria.length;

    // What the form starts from: the stored weights when the rubric uses them,
    // otherwise the equal split it is being scored on.
    const initialDraft = useCallback((): Record<string, string> => {
        const out: Record<string, string> = {};
        if (storedCount === criteria.length && criteria.length > 0) {
            const shares = effectiveWeights(criteria);
            criteria.forEach(c => { out[c.id] = formatScore((shares.get(c.id) ?? 0) * 100); });
        } else {
            const split = equalSplit(criteria.length);
            criteria.forEach((c, i) => { out[c.id] = String(split[i]); });
        }
        return out;
    }, [criteria, storedCount]);

    useEffect(() => { setDraft(initialDraft()); }, [initialDraft]);

    const values = criteria.map(c => toNumber(draft[c.id] ?? ''));
    const invalid = values.some(v => v === null || v < 0 || v > 100);
    const total = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    const totalOk = !invalid && Math.abs(total - 100) <= 0.01;
    const dirty = criteria.some(c => (draft[c.id] ?? '') !== (initialDraft()[c.id] ?? ''));

    const describeError = (message: string, code?: string): string => {
        if (code === 'PGRST202' || /could not find the function|set_rubric_weights/i.test(message)) {
            return 'The database is missing the weights update. Run sql/subject_rubrics_1_weights.sql first.';
        }
        return message;
    };

    const save = async (weights: Record<string, number>, done: string) => {
        if (!category) return;
        setBusy(true);
        const { error } = await supabase.rpc('set_rubric_weights', {
            p_category_id: category.id,
            p_weights: weights,
        });
        setBusy(false);
        if (error) {
            showToast(describeError(error.message, error.code), 'error');
            return;
        }
        showToast(done, 'success');
        await fetchData();
        onWeightsChanged();
    };

    const handleSave = () => {
        if (!category || !totalOk) return;
        const weights: Record<string, number> = {};
        criteria.forEach((c, i) => { weights[c.id] = values[i] as number; });
        showConfirm(
            `Save weights for ${category.code}?`,
            `Every group already assessed with ${category.code} - ${category.name} gets its score recalculated with these weights. The marks teachers gave stay as they are.`,
            () => save(weights, `Saved the weights for ${category.code}.`),
            'Save',
        );
    };

    const handleReset = () => {
        if (!category) return;
        showConfirm(
            `Count every ${category.code} criterion equally?`,
            `This removes the weights from ${category.code} - ${category.name}, so each of its ${criteria.length} criteria counts the same. Scores of groups already assessed are recalculated.`,
            () => save({}, `${category.code} now counts every criterion equally.`),
            'Reset',
        );
    };

    const handleRefresh = async () => {
        setLoading(true);
        await fetchData();
    };

    const rubricLabel = (c: AssessmentCategory) => {
        const own = indicators.filter(i => dimensions.some(d => d.category_id === c.id && d.id === i.dimension_id));
        const tag = own.length === 0 ? 'no criteria'
            : own.every(i => i.weight !== null && i.weight !== undefined) && hasCustomWeights(own) ? 'weighted'
            : 'equal';
        return `${c.code} - ${c.name} (${tag})`;
    };

    return (
        <div className="bg-[#1a1811] border border-amber-900/20 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Scale className="text-amber-500" />
                        Rubric Weights
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                        How much each criterion counts toward its rubric&apos;s score. A rubric without weights counts
                        every criterion equally.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label htmlFor="rw-rubric" className="text-xs text-slate-500 shrink-0">Rubric</label>
                    <select
                        id="rw-rubric"
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className={inputClass + ' flex-1 sm:w-80 min-w-0'}
                    >
                        {phases.length > 0 && (
                            <optgroup label="STEAM phases">
                                {phases.map(c => <option key={c.id} value={c.id}>{rubricLabel(c)}</option>)}
                            </optgroup>
                        )}
                        {others.length > 0 && (
                            <optgroup label="Other rubrics">
                                {others.map(c => <option key={c.id} value={c.id}>{rubricLabel(c)}</option>)}
                            </optgroup>
                        )}
                    </select>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        aria-label="Reload rubrics"
                        className="p-2.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className={'w-4 h-4' + (loading ? ' animate-spin' : '')} />
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-slate-500 text-sm py-8 text-center">Loading rubrics...</p>
            ) : !category ? (
                <p className="text-slate-500 text-sm py-8 text-center">No rubrics yet.</p>
            ) : criteria.length === 0 ? (
                <p className="text-sm text-slate-500 border border-dashed border-slate-800 rounded-xl px-4 py-6 text-center">
                    {category.code} has no criteria yet, so there is nothing to weight.
                </p>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500">Now scored with</span>
                        <span className={
                            'px-2 py-0.5 rounded-full border font-semibold '
                            + (isWeighted
                                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700')
                        }>
                            {isWeighted ? 'its own weights' : 'equal weights'}
                        </span>
                    </div>

                    {isPartial && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-100">
                                Only {storedCount} of {criteria.length} criteria have a weight, probably because a criterion
                                was added after the weights were set. Until every criterion has one, {category.code} counts
                                them all equally. Set the weights below and save.
                            </p>
                        </div>
                    )}

                    {rubricDims.map(dim => {
                        const dimCriteria = criteria.filter(c => c.dimension_id === dim.id);
                        const dimTotal = dimCriteria.reduce((sum, c) => sum + (toNumber(draft[c.id] ?? '') ?? 0), 0);
                        return (
                            <div key={dim.id} className="bg-[#1c1b14] border border-slate-800 rounded-xl">
                                <div className="bg-[#1a1811] border-b border-slate-800 rounded-t-xl px-5 py-3 flex items-center justify-between gap-3">
                                    <h3 className="font-bold text-slate-200 text-sm">{dim.name}</h3>
                                    {rubricDims.length > 1 && (
                                        <span className="text-xs text-slate-500">{formatScore(dimTotal)}%</span>
                                    )}
                                </div>
                                <ul className="divide-y divide-slate-800/50">
                                    {dimCriteria.map(c => {
                                        const value = toNumber(draft[c.id] ?? '');
                                        const bad = value === null || value < 0 || value > 100;
                                        return (
                                            <li key={c.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                                <label htmlFor={`rw-${c.id}`} className="text-sm text-slate-300 flex-1">
                                                    {c.description}
                                                </label>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <input
                                                        id={`rw-${c.id}`}
                                                        type="number"
                                                        inputMode="decimal"
                                                        min={0}
                                                        max={100}
                                                        step="any"
                                                        value={draft[c.id] ?? ''}
                                                        onChange={e => setDraft(prev => ({ ...prev, [c.id]: e.target.value }))}
                                                        disabled={busy}
                                                        aria-invalid={bad}
                                                        className={inputClass + ' w-24 text-right' + (bad ? ' border-red-500/60' : '')}
                                                    />
                                                    <span className="text-sm text-slate-500">%</span>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}

                    <div className="bg-[#1c1b14] border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className={'text-sm font-semibold ' + (totalOk ? 'text-emerald-400' : 'text-red-400')}>
                            Total: {formatScore(total)}%
                            {!totalOk && (
                                <span className="font-normal text-slate-400">
                                    {invalid ? ' — each weight must be a number from 0 to 100' : ' — the weights must add up to 100%'}
                                </span>
                            )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    const split = equalSplit(criteria.length);
                                    setDraft(Object.fromEntries(criteria.map((c, i) => [c.id, String(split[i])])));
                                }}
                                disabled={busy}
                                className="inline-flex items-center gap-2 bg-[#1a1811] border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl py-2 px-3.5 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                <Equal className="w-4 h-4" /> Split equally
                            </button>
                            {storedCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleReset}
                                    disabled={busy}
                                    className="inline-flex items-center gap-2 bg-[#1a1811] border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl py-2 px-3.5 text-sm font-semibold transition-colors disabled:opacity-50"
                                >
                                    <RotateCcw className="w-4 h-4" /> Remove weights
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={busy || !totalOk || (!dirty && storedCount === criteria.length)}
                                className="inline-flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl py-2 px-4 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> {busy ? 'Saving...' : 'Save weights'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
