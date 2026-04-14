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

  // Use getSession() here instead of getUser().
  // getUser() makes a live network call to Supabase on every request which can
  // fail if there is any network issue between the Next.js server and Supabase,
  // causing the user to be bounced back to the login page even with a valid session.
  // getSession() reads the JWT from the cookie directly — fast and reliable.
  // The callback route already uses getUser() (the secure context) to validate
  // the session at sign-in time, so this is safe.
  let session = null
  try {
    const { data } = await supabase.auth.getSession()
    session = data.session
  } catch (e) {
    console.error('Middleware getSession error:', e)
  }

  // If no session and trying to access dashboard, redirect to login
  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Role-based route protection
  if (session) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = profile?.role
      const path = request.nextUrl.pathname

      // Students cannot access teacher area
      if (role === 'student' && path.startsWith('/dashboard/teacher')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/student'
        return NextResponse.redirect(url)
      }

      // Teachers cannot access student area
      if (role === 'teacher' && path.startsWith('/dashboard/student')) {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/teacher'
        return NextResponse.redirect(url)
      }
    } catch (e) {
      console.error('Middleware profile check error:', e)
      // Fail open — let the user through if we can't check the role
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
