'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface HeroCardProps {
    total: number;
    newToday: number;
}

function useCountUp(target: number, duration = 1500) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (target === 0) return;
        const start = Date.now();
        const timer = setInterval(() => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(target * ease));
            if (progress === 1) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return count;
}

export function HeroCard({ total, newToday }: HeroCardProps) {
    const displayTotal = useCountUp(total);

    return (
        <div className="card-glow rounded-2xl p-6 h-full flex flex-col justify-between relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-transparent pointer-events-none" />

            <div>
                <div className="flex items-center gap-2 mb-4">
                    <div className="pulse-dot" />
                    <span className="text-xs text-green-400 font-semibold uppercase tracking-wider">实时监控</span>
                </div>

                <div className="counter-display">{displayTotal}</div>
                <div className="text-white/40 text-sm mt-2 font-medium">当前免费模型总数</div>
            </div>

            <div className="flex items-center gap-3 mt-6">
                {newToday > 0 && (
                    <Link
                        href="/changelog"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-all"
                    >
                        <span>今日新增 {newToday} 个</span>
                        <ArrowUpRight className="w-3 h-3" />
                    </Link>
                )}
                <span className="text-xs text-white/25">每隔 1 小时更新</span>
            </div>
        </div>
    );
}
