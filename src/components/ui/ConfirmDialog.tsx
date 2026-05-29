'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = 'Delete',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1811] border border-amber-900/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6 ml-[52px]">{message}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-bold"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
