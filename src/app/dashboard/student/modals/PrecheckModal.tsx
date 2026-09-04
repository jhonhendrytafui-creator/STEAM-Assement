'use client';

import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface PrecheckModalProps {
    show: boolean;
    result: string;
    onClose: () => void;
    renderFormattedText: (text: string) => React.ReactNode;
}

export default function PrecheckModal({ show, result, onClose, renderFormattedText }: PrecheckModalProps) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1811] border border-indigo-500/30 rounded-2xl p-6 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button aria-label="Close AI Pre-Check results"
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-2"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white leading-tight">AI Pre-Check Results</h3>
                        <p className="text-xs text-indigo-400/80 mb-0">Powered by Pahoa STEAM AI</p>
                    </div>
                </div>

                <div className="prose prose-sm prose-invert max-w-none text-slate-300">
                    {result.split('\n').map((line, idx) => {
                        if (line.startsWith('### ')) {
                            return <h4 key={idx} className="text-indigo-400 font-bold mt-6 mb-3 text-lg">{line.replace('### ', '')}</h4>;
                        }
                        if (line.startsWith('- ')) {
                            return (
                                <div key={idx} className="flex gap-2 mb-2 items-start text-[15px]">
                                    <span className="text-indigo-500 mt-1.5">•</span>
                                    <span>{renderFormattedText(line.substring(2))}</span>
                                </div>
                            );
                        }
                        if (line.trim() === '') return <div key={idx} className="h-2"></div>;
                        return <p key={idx} className="mb-2 leading-relaxed">{renderFormattedText(line)}</p>;
                    })}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-[#292314] hover:bg-[#3d341e] text-indigo-400 font-semibold py-2.5 px-6 rounded-xl transition-colors border border-indigo-900/40 text-sm"
                    >
                        Close &amp; Continue Editing
                    </button>
                </div>
            </div>
        </div>
    );
}
