import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Cek apakah ada sesi login
  const { data: { session } } = await supabase.auth.getSession()

  // Jika tidak ada session dan mencoba masuk ke dashboard, lempar ke login
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Ambil data profil untuk mengecek role
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    const role = profile?.role
    const path = req.nextUrl.pathname

    // Proteksi: Siswa tidak boleh masuk ke area Teacher
    if (role === 'student' && path.startsWith('/dashboard/teacher')) {
      return NextResponse.redirect(new URL('/dashboard/student', req.url))
    }

    // Proteksi: Guru tidak boleh masuk ke area Student
    if (role === 'teacher' && path.startsWith('/dashboard/student')) {
      return NextResponse.redirect(new URL('/dashboard/teacher', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
