import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    },
                },
            }
        );

        // Tukar kode menjadi session
        await supabase.auth.exchangeCodeForSession(code);

        // Ambil user yang baru login
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            // Cek apakah email berakhiran @sekolah.pahoa.sch.id
            if (!user.email?.endsWith('@sekolah.pahoa.sch.id')) {
                // Logout user jika tidak sesuai domain
                await supabase.auth.signOut();
                return NextResponse.redirect(`${requestUrl.origin}/?error=unauthorized_email`);
            }

            // Ambil role dari tabel profiles
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            // Redirect berdasarkan role
            if (profile?.role === 'teacher') {
                return NextResponse.redirect(`${requestUrl.origin}/dashboard/teacher`);
            } else {
                return NextResponse.redirect(`${requestUrl.origin}/dashboard/student`);
            }
        }
    }

    // Jika gagal, kembalikan ke halaman utama (login)
    return NextResponse.redirect(`${requestUrl.origin}/`);
}
