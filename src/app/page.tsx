'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, Lock, LogIn, Star } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

export default function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Read error from URL if redirected back from callback with an error
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'unauthorized_email') {
      setAuthError('Access Denied. Please use your @sekolah.pahoa.sch.id email account.');
    }
  }, []);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#1c1b14] text-[#d4d4d4] flex flex-col font-sans relative">

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">

        {/* Login Card */}
        <div className="w-full max-w-[420px] bg-[#1a1811] border border-amber-900/40 rounded-2xl p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center">

          {/* Circular Icon Top */}
          <div className="w-16 h-16 rounded-full border border-amber-500 bg-[#29220c] flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
            <Star className="w-8 h-8 text-amber-500 fill-amber-500" strokeWidth={2} />
          </div>

          {/* Titles & Description */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Welcome to Pahoa STEAM Assessment Portal</h1>

          <p className="text-[#8c8c88] text-[15px] leading-relaxed mb-6 max-w-[320px]">
            Log in to access your STEAM project dashboard.
            <br /><br />
            <span className="text-amber-500/90 font-medium">Note: Only @sekolah.pahoa.sch.id email accounts are permitted.</span>
          </p>

          {authError && (
            <div className="w-full bg-red-900/30 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-6 text-left">
              {authError}
            </div>
          )}

          {/* Login Button Button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full group relative flex items-center justify-center gap-3 border-2 border-amber-500 hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]"
          >
            <LogIn className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span>Login with Google</span>
          </button>

          {/* Secure Lock text */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-[#6b6b66]">
            <Lock className="w-3.5 h-3.5" />
            <span>Secure quantum encryption active</span>
          </div>

        </div>

      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center text-[13px] font-medium text-[#6b6b66]">
        &copy; Pahoa STEAM Assessment Portal. All rights reserved.
      </footer>

    </div>
  );
}
