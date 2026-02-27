'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Lang = 'zh' | 'en';

interface LangContextType {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: (key: string) => string;
}

// ── 完整翻译表（覆盖所有页面）────────────────────────────────
const TRANSLATIONS: Record<Lang, Record<string, string>> = {
    zh: {
        // ── 导航 ──
        'nav.dashboard': '仪表盘',
        'nav.video': '视频专区',
        'nav.recommend': '智能推荐',
        'nav.changelog': '变更日志',
        'nav.integrations': '集成中心',
        'nav.guide': '操作说明',
        'nav.settings': '设置',
        'nav.github': 'GitHub Star',
        'nav.status': '实时监控中',

        // ── 仪表盘 ──
        'dashboard.title': '免费模型实时雷达',
        'dashboard.models': '当前免费模型总数',
        'dashboard.today': '今日新增',
        'dashboard.top5': '⭐ Top 5 推荐模型',
        'dashboard.top5.sort': '按上下文长度排序',
        'dashboard.all': '📋 全部免费模型',
        'dashboard.no_data': '暂无数据，等待 Cron 首次运行',

        // ── 模型表格 ──
        'table.name': '模型名称',
        'table.provider': '提供商',
        'table.context': '上下文',
        'table.caps': '能力',
        'table.ratelimit': '限流',
        'table.updated': '更新时间',
        'table.actions': '操作',
        'table.no_result': '没有找到匹配的模型',

        // ── 过滤器 ──
        'filter.search': '搜索模型或提供商...',
        'filter.sort.recent': '最新更新',
        'filter.sort.ctx': '上下文长度',

        // ── 视频页 ──
        'video.title': '视频生成专区',
        'video.subtitle': '为 AI 视频平台一键生成专业 Prompt',
        'video.credits': '今日额度',
        'video.platform': '目标平台',
        'video.template': 'Prompt 模板',
        'video.topic': '视频主题描述',
        'video.topic.hint': '例如：生成30秒产品演示视频，展示一款极简设计的智能手表...',
        'video.generate': '一键生成 Prompt',
        'video.generating': '生成中...',
        'video.prompt.label': '生成的 Prompt',
        'video.copy': '复制',
        'video.copied': '已复制！',
        'video.history': '历史记录',
        'video.credits.realtime': '实时',
        'video.credits.sync': '每日 UTC 00:00 重置 · 数据每小时同步',

        // ── 智能推荐 ──
        'recommend.title': '⚡ 智能推荐',
        'recommend.subtitle': '描述你的任务，AI 为你推荐最佳免费模型',
        'recommend.placeholder': '描述你的任务需求，例如：我需要处理长文档、分析图片、写代码...',
        'recommend.quick': '快速选择：',
        'recommend.analyze': '分析任务',
        'recommend.analyzing': '分析中...',
        'recommend.best': '最佳推荐',
        'recommend.reason': '推荐理由',
        'recommend.risks': '注意事项',
        'recommend.code': '🔌 一键接入代码',
        'recommend.alts': '🔄 备用推荐 Top 3',
        'recommend.view': '查看',

        // ── 变更日志 ──
        'changelog.title': '📋 变更日志',
        'changelog.subtitle': 'OpenRouter 免费模型变更历史',
        'changelog.empty': '暂无变更记录，等待 Cron 首次运行后将自动填充数据',
        'changelog.empty.hint': '手动触发: POST /api/cron',
        'changelog.count': '条',

        // ── 集成中心 ──
        'integrations.title': '🔌 集成中心',
        'integrations.subtitle': '一键复制接入代码，快速集成 OpenRouter 免费模型',
        'integrations.copy': '复制',
        'integrations.copied': '已复制',

        // ── 操作说明 ──
        'guide.title': '📖 操作说明',
        'guide.subtitle': '了解如何使用 FreeOR Radar 的各项功能',

        // ── 设置 ──
        'settings.title': '设置',
        'settings.subtitle': '通知、API Key 和个性化配置',
        'settings.notify.title': '通知设置',
        'settings.notify.new': '新增免费模型',
        'settings.notify.new.desc': '有新模型加入免费列表时通知我',
        'settings.notify.removed': '模型下线',
        'settings.notify.removed.desc': '模型从免费列表移除时通知我',
        'settings.notify.limit': '限流变更',
        'settings.notify.limit.desc': '现有免费模型限制发生变化时通知我',
        'settings.channels': '推送渠道',
        'settings.telegram.hint': '在 Telegram 中与 @userinfobot 对话获取 Chat ID',
        'settings.x.config': '配置说明',
        'settings.x.hint': '请在 .env.local 中配置 X_API_KEY / X_ACCESS_TOKEN 等环境变量后重启服务',
        'settings.apikey.title': 'API Key 管理',
        'settings.apikey.info': 'FreeOR Radar 的所有免费模型列表功能无需 API Key。仅在使用智能推荐的 AI 分析功能时，需要一个 OpenRouter Key（免费注册可得）。',
        'settings.apikey.local': 'Key 仅存储在浏览器本地，不会上传到服务器。',
        'settings.apikey.get': '免费获取 Key',
        'settings.optional': '（可选）',
        'settings.siteurl': '您的站点 URL',
        'settings.siteurl.hint': '用于 OpenRouter 的 HTTP-Referer 请求头',
        'settings.save': '保存设置',
        'settings.saved': '已保存',
        'settings.saved.hint': '设置已保存到本地浏览器，刷新后生效',
    },

    en: {
        // ── Nav ──
        'nav.dashboard': 'Dashboard',
        'nav.video': 'Video',
        'nav.recommend': 'Recommend',
        'nav.changelog': 'Changelog',
        'nav.integrations': 'Integrations',
        'nav.guide': 'Guide',
        'nav.settings': 'Settings',
        'nav.github': 'GitHub Star',
        'nav.status': 'Live monitoring',

        // ── Dashboard ──
        'dashboard.title': 'Free Model Radar',
        'dashboard.models': 'Total free models',
        'dashboard.today': "Today's new",
        'dashboard.top5': '⭐ Top 5 Recommended',
        'dashboard.top5.sort': 'Sorted by context length',
        'dashboard.all': '📋 All Free Models',
        'dashboard.no_data': 'No data yet. Waiting for first Cron run.',

        // ── Table ──
        'table.name': 'Model Name',
        'table.provider': 'Provider',
        'table.context': 'Context',
        'table.caps': 'Capabilities',
        'table.ratelimit': 'Rate',
        'table.updated': 'Updated',
        'table.actions': 'Actions',
        'table.no_result': 'No models found',

        // ── Filters ──
        'filter.search': 'Search models or providers...',
        'filter.sort.recent': 'Recently updated',
        'filter.sort.ctx': 'Context length',

        // ── Video ──
        'video.title': 'Video Studio',
        'video.subtitle': 'Generate professional prompts for AI video platforms',
        'video.credits': "Today's Credits",
        'video.platform': 'Target Platform',
        'video.template': 'Prompt Template',
        'video.topic': 'Video Topic',
        'video.topic.hint': 'e.g. Create a 30-second product demo for a minimalist smartwatch...',
        'video.generate': 'Generate Prompt',
        'video.generating': 'Generating...',
        'video.prompt.label': 'Generated Prompt',
        'video.copy': 'Copy',
        'video.copied': 'Copied!',
        'video.history': 'History',
        'video.credits.realtime': 'Live',
        'video.credits.sync': 'Resets daily at UTC 00:00 · Synced hourly',

        // ── Recommend ──
        'recommend.title': '⚡ Smart Recommend',
        'recommend.subtitle': 'Describe your task, AI picks the best free model',
        'recommend.placeholder': 'Describe your task, e.g. I need to summarize long documents, analyze images, write code...',
        'recommend.quick': 'Quick pick:',
        'recommend.analyze': 'Analyze Task',
        'recommend.analyzing': 'Analyzing...',
        'recommend.best': 'Best Match',
        'recommend.reason': 'Why this model',
        'recommend.risks': 'Caveats',
        'recommend.code': '🔌 One-click Code',
        'recommend.alts': '🔄 Top 3 Alternatives',
        'recommend.view': 'View',

        // ── Changelog ──
        'changelog.title': '📋 Changelog',
        'changelog.subtitle': 'OpenRouter free model change history',
        'changelog.empty': 'No changes yet. Data will populate after the first Cron run.',
        'changelog.empty.hint': 'Manual trigger: POST /api/cron',
        'changelog.count': 'entries',

        // ── Integrations ──
        'integrations.title': '🔌 Integrations',
        'integrations.subtitle': 'One-click code snippets for OpenRouter free models',
        'integrations.copy': 'Copy',
        'integrations.copied': 'Copied',

        // ── Guide ──
        'guide.title': '📖 Operation Guide',
        'guide.subtitle': 'Learn how to use FreeOR Radar features',

        // ── Settings ──
        'settings.title': 'Settings',
        'settings.subtitle': 'Notifications, API Keys & Personalization',
        'settings.notify.title': 'Notifications',
        'settings.notify.new': 'New Free Models',
        'settings.notify.new.desc': 'Notify me when new models join the free tier',
        'settings.notify.removed': 'Model Removed',
        'settings.notify.removed.desc': 'Notify me when models leave the free tier',
        'settings.notify.limit': 'Rate Limit Changes',
        'settings.notify.limit.desc': 'Notify me when existing free models change their limits',
        'settings.channels': 'Push Channels',
        'settings.telegram.hint': 'Chat with @userinfobot on Telegram to get your Chat ID',
        'settings.x.config': 'Configuration',
        'settings.x.hint': 'Configure X_API_KEY / X_ACCESS_TOKEN in .env.local and restart',
        'settings.apikey.title': 'API Key Management',
        'settings.apikey.info': 'All free model listing features require no API key. Only the Smart Recommend AI analysis needs an OpenRouter key (free to register).',
        'settings.apikey.local': 'Key is stored locally in your browser only.',
        'settings.apikey.get': 'Get a free key',
        'settings.optional': '(Optional)',
        'settings.siteurl': 'Your Site URL',
        'settings.siteurl.hint': 'Used as HTTP-Referer header for OpenRouter requests',
        'settings.save': 'Save Settings',
        'settings.saved': 'Saved',
        'settings.saved.hint': 'Settings saved to browser. Effective after refresh.',
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
