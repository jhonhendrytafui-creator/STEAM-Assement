'use client';

import { GraduationCap, BookOpen, ClipboardList, BarChart2, LogOut } from 'lucide-react';

export default function TeacherDashboardPage() {
    return (
        <div className="min-h-screen bg-[#1a160d] text-slate-200 font-sans">
            {/* Navbar */}
            <nav className="bg-[#241f14] border-b border-amber-900/30 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <GraduationCap className="text-amber-400 w-7 h-7" />
                    <span className="font-bold text-xl text-white">STEAM</span>
                    <span className="ml-2 bg-amber-900/40 text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-500/30">
                        Teacher Portal
                    </span>
                </div>
                <button className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition-colors text-sm">
                    <LogOut className="w-4 h-4" />
                    Logout
                </button>
            </nav>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto p-6 space-y-8">
                {/* Welcome Banner */}
                <div className="bg-gradient-to-r from-amber-900/40 to-[#241f14] border border-amber-900/30 rounded-2xl p-6">
                    <h1 className="text-3xl font-bold text-white mb-1">Selamat Datang, Guru! 👋</h1>
                    <p className="text-slate-400">Ini adalah halaman dummy Teacher Dashboard.</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                        { label: 'Total Siswa', value: '32', icon: <BookOpen className="w-6 h-6" />, color: 'text-amber-400' },
                        { label: 'Tugas Aktif', value: '8', icon: <ClipboardList className="w-6 h-6" />, color: 'text-green-400' },
                        { label: 'Rata-rata Nilai', value: '78.5', icon: <BarChart2 className="w-6 h-6" />, color: 'text-blue-400' },
                    ].map((stat) => (
                        <div key={stat.label} className="bg-[#241f14] border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                            <div className={`${stat.color}`}>{stat.icon}</div>
                            <div>
                                <p className="text-slate-400 text-sm">{stat.label}</p>
                                <p className="text-2xl font-bold text-white">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Placeholder Table */}
                <div className="bg-[#241f14] border border-slate-800 rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Daftar Siswa (Dummy)</h2>
                    <div className="space-y-3">
                        {['Budi Santoso', 'Siti Rahayu', 'Ahmad Fauzi', 'Dewi Lestari'].map((name) => (
                            <div key={name} className="flex justify-between items-center bg-[#1a160d] rounded-xl px-4 py-3 border border-slate-800/50">
                                <span className="text-slate-200">{name}</span>
                                <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
                                    Student
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
