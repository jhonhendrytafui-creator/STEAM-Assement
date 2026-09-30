import { GoogleGenerativeAI, type ModelParams } from '@google/generative-ai';

// ─────────────────────────────────────────────────────────────
// Shared Gemini calling code.
//
// Every AI route walks a list of models until one answers. That list used to
// be copy-pasted into each route, and the copies drifted: /api/precheck and
// /api/debug-quota were left pointing at model ids the API does not serve
// (`gemini-3.1-pro`, `gemini-3.0-flash` — the real ids carry a `-preview`
// suffix or do not exist), so the pre-check spent its whole time budget
// collecting 404s. Keep the list here so there is one copy to update.
// ─────────────────────────────────────────────────────────────

/**
 * Text-generation models, best first. Every entry must be one Google serves to
 * any key, new or old — check before adding one:
 *
 *   - gemini-2.0-flash was shut down on 2026-06-01; every call is a 404.
 *   - gemini-2.5-* answer only keys whose project used them before. Any other
 *     key gets a 404 "no longer available to new users", and the family is due
 *     to retire in October 2026.
 *
 * Four of the previous six entries were in those two groups, so a newer key
 * had two live models, not six. Free-tier quota is counted per model, so each
 * live entry here is also a separate allowance to fall back on.
 *
 * gemini-3.1-flash-lite is second because it thinks at "minimal" by default and
 * answers in seconds, which is what a fallback needs after the first model has
 * spent most of the budget. gemini-2.5-flash stays last only for keys that
 * still have it; for the rest it costs one fast 404.
 */
export const GEMINI_TEXT_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
] as const;

/**
 * The same models, fastest first, for work that has to fit many calls into one
 * time budget. gemini-3.5-flash often needs 20 seconds or more for a chunk of
 * projects, so leading with it left room for about two chunks per run; the
 * Flash-Lite models answer in a few.
 */
export const GEMINI_FAST_TEXT_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
] as const;

export type GeminiFailureKind =
    | 'unknown_model'
    | 'auth'
    | 'quota'
    | 'overloaded'
    | 'timeout'
    | 'network'
    | 'blocked'
    | 'empty'
    | 'unusable'
    | 'bad_request'
    | 'unknown';

export interface GeminiFailure {
    kind: GeminiFailureKind;
    /** Worth pausing before the next attempt. False means move on immediately. */
    transient: boolean;
    /** True when no other model can succeed either, so stop walking the list. */
    fatal: boolean;
    /** HTTP status the route should return. */
    status: number;
    /**
     * Shown to the student. Says what to do, never leaks internals. Routes a
     * teacher calls use teacherMessage() instead.
     */
    message: string;
    /** Server-log detail. */
    detail: string;
}

/** Thrown by generateWithFallback once every model has been tried. */
export class GeminiGenerationError extends Error {
    readonly failure: GeminiFailure;

    constructor(failure: GeminiFailure) {
        super(failure.detail);
        this.name = 'GeminiGenerationError';
        this.failure = failure;
    }
}

/**
 * Turn an SDK error into something both the log and the student can use.
 *
 * The old code matched on `message.includes('503')` alone and returned a
 * single generic 500 for everything else, so "the key is wrong", "the model
 * does not exist" and "Google is busy" were indistinguishable from the
 * outside — which is why this failure was hard to place.
 */
export function classifyGeminiError(e: unknown): GeminiFailure {
    const err = e as { name?: string; message?: string; status?: number };
    const message = err?.message ?? String(e);
    const status = typeof err?.status === 'number' ? err.status : undefined;
    const has = (needle: string) => message.toLowerCase().includes(needle.toLowerCase());

    const aborted =
        err?.name === 'AbortError' ||
        err?.name === 'GoogleGenerativeAIAbortError' ||
        has('abort') ||
        has('timeout');

    if (aborted) {
        return {
            kind: 'timeout',
            transient: true,
            fatal: false,
            status: 504,
            message: 'The AI took too long to answer. Please try again.',
            detail: message,
        };
    }

    if (status === 404 || has('is not found') || has('not supported for generateContent')) {
        return {
            kind: 'unknown_model',
            transient: false,
            fatal: false,
            status: 503,
            message: 'The AI model is not available right now. Please tell your teacher.',
            detail: message,
        };
    }

    if (status === 429 || has('RESOURCE_EXHAUSTED') || has('quota')) {
        return {
            kind: 'quota',
            transient: false,
            fatal: false,
            status: 503,
            message:
                'The school has used up its AI allowance for now. Please try again later and tell your teacher.',
            detail: message,
        };
    }

    if (status === 503 || has('overloaded') || has('UNAVAILABLE')) {
        return {
            kind: 'overloaded',
            transient: true,
            fatal: false,
            status: 503,
            message: 'The AI service is busy right now. Please try again in a few minutes.',
            detail: message,
        };
    }

    // A bad key fails the same way on every model, so there is nothing to gain
    // from working through the rest of the list.
    if (status === 401 || status === 403 || has('API_KEY_INVALID') || has('PERMISSION_DENIED') || has('API key not valid')) {
        return {
            kind: 'auth',
            transient: false,
            fatal: true,
            status: 503,
            message: 'The AI service is not set up correctly. Please tell your teacher.',
            detail: message,
        };
    }

    if (has('blocked') || has('SAFETY') || has('safety')) {
        return {
            kind: 'blocked',
            transient: false,
            fatal: true,
            status: 422,
            message:
                'The AI could not review this draft because of its safety filters. Please reword it and try again.',
            detail: message,
        };
    }

    if (status === 400 || has('INVALID_ARGUMENT')) {
        return {
            kind: 'bad_request',
            transient: false,
            fatal: true,
            status: 500,
            message: 'The AI request was rejected. Please tell your teacher.',
            detail: message,
        };
    }

    if (has('fetch failed') || has('ENOTFOUND') || has('ECONNRESET') || has('network')) {
        return {
            kind: 'network',
            transient: true,
            fatal: false,
            status: 503,
            message: 'Could not reach the AI service. Please try again.',
            detail: message,
        };
    }

    return {
        kind: 'unknown',
        transient: false,
        fatal: false,
        status: 500,
        message: 'The AI check could not be completed. Please try again.',
        detail: message,
    };
}

/**
 * The same failure, worded for a teacher.
 *
 * The student wording sends the reader to their teacher, which is no help when
 * the reader is the teacher, so this says what to check instead. The switch
 * covers every kind: adding one without a teacher wording does not compile.
 */
export function teacherMessage(failure: GeminiFailure): string {
    switch (failure.kind) {
        case 'unknown_model':
            return 'None of the Gemini models this app uses is available to its API key. The model list in the app needs updating.';
        case 'auth':
            return 'Gemini rejected the server\'s API key. Please check GEMINI_API_KEY in the server settings.';
        case 'quota':
            return 'The Gemini API key has reached its usage limit for now. Please try again later.';
        case 'blocked':
            return 'Gemini would not process this content because of its safety filters.';
        case 'bad_request':
            return 'Gemini rejected the request. The server log has the details.';
        case 'unknown':
            return 'The AI request could not be completed. Please try again.';
        case 'timeout':
        case 'overloaded':
        case 'network':
        case 'empty':
        case 'unusable':
            // Already worded for anyone: what happened, and to try again.
            return failure.message;
    }
}

const EMPTY_RESPONSE: GeminiFailure = {
    kind: 'empty',
    transient: false,
    fatal: false,
    status: 502,
    message: 'The AI returned an empty answer. Please try again.',
    detail: 'Model returned an empty response body.',
};

const UNUSABLE_RESPONSE: GeminiFailure = {
    kind: 'unusable',
    transient: false,
    fatal: false,
    status: 502,
    message: 'The AI returned an answer that could not be read. Please try again.',
    detail: 'Model answered, but the answer failed the caller\'s accept check.',
};

export interface GenerateWithFallbackOptions {
    apiKey: string;
    prompt: string;
    /** Prefix for server logs, e.g. "Precheck". */
    label: string;
    models?: readonly string[];
    modelParams?: Omit<ModelParams, 'model'>;
    /**
     * Cap on a single generateContent call. It only ever cuts off a model that
     * is working — a 404 or 429 comes back in well under a second — so it must
     * cover the model's thinking time as well as the answer. At its default
     * thinking level gemini-3.5-flash takes about 15 seconds before it writes
     * anything. Defaults to 30 seconds.
     */
    perAttemptTimeoutMs?: number;
    /**
     * Wall-clock cap on the whole walk. Must stay under the route's
     * `maxDuration`, and under the hosting platform's function timeout, so the
     * route always returns real JSON instead of being killed mid-flight.
     */
    budgetMs?: number;
    /**
     * Return false for an answer that came back but cannot be used, such as
     * JSON that does not parse or lacks a required field. It then counts as a
     * failed attempt and the next model is tried, rather than the caller
     * getting something it has to reject after the walk is over.
     */
    accept?: (text: string) => boolean;
}

const TRANSIENT_PAUSE_MS = 1_000;

/**
 * The failure to show once every model has been tried.
 *
 * A model this key cannot use (404) says nothing about why the models it can
 * use failed, so it never replaces a failure already recorded. Reporting simply
 * the last one meant a quota or timeout on the live models reached the student
 * as "The AI model is not available right now" — the 404 from whichever
 * retired model ended the list — which reads as a broken API key.
 */
function moreInformative(recorded: GeminiFailure | null, next: GeminiFailure): GeminiFailure {
    if (recorded && recorded.kind !== 'unknown_model' && next.kind === 'unknown_model') {
        return recorded;
    }
    return next;
}

/**
 * Try each model in turn until one answers.
 *
 * The pause between attempts is the part that used to break: the old loop
 * slept `attempt * 2000` ms after *every* failure, so seven models cost 42
 * seconds of sleeping before the route gave up — past the 60s `maxDuration`
 * once real request time was added, and far past the ~10s function timeout on
 * a default Netlify deploy. A 404 gains nothing from waiting, so only genuinely
 * transient failures pause, and the whole walk is bounded by `budgetMs`.
 */
export async function generateWithFallback(
    opts: GenerateWithFallbackOptions
): Promise<{ text: string; model: string }> {
    const {
        apiKey,
        prompt,
        label,
        models = GEMINI_TEXT_MODELS,
        modelParams,
        perAttemptTimeoutMs = 30_000,
        budgetMs = 45_000,
        accept,
    } = opts;

    const genAI = new GoogleGenerativeAI(apiKey);
    const deadline = Date.now() + budgetMs;
    let reported: GeminiFailure | null = null;

    for (let i = 0; i < models.length; i++) {
        const modelName = models[i];
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;

        try {
            const model = genAI.getGenerativeModel({ model: modelName, ...modelParams });
            const result = await model.generateContent(prompt, {
                timeout: Math.min(perAttemptTimeoutMs, remaining),
            });
            const text = result.response.text();

            if (!text.trim()) {
                reported = moreInformative(reported, EMPTY_RESPONSE);
                console.error(`[${label}] ${modelName} returned an empty response.`);
                continue;
            }

            if (accept && !accept(text)) {
                reported = moreInformative(reported, UNUSABLE_RESPONSE);
                console.error(
                    `[${label}] ${modelName} returned an unusable answer (${text.length} chars): ${text.slice(0, 120)}`
                );
                continue;
            }

            console.log(`[${label}] answered by ${modelName} (attempt ${i + 1}/${models.length})`);
            return { text, model: modelName };
        } catch (e) {
            const failure = classifyGeminiError(e);
            reported = moreInformative(reported, failure);
            console.error(
                `[${label}] ${modelName} failed (${failure.kind}): ${failure.detail.slice(0, 200)}`
            );

            if (failure.fatal) break;
            if (failure.transient) {
                const pause = Math.min(TRANSIENT_PAUSE_MS, Math.max(0, deadline - Date.now()));
                if (pause > 0) await new Promise(res => setTimeout(res, pause));
            }
        }
    }

    throw new GeminiGenerationError(
        reported ?? {
            kind: 'timeout',
            transient: true,
            fatal: false,
            status: 504,
            message: 'The AI took too long to answer. Please try again.',
            detail: `No model answered within ${budgetMs}ms.`,
        }
    );
}
