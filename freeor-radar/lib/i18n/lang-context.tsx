'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'zh' | 'en';

interface LangContextType {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string) => string;
}

// ── 翻译表 ────────────────────────────────────────────────────
const TRANSLATIONS: Record<Lang, Record<string, string>> = {
    zh: {
        'nav.dashboard': '仪表盘',
        'nav.video': '视频专区',
        'nav.recommend': '智能推荐',
        'nav.changelog': '变更日志',
        'nav.integrations': '集成中心',
        'nav.guide': '操作说明',
        'nav.settings': '设置',
        'nav.github': 'GitHub Star',
        'nav.status': '实时监控中',
        'dashboard.title': '免费模型实时雷达',
        'dashboard.models': '当前免费模型总数',
        'dashboard.today': '今日新增',
        'video.title': '视频生成专区',
        'video.subtitle': '为 AI 视频平台一键生成专业 Prompt',
        'video.credits': '今日额度',
        'table.name': '模型名称',
        'table.provider': '提供商',
        'table.context': '上下文',
        'table.caps': '能力',
        'table.ratelimit': '限流',
        'table.updated': '更新时间',
        'table.actions': '操作',
        'filter.search': '搜索模型或提供商...',
        'filter.sort.recent': '最新更新',
        'filter.sort.ctx': '上下文长度',
    },
    en: {
        'nav.dashboard': 'Dashboard',
        'nav.video': 'Video',
        'nav.recommend': 'Recommend',
        'nav.changelog': 'Changelog',
        'nav.integrations': 'Integrations',
        'nav.guide': 'Guide',
        'nav.settings': 'Settings',
        'nav.github': 'GitHub Star',
        'nav.status': 'Live monitoring',
        'dashboard.title': 'Free Model Radar',
        'dashboard.models': 'Total free models',
        'dashboard.today': "Today's new",
        'video.title': 'Video Studio',
        'video.subtitle': 'Generate professional prompts for AI video platforms',
        'video.credits': "Today's Credits",
        'table.name': 'Model Name',
        'table.provider': 'Provider',
        'table.context': 'Context',
        'table.caps': 'Capabilities',
        'table.ratelimit': 'Rate',
        'table.updated': 'Updated',
        'table.actions': 'Actions',
        'filter.search': 'Search models or providers...',
        'filter.sort.recent': 'Recently updated',
        'filter.sort.ctx': 'Context length',
    },
};

const LangContext = createContext<LangContextType>({
    lang: 'zh',
    setLang: () => { },
    t: (k) => k,
});

export function LangProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>('zh');

    useEffect(() => {
        const saved = localStorage.getItem('freeor-lang') as Lang | null;
        if (saved === 'en' || saved === 'zh') setLangState(saved);
    }, []);

    function setLang(l: Lang) {
        setLangState(l);
        localStorage.setItem('freeor-lang', l);
    }

    function t(key: string): string {
        return TRANSLATIONS[lang][key] ?? key;
    }

    return (
        <LangContext.Provider value={{ lang, setLang, t }}>
            {children}
        </LangContext.Provider>
    );
}

export function useLang() {
    return useContext(LangContext);
}

/** 语言切换按钮组件 */
export function LangToggle({ className = '' }: { className?: string }) {
    const { lang, setLang } = useLang();
    return (
        <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/50 hover:text-white/80 hover:border-white/20 transition-all ${className}`}
            title={lang === 'zh' ? 'Switch to English' : '切换中文'}
        >
            <span className="text-sm">{lang === 'zh' ? '🇨🇳' : '🇺🇸'}</span>
            <span>{lang === 'zh' ? '中' : 'EN'}</span>
        </button>
    );
}
