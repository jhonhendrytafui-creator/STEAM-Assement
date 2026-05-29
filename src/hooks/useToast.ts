'use client';

import { useState, useCallback, useRef } from 'react';
import type { ToastType, ToastData } from '@/lib/types';

// Custom hook encapsulating toast notification state and actions.
// Previously duplicated in both student and teacher dashboard pages.
export function useToast() {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const toastIdRef = useRef(0);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = ++toastIdRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return { toasts, showToast, dismissToast };
}
