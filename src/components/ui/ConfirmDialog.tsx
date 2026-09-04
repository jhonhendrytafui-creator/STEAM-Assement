'use client';

import { useEffect, useRef } from 'react';
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
    const cancelRef = useRef<HTMLButtonElement>(null);
    const returnFocusTo = useRef<Element | null>(null);

    // Escape closes. Without it the only way out of a delete confirmation was
    // to find and click Cancel, which on a phone means the dialog blocks the
    // screen until you hit a small target.
    useEffect(() => {
        if (!open) return;

        returnFocusTo.current = document.activeElement;
        cancelRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCancel();
            }
        };
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            (returnFocusTo.current as HTMLElement | null)?.focus?.();
        };
    }, [open, onCancel]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby="confirm-dialog-message"
                className="bg-[#1a1811] border border-amber-900/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-400" aria-hidden="true" />
                    </div>
                    <h3 id="confirm-dialog-title" className="text-lg font-bold text-white">{title}</h3>
                </div>
                <p id="confirm-dialog-message" className="text-slate-400 text-sm mb-6 ml-[52px]">{message}</p>
                <div className="flex justify-end gap-3">
                    {/* Cancel takes focus, not the destructive button: a stray
                        Enter keypress should not delete anything. */}
                    <button
                        ref={cancelRef}
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
