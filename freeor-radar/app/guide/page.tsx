'use client';

import { useState } from 'react';
import {
    BookOpen, ChevronDown, ChevronRight,
    LayoutDashboard, Video, Sparkles, GitFork, Code2, Settings,
    Zap, Bell, RefreshCw, Search, Download, Copy
} from 'lucide-react';

interface Section {
    id: string;
    icon: React.ElementType;
    title: string;
    subtitle: string;
    color: string;
    steps: { title: string; desc: string }[];
}

const SECTIONS: Section[] = [
    {
        id: 'dashboard',
        icon: LayoutDashboard,
        title: '仪表盘',
        subtitle: '实时监控 OpenRouter 所有免费模型',
        color: 'text-green-400',
        steps: [
            { title: '实时监控卡片', desc: '左侧大数字显示当前免费模型总数，每小时自动更新一次（Vercel Cron 驱动）。"今日新增"按钮跳转至变更日志。' },
            { title: '视频额度追踪', desc: 'Kling、Genmo、Pika 等视频平台的每日免费额度以进度条实时呈现，点击"生成 Prompt →"直达视频专区。' },
            { title: 'Top 5 推荐模型', desc: '按上下文长度排序的前 5 个免费模型，展示提供商、上下文窗口和能力标签（vision / tool / coding）。' },
            { title: '全部免费模型表格', desc: '完整列表支持关键词搜索、多标签筛选、排序切换。点击模型 ID 可一键复制；右上角可导出 CSV 文件。' },
        ],
    },
    {
        id: 'video',
        icon: Video,
        title: '视频专区',
        subtitle: '一键生成高质量视频描述 Prompt',
        color: 'text-purple-400',
        steps: [
            { title: '选择目标平台', desc: '从下拉菜单选择 Kling、Veo、Runway、Genmo 或 Pika，模板会自动过滤出该平台支持的风格。' },
            { title: '选择 Prompt 模板', desc: '7 大场景模板（电影感、产品展示、自然风景等），每个模板配有描述、标签和平台兼容性说明。' },
            { title: '输入核心内容', desc: '在右侧输入框描述您的视频主题，系统会将输入插入模板的变量占位符中，实时预览。' },
            { title: '复制并使用', desc: '点击"复制 Prompt"将完整内容复制到剪贴板，粘贴到对应视频平台即可生成。历史记录自动保存在底部。' },
        ],
    },
    {
        id: 'recommend',
        icon: Sparkles,
        title: '智能推荐',
        subtitle: 'AI 自动匹配最适合您任务的免费模型',
        color: 'text-yellow-400',
        steps: [
            { title: '描述您的任务', desc: '在大输入框中用自然语言描述需求，例如"需要分析一段长文本并提取关键信息"或"写一段 Python 爬虫代码"。' },
            { title: '点击分析', desc: '系统根据任务类型、上下文需求和模型能力标签，从 29 个免费模型中找出最佳匹配。' },
            { title: '查看推荐结果', desc: '结果包含：最佳模型（附理由）、风险提示、Top 3 备选方案和可直接使用的 Python / JS / cURL 代码片段。' },
            { title: '一键复制代码', desc: '点击代码块右上角的复制图标，直接粘贴到您的项目中，model ID 已预填为推荐的免费模型。' },
        ],
    },
    {
        id: 'changelog',
        icon: GitFork,
        title: '变更日志',
        subtitle: '追踪每一次模型上线与下架',
        color: 'text-blue-400',
        steps: [
            { title: '时间线视图', desc: '按日期分组展示所有模型变更：🟢 新增、🔴 下线、🟡 更新，最新变更置顶显示。' },
            { title: '变更类型', desc: '"new"表示新加入免费列表，"removed"表示模型已不再免费（数据库软删除，非彻底移除），"limit_change"表示额度规则调整。' },
            { title: '自动触发', desc: '每小时 Cron 同步后，若检测到变更会自动写入此日志，并通过 Telegram / Discord 发送推送通知（需在设置中配置）。' },
        ],
    },
    {
        id: 'integrations',
        icon: Code2,
        title: '集成中心',
        subtitle: '多语言快速接入 OpenRouter 免费模型',
        color: 'text-cyan-400',
        steps: [
            { title: '切换语言 Tab', desc: '顶部 Tab 栏支持 Python、JavaScript、cURL 和 Aider 四种接入方式，点击即切换。' },
            { title: '复制代码', desc: '代码块右上角点击"复制"按钮，将完整模板复制到剪贴板。替换 `your-api-key-here` 为您的 OpenRouter Key 即可使用。' },
            { title: '常用模型 ID', desc: '下方卡片列出 4 个热门免费模型 ID（含 :free 后缀），点击右侧复制图标可单独复制 model ID。' },
            { title: '免费获取 API Key', desc: '访问 openrouter.ai/keys，注册后免费获得 Key。模型列表本身无需 Key；智能推荐的 AI 分析功能才需要。' },
        ],
    },
    {
        id: 'settings',
        icon: Settings,
        title: '设置',
        subtitle: '配置推送通知与 API Key',
        color: 'text-orange-400',
        steps: [
            { title: '通知事件开关', desc: '分别开启"新增模型"、"模型下线"、"限流变更"三类事件的推送。关闭后对应事件不发送通知，但日志仍记录。' },
            { title: 'Telegram 配置', desc: '填入 Chat ID（群组 ID 以 -100 开头）。需先让 Bot 加入群组或私聊 Bot，Bot Token 在服务器 .env.local 中配置。' },
            { title: 'Discord Webhook', desc: '在 Discord 频道设置 → 集成 → Webhooks 创建 Webhook URL，粘贴到此处即可接收 Embed 格式通知。' },
            { title: 'OpenRouter API Key', desc: 'Key 仅存储在浏览器本地（localStorage），不上传服务器。用于智能推荐的 AI 分析调用，填写后重新分析任务即生效。' },
        ],
    },
];

export default function GuidePage() {
    const [open, setOpen] = useState<string | null>('dashboard');

    return (
        <div className="max-w-3xl mx-auto space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">📖 操作说明</h1>
                    <p className="text-sm text-white/40 mt-0.5">FreeOR Radar 完整使用指南</p>
                </div>
            </div>

            {/* Quick tips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                {[
                    { icon: RefreshCw, text: '每小时自动同步' },
                    { icon: Bell, text: '多渠道推送通知' },
                    { icon: Search, text: '全局模型搜索' },
                    { icon: Download, text: '支持 CSV 导出' },
                ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2 p-3 rounded-xl bg-white/3 border border-white/6">
                        <Icon className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-xs text-white/60">{text}</span>
                    </div>
                ))}
            </div>

            {/* Accordion sections */}
            <div className="space-y-2">
                {SECTIONS.map((section) => {
                    const isOpen = open === section.id;
                    const Icon = section.icon;
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
                                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0`}>
                                    <Icon className={`w-4 h-4 ${section.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-white/90">{section.title}</div>
                                    <div className="text-xs text-white/35 truncate">{section.subtitle}</div>
                                </div>
                                {isOpen
                                    ? <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                                    : <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                                }
                            </button>

                            {/* Accordion body */}
                            {isOpen && (
                                <div className="px-5 pb-5 space-y-4 border-t border-white/5">
                                    {section.steps.map((step, i) => (
                                        <div key={i} className="flex gap-3 pt-4">
                                            <span className={`text-xs font-bold ${section.color} opacity-70 w-5 text-center flex-shrink-0 pt-0.5`}>
                                                {i + 1}
                                            </span>
                                            <div>
                                                <div className="text-sm font-medium text-white/85 mb-1">{step.title}</div>
                                                <div className="text-xs text-white/45 leading-relaxed">{step.desc}</div>
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
                    <p className="text-sm text-green-400 font-medium mb-1">快速上手</p>
                    <p className="text-xs text-white/40 leading-relaxed">
                        首次使用建议：直接查看仪表盘了解当前免费模型 → 前往集成中心复制调用代码 → 在设置页配置 Telegram 通知，再也不会错过新上线的免费模型！
                    </p>
                </div>
            </div>
        </div>
    );
}
