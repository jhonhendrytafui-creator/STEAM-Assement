'use client';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = 'Loading your dashboard...' }: LoadingScreenProps) {
    return (
        <div className="min-h-screen bg-[#1c1b14] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 text-sm">{message}</p>
            </div>
        </div>
    );
}
