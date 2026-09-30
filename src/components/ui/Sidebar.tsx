'use client';

import { useEffect, useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
    /**
     * Offer a collapse control on desktop. The teacher menu is fifteen items
     * across five sections, and the screens it leads to — a rubric, a score
     * table — want the width back.
     */
    collapsible?: boolean;
    /** Distinguishes the stored preference when more than one menu is collapsible. */
    storageKey?: string;
}

export default function Sidebar({
    tabs, sections, activeTab, onTabChange, headerContent,
    collapsible = false, storageKey = 'steam:sidebar-collapsed',
}: SidebarProps) {
    // Read once, lazily. Both dashboards render a loading screen until their
    // data arrives, so this component first mounts on the client and cannot
    // produce a hydration mismatch; the window guard covers any caller that
    // does not.
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (!collapsible || typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem(storageKey) === '1';
        } catch {
            return false;   // private mode, or storage blocked
        }
    });

    useEffect(() => {
        if (!collapsible) return;
        try {
            window.localStorage.setItem(storageKey, collapsed ? '1' : '0');
        } catch {
            // Storage unavailable — the toggle still works for this session.
        }
    }, [collapsed, collapsible, storageKey]);

    // A flat `tabs` list is treated as one unlabelled section, so both call
    // styles render through the same code path.
    const resolved: SidebarSection[] = sections ?? [{ label: '', tabs: tabs ?? [] }];

    // Collapsing applies to the desktop column only. On mobile the menu is a
    // horizontal strip of icons and labels, which is already compact.
    const shrunk = collapsible && collapsed;

    const button = (tab: TabItem) => (
        <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            // The label still reaches a screen reader when it is visually gone,
            // and the native tooltip names the icon for everyone else.
            aria-label={shrunk ? tab.label : undefined}
            title={shrunk ? tab.label : undefined}
            className={`flex-shrink-0 md:w-full flex items-center justify-center gap-2 md:gap-3 py-3 rounded-xl transition-all font-medium text-sm border whitespace-nowrap px-4 ${
                shrunk ? 'md:justify-center md:px-0' : 'md:justify-start'
            } ${activeTab === tab.id
                ? 'bg-[#292314] text-amber-500 border-amber-500/50 shadow-lg shadow-amber-900/10'
                : 'bg-[#1a1811] text-slate-400 hover:bg-[#25221b] hover:text-amber-400 border-amber-900/20'
            }`}
        >
            <tab.icon className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            {/* Hidden on the desktop column when shrunk, always shown on the
                mobile strip, which does not collapse. */}
            <span className={shrunk ? 'md:hidden' : ''}>{tab.label}</span>
        </button>
    );

    return (
        // The mobile strip scrolls horizontally with the scrollbar hidden, so a
        // fade on the right edge is the only cue that more items exist.
        <div className="relative md:contents">
            <aside
                className={`w-full shrink-0 flex flex-row md:flex-col gap-2 md:gap-0 md:space-y-2 overflow-x-auto md:overflow-y-auto pb-2 md:pb-0 z-40 bg-[#1c1b14] pt-2 md:pt-0 transition-[width] duration-200 ease-out ${
                    shrunk ? 'md:w-16' : 'md:w-64'
                }`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                <style dangerouslySetInnerHTML={{ __html: `aside::-webkit-scrollbar { display: none; }` }} />

                {collapsible && (
                    <button
                        type="button"
                        onClick={() => setCollapsed(c => !c)}
                        aria-expanded={!shrunk}
                        aria-label={shrunk ? 'Expand the menu' : 'Collapse the menu'}
                        title={shrunk ? 'Expand the menu' : 'Collapse the menu'}
                        className={`hidden md:flex items-center gap-2 w-full py-2 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-[#25221b] transition-colors ${
                            shrunk ? 'justify-center px-0' : 'justify-start px-4'
                        }`}
                    >
                        {shrunk
                            ? <PanelLeftOpen className="w-4 h-4 shrink-0" />
                            : <PanelLeftClose className="w-4 h-4 shrink-0" />}
                        {!shrunk && <span className="text-xs">Collapse</span>}
                    </button>
                )}

                {/* Group card and the like: there is no room for it when shrunk. */}
                {headerContent && (
                    <div className={shrunk ? 'hidden' : 'contents'}>{headerContent}</div>
                )}

                {resolved.map((section, i) => (
                    <div key={section.label || i} className="contents md:block md:space-y-2">
                        {section.label && (
                            shrunk
                                // A rule keeps the grouping legible once the
                                // heading has nowhere to go.
                                ? <div className="hidden md:block border-t border-slate-800 mx-3 my-2" aria-hidden="true" />
                                : (
                                    <div className="hidden md:block px-4 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                        {section.label}
                                    </div>
                                )
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
