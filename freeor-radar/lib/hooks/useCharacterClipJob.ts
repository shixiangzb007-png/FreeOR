'use client';

import { useState, useCallback } from 'react';
import { CharacterClipJob, CharacterClipPlan, CharacterClipSegment, VideoCharacter } from '@/types/character';
import { buildCharacterVideoPrompt, characterToInputReferences } from '@/lib/video/character-prompt';
import { submitAndPollVideo } from '@/lib/video/clip/submit-and-poll';
import { stitchVideoUrls } from '@/lib/video/clip/stitch-videos';
import { clampVideoDuration } from '@/lib/video/models';
import { DEFAULT_CHARACTER_MODEL } from '@/lib/video/character-models';

function readApiKey(): string {
    try {
        const raw = localStorage.getItem('freeor-settings');
        if (!raw) return '';
        return JSON.parse(raw).openrouter_key || '';
    } catch {
        return '';
    }
}

export function useCharacterClipJob() {
    const [job, setJob] = useState<CharacterClipJob | null>(null);

    const reset = useCallback(() => {
        setJob(prev => {
            if (prev?.final_video_url?.startsWith('blob:')) {
                URL.revokeObjectURL(prev.final_video_url);
            }
            return null;
        });
    }, []);

    /** P5-M1: single segment with character references */
    const runSingleClip = useCallback(async (opts: {
        character: VideoCharacter;
        actionPrompt: string;
        model: string;
        duration: number;
        lang: string;
    }) => {
        const apiKey = readApiKey();
        if (!apiKey) throw new Error('NO_API_KEY');
        if (!opts.character.images.length) throw new Error('NO_CHARACTER_IMAGES');

        const id = crypto.randomUUID();
        const refs = characterToInputReferences(opts.character.images);
        const prompt = buildCharacterVideoPrompt(opts.actionPrompt, opts.character);
        const duration = clampVideoDuration(opts.duration, opts.model);

        setJob({
            id,
            character_id: opts.character.id,
            character_name: opts.character.name,
            status: 'generating',
            progress: 10,
            progress_label: 'generating',
            created_at: new Date().toISOString(),
        });

        try {
            const videoUrl = await submitAndPollVideo(
                { prompt, model: opts.model, duration, lang: opts.lang, input_references: refs },
                apiKey,
                () => setJob(prev => prev ? { ...prev, progress: 50 } : null)
            );

            setJob(prev => prev ? {
                ...prev,
                status: 'done',
                progress: 100,
                progress_label: 'done',
                final_video_url: videoUrl,
                plan: {
                    target_duration_sec: duration,
                    model: opts.model,
                    mode: 'rule',
                    segments: [{ index: 1, prompt, duration_sec: duration, video_url: videoUrl, status: 'done' }],
                },
            } : null);

            return videoUrl;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setJob(prev => prev ? { ...prev, status: 'failed', error: msg } : null);
            throw err;
        }
    }, []);

    /** P5-M2: multi-segment plan + generate + stitch */
    const runMultiClip = useCallback(async (opts: {
        character: VideoCharacter;
        theme: string;
        targetDurationSec: number;
        model: string;
        lang: string;
    }) => {
        const apiKey = readApiKey();
        if (!apiKey) throw new Error('NO_API_KEY');
        if (!opts.character.images.length) throw new Error('NO_CHARACTER_IMAGES');

        const id = crypto.randomUUID();
        const refs = characterToInputReferences(opts.character.images);

        setJob({
            id,
            character_id: opts.character.id,
            character_name: opts.character.name,
            status: 'planning',
            progress: 5,
            progress_label: 'planning',
            created_at: new Date().toISOString(),
        });

        try {
            const planRes = await fetch('/api/video/clip/plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    theme: opts.theme,
                    target_duration_sec: opts.targetDurationSec,
                    model: opts.model,
                    character_name: opts.character.name,
                    character_description: opts.character.description,
                    lang: opts.lang,
                }),
            });
            const planData = await planRes.json();
            if (!planRes.ok) throw new Error(planData.error || 'Plan failed');

            const plan = planData.plan as CharacterClipPlan;
            const segments: CharacterClipSegment[] = plan.segments.map(s => ({ ...s, status: 'pending' as const }));

            setJob(prev => prev ? {
                ...prev,
                status: 'generating',
                progress: 15,
                progress_label: 'generating',
                plan: { ...plan, segments },
            } : null);

            const videoUrls: string[] = [];

            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                segments[i] = { ...seg, status: 'processing' };
                setJob(prev => prev ? {
                    ...prev,
                    plan: { ...plan, segments: [...segments] },
                    progress: 15 + Math.round((i / segments.length) * 55),
                } : null);

                try {
                    const url = await submitAndPollVideo(
                        {
                            prompt: seg.prompt,
                            model: plan.model,
                            duration: seg.duration_sec,
                            lang: opts.lang,
                            input_references: refs,
                        },
                        apiKey
                    );
                    videoUrls.push(url);
                    segments[i] = { ...seg, status: 'done', video_url: url };
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    segments[i] = { ...seg, status: 'failed', error: msg };
                    throw new Error(`Segment ${i + 1}: ${msg}`);
                }

                setJob(prev => prev ? {
                    ...prev,
                    plan: { ...plan, segments: [...segments] },
                } : null);
            }

            setJob(prev => prev ? {
                ...prev,
                status: 'stitching',
                progress: 75,
                progress_label: 'stitching',
                plan: { ...plan, segments },
            } : null);

            const blob = await stitchVideoUrls(videoUrls, pct =>
                setJob(prev => prev ? { ...prev, progress: 75 + Math.round(pct * 0.22) } : null)
            );
            const final_video_url = URL.createObjectURL(blob);

            setJob(prev => prev ? {
                ...prev,
                status: 'done',
                progress: 100,
                progress_label: 'done',
                final_video_url,
                plan: { ...plan, segments },
            } : null);

            return final_video_url;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setJob(prev => prev ? { ...prev, status: 'failed', error: msg } : null);
            throw err;
        }
    }, []);

    return {
        job,
        reset,
        runSingleClip,
        runMultiClip,
        defaultModel: DEFAULT_CHARACTER_MODEL,
    };
}
