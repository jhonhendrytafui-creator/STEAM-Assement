'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToastType, ToastData } from '@/lib/types';

// How long each kind of message stays on screen. Errors and warnings ask the
// reader to do something about them — and this app's users are reading in a
// second language — so they get roughly twice as long as a confirmation.
const DISMISS_AFTER_MS: Record<ToastType, number> = {
    success: 4000,
    info: 4000,
    warning: 8000,
    error: 10000,
};

// Custom hook encapsulating toast notification state and actions.
// Previously duplicated in both student and teacher dashboard pages.
export function useToast() {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastIdRef = useRef(0);
    const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

    // Cancel pending dismissals when the dashboard unmounts, so no timer is
    // left holding a setState for a component that is gone.
    useEffect(() => {
        const timers = timersRef.current;
        return () => {
            timers.forEach(clearTimeout);
            timers.clear();
        };
    }, []);

    const dismissToast = useCallback((id: number) => {
        const timer = timersRef.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(id);
        }
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);

        const timer = setTimeout(() => {
            timersRef.current.delete(id);
            setToasts(prev => prev.filter(t => t.id !== id));
        }, DISMISS_AFTER_MS[type] ?? 4000);

        timersRef.current.set(id, timer);
    }, []);

    return { toasts, showToast, dismissToast };
}
