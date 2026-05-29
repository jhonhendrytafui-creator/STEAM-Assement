'use client';

import { Star, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface NavbarProps {
    portalName: string;
    userEmail?: string | null;
}

export default function Navbar({ portalName, userEmail }: NavbarProps) {
    return (
        <nav className="bg-[#1a1811] border-b border-amber-900/40 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-3">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" strokeWidth={2} />
                <span className="font-bold text-xl text-amber-500">
                    PAHOA STEAM ASSESSMENT
                </span>
                <span className="ml-2 bg-amber-900/30 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/20 hidden sm:inline-block">
                    {portalName}
                </span>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-sm text-slate-400 hidden sm:block">{userEmail}</div>
                <button
                    onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm px-3 py-1.5 rounded-lg hover:bg-red-950/30"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </nav>
    );
}
