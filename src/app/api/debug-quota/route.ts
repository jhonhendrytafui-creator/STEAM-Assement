import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';

/**
 * Diagnostic endpoint to check the status of all API quotas.
 * Hit GET /api/debug-quota to see which services are working and which are blocked.
 */
export async function GET() {
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        checks: {},
    };

    // ── Check 1: Gemini API Key ──────────────────────────
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            results.checks.gemini = { status: 'FAIL', reason: 'GEMINI_API_KEY env var is missing' };
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            // Smallest possible request to test quota
            const result = await model.generateContent('Reply with only the word "ok".');
            const text = result.response.text();
            results.checks.gemini = {
                status: 'OK',
                response: text.slice(0, 100),
                model: 'gemini-2.5-flash',
            };
        }
    } catch (e: any) {
        const errorDetails = parseGeminiError(e);
        results.checks.gemini = {
            status: 'FAIL',
            ...errorDetails,
        };
    }

    // ── Check 2: Google Service Account ──────────────────
    try {
        const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!credentialsJson) {
            results.checks.google_service_account = { status: 'FAIL', reason: 'GOOGLE_SERVICE_ACCOUNT_JSON env var is missing' };
        } else {
            const credentials = JSON.parse(credentialsJson);
            results.checks.google_service_account = {
                status: 'OK',
                client_email: credentials.client_email,
                project_id: credentials.project_id,
            };

            // ── Check 3: Google Drive API ────────────────────
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/drive'],
                });
                const drive = google.drive({ version: 'v3', auth });

                // Check service account's storage usage
                const about = await drive.about.get({
                    fields: 'storageQuota, user',
                });

                const quota = about.data.storageQuota;
                const usageBytes = parseInt(quota?.usage || '0');
                const limitBytes = parseInt(quota?.limit || '0');
                const usageMB = (usageBytes / (1024 * 1024)).toFixed(2);
                const limitMB = limitBytes > 0 ? (limitBytes / (1024 * 1024)).toFixed(2) : 'Unlimited';
                const usagePercent = limitBytes > 0 ? ((usageBytes / limitBytes) * 100).toFixed(1) : 'N/A';

                // List files owned by service account
                const files = await drive.files.list({
                    q: "'me' in owners",
                    fields: 'files(id, name, size, createdTime)',
                    pageSize: 20,
                });

                results.checks.google_drive = {
                    status: 'OK',
                    storage: {
                        used: `${usageMB} MB`,
                        limit: `${limitMB} MB`,
                        percentUsed: `${usagePercent}%`,
                        usageBytes: quota?.usage,
                        limitBytes: quota?.limit,
                        usageInDrive: quota?.usageInDrive,
                        usageInDriveTrash: quota?.usageInDriveTrash,
                    },
                    ownedFiles: (files.data.files || []).map(f => ({
                        name: f.name,
                        size: f.size,
                        created: f.createdTime,
                    })),
                    ownedFileCount: (files.data.files || []).length,
                };

                // Check if storage is full (common cause of quota errors)
                if (limitBytes > 0 && usageBytes >= limitBytes * 0.95) {
                    results.checks.google_drive.warning = '⚠️ Storage is nearly full or full! This is likely causing the quota exceeded error for document generation.';
                }
            } catch (driveErr: any) {
                results.checks.google_drive = {
                    status: 'FAIL',
                    errorMessage: driveErr.message,
                    errorCode: driveErr.code,
                    errors: driveErr.errors,
                };
            }

            // ── Check 4: Google Docs API ─────────────────────
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials,
                    scopes: ['https://www.googleapis.com/auth/documents'],
                });
                const docs = google.docs({ version: 'v1', auth });

                // Try to read the template doc (doesn't modify anything)
                const TEMPLATE_DOC_ID = '1A8c7jl0mgwDDpZKNA6Af169eBYX7Zm5LK29Esc23BbY';
                const doc = await docs.documents.get({ documentId: TEMPLATE_DOC_ID });
                results.checks.google_docs = {
                    status: 'OK',
                    templateTitle: doc.data.title,
                    templateId: TEMPLATE_DOC_ID,
                };
            } catch (docsErr: any) {
                results.checks.google_docs = {
                    status: 'FAIL',
                    errorMessage: docsErr.message,
                    errorCode: docsErr.code,
                    errors: docsErr.errors,
                    hint: docsErr.code === 403 
                        ? 'Service account does not have access to the template document. Share it with the service account email.'
                        : docsErr.code === 429
                            ? 'Google Docs API rate limit exceeded.'
                            : undefined,
                };
            }
        }
    } catch (saErr: any) {
        results.checks.google_service_account = {
            status: 'FAIL',
            reason: 'Failed to parse service account JSON',
            errorMessage: saErr.message,
        };
    }

    // ── Summary ──────────────────────────────────────────
    const failedChecks = Object.entries(results.checks)
        .filter(([, v]: [string, any]) => v.status === 'FAIL')
        .map(([k]) => k);

    results.summary = failedChecks.length === 0
        ? '✅ All checks passed. Quota issue may be intermittent or rate-limit based.'
        : `❌ Failed checks: ${failedChecks.join(', ')}. Check the details above for the exact cause.`;

    return NextResponse.json(results, { status: 200 });
}

function parseGeminiError(e: any) {
    const result: Record<string, any> = {
        errorMessage: e.message || 'Unknown error',
    };

    // Parse specific error types
    if (e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.message?.toLowerCase()?.includes('quota')) {
        result.errorType = 'QUOTA_EXCEEDED';
        result.hint = '🔴 Your Gemini API key has exceeded its quota. This is the FREE tier limit. Options: (1) Wait until the quota resets (usually daily), (2) Enable billing on Google AI Studio, (3) Use a different API key.';
    } else if (e.message?.includes('403') || e.message?.includes('PERMISSION_DENIED')) {
        result.errorType = 'PERMISSION_DENIED';
        result.hint = 'The API key does not have permission to use this model.';
    } else if (e.message?.includes('400') || e.message?.includes('INVALID_ARGUMENT')) {
        result.errorType = 'INVALID_REQUEST';
        result.hint = 'The request was malformed or the API key is invalid.';
    } else if (e.message?.includes('503')) {
        result.errorType = 'SERVICE_UNAVAILABLE';
        result.hint = 'Google AI servers are temporarily overloaded. Try again in a few minutes.';
    }

    // Try to extract status details from the error
    if (e.status) result.httpStatus = e.status;
    if (e.statusText) result.httpStatusText = e.statusText;
    if (e.errorDetails) result.errorDetails = e.errorDetails;

    return result;
}
