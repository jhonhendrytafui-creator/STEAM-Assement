import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Server-side auth for API route handlers.
//
// The Next.js middleware only matches /dashboard/:path*, so nothing under
// /api/* is protected by it. Every route handler must therefore check the
// caller itself — otherwise the AI endpoints can be called by anyone on the
// internet and will happily burn the Gemini quota.
// ─────────────────────────────────────────────────────────────

export interface AuthedUser {
    id: string;
    email: string;
    role: string;
    is_admin: boolean;
}

/** Supabase client bound to the caller's cookies. Reads run under their RLS. */
async function serverClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll() {
                    // Route handlers here never refresh the session, so there is
                    // nothing to write back.
                },
            },
        }
    );
}

/**
 * Resolve the signed-in user for an API route, or null when the request is
 * anonymous. Accepts either the session cookie (normal browser calls) or an
 * `Authorization: Bearer <token>` header (used by background fetches that
 * already hold an access token).
 */
export async function getAuthedUser(req: Request): Promise<AuthedUser | null> {
    const supabase = await serverClient();

    let userId: string | null = null;
    let userEmail: string | null = null;

    const authHeader = req.headers.get('Authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (bearer) {
        const { data, error } = await supabase.auth.getUser(bearer);
        if (!error && data.user) {
            userId = data.user.id;
            userEmail = data.user.email ?? null;
        }
    }

    if (!userId) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) return null;
        userId = data.user.id;
        userEmail = data.user.email ?? null;
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_admin, email')
        .eq('id', userId)
        .single();

    return {
        id: userId,
        email: userEmail ?? profile?.email ?? '',
        role: profile?.role ?? 'student',
        // is_admin may not exist yet if sql/add_admin_role.sql has not been run.
        is_admin: profile?.is_admin === true,
    };
}

const deny = (message: string, status: number) =>
    NextResponse.json({ error: message }, { status });

/**
 * Guard for routes any signed-in user may call.
 * Returns the user, or a ready-to-return error response.
 */
export async function requireUser(
    req: Request,
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
    const user = await getAuthedUser(req);
    if (!user) {
        return { response: deny('You must be signed in to use this feature.', 401) };
    }
    return { user };
}

/** Guard for routes only teachers may call. */
export async function requireTeacher(
    req: Request,
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
    const result = await requireUser(req);
    if ('response' in result) return result;
    if (result.user.role !== 'teacher') {
        return { response: deny('This feature is only available to teachers.', 403) };
    }
    return result;
}

/** Guard for routes only admins may call. */
export async function requireAdmin(
    req: Request,
): Promise<{ user: AuthedUser } | { response: NextResponse }> {
    const result = await requireTeacher(req);
    if ('response' in result) return result;
    if (!result.user.is_admin) {
        return { response: deny('This feature is only available to administrators.', 403) };
    }
    return result;
}
