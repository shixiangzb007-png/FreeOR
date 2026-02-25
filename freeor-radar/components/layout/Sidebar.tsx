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
    MessageCircle,
    Zap,
} from 'lucide-react';
import { LangToggle } from '@/lib/i18n/lang-context';

const navItems = [
    { href: '/', label: '仪表盘', icon: LayoutDashboard },
    { href: '/video', label: '视频专区', icon: Video },
    { href: '/recommend', label: '智能推荐', icon: Sparkles },
    { href: '/changelog', label: '变更日志', icon: GitFork },
    { href: '/integrations', label: '集成中心', icon: Code2 },
    { href: '/guide', label: '操作说明', icon: BookOpen },
    { href: '/settings', label: '设置', icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]">
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-white/5">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-400" />
                </div>
                <div>
                    <div className="font-bold text-sm text-white tracking-tight">FreeOR Radar</div>
                    <div className="text-[10px] text-green-400 font-medium">免费模型实时雷达</div>
                </div>
            </div>

            {/* Navigation — min-h-0 让 flex 子项可以正确收缩 */}
            <nav className="flex-1 min-h-0 px-3 py-4 space-y-1 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <span>{label}</span>
                            {href === '/changelog' && (
                                <span className="ml-auto text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                                    新
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer links — flex-shrink-0 确保小屏幕下不被 nav 压缩遮挡 */}
            <div className="flex-shrink-0 px-3 py-4 border-t border-white/5 space-y-1">
                <a
                    href="https://github.com/shixiangzb007-png/FreeOR"
                    target="_blank"
                    rel="noreferrer"
                    className="nav-item"
                >
                    <Star className="w-4 h-4 flex-shrink-0" />
                    <span>GitHub Star</span>
                </a>
                <a
                    href="https://t.me/freeor_radar"
                    target="_blank"
                    rel="noreferrer"
                    className="nav-item"
                    style={{ display: 'none' }}
                >
                    <MessageCircle className="w-4 h-4 flex-shrink-0" />
                    <span>Telegram 群</span>
                </a>
                <div className="px-4 pt-2 pb-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="pulse-dot" />
                            <span className="text-[11px] text-green-400 font-medium">实时监控中</span>
                        </div>
                        {/* P2: 语言切换 */}
                        <LangToggle />
                    </div>
                </div>
            </div>
        </div>
    );
}
