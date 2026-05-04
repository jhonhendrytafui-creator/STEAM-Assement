'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import LoginCanvas from '@/components/LoginCanvas';

export default function LoginPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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
    setIsAuthenticating(true);
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
    <div className="h-screen w-screen relative overflow-hidden bg-black text-[#e6edf3] font-sans">
      
      {/* Full Screen Background Animation */}
      <div className="absolute inset-0 z-0 pointer-events-none">
          <LoginCanvas />
      </div>

      {/* Foreground UI Layout */}
      <div className="relative z-10 flex flex-col lg:flex-row h-full w-full pointer-events-none">
          
          {/* Left Side: Empty space to let the animation breathe */}
          <div className="hidden lg:block lg:w-[55%] h-full bg-transparent"></div>

          {/* Right Side: Full Height Container */}
          <div className="w-full lg:w-[45%] h-full flex flex-col items-center justify-center p-6 lg:p-12 pointer-events-auto relative">
              
              {/* Premium separation: Rounded left edge with a subtle neon glow and heavy shadow */}
              <div className="absolute inset-0 lg:rounded-l-[3rem] bg-[#181715] shadow-[-30px_0_60px_rgba(0,0,0,0.8)] overflow-hidden z-0">
                  <div className="absolute left-0 top-[10%] bottom-[10%] w-[1px] bg-gradient-to-b from-transparent via-[#f97316] to-transparent opacity-30 shadow-[0_0_20px_#f97316]"></div>
              </div>
              
              <div 
                className="max-w-[420px] w-full flex flex-col relative z-20" 
                style={{ 
                  animation: 'fadeIn 0.8s ease-out forwards',
                  animationDelay: '0.1s',
                  opacity: 0,
                  transform: 'translateY(20px)'
                }}
              >
                  <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                  `}</style>

                  <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-6" style={{ background: 'transparent', border: '1px solid #f97316', color: '#f97316', boxShadow: 'inset 0 0 10px rgba(249, 115, 22, 0.1), 0 0 15px rgba(249, 115, 22, 0.2)' }}>
                          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                      </div>
                      
                      <h1 className="text-[22px] leading-tight font-bold text-white tracking-wide mb-4">
                          Welcome to Pahoa<br/>STEAM Assessment<br/>Portal
                      </h1>
                      
                      <p className="text-[#a09f9d] text-[13px] leading-relaxed mb-6 px-4">
                          Log in to access your STEAM project dashboard.
                      </p>

                      <p className="text-[#f97316] text-[12px] font-semibold px-2 leading-relaxed">
                          Note: Only @sekolah.pahoa.sch.id email accounts are permitted.
                      </p>
                  </div>

                  {authError && (
                    <div className="w-full bg-red-900/30 border border-red-500/50 text-red-400 text-sm p-3 rounded-xl mb-6 text-left">
                      {authError}
                    </div>
                  )}

                  <div className="space-y-6">
                      <button 
                        onClick={handleGoogleLogin} 
                        className="w-full flex items-center justify-center gap-3 py-3 px-6 rounded-lg font-medium text-[13px] transition-all duration-200"
                        style={{ background: 'transparent', color: '#f97316', border: '1px solid #f97316' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(249, 115, 22, 0.08)';
                          e.currentTarget.style.boxShadow = '0 0 15px rgba(249, 115, 22, 0.15)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.transform = 'none';
                        }}
                      >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                          </svg>
                          Login with Google
                      </button>

                      <div className="flex items-center justify-center gap-2 pt-2 text-[#737270] text-[11px] font-medium">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                          </svg>
                          Secure quantum encryption active
                      </div>
                  </div>
              </div>

              {/* Footer anchored below the card */}
              <div className="mt-8 text-center pointer-events-auto">
                  <p className="text-[#8e98a8] text-[10px]">
                      © Pahoa STEAM Assessment Portal. All rights reserved.
                  </p>
              </div>

          </div>
      </div>

      {/* Feedback Modal */}
      {isAuthenticating && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto">
            <div className="bg-[#181715] p-10 rounded-2xl border border-white/10 max-w-sm w-full mx-4 text-center shadow-2xl">
                <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <div className="w-3 h-3 bg-orange-500 rounded-full animate-ping"></div>
                </div>
                <h3 className="text-xl font-medium text-white mb-3">Authenticating</h3>
                <p className="text-[#a09f9d] text-sm mb-8 leading-relaxed">Verifying institution credentials through Google Workspace.</p>
                <button onClick={() => setIsAuthenticating(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm transition-all font-medium border border-white/10">Cancel</button>
            </div>
        </div>
      )}

    </div>
  );
}
