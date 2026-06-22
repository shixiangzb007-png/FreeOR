'use client';

import { useState, useCallback } from 'react';
import {
    OverviewFormat,
    OverviewJob,
    OverviewPlan,
    OverviewVisualStyle,
} from '@/types/overview';
import { composeOverviewVideo, downloadBlob, exportPlanJson } from '@/lib/video/overview/compose-video';
import { DEFAULT_IMAGE_MODEL } from '@/lib/video/overview/config';
import { VideoCharacter } from '@/types/character';
import { imageRefUrl } from '@/lib/video/characters-cloud';

function readApiKey(): string {
    try {
        const raw = localStorage.getItem('freeor-settings');
        if (!raw) return '';
        return JSON.parse(raw).openrouter_key || '';
    } catch {
        return '';
    }
}

export function useOverviewJob() {
    const [job, setJob] = useState<OverviewJob | null>(null);

    const patch = useCallback((p: Partial<OverviewJob>) => {
        setJob(prev => (prev ? { ...prev, ...p } : null));
    }, []);

    const runOverview = useCallback(async (opts: {
        sourceText: string;
        format: OverviewFormat;
        visualStyle: OverviewVisualStyle;
        lang: string;
        imageModel?: string;
        hostCharacter?: VideoCharacter | null;
    }) => {
        const apiKey = readApiKey();
        if (!apiKey) throw new Error('NO_API_KEY');

        const id = crypto.randomUUID();
        setJob({
            id,
            status: 'planning',
            progress: 5,
            progress_label: 'planning',
            created_at: new Date().toISOString(),
        });

        try {
            const planRes = await fetch('/api/video/overview/plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    source_text: opts.sourceText,
                    format: opts.format,
                    visual_style: opts.visualStyle,
                    lang: opts.lang,
                }),
            });
            const planData = await planRes.json();
            if (!planRes.ok) throw new Error(planData.error || 'Plan failed');

            const plan = planData.plan as OverviewPlan;
            setJob(prev => prev ? {
                ...prev,
                status: 'generating_images',
                progress: 15,
                progress_label: 'images',
                plan,
            } : null);

            const imageModel = opts.imageModel || DEFAULT_IMAGE_MODEL;
            const scenes = [...plan.scenes];
            const referenceUrls = opts.hostCharacter?.images
                ?.map(imageRefUrl)
                .filter(Boolean)
                .slice(0, 3) ?? [];

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const imgRes = await fetch('/api/video/overview/image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        prompt: scene.visual_prompt,
                        narration: scene.narration,
                        visual_style: opts.visualStyle,
                        model: imageModel,
                        lang: opts.lang,
                        reference_urls: referenceUrls.length > 0 ? referenceUrls : undefined,
                        host_name: opts.hostCharacter?.name,
                        host_description: opts.hostCharacter?.description,
                    }),
                });
                const imgData = await imgRes.json();
                if (!imgRes.ok) throw new Error(imgData.error || `Scene ${i + 1} image failed`);

                scenes[i] = { ...scene, image_url: imgData.image_url };
                const pct = 15 + Math.round(((i + 1) / scenes.length) * 55);
                setJob(prev => prev ? {
                    ...prev,
                    progress: pct,
                    plan: { ...plan, scenes: [...scenes] },
                } : null);
            }

            const finalPlan = { ...plan, scenes };
            setJob(prev => prev ? {
                ...prev,
                status: 'composing',
                progress: 75,
                progress_label: 'composing',
                plan: finalPlan,
            } : null);

            const blob = await composeOverviewVideo(
                finalPlan.scenes,
                finalPlan.title,
                opts.lang,
                pct => setJob(prev => prev ? { ...prev, progress: 75 + Math.round(pct * 0.24) } : null)
            );

            const video_blob_url = URL.createObjectURL(blob);
            setJob(prev => prev ? {
                ...prev,
                status: 'done',
                progress: 100,
                progress_label: 'done',
                plan: finalPlan,
                video_blob_url,
            } : null);

            return { plan: finalPlan, blob, video_blob_url };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setJob(prev => prev ? { ...prev, status: 'failed', error: msg } : null);
            throw err;
        }
    }, []);

    const reset = useCallback(() => {
        setJob(prev => {
            if (prev?.video_blob_url) URL.revokeObjectURL(prev.video_blob_url);
            return null;
        });
    }, []);

    const downloadVideo = useCallback(() => {
        if (!job?.video_blob_url) return;
        fetch(job.video_blob_url)
            .then(r => r.blob())
            .then(blob => {
                const safe = (job.plan?.title || 'overview').replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 40);
                downloadBlob(blob, `${safe}-overview.webm`);
            });
    }, [job]);

    const downloadStoryboard = useCallback(() => {
        if (!job?.plan) return;
        const safe = job.plan.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 40);
        exportPlanJson(job.plan, `${safe}-storyboard.json`);
    }, [job]);

    return { job, runOverview, reset, downloadVideo, downloadStoryboard, patch };
}
