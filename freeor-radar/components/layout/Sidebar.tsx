'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Video,
    Sparkles,
    GitFork,
    Code2,
    BookOpen,
    Settings,
    Star,
    Zap,
} from 'lucide-react';
import { LangToggle, useLang } from '@/lib/i18n/lang-context';

const NAV_KEYS = [
    { href: '/', tKey: 'nav.dashboard', icon: LayoutDashboard },
    { href: '/video', tKey: 'nav.video', icon: Video },
    { href: '/recommend', tKey: 'nav.recommend', icon: Sparkles },
    { href: '/changelog', tKey: 'nav.changelog', icon: GitFork },
    { href: '/integrations', tKey: 'nav.integrations', icon: Code2 },
    { href: '/guide', tKey: 'nav.guide', icon: BookOpen },
    { href: '/settings', tKey: 'nav.settings', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { t } = useLang();

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                    <div className="font-bold text-sm text-white tracking-tight">FreeOR Radar</div>
                    <div className="text-[10px] text-green-400 font-medium">{t('dashboard.title')}</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_KEYS.map(({ href, tKey, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span>{t(tKey)}</span>
                            {href === '/changelog' && (
                                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                                    {t('nav.new') || 'New'}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-white/5 space-y-1">
                <a
                    href="https://github.com/shixiangzb007-png/FreeOR"
                    target="_blank"
                    rel="noreferrer"
                    className="nav-item"
                >
                    <Star className="w-4 h-4 flex-shrink-0" />
                    <span>{t('nav.github')}</span>
                </a>
                <div className="px-4 pt-2 pb-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="pulse-dot" />
                            <span className="text-[11px] text-green-400 font-medium">{t('nav.status')}</span>
                        </div>
                        <LangToggle />
                    </div>
                </div>
            </div>
        </div>
    );
}
