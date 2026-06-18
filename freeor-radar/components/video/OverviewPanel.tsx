'use client';

import { useState } from 'react';
import { Film, Loader2, Download, FileJson, Sparkles, AlertCircle } from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';
import { useOverviewJob } from '@/lib/hooks/useOverviewJob';
import { OverviewFormat, OverviewVisualStyle } from '@/types/overview';
import { DEFAULT_IMAGE_MODEL, FORMAT_TARGETS, OVERVIEW_IMAGE_MODELS } from '@/lib/video/overview/config';

const STYLES: { value: OverviewVisualStyle; labelKey: string }[] = [
    { value: 'auto', labelKey: 'overview.style.auto' },
    { value: 'whiteboard', labelKey: 'overview.style.whiteboard' },
    { value: 'minimal', labelKey: 'overview.style.minimal' },
    { value: 'retro', labelKey: 'overview.style.retro' },
];

export function OverviewPanel() {
    const { t, lang } = useLang();
    const { job, runOverview, reset, downloadVideo, downloadStoryboard } = useOverviewJob();

    const [sourceText, setSourceText] = useState('');
    const [format, setFormat] = useState<OverviewFormat>('brief');
    const [visualStyle, setVisualStyle] = useState<OverviewVisualStyle>('whiteboard');
    const [imageModel, setImageModel] = useState(DEFAULT_IMAGE_MODEL);
    const [error, setError] = useState('');
    const [isRunning, setIsRunning] = useState(false);

    const target = FORMAT_TARGETS[format];
    const isBusy = isRunning || (job != null && !['done', 'failed'].includes(job.status));

    async function handleGenerate() {
        setError('');
        if (sourceText.trim().length < 20) {
            setError(t('overview.error.short'));
            return;
        }
        setIsRunning(true);
        reset();
        try {
            await runOverview({ sourceText, format, visualStyle, lang, imageModel });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'NO_API_KEY') {
                setError(t('video.error.nokey'));
            } else {
                setError(msg);
            }
        } finally {
            setIsRunning(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 text-sm text-blue-200/80 space-y-2">
                <p>{t('overview.disclaimer')}</p>
                <p className="text-[11px] text-blue-200/50">
                    <span className="font-semibold text-blue-200/70">{t('overview.tips.title')}：</span>
                    {t('overview.tips.text')}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('overview.source')}
                        </label>
                        <textarea
                            value={sourceText}
                            onChange={e => setSourceText(e.target.value)}
                            rows={12}
                            placeholder={t('overview.source.placeholder')}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/40 resize-none font-mono leading-relaxed"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('overview.format')}
                        </label>
                        <div className="flex gap-2">
                            {(['brief', 'explainer'] as OverviewFormat[]).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFormat(f)}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-all ${format === f
                                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                                        : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
                                        }`}
                                >
                                    {t(`overview.format.${f}`)}
                                    <span className="block text-[10px] opacity-60 mt-0.5">
                                        ~{Math.round(FORMAT_TARGETS[f].targetDurationSec / 60)} min · {FORMAT_TARGETS[f].sceneCount} {t('overview.scenes')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('overview.style')}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {STYLES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setVisualStyle(s.value)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${visualStyle === s.value
                                        ? 'border-green-500/40 bg-green-500/10 text-green-400'
                                        : 'border-white/10 bg-white/5 text-white/40'
                                        }`}
                                >
                                    {t(s.labelKey)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-2 block">
                            {t('overview.image_model')}
                        </label>
                        <select
                            value={imageModel}
                            onChange={e => setImageModel(e.target.value)}
                            disabled={isBusy}
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none cursor-pointer"
                        >
                            {OVERVIEW_IMAGE_MODELS.map(m => (
                                <option key={m.id} value={m.id} className="bg-neutral-900">
                                    {m.name} ({m.id.split('/').pop()})
                                </option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            {error}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isBusy}
                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        {isBusy ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />{t('overview.generating')}</>
                        ) : (
                            <><Sparkles className="w-4 h-4" />{t('overview.generate')}</>
                        )}
                    </button>
                </div>

                <div className="space-y-4">
                    <label className="text-xs text-white/50 font-semibold uppercase tracking-wider block">
                        {t('overview.preview')}
                    </label>

                    {!job && (
                        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-white/10 text-white/25">
                            <Film className="w-10 h-10 mb-3 opacity-40" />
                            <p className="text-sm">{t('overview.empty')}</p>
                        </div>
                    )}

                    {job && (
                        <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium text-white/80 truncate">
                                    {job.plan?.title || t('overview.planning')}
                                </span>
                                <span className="text-xs text-white/40">{job.progress}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${job.progress}%` }}
                                />
                            </div>
                            <p className="text-xs text-white/40">
                                {t(`overview.status.${job.status}`)}
                                {job.plan?.mode === 'llm' && ` · ${t('overview.mode.llm')}`}
                                {job.plan?.mode === 'rule' && ` · ${t('overview.mode.rule')}`}
                            </p>

                            {job.status === 'failed' && job.error && (
                                <p className="text-xs text-red-400">{job.error}</p>
                            )}

                            {job.plan && job.status !== 'composing' && job.status !== 'failed' && (
                                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                                    {job.plan.scenes.map(sc => (
                                        <div key={sc.index} className="flex gap-2 text-xs border border-white/5 rounded-lg p-2">
                                            {sc.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={sc.image_url} alt="" className="w-16 h-10 object-cover rounded shrink-0" />
                                            ) : (
                                                <div className="w-16 h-10 bg-white/5 rounded shrink-0 animate-pulse" />
                                            )}
                                            <div className="min-w-0">
                                                <span className="text-white/30">#{sc.index} · {sc.duration_sec}s</span>
                                                <p className="text-white/60 line-clamp-2">{sc.narration}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {job.status === 'done' && job.video_blob_url && (
                                <>
                                    <video
                                        src={job.video_blob_url}
                                        controls
                                        className="w-full rounded-lg bg-black max-h-64"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={downloadVideo}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 text-green-400 text-xs hover:bg-green-500/25"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {t('overview.download.video')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadStoryboard}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10"
                                        >
                                            <FileJson className="w-3.5 h-3.5" />
                                            {t('overview.download.storyboard')}
                                        </button>
                                    </div>
                                    {job.plan && (
                                        <p className="text-[11px] text-white/30">
                                            {t('overview.meta')
                                                .replace('{scenes}', String(job.plan.scenes.length))
                                                .replace('{duration}', String(job.plan.total_duration_sec))
                                                .replace('{mode}', job.plan.mode)}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
