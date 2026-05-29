'use client';

import type { TabItem } from '@/lib/types';

interface SidebarProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    headerContent?: React.ReactNode;
}

export default function Sidebar({ tabs, activeTab, onTabChange, headerContent }: SidebarProps) {
    return (
        <aside
            className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 z-40 bg-[#1c1b14] pt-2 md:pt-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
            <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

            {headerContent}

            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex-shrink-0 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border whitespace-nowrap ${activeTab === tab.id
                        ? 'bg-[#292314] text-amber-500 border-amber-500/50 shadow-lg shadow-amber-900/10'
                        : 'bg-[#1a1811] text-slate-400 hover:bg-[#25221b] hover:text-amber-400 border-amber-900/20'
                        }`}
                >
                    <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
                    {tab.label}
                </button>
            ))}
        </aside>
    );
}
