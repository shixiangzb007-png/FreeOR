'use client';

import { useState } from 'react';
import { VIDEO_PROMPT_TEMPLATES, fillTemplate, extractVariables } from '@/lib/prompts/video-templates';
import { VideoGenPlatform } from '@/types';
import { Copy, RefreshCw, Sparkles, CreditCard } from 'lucide-react';
import { VideoCreditBanner } from '@/components/dashboard/CreditBanner';

const PLATFORMS: { value: VideoGenPlatform; label: string; color: string }[] = [
    { value: 'all', label: '全部', color: '#6b7280' },
    { value: 'kling', label: 'Kling', color: '#3b82f6' },
    { value: 'veo', label: 'Veo 2', color: '#06b6d4' },
    { value: 'runway', label: 'Runway', color: '#6366f1' },
    { value: 'genmo', label: 'Genmo', color: '#8b5cf6' },
    { value: 'pika', label: 'Pika', color: '#f59e0b' },
    { value: 'higgsfield', label: 'Higgsfield', color: '#ec4899' },
    { value: 'openart', label: 'OpenArt', color: '#f97316' },
];

export default function VideoPage() {
    const [selectedPlatform, setSelectedPlatform] = useState<VideoGenPlatform>('all');
    const [selectedTemplateId, setSelectedTemplateId] = useState(VIDEO_PROMPT_TEMPLATES[0].id);
    const [description, setDescription] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [showCredits, setShowCredits] = useState(false);

    const filteredTemplates = VIDEO_PROMPT_TEMPLATES.filter(
        t => selectedPlatform === 'all' || t.platform === selectedPlatform || t.platform === 'all'
    );
    const selectedTemplate = filteredTemplates.find(t => t.id === selectedTemplateId) || filteredTemplates[0];

    async function handleGenerate() {
        if (!description.trim() || !selectedTemplate) return;
        setIsGenerating(true);

        const variables: Record<string, string> = {};
        extractVariables(selectedTemplate.template).forEach(v => {
            variables[v] = description;
        });
        variables['subject'] = description;
        variables['topic'] = description;
        variables['theme'] = description;

        await new Promise(r => setTimeout(r, 800));
        const prompt = fillTemplate(selectedTemplate, variables);
        setGeneratedPrompt(prompt);
        setHistory(prev => [prompt, ...prev.slice(0, 4)]);
        setIsGenerating(false);
    }

    function copyPrompt() {
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">🎬 视频生成专区</h1>
                    <p className="text-sm text-white/40 mt-1">为 AI 视频平台一键生成专业 Prompt</p>
                </div>
                {/* P0: 今日额度 inline 切换 */}
                <button
                    onClick={() => setShowCredits(v => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${showCredits
                            ? 'bg-green-500/10 border-green-500/30 text-green-400'
                            : 'bg-white/5 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20'
                        }`}
                >
                    <CreditCard className="w-4 h-4" />
                    今日额度
                </button>
            </div>

            {/* P0: 内联额度面板（含 P1: Higgsfield + OpenArt） */}
            {showCredits && (
                <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">今日视频额度</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">实时</span>
                    </div>
                    <VideoCreditBanner compact />
                    <p className="text-[11px] text-white/20 mt-3">每日 UTC 00:00 重置 · 数据每小时同步</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Form */}
                <div className="space-y-5">
                    {/* Platform selector — P1: 新增 Higgsfield / OpenArt */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">目标平台</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setSelectedPlatform(p.value)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedPlatform === p.value
                                            ? 'border-opacity-100 text-white'
                                            : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'
                                        }`}
                                    style={selectedPlatform === p.value
                                        ? { borderColor: p.color, backgroundColor: p.color + '20', color: p.color }
                                        : {}}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Template selector */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">Prompt 模板</label>
                        <div className="grid grid-cols-1 gap-2">
                            {filteredTemplates.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTemplateId(t.id)}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedTemplateId === t.id || selectedTemplate?.id === t.id
                                            ? 'border-green-500/30 bg-green-500/8 text-green-400'
                                            : 'border-white/8 bg-white/3 text-white/60 hover:border-white/15'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{t.name}</div>
                                        <div className="text-xs opacity-60 mt-0.5">{t.description}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {t.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="cap-tag text-[10px]">{tag}</span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description input */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">视频主题描述</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="例如：生成30秒产品演示视频，展示一款极简设计的智能手表..."
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40 resize-none transition-all"
                        />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={!description.trim() || isGenerating}
                        className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        {isGenerating ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                一键生成 Prompt
                            </>
                        )}
                    </button>
                </div>

                {/* Right: Preview */}
                <div className="space-y-4">
                    {/* Generated prompt */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-white/50 font-semibold uppercase tracking-wider">生成的 Prompt</label>
                            {generatedPrompt && (
                                <button
                                    onClick={copyPrompt}
                                    className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    {copied ? '已复制！' : '复制'}
                                </button>
                            )}
                        </div>
                        <textarea
                            value={generatedPrompt}
                            onChange={e => setGeneratedPrompt(e.target.value)}
                            placeholder="点击「一键生成 Prompt」查看结果..."
                            rows={12}
                            className="w-full px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-green-500/30 resize-none font-mono leading-relaxed transition-all"
                        />
                    </div>

                    {/* History */}
                    {history.length > 1 && (
                        <div>
                            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2 block">历史记录</label>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {history.slice(1).map((h, i) => (
                                    <div
                                        key={i}
                                        onClick={() => setGeneratedPrompt(h)}
                                        className="p-3 rounded-lg bg-white/3 border border-white/5 hover:border-white/15 cursor-pointer transition-all"
                                    >
                                        <p className="text-xs text-white/40 line-clamp-2 font-mono">{h.slice(0, 100)}...</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
