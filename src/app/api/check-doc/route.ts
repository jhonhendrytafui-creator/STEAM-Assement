import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

// Only these hosts may be fetched. A substring test such as
// url.includes('docs.google.com') also matches https://evil.com/?x=docs.google.com,
// which would turn this route into an open proxy for whoever calls it.
const ALLOWED_HOSTS = new Set(['docs.google.com', 'drive.google.com']);

export async function POST(request: Request) {
    try {
        const auth = await requireUser(request);
        if ('response' in auth) return auth.response;

        const { url } = await request.json();

        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return NextResponse.json(
                { isPublic: false, error: 'That does not look like a valid link.' },
                { status: 400 }
            );
        }

        if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
            return NextResponse.json(
                { isPublic: false, error: 'Please paste a Google Docs or Google Drive link.' },
                { status: 400 }
            );
        }

        // HEAD is enough to see whether Google redirects us to the sign-in page,
        // and avoids downloading the whole document just to throw it away.
        const response = await fetch(parsed.toString(), {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; STEAMBot/1.0)' },
            redirect: 'follow',
        });

        // A public document never redirects to ServiceLogin.
        if (response.url.includes('ServiceLogin') || response.url.includes('accounts.google.com')) {
            return NextResponse.json({
                isPublic: false,
                error: 'This document is private. Change sharing to "Anyone with the link".',
            });
        }

        return NextResponse.json({ isPublic: true });

    } catch (error) {
        console.error('Doc validation error:', error);
        return NextResponse.json(
            { isPublic: false, error: 'Could not check that link. Make sure it opens for anyone with the link.' },
            { status: 500 }
        );
    }
}
