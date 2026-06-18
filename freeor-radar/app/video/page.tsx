'use client';

import { useState, useEffect } from 'react';
import { VIDEO_PROMPT_TEMPLATES, fillTemplate, extractVariables } from '@/lib/prompts/video-templates';
import { VideoGenPlatform } from '@/types';
import { Copy, RefreshCw, Sparkles, Video, Download, Trash2, RotateCcw, Play, Film } from 'lucide-react';
import { VideoCreditBanner } from '@/components/dashboard/CreditBanner';
import { useLang } from '@/lib/i18n/lang-context';
import { useVideoTasks } from '@/lib/hooks/useVideoTasks';
import { OverviewPanel } from '@/components/video/OverviewPanel';
import {
    VIDEO_MODEL_CONFIGS,
    clampVideoDuration,
    durationPresetsForModel,
    getVideoModelConfig,
} from '@/lib/video/models';

// ── Constants ─────────────────────────────────────────────────

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

// OpenRouter 视频生成模型（POST /api/v1/videos）。注意：视频模型均按用量计费，
// 需使用自己有余额的 OpenRouter Key（BYOK）。ID 来自 /api/v1/videos/models。
const VIDEO_MODELS = VIDEO_MODEL_CONFIGS;

// ── Status Badge ──────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
    const styles: Record<string, string> = {
        pending:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
        processing: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
        succeed:    'bg-green-500/15 text-green-400 border-green-500/20',
        failed:     'bg-red-500/15 text-red-400 border-red-500/20',
    };
    const labelKey: Record<string, string> = {
        pending:    'video.tasks.pending',
        processing: 'video.tasks.processing',
        succeed:    'video.tasks.succeed',
        failed:     'video.tasks.failed',
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status] || styles.pending}`}>
            {t(labelKey[status] || 'video.tasks.pending')}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────

export default function VideoPage() {
    const { t, lang } = useLang();
    const { tasks, isLoaded, submitTask, removeTask, retryTask } = useVideoTasks();

    const [selectedPlatform, setSelectedPlatform] = useState<VideoGenPlatform>('all');
    const [selectedTemplateId, setSelectedTemplateId] = useState(VIDEO_PROMPT_TEMPLATES[0].id);
    const [selectedModel, setSelectedModel] = useState(VIDEO_MODELS[0].id);
    const [selectedDuration, setSelectedDuration] = useState(
        clampVideoDuration(VIDEO_PROMPT_TEMPLATES[0].durationSeconds, VIDEO_MODELS[0].id)
    );
    const [description, setDescription] = useState('');
    const [generatedPrompt, setGeneratedPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [apiKey, setApiKey] = useState('');
    const [submitError, setSubmitError] = useState('');
    const [videoTab, setVideoTab] = useState<'clip' | 'overview'>('clip');

    // Load prompt history and API key from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('video_prompt_history');
            if (saved) setHistory(JSON.parse(saved));
        } catch { /* noop */ }
        try {
            const settings = localStorage.getItem('freeor-settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                if (parsed.openrouter_key) setApiKey(parsed.openrouter_key);
            }
        } catch { /* noop */ }
    }, []);

    const filteredTemplates = VIDEO_PROMPT_TEMPLATES.filter(
        tmpl => selectedPlatform === 'all' || tmpl.platform === selectedPlatform || tmpl.platform === 'all'
    );
    const selectedTemplate = filteredTemplates.find(tmpl => tmpl.id === selectedTemplateId) || filteredTemplates[0];
    const modelConfig = getVideoModelConfig(selectedModel);
    const durationPresets = durationPresetsForModel(selectedModel);
    const durationClamped = selectedTemplate
        && selectedTemplate.durationSeconds > modelConfig.maxDuration;

    // Apply template default duration when template or model changes
    useEffect(() => {
        const tmpl = VIDEO_PROMPT_TEMPLATES.find(t => t.id === selectedTemplateId);
        if (!tmpl) return;
        setSelectedDuration(clampVideoDuration(tmpl.durationSeconds, selectedModel));
    }, [selectedTemplateId, selectedModel]);

    async function handleGeneratePrompt() {
        if (!description.trim() || !selectedTemplate) return;
        setIsGenerating(true);

        const effectiveDuration = clampVideoDuration(selectedDuration, selectedModel);
        const variables: Record<string, string> = { duration: String(effectiveDuration) };
        extractVariables(selectedTemplate.template).forEach(v => {
            if (v !== 'duration') variables[v] = description;
        });
        variables['subject'] = description;
        variables['topic'] = description;
        variables['theme'] = description;

        await new Promise(r => setTimeout(r, 800));
        const prompt = fillTemplate(selectedTemplate, variables);
        setGeneratedPrompt(prompt);
        setSelectedDuration(effectiveDuration);
        setIsGenerating(false);

        setHistory(prev => {
            const next = [prompt, ...prev.slice(0, 19)];
            localStorage.setItem('video_prompt_history', JSON.stringify(next));
            return next;
        });
    }

    async function handleSubmitVideo() {
        setSubmitError('');
        if (!apiKey) return setSubmitError(t('video.error.nokey'));
        if (!generatedPrompt.trim()) return setSubmitError(t('video.error.noprompt'));

        setIsSubmitting(true);
        try {
            await submitTask({
                prompt: generatedPrompt,
                model: selectedModel,
                lang,
                duration: clampVideoDuration(selectedDuration, selectedModel),
            }, apiKey);
        } finally {
            setIsSubmitting(false);
        }
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

            {/* Video Clip vs Overview tabs */}
            <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
                <button
                    type="button"
                    onClick={() => setVideoTab('clip')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${videoTab === 'clip'
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'text-white/40 hover:text-white/70'
                        }`}
                >
                    <Video className="w-4 h-4" />
                    {t('video.tab.clip')}
                </button>
                <button
                    type="button"
                    onClick={() => setVideoTab('overview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${videoTab === 'overview'
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'text-white/40 hover:text-white/70'
                        }`}
                >
                    <Film className="w-4 h-4" />
                    {t('video.tab.overview')}
                </button>
            </div>

            {videoTab === 'overview' ? (
                <OverviewPanel />
            ) : (
                <>
            {/* Credits — Clip tab */}
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

                    {/* Generate Prompt Button */}
                    <button
                        onClick={handleGeneratePrompt}
                        disabled={!description.trim() || isGenerating}
                        className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        {isGenerating ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" />{t('video.generating')}</>
                        ) : (
                            <><Sparkles className="w-4 h-4" />{t('video.generate')}</>
                        )}
                    </button>

                    {/* ── Video duration ── */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('video.duration.label')}
                            <span className="ml-2 text-white/30 normal-case font-normal">
                                {t('video.duration.max').replace('{max}', String(modelConfig.maxDuration))}
                            </span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {durationPresets.map(sec => (
                                <button
                                    key={sec}
                                    type="button"
                                    onClick={() => setSelectedDuration(sec)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedDuration === sec
                                        ? 'border-green-500/40 bg-green-500/10 text-green-400'
                                        : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                                        }`}
                                >
                                    {sec}s
                                </button>
                            ))}
                        </div>
                        {durationClamped && (
                            <p className="text-[11px] text-yellow-400/80 mt-2">
                                {t('video.duration.clamped')
                                    .replace('{requested}', String(selectedTemplate.durationSeconds))
                                    .replace('{max}', String(modelConfig.maxDuration))}
                            </p>
                        )}
                    </div>

                    {/* ── Video Model Selector ── */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('video.model.label')}
                        </label>
                        <div className="grid grid-cols-1 gap-1.5">
                            {VIDEO_MODELS.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        setSelectedModel(m.id);
                                        setSelectedDuration(prev => clampVideoDuration(prev, m.id));
                                    }}
                                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${selectedModel === m.id
                                            ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                                            : 'border-white/8 bg-white/3 text-white/50 hover:border-white/15'
                                        }`}
                                >
                                    <Video className="w-3.5 h-3.5 shrink-0" />
                                    <span className="flex-1 font-medium">{m.name}</span>
                                    {m.badge && (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                            m.badge === 'FREE' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>{m.badge}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Submit Video Button ── */}
                    {submitError && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            {submitError}
                        </p>
                    )}
                    <button
                        onClick={handleSubmitVideo}
                        disabled={isSubmitting || !generatedPrompt.trim()}
                        className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                            !apiKey
                                ? 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                        }`}
                    >
                        {isSubmitting ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" />{t('video.generate.btn.loading')}</>
                        ) : !apiKey ? (
                            <><Video className="w-4 h-4" />{t('video.generate.btn.nokey')}</>
                        ) : (
                            <><Video className="w-4 h-4" />{t('video.generate.btn')}</>
                        )}
                    </button>
                </div>

                {/* Right: Preview + Tasks */}
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
                            rows={10}
                            className="w-full px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-green-500/30 resize-none font-mono leading-relaxed transition-all"
                        />
                    </div>

                    {/* Prompt history */}
                    {history.length > 1 && (
                        <div>
                            <label className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-2 block">
                                {t('video.history')}
                            </label>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
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

                    {/* ── Video Tasks Panel ── */}
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-3 block">
                            {t('video.tasks.title')}
                        </label>

                        {!isLoaded || tasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-white/20">
                                <Video className="w-8 h-8 mb-2 opacity-30" />
                                <p className="text-xs">{t('video.tasks.empty')}</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                {tasks.map(task => (
                                    <div
                                        key={task.local_id}
                                        className={`rounded-xl border p-3 transition-all ${
                                            task.status === 'succeed'
                                                ? 'border-green-500/20 bg-green-500/5'
                                                : task.status === 'failed'
                                                ? 'border-red-500/20 bg-red-500/5'
                                                : 'border-white/8 bg-white/3'
                                        }`}
                                    >
                                        {/* Task header */}
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <StatusBadge status={task.status} t={t} />
                                            <span className="text-[10px] text-white/25">
                                                {new Date(task.created_at).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', {
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </span>
                                        </div>

                                        <p className="text-xs text-white/50 font-mono line-clamp-2 mb-2">
                                            {task.prompt.slice(0, 120)}...
                                        </p>
                                        <p className="text-[10px] text-white/25 mb-2">{task.model}</p>

                                        {/* Error */}
                                        {task.status === 'failed' && task.error && (
                                            <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 mb-2">
                                                {task.error}
                                            </p>
                                        )}

                                        {/* Video player */}
                                        {task.status === 'succeed' && task.video_url && (
                                            <div className="mb-2 rounded-lg overflow-hidden">
                                                <video
                                                    src={task.video_url}
                                                    controls
                                                    loop
                                                    className="w-full max-h-48 object-contain bg-black"
                                                />
                                            </div>
                                        )}

                                        {/* Action buttons */}
                                        <div className="flex gap-1.5">
                                            {task.status === 'succeed' && task.video_url && (
                                                <a
                                                    href={task.video_url}
                                                    download
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors"
                                                >
                                                    <Download className="w-3 h-3" />
                                                    {t('video.tasks.download')}
                                                </a>
                                            )}
                                            {task.status === 'failed' && (
                                                <button
                                                    onClick={() => retryTask(task.local_id, apiKey)}
                                                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 transition-colors"
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    {t('video.tasks.retry')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => removeTask(task.local_id)}
                                                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/30 hover:bg-white/10 hover:text-red-400 transition-colors ml-auto"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                {t('video.tasks.remove')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
                </>
            )}
        </div>
    );
}
