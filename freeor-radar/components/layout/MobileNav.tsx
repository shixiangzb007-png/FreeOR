'use client';

import { useState } from 'react';
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
} from 'lucide-react';

const navItems = [
    { href: '/', label: '仪表盘', icon: LayoutDashboard },
    { href: '/video', label: '视频', icon: Video },
    { href: '/recommend', label: '推荐', icon: Sparkles },
    { href: '/changelog', label: '日志', icon: GitFork },
    { href: '/guide', label: '指南', icon: BookOpen },
    { href: '/settings', label: '设置', icon: Settings },
];

export function MobileNav() {
    const pathname = usePathname();

    return (
        <nav className="mobile-nav lg:hidden">
            {navItems.map(({ href, label, icon: Icon }) => {
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
                        <span className="text-[10px] font-medium">{label}</span>
                        {isActive && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-green-400" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
