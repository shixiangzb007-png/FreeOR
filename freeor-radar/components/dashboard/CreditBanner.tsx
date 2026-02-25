'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { VideoCredit } from '@/types';

// P1: 新增 Higgsfield 和 OpenArt
const PLATFORM_META: Record<string, { color: string; label: string; icon: string; reset: string }> = {
    kling: { color: '#3b82f6', label: 'Kling', icon: '🎬', reset: '每日' },
    genmo: { color: '#8b5cf6', label: 'Genmo', icon: '∞', reset: '无限' },
    pika: { color: '#f59e0b', label: 'Pika', icon: '⚡', reset: '每日' },
    runway: { color: '#6366f1', label: 'Runway', icon: '🛸', reset: '订阅' },
    veo: { color: '#06b6d4', label: 'Veo 2', icon: '🌊', reset: '配额' },
    higgsfield: { color: '#ec4899', label: 'Higgsfield', icon: '🎯', reset: '每日' },
    openart: { color: '#f97316', label: 'OpenArt', icon: '🎨', reset: '每日' },
};

interface VideoCreditBannerProps {
    /** compact=true 用于视频页内联展示（竖排卡片），false 为仪表盘横排样式 */
    compact?: boolean;
}

export function VideoCreditBanner({ compact = false }: VideoCreditBannerProps) {
    const [credits, setCredits] = useState<VideoCredit[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();

        async function load() {
            const { data } = await supabase
                .from('video_credits')
                .select('*')
                .order('tool');
            if (data) setCredits(data as VideoCredit[]);
            setLoading(false);
        }

        load();

        // Realtime subscription for live updates
        const channel = supabase
            .channel('video_credits_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'video_credits' }, load)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-white/3 animate-pulse" />
                ))}
            </div>
        );
    }

    // 仅显示有数据的平台 + 预定义平台（填补数据库中没有的）
    const allTools = Object.keys(PLATFORM_META);
    const creditMap = new Map(credits.map(c => [c.tool, c]));

    // 合并：数据库有的显示真实数据，没有的显示占位
    const platforms = allTools.map(tool => {
        const db = creditMap.get(tool);
        return db || {
            tool,
            daily_credits: 0,
            used_today: 0,
            updated_at: new Date().toISOString(),
            reset_at: null,
        } as VideoCredit;
    });

    if (compact) {
        // 视频页内联版：竖向卡片列表
        return (
            <div className="space-y-2">
                {platforms.map(c => {
                    const meta = PLATFORM_META[c.tool];
                    if (!meta) return null;
                    const isUnlimited = meta.reset === '无限' || c.daily_credits === 999999;
                    const pct = isUnlimited ? 100 : c.daily_credits > 0
                        ? Math.max(0, Math.round(((c.daily_credits - c.used_today) / c.daily_credits) * 100))
                        : 0;
                    const remaining = isUnlimited ? '∞' : c.daily_credits > 0
                        ? `${c.daily_credits - c.used_today}/${c.daily_credits}`
                        : '—';

                    return (
                        <div key={c.tool} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/6">
                            <span className="text-base w-6 text-center flex-shrink-0">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-white/70">{meta.label}</span>
                                    <span className="text-xs font-mono" style={{ color: meta.color }}>{remaining}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width: `${pct}%`,
                                            backgroundColor: meta.color,
                                            opacity: isUnlimited ? 0.6 : 1,
                                        }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-white/20 flex-shrink-0">{meta.reset}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    // 仪表盘横排版（原样式）
    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {platforms.map(c => {
                const meta = PLATFORM_META[c.tool];
                if (!meta) return null;
                const isUnlimited = meta.reset === '无限' || c.daily_credits === 999999;
                const pct = isUnlimited ? 100 : c.daily_credits > 0
                    ? Math.max(0, Math.round(((c.daily_credits - c.used_today) / c.daily_credits) * 100))
                    : 0;
                const remaining = isUnlimited ? '∞' : c.daily_credits > 0
                    ? `${c.daily_credits - c.used_today}/${c.daily_credits}`
                    : '0/0';

                return (
                    <div key={c.tool} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-white/50 font-medium">{meta.label}</span>
                            <span className="text-xs font-mono font-bold" style={{ color: meta.color }}>
                                {remaining}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${pct}%`,
                                    backgroundColor: meta.color,
                                    opacity: isUnlimited ? 0.5 : 1,
                                }}
                            />
                        </div>
                        <span className="text-[10px] text-white/20">
                            {isUnlimited ? '无限制' : `${pct}% 剩余`}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// 向后兼容别名：page.tsx import { CreditBanner } 仍可正常工作
export const CreditBanner = VideoCreditBanner;
