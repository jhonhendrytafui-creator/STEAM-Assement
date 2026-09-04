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
 * Text-generation models, best first. Spans three generations on purpose: an
 * API key that cannot reach the newest model falls through to one it can,
 * and an id that stops being served (gemini-2.5-* retires in October 2026)
 * costs one fast 404 rather than an outage.
 */
export const GEMINI_TEXT_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
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
    /** Shown to the student. Says what to do, never leaks internals. */
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

const EMPTY_RESPONSE: GeminiFailure = {
    kind: 'empty',
    transient: false,
    fatal: false,
    status: 502,
    message: 'The AI returned an empty answer. Please try again.',
    detail: 'Model returned an empty response body.',
};

export interface GenerateWithFallbackOptions {
    apiKey: string;
    prompt: string;
    /** Prefix for server logs, e.g. "Precheck". */
    label: string;
    models?: readonly string[];
    modelParams?: Omit<ModelParams, 'model'>;
    /** Cap on a single generateContent call. */
    perAttemptTimeoutMs?: number;
    /**
     * Wall-clock cap on the whole walk. Must stay under the route's
     * `maxDuration`, and under the hosting platform's function timeout, so the
     * route always returns real JSON instead of being killed mid-flight.
     */
    budgetMs?: number;
}

const TRANSIENT_PAUSE_MS = 1_000;

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
        perAttemptTimeoutMs = 15_000,
        budgetMs = 45_000,
    } = opts;

    const genAI = new GoogleGenerativeAI(apiKey);
    const deadline = Date.now() + budgetMs;
    let lastFailure: GeminiFailure | null = null;

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
                lastFailure = EMPTY_RESPONSE;
                console.error(`[${label}] ${modelName} returned an empty response.`);
                continue;
            }

            console.log(`[${label}] answered by ${modelName} (attempt ${i + 1}/${models.length})`);
            return { text, model: modelName };
        } catch (e) {
            lastFailure = classifyGeminiError(e);
            console.error(
                `[${label}] ${modelName} failed (${lastFailure.kind}): ${lastFailure.detail.slice(0, 200)}`
            );

            if (lastFailure.fatal) break;
            if (lastFailure.transient) {
                const pause = Math.min(TRANSIENT_PAUSE_MS, Math.max(0, deadline - Date.now()));
                if (pause > 0) await new Promise(res => setTimeout(res, pause));
            }
        }
    }

    throw new GeminiGenerationError(
        lastFailure ?? {
            kind: 'timeout',
            transient: true,
            fatal: false,
            status: 504,
            message: 'The AI took too long to answer. Please try again.',
            detail: `No model answered within ${budgetMs}ms.`,
        }
    );
}
