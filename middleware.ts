import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getUser() instead of getSession() for accurate validation
  const { data: { user } } = await supabase.auth.getUser()

  // Jika tidak ada user dan mencoba masuk ke dashboard, lempar ke login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Ambil data profil untuk mengecek role
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const path = request.nextUrl.pathname

    // Proteksi: Siswa tidak boleh masuk ke area Teacher
    if (role === 'student' && path.startsWith('/dashboard/teacher')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/student'
      return NextResponse.redirect(url)
    }

    // Proteksi: Guru tidak boleh masuk ke area Student
    if (role === 'teacher' && path.startsWith('/dashboard/student')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard/teacher'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  // Hanya jalankan middleware pada halaman dashboard
  matcher: ['/dashboard/:path*'],
}
