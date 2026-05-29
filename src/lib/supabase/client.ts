'use client';

import { createBrowserClient } from '@supabase/ssr';

// Singleton browser Supabase client — replaces inline createBrowserClient() calls
// scattered across dashboard pages and components
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
