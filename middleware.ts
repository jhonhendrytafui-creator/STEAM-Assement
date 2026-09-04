import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// API routes that must answer without a session. The health probe is called by
// the container platform, which holds no cookies — returning 401 to it would
// make Coolify judge a healthy container dead and restart it in a loop.
const PUBLIC_API_ROUTES = ['/api/health']

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

  const path = request.nextUrl.pathname
  const isApiRoute = path.startsWith('/api')

  if (PUBLIC_API_ROUTES.includes(path)) {
    return supabaseResponse
  }

  // API callers get JSON, not a redirect — a 302 to the login page would reach
  // fetch() as an HTML body and surface to the user as a JSON parse error.
  if (!session && isApiRoute) {
    return NextResponse.json(
      { error: 'You must be signed in to use this feature.' },
      { status: 401 }
    )
  }

  // If no session and trying to access dashboard, redirect to login
  if (!session && path.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Role-based route protection. Only page routes are redirected by role;
  // API routes do their own per-route checks in src/lib/api-auth.ts, which can
  // distinguish student / teacher / admin properly.
  if (session && !isApiRoute) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = profile?.role

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
  // /api is included so anonymous calls are rejected before a route handler
  // starts spending Gemini or Google Docs quota. Each handler still checks the
  // caller itself via src/lib/api-auth.ts — this is defence in depth, not the
  // only gate.
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
