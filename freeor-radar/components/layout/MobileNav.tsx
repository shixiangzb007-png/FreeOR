'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Video,
    Sparkles,
    GitFork,
    BookOpen,
    Settings,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';

const NAV_KEYS = [
    { href: '/', tKey: 'nav.dashboard', icon: LayoutDashboard },
    { href: '/video', tKey: 'nav.video', icon: Video },
    { href: '/recommend', tKey: 'nav.recommend', icon: Sparkles },
    { href: '/changelog', tKey: 'nav.changelog', icon: GitFork },
    { href: '/guide', tKey: 'nav.guide', icon: BookOpen },
    { href: '/settings', tKey: 'nav.settings', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();
    const { t } = useLang();

    return (
        <nav className="mobile-nav lg:hidden">
            {NAV_KEYS.map(({ href, tKey, icon: Icon }) => {
                const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all ${isActive
                            ? 'text-green-400'
                            : 'text-white/40 hover:text-white/70'
                            }`}
                    >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{t(tKey)}</span>
                        {isActive && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-green-400" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
