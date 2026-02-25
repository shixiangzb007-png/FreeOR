'use client';

import { useState } from 'react';
import { Search, Bell, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Topbar() {
    const [search, setSearch] = useState('');
    const router = useRouter();

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
                        placeholder="搜索模型名称..."
                        className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                    />
                </div>
            </form>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Today's new badge */}
            <a
                href="/changelog"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/15 transition-all cursor-pointer"
            >
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold text-green-400">今日新增</span>
                <span className="text-xs font-bold text-white bg-green-500 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    +
                </span>
            </a>

            {/* Notifications */}
            <button
                className="relative w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
                title="通知"
            >
                <Bell className="w-4 h-4 text-white/60" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-400 border border-[#0a0a0a]" />
            </button>
        </div>
    );
}
