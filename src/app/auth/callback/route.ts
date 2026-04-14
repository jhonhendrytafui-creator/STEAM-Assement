import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    // Use NEXT_PUBLIC_SITE_URL to ensure redirects go to the custom domain.
    // Falls back to request origin for local dev.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, '');

    if (code) {
        const cookieStore = await cookies();

        // Capture every cookie that Supabase sets during exchangeCodeForSession.
        // We MUST attach these to the redirect response ourselves because
        // NextResponse.redirect() creates a brand-new Response object that does
        // NOT inherit cookies from Next.js's internal cookieStore.
        const cookiesToForward: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            // CRITICAL: push FIRST, before the potentially-throwing set().
                            // If set() is called after push and throws, the cookie is
                            // still captured for the redirect response.
                            cookiesToForward.push({ name, value, options: options ?? {} });
                            try {
                                cookieStore.set(name, value, options);
                            } catch {
                                // Safe to ignore — cookie captured above
                            }
                        });
                    },
                },
            }
        );

        // Exchange the one-time code for a persistent session.
        // This triggers setAll above and populates cookiesToForward.
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Auth Exchange Error:', error.message);
            return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
        }

        // Get the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('User Not Found:', userError?.message);
            return NextResponse.redirect(`${siteUrl}/?error=user_not_found`);
        }

        // Only allow @sekolah.pahoa.sch.id emails
        if (!user.email?.endsWith('@sekolah.pahoa.sch.id')) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${siteUrl}/?error=unauthorized_email`);
        }

        // Check if the user is a teacher
        const { data: teacherRecord } = await supabase
            .from('teacher_emails')
            .select('email')
            .eq('email', user.email)
            .single();

        const role = teacherRecord ? 'teacher' : 'student';

        // Upsert the profile with the correct role
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(
                { id: user.id, email: user.email, role },
                { onConflict: 'id' }
            );

        if (profileError) {
            console.error('Profile Upsert Error:', profileError.message);
        }

        const redirectUrl = role === 'teacher'
            ? `${siteUrl}/dashboard/teacher`
            : `${siteUrl}/dashboard/student`;

        // Build the redirect response and attach the session cookies.
        // Without this, the browser never receives Set-Cookie headers and
        // the middleware will see no session and bounce back to login.
        const response = NextResponse.redirect(redirectUrl);

        cookiesToForward.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });

        console.log(`Auth success: role=${role}, cookies forwarded=${cookiesToForward.length}, redirect=${redirectUrl}`);

        return response;
    }

    // No code in the URL — redirect to login with error
    return NextResponse.redirect(`${siteUrl}/?error=missing_code`);
}
