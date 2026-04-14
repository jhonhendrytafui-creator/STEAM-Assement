import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    // Use NEXT_PUBLIC_SITE_URL to ensure redirects go to the custom domain,
    // not the internal Netlify domain. Falls back to request origin for local dev.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, '');

    if (code) {
        const cookieStore = await cookies();

        // Track every cookie Supabase sets so we can attach them to the
        // redirect response — NextResponse.redirect() is a brand-new Response
        // and does NOT inherit cookies from Next.js's internal cookieStore.
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
                        try {
                            cookiesToSet.forEach(({ name, value, options }) => {
                                cookieStore.set(name, value, options);
                                // Capture for the redirect response below
                                cookiesToForward.push({ name, value, options: options ?? {} });
                            });
                        } catch {
                            // Required catch — Supabase may call this outside a mutable context
                        }
                    },
                },
            }
        );

        // Exchange the one-time code for a persistent session.
        // This is what triggers setAll above and populates cookiesToForward.
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('Supabase Auth Exchange Error:', error);
            return NextResponse.redirect(`${siteUrl}/?error=auth_failed`);
        }

        // Ambil user yang baru login
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error('User Not Found Error:', userError);
            return NextResponse.redirect(`${siteUrl}/?error=user_not_found`);
        }

        // Cek apakah email berakhiran @sekolah.pahoa.sch.id
        if (!user.email?.endsWith('@sekolah.pahoa.sch.id')) {
            await supabase.auth.signOut();
            return NextResponse.redirect(`${siteUrl}/?error=unauthorized_email`);
        }

        // Cek apakah email ada di tabel teacher_emails
        const { data: teacherRecord } = await supabase
            .from('teacher_emails')
            .select('email')
            .eq('email', user.email)
            .single();

        // Auto-assign role: jika ada di teacher_emails = teacher, selainnya = student
        const role = teacherRecord ? 'teacher' : 'student';

        // Upsert ke tabel profiles agar middleware tetap berfungsi
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(
                { id: user.id, email: user.email, role },
                { onConflict: 'id' }
            );

        if (profileError) {
            console.error('Profile Upsert Error:', profileError);
        }

        // Build the redirect and attach the Supabase session cookies so the
        // browser stores them and the middleware can verify the session.
        const redirectUrl = role === 'teacher'
            ? `${siteUrl}/dashboard/teacher`
            : `${siteUrl}/dashboard/student`;

        const response = NextResponse.redirect(redirectUrl);

        cookiesToForward.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
        });

        return response;
    }

    // Jika gagal, kembalikan ke halaman utama (login)
    return NextResponse.redirect(`${siteUrl}/?error=missing_code`);
}
