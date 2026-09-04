import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────
// Liveness probe for the container platform (Coolify, Docker, a load balancer).
//
// Deliberately shallow: it answers "is this Next.js process serving requests",
// nothing more. It does not touch Supabase or Gemini on purpose — a health
// check that fails when a dependency blips makes the platform restart a
// perfectly healthy container, turning a brief outage elsewhere into a restart
// loop here.
//
// The middleware lets this through without a session; see PUBLIC_API_ROUTES
// in middleware.ts.
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json(
        {
            status: 'ok',
            service: 'steam-assessment',
            time: new Date().toISOString(),
            uptimeSeconds: Math.round(process.uptime()),
        },
        {
            status: 200,
            headers: { 'Cache-Control': 'no-store' },
        }
    );
}
