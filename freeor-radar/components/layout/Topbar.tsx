'use client';

import { useState, useEffect } from 'react';
import { Search, Bell, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useLang } from '@/lib/i18n/lang-context';

export function Topbar() {
    const { t } = useLang();
    const [search, setSearch] = useState('');
    const [newToday, setNewToday] = useState<number | null>(null);
    const router = useRouter();

    // 拉取过去 24h 新增免费模型数（change_logs 公开可读）
    useEffect(() => {
        const supabase = createClient();
        supabase
            .from('change_logs')
            .select('*', { count: 'exact', head: true })
            .eq('change_type', 'new')
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .then(({ count }) => setNewToday(count ?? 0));
    }, []);

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (search.trim()) {
            router.push(`/?search=${encodeURIComponent(search.trim())}`);
        }
    }

    return (
        <div className="flex items-center gap-4 h-full px-4 lg:px-8">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={t('topbar.search')}
                        className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                    />
                </div>
            </form>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Today's new badge */}
            <Link
                href="/changelog"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-all cursor-pointer"
            >
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold text-green-400">{t('topbar.today')}</span>
                <span className="text-xs font-bold text-white bg-green-500 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {newToday === null ? '…' : newToday > 0 ? `+${newToday}` : '0'}
                </span>
            </Link>

            {/* Notification settings */}
            <Link
                href="/settings"
                className="relative w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
                title={t('topbar.notifications')}
            >
                <Bell className="w-4 h-4 text-white/60" />
            </Link>
        </div>
    );
}
