'use client';

import type { TabItem } from '@/lib/types';

export interface SidebarSection {
    /** Shown as a small heading above the group on desktop. */
    label: string;
    tabs: TabItem[];
}

interface SidebarProps {
    /** Flat list, or sections when the menu is long enough to need grouping. */
    tabs?: TabItem[];
    sections?: SidebarSection[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    headerContent?: React.ReactNode;
}

export default function Sidebar({ tabs, sections, activeTab, onTabChange, headerContent }: SidebarProps) {
    // A flat `tabs` list is treated as one unlabelled section, so both call
    // styles render through the same code path.
    const resolved: SidebarSection[] = sections ?? [{ label: '', tabs: tabs ?? [] }];

    const button = (tab: TabItem) => (
        <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex-shrink-0 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border whitespace-nowrap ${activeTab === tab.id
                ? 'bg-[#292314] text-amber-500 border-amber-500/50 shadow-lg shadow-amber-900/10'
                : 'bg-[#1a1811] text-slate-400 hover:bg-[#25221b] hover:text-amber-400 border-amber-900/20'
                }`}
        >
            <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
            {tab.label}
        </button>
    );

    return (
        // The mobile strip scrolls horizontally with the scrollbar hidden, so a
        // fade on the right edge is the only cue that more items exist.
        <div className="relative md:contents">
            <aside
                className="w-full md:w-64 shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 z-40 bg-[#1c1b14] pt-2 md:pt-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                {headerContent}

                {resolved.map((section, i) => (
                    <div key={section.label || i} className="contents md:block md:space-y-2">
                        {section.label && (
                            <div className="hidden md:block px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                {section.label}
                            </div>
                        )}
                        {section.tabs.map(button)}
                    </div>
                ))}
            </aside>

            <div
                aria-hidden="true"
                className="md:hidden pointer-events-none absolute right-0 top-2 bottom-2 w-8 bg-gradient-to-l from-[#1c1b14] to-transparent"
            />
        </div>
    );
}
