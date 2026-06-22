'use client';

import { useEffect, useState } from 'react';
import {
    User, Upload, Trash2, Plus, Loader2, Sparkles, Film, Download, AlertCircle, Layers,
    Cloud, CloudOff, Mic2, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';
import { useCharacterClipJob } from '@/lib/hooks/useCharacterClipJob';
import { useCharacters, ANGLE_SLOTS } from '@/lib/hooks/useCharacters';
import { useCharacterFeedback } from '@/lib/hooks/useCharacterFeedback';
import {
    CharacterContentType,
    CharacterImage,
    CharacterImageLabel,
    VideoCharacter,
} from '@/types/character';
import { fileToCharacterImage } from '@/lib/video/characters-storage';
import { validateCharacterCompliance, complianceHint } from '@/lib/video/character-compliance';
import { imageRefUrl } from '@/lib/video/characters-cloud';
import {
    CHARACTER_VIDEO_MODELS,
    DEFAULT_CHARACTER_MODEL,
    MULTI_SEGMENT_TARGETS,
} from '@/lib/video/character-models';
import { clampVideoDuration, durationPresetsForModel } from '@/lib/video/models';
import { downloadVideoBlob } from '@/lib/video/clip/stitch-videos';

type ClipMode = 'single' | 'multi';

function imgSrc(img: CharacterImage): string {
    return imageRefUrl(img);
}

export function CharacterPanel() {
    const { t, lang } = useLang();
    const { job, reset, runSingleClip, runMultiClip } = useCharacterClipJob();
    const {
        characters,
        cloudEnabled,
        syncing,
        saveCharacter,
        removeCharacter,
        setOverviewHost,
    } = useCharacters();
    const { lastRating, stats, loadStats, submitFeedback } = useCharacterFeedback();

    const [selectedId, setSelectedId] = useState('');
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editImages, setEditImages] = useState<CharacterImage[]>([]);
    const [contentType, setContentType] = useState<CharacterContentType>('illustration');
    const [confirmedOriginal, setConfirmedOriginal] = useState(false);
    const [isOverviewHost, setIsOverviewHost] = useState(false);
    const [clipMode, setClipMode] = useState<ClipMode>('single');
    const [actionPrompt, setActionPrompt] = useState('');
    const [theme, setTheme] = useState('');
    const [targetDuration, setTargetDuration] = useState<number>(30);
    const [model, setModel] = useState(DEFAULT_CHARACTER_MODEL);
    const [duration, setDuration] = useState(10);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const selected = characters.find(c => c.id === selectedId);

    useEffect(() => {
        if (characters.length && !selectedId) setSelectedId(characters[0].id);
    }, [characters, selectedId]);

    useEffect(() => {
        if (selected) {
            setEditName(selected.name);
            setEditDesc(selected.description);
            setEditImages([...selected.images]);
            setContentType(selected.content_type || 'illustration');
            setIsOverviewHost(!!selected.is_overview_host);
            void loadStats(selected.id);
        }
    }, [selected?.id, selected?.updated_at, loadStats]);

    useEffect(() => {
        setDuration(clampVideoDuration(duration, model));
    }, [model, duration]);

    function imageForLabel(label: CharacterImageLabel): CharacterImage | undefined {
        return editImages.find(i => i.label === label);
    }

    async function handleAngleUpload(label: CharacterImageLabel, e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setError('');

        const compliance = validateCharacterCompliance({
            confirmedOriginal,
            contentType,
            fileName: file.name,
            lang,
        });
        if (!compliance.ok) {
            setError(t(compliance.errorKey));
            e.target.value = '';
            return;
        }

        try {
            const img = await fileToCharacterImage(file, label);
            setEditImages(prev => {
                const rest = prev.filter(i => i.label !== label);
                return [...rest, img].slice(0, 3);
            });
        } catch (err) {
            const code = err instanceof Error ? err.message : '';
            if (code === 'IMAGE_TOO_LARGE') setError(t('character.error.size'));
            else setError(t('character.error.upload'));
        }
        e.target.value = '';
    }

    async function handleSaveCharacter() {
        setError('');
        if (!editName.trim()) {
            setError(t('character.error.name'));
            return;
        }
        if (!imageForLabel('front')) {
            setError(t('character.error.front_required'));
            return;
        }
        if (!confirmedOriginal) {
            setError(t('character.compliance.confirm_required'));
            return;
        }

        const draft: VideoCharacter = {
            id: selected?.id || crypto.randomUUID(),
            name: editName,
            description: editDesc,
            images: editImages,
            content_type: contentType,
            is_overview_host: isOverviewHost,
            created_at: selected?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const saved = await saveCharacter(draft);
        setSelectedId(saved.id);
        if (isOverviewHost) await setOverviewHost(saved.id);
    }

    function handleNewCharacter() {
        setSelectedId('');
        setEditName('');
        setEditDesc('');
        setEditImages([]);
        setContentType('illustration');
        setConfirmedOriginal(false);
        setIsOverviewHost(false);
    }

    async function handleDeleteCharacter(id: string) {
        await removeCharacter(id);
        if (selectedId === id) handleNewCharacter();
    }

    async function handleGenerate() {
        setError('');
        if (!confirmedOriginal) {
            setError(t('character.compliance.confirm_required'));
            return;
        }

        let char = selected;
        if (!char || !imageForLabel('front')) {
            if (!editName.trim() || !imageForLabel('front')) {
                setError(t('character.error.save_first'));
                return;
            }
            char = await saveCharacter({
                id: selected?.id || crypto.randomUUID(),
                name: editName,
                description: editDesc,
                images: editImages,
                content_type: contentType,
                is_overview_host: isOverviewHost,
                created_at: selected?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            setSelectedId(char.id);
        }

        if (!char.images.length) {
            setError(t('character.error.image'));
            return;
        }

        setBusy(true);
        reset();
        try {
            if (clipMode === 'single') {
                if (!actionPrompt.trim()) {
                    setError(t('character.error.action'));
                    return;
                }
                await runSingleClip({
                    character: char,
                    actionPrompt,
                    model,
                    duration: clampVideoDuration(duration, model),
                    lang,
                });
            } else {
                if (!theme.trim()) {
                    setError(t('character.error.theme'));
                    return;
                }
                await runMultiClip({
                    character: char,
                    theme,
                    targetDurationSec: targetDuration,
                    model,
                    lang,
                });
            }
            void loadStats(char.id);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === 'NO_API_KEY') setError(t('video.error.nokey'));
            else setError(msg);
        } finally {
            setBusy(false);
        }
    }

    function handleDownloadFinal() {
        if (!job?.final_video_url) return;
        fetch(job.final_video_url)
            .then(r => r.blob())
            .then(blob => {
                const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
                const safe = (job.character_name || 'character').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 30);
                downloadVideoBlob(blob, `${safe}-clip.${ext}`);
            });
    }

    const durationPresets = durationPresetsForModel(model);
    const isJobBusy = busy || (job != null && !['done', 'failed'].includes(job.status));

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-purple-500/8 border border-purple-500/20 text-sm text-purple-200/80 space-y-2">
                <p>{t('character.disclaimer')}</p>
                <p className="text-[11px] text-purple-200/50">{complianceHint(contentType, lang)}</p>
            </div>

            <div className="flex items-center gap-2 text-xs text-white/40">
                {cloudEnabled ? (
                    <><Cloud className="w-3.5 h-3.5 text-green-400" />{t('character.cloud.on')}</>
                ) : (
                    <><CloudOff className="w-3.5 h-3.5" />{t('character.cloud.off')}</>
                )}
                {syncing && <span className="text-purple-400">{t('character.cloud.syncing')}</span>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50 font-semibold uppercase tracking-wider">
                            {t('character.library')}
                        </label>
                        <button type="button" onClick={handleNewCharacter} className="flex items-center gap-1 text-xs text-purple-400">
                            <Plus className="w-3.5 h-3.5" />{t('character.new')}
                        </button>
                    </div>

                    {characters.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {characters.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedId(c.id)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs ${selectedId === c.id
                                        ? 'border-purple-500/40 bg-purple-500/15 text-purple-300'
                                        : 'border-white/10 text-white/50'
                                        }`}
                                >
                                    {c.name}
                                    {c.is_overview_host && <Mic2 className="w-3 h-3 inline ml-1 text-green-400" />}
                                </button>
                            ))}
                        </div>
                    )}

                    <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        placeholder={t('character.name.placeholder')}
                        className="w-full h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
                    />
                    <textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        rows={2}
                        placeholder={t('character.appearance.placeholder')}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none"
                    />

                    <div>
                        <label className="text-xs text-white/50 mb-2 block">{t('character.content_type')}</label>
                        <select
                            value={contentType}
                            onChange={e => setContentType(e.target.value as CharacterContentType)}
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70"
                        >
                            <option value="illustration" className="bg-neutral-900">{t('character.type.illustration')}</option>
                            <option value="original_character" className="bg-neutral-900">{t('character.type.original')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs text-white/50 mb-2 block">{t('character.angles')}</label>
                        <div className="grid grid-cols-3 gap-2">
                            {ANGLE_SLOTS.map(slot => {
                                const img = imageForLabel(slot.label);
                                return (
                                    <div key={slot.label} className="space-y-1">
                                        <span className="text-[10px] text-white/40">
                                            {t(`character.angle.${slot.label}`)}
                                            {slot.required && ' *'}
                                        </span>
                                        <div className="relative aspect-square rounded-lg border border-white/10 overflow-hidden bg-white/5">
                                            {img ? (
                                                <>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={imgSrc(img)} alt="" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditImages(prev => prev.filter(i => i.label !== slot.label))}
                                                        className="absolute top-1 right-1 p-0.5 rounded bg-black/60"
                                                    >
                                                        <Trash2 className="w-3 h-3 text-white" />
                                                    </button>
                                                </>
                                            ) : (
                                                <label className="flex flex-col items-center justify-center h-full cursor-pointer text-white/30 hover:text-purple-400">
                                                    <Upload className="w-5 h-5" />
                                                    <input type="file" accept="image/*" className="hidden" onChange={e => handleAngleUpload(slot.label, e)} />
                                                </label>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <label className="flex items-start gap-2 text-xs text-white/50 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={confirmedOriginal}
                            onChange={e => setConfirmedOriginal(e.target.checked)}
                            className="mt-0.5"
                        />
                        {t('character.compliance.checkbox')}
                    </label>

                    <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isOverviewHost}
                            onChange={e => setIsOverviewHost(e.target.checked)}
                        />
                        <Mic2 className="w-3.5 h-3.5 text-green-400" />
                        {t('character.overview_host')}
                    </label>

                    {stats && selected && (
                        <p className="text-[10px] text-white/30">
                            {t('character.feedback.stats').replace('{score}', String(stats.score)).replace('{up}', String(stats.up)).replace('{down}', String(stats.down))}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button type="button" onClick={handleSaveCharacter} disabled={syncing} className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70">
                            {t('character.save')}
                        </button>
                        {selected && (
                            <button type="button" onClick={() => handleDeleteCharacter(selected.id)} className="px-3 h-10 rounded-lg border border-red-500/20 text-red-400">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2 p-1 rounded-lg bg-white/5 border border-white/10 w-fit">
                        <button type="button" onClick={() => setClipMode('single')} className={`px-3 py-1.5 rounded-md text-xs ${clipMode === 'single' ? 'bg-purple-500/20 text-purple-300' : 'text-white/40'}`}>
                            {t('character.mode.single')}
                        </button>
                        <button type="button" onClick={() => setClipMode('multi')} className={`px-3 py-1.5 rounded-md text-xs ${clipMode === 'multi' ? 'bg-purple-500/20 text-purple-300' : 'text-white/40'}`}>
                            {t('character.mode.multi')}
                        </button>
                    </div>

                    {clipMode === 'single' ? (
                        <textarea
                            value={actionPrompt}
                            onChange={e => setActionPrompt(e.target.value)}
                            rows={4}
                            placeholder={t('character.action.placeholder')}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none"
                        />
                    ) : (
                        <>
                            <textarea
                                value={theme}
                                onChange={e => setTheme(e.target.value)}
                                rows={4}
                                placeholder={t('character.theme.placeholder')}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white resize-none"
                            />
                            <div className="flex flex-wrap gap-2">
                                {MULTI_SEGMENT_TARGETS.map(sec => (
                                    <button key={sec} type="button" onClick={() => setTargetDuration(sec)} className={`px-3 py-1 rounded-lg text-xs border ${targetDuration === sec ? 'border-purple-500/40 text-purple-300' : 'border-white/10 text-white/40'}`}>
                                        {sec}s
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    {clipMode === 'single' && (
                        <div className="flex flex-wrap gap-2">
                            {durationPresetsForModel(model).map(sec => (
                                <button key={sec} type="button" onClick={() => setDuration(sec)} className={`px-3 py-1 rounded-lg text-xs border ${duration === sec ? 'border-purple-500/40 text-purple-300' : 'border-white/10 text-white/40'}`}>
                                    {sec}s
                                </button>
                            ))}
                        </div>
                    )}

                    <select value={model} onChange={e => setModel(e.target.value)} disabled={isJobBusy} className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70">
                        {CHARACTER_VIDEO_MODELS.map(m => (
                            <option key={m.id} value={m.id} className="bg-neutral-900">{m.name} (max {m.maxDuration}s)</option>
                        ))}
                    </select>

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    <button type="button" onClick={handleGenerate} disabled={isJobBusy} className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2">
                        {isJobBusy ? <><Loader2 className="w-4 h-4 animate-spin" />{t('character.generating')}</> : <><Sparkles className="w-4 h-4" />{t('character.generate')}</>}
                    </button>

                    {job && (
                        <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
                            <div className="flex justify-between text-sm"><span>{job.character_name}</span><span>{job.progress}%</span></div>
                            <div className="h-1.5 rounded-full bg-white/10"><div className="h-full bg-purple-500 transition-all" style={{ width: `${job.progress}%` }} /></div>
                            <p className="text-xs text-white/40">{t(`character.status.${job.status}`)}</p>
                            {job.status === 'done' && job.final_video_url && (
                                <>
                                    <video src={job.final_video_url} controls className="w-full rounded-lg bg-black max-h-48" />
                                    <button type="button" onClick={handleDownloadFinal} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 text-green-400 text-xs">
                                        <Download className="w-3.5 h-3.5" />{t('character.download')}
                                    </button>
                                    {selected && (
                                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                            <span className="text-[10px] text-white/40">{t('character.feedback.prompt')}</span>
                                            <button
                                                type="button"
                                                disabled={lastRating === 1}
                                                onClick={() => submitFeedback({ characterId: selected.id, jobId: job.id, mode: clipMode === 'multi' ? 'multi' : 'single', rating: 1 })}
                                                className={`p-1.5 rounded-lg ${lastRating === 1 ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/40'}`}
                                            >
                                                <ThumbsUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={lastRating === -1}
                                                onClick={() => submitFeedback({ characterId: selected.id, jobId: job.id, mode: clipMode === 'multi' ? 'multi' : 'single', rating: -1 })}
                                                className={`p-1.5 rounded-lg ${lastRating === -1 ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-white/40'}`}
                                            >
                                                <ThumbsDown className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {!job && (
                        <div className="flex flex-col items-center py-8 text-white/20 border border-dashed border-white/10 rounded-xl">
                            <Film className="w-8 h-8 mb-2 opacity-40" />
                            <p className="text-xs">{t('character.empty')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
