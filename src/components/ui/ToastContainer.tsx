'use client';

import { CheckCircle2, AlertTriangle, FileText, X } from 'lucide-react';
import type { ToastData, ToastType } from '@/lib/types';

const TOAST_STYLES: Record<ToastType, string> = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

const TOAST_ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
    success: CheckCircle2,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: FileText
};

interface ToastContainerProps {
    toasts: ToastData[];
    onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
            {toasts.map(toast => {
                const Icon = TOAST_ICONS[toast.type];
                return (
                    <div
                        key={toast.id}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl animate-[slideIn_0.3s_ease-out] ${TOAST_STYLES[toast.type]}`}
                    >
                        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                        <p className="text-sm flex-1 font-medium">{toast.message}</p>
                        <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
