'use client';

import { useState, useEffect } from 'react';
import { VIDEO_PROMPT_TEMPLATES, fillTemplate, extractVariables } from '@/lib/prompts/video-templates';
import { VideoGenPlatform } from '@/types';
import { Copy, RefreshCw, Sparkles } from 'lucide-react';
import { VideoCreditBanner } from '@/components/dashboard/CreditBanner';
import { useLang } from '@/lib/i18n/lang-context';

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
    const { t } = useLang();
    const [selectedPlatform, setSelectedPlatform] = useState<VideoGenPlatform>('all');
    const [selectedTemplateId, setSelectedTemplateId] = useState(VIDEO_PROMPT_TEMPLATES[0].id);
    const [description, setDescription] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    
    // 从 localStorage 恢复历史记录 (Client Only)
    useEffect(() => {
        try {
            const saved = localStorage.getItem('video_prompt_history');
            if (saved) setHistory(JSON.parse(saved));
        } catch (e) {
            console.error('Failed to parse video prompt history from localStorage', e);
        }
    }, []);

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
        setIsGenerating(false);

        // 更新 State 的同时写入 LocalStorage，保留最近 20 条
        setHistory(prev => {
            const next = [prompt, ...prev.slice(0, 19)];
            localStorage.setItem('video_prompt_history', JSON.stringify(next));
            return next;
        });
    }

    function copyPrompt() {
        navigator.clipboard.writeText(generatedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">🎬 {t('video.title')}</h1>
                <p className="text-sm text-white/40 mt-1">{t('video.subtitle')}</p>
            </div>

            {/* 今日额度 — 常驻内联展示 */}
            <div className="p-4 rounded-2xl bg-white/3 border border-white/8">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                        {t('video.credits')}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
                        {t('video.credits.realtime')}
                    </span>
                </div>
                <VideoCreditBanner compact />
                <p className="text-[11px] text-white/20 mt-3">{t('video.credits.sync')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Form */}
                <div className="space-y-5">
                    {/* Platform selector */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('video.platform')}
                        </label>
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
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('video.template')}
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {filteredTemplates.map(tmpl => (
                                <button
                                    key={tmpl.id}
                                    onClick={() => setSelectedTemplateId(tmpl.id)}
                                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${selectedTemplateId === tmpl.id || selectedTemplate?.id === tmpl.id
                                            ? 'border-green-500/30 bg-green-500/8 text-green-400'
                                            : 'border-white/8 bg-white/3 text-white/60 hover:border-white/15'
                                        }`}
                                >
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{tmpl.name}</div>
                                        <div className="text-xs opacity-60 mt-0.5">{tmpl.description}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {tmpl.tags.slice(0, 2).map(tag => (
                                            <span key={tag} className="cap-tag text-[10px]">{tag}</span>
                                        ))}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Description input */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('video.topic')}
                        </label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={t('video.topic.hint')}
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
                                {t('video.generating')}
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                {t('video.generate')}
                            </>
                        )}
                    </button>
                </div>

                {/* Right: Preview */}
                <div className="space-y-4">
                    {/* Generated prompt */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs text-white/50 font-semibold uppercase tracking-wider">
                                {t('video.prompt.label')}
                            </label>
                            {generatedPrompt && (
                                <button
                                    onClick={copyPrompt}
                                    className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    {copied ? t('video.copied') : t('video.copy')}
                                </button>
                            )}
                        </div>
                        <textarea
                            value={generatedPrompt}
                            onChange={e => setGeneratedPrompt(e.target.value)}
                            placeholder={t('video.prompt.placeholder')}
                            rows={12}
                            className="w-full px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-green-500/30 resize-none font-mono leading-relaxed transition-all"
                        />
                    </div>

                    {/* History */}
                    {history.length > 1 && (
                        <div>
                            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2 block">
                                {t('video.history')}
                            </label>
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
