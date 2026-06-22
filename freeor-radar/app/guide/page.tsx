'use client';

import { useState } from 'react';
import {
    BookOpen, ChevronDown, ChevronRight,
    LayoutDashboard, Video, Sparkles, GitFork, Code2, Settings,
    Zap, Bell, RefreshCw, Search, Download, User, Film,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';

type SectionId = 's1' | 's2' | 's7' | 's8' | 's3' | 's4' | 's5' | 's6';

interface SectionMeta {
    id: SectionId;
    icon: React.ElementType;
    color: string;
    /** number of steps in this section */
    steps: number;
}

const SECTION_META: SectionMeta[] = [
    { id: 's1', icon: LayoutDashboard, color: 'text-green-400',  steps: 5 },
    { id: 's2', icon: Video,           color: 'text-emerald-400', steps: 4 },
    { id: 's7', icon: User,            color: 'text-purple-400', steps: 5 },
    { id: 's8', icon: Film,            color: 'text-blue-400',   steps: 4 },
    { id: 's3', icon: Sparkles,        color: 'text-yellow-400', steps: 4 },
    { id: 's4', icon: GitFork,         color: 'text-cyan-400',   steps: 3 },
    { id: 's5', icon: Code2,           color: 'text-teal-400',   steps: 4 },
    { id: 's6', icon: Settings,        color: 'text-orange-400', steps: 5 },
];

export default function GuidePage() {
    const { t } = useLang();
    const [open, setOpen] = useState<string | null>('s1');

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">{t('guide.title')}</h1>
                    <p className="text-sm text-white/40 mt-0.5">{t('guide.subtitle')}</p>
                </div>
            </div>

            {/* Quick tips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
                {([
                    { icon: RefreshCw, key: 'guide.tips.sync' },
                    { icon: Bell,      key: 'guide.tips.notify' },
                    { icon: Search,    key: 'guide.tips.search' },
                    { icon: Download,  key: 'guide.tips.csv' },
                    { icon: Video,     key: 'guide.tips.video' },
                    { icon: User,      key: 'guide.tips.character' },
                ] as { icon: React.ElementType; key: string }[]).map(({ icon: Icon, key }) => (
                    <div key={key} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                        <Icon className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-xs text-white/60">{t(key)}</span>
                    </div>
                ))}
            </div>

            {/* Accordion sections */}
            <div className="space-y-2">
                {SECTION_META.map((section) => {
                    const isOpen = open === section.id;
                    const Icon = section.icon;
                    const prefix = `guide.${section.id}`;
                    // Build steps array from translation keys
                    const stepIndices = Array.from({ length: section.steps }, (_, i) => i + 1);

                    return (
                        <div
                            key={section.id}
                            className="rounded-2xl border border-white/8 overflow-hidden transition-all"
                            style={{ background: 'var(--bg-card)' }}
                        >
                            {/* Accordion header */}
                            <button
                                onClick={() => setOpen(isOpen ? null : section.id)}
                                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                    <Icon className={`w-4 h-4 ${section.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white/90">{t(`${prefix}.title`)}</div>
                                    <div className="text-xs text-white/35 truncate">{t(`${prefix}.subtitle`)}</div>
                                </div>
                                {isOpen
                                    ? <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                                }
                            </button>

                            {/* Accordion body */}
                            {isOpen && (
                                <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                                    {stepIndices.map((i) => (
                                        <div key={i} className="flex gap-3 pt-4">
                                            <span className={`text-xs font-bold ${section.color} opacity-70 w-5 text-center flex-shrink-0 pt-0.5`}>
                                                {i}
                                            </span>
                                            <div>
                                                <div className="text-sm font-medium text-white/85 mb-1">
                                                    {t(`${prefix}.step${i}.title`)}
                                                </div>
                                                <div className="text-xs text-white/45 leading-relaxed">
                                                    {t(`${prefix}.step${i}.desc`)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer tip */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-green-500/5 border border-green-500/15 mt-4">
                <Zap className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm text-green-400 font-medium mb-1">{t('guide.footer.title')}</p>
                    <p className="text-xs text-white/40 leading-relaxed">{t('guide.footer.desc')}</p>
                </div>
            </div>
        </div>
    );
}
