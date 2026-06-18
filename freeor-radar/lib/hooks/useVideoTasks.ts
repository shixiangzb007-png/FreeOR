'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────

export interface VideoTask {
    local_id: string;
    model: string;
    prompt: string;
    status: 'pending' | 'processing' | 'succeed' | 'failed';
    video_url?: string;
    revised_prompt?: string;
    job_id?: string;
    polling_url?: string;
    lang?: string;
    duration?: number;
    created_at: string;
    error?: string;
}

export interface VideoGenerateRequest {
    prompt: string;
    model: string;
    lang?: string;
    /** Video length in seconds — passed to OpenRouter `duration` field */
    duration?: number;
}

// ── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'freeor_video_tasks';
const MAX_TASKS = 20;
const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_MS = 10 * 60_000;

// ── Helpers ───────────────────────────────────────────────────

function loadTasks(): VideoTask[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as VideoTask[]) : [];
    } catch {
        return [];
    }
}

function saveTasks(tasks: VideoTask[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, MAX_TASKS)));
    } catch {
        // ignore quota errors
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function readApiKeyFromSettings(): string {
    try {
        const raw = localStorage.getItem('freeor-settings');
        if (!raw) return '';
        return JSON.parse(raw).openrouter_key || '';
    } catch {
        return '';
    }
}

// ── Hook ──────────────────────────────────────────────────────

export function useVideoTasks() {
    const [tasks, setTasks] = useState<VideoTask[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const pollAbortRef = useRef<Map<string, boolean>>(new Map());

    const updateTask = useCallback((local_id: string, patch: Partial<VideoTask>) => {
        setTasks(prev => prev.map(t => (t.local_id === local_id ? { ...t, ...patch } : t)));
    }, []);

    const pollUntilDone = useCallback(async (
        local_id: string,
        polling_url: string,
        apiKey: string,
        lang?: string
    ) => {
        pollAbortRef.current.set(local_id, false);
        const deadline = Date.now() + POLL_MAX_MS;
        const zh = lang !== 'en';

        while (Date.now() < deadline) {
            if (pollAbortRef.current.get(local_id)) return;

            await sleep(POLL_INTERVAL_MS);
            if (pollAbortRef.current.get(local_id)) return;

            try {
                const res = await fetch('/api/video/poll', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({ polling_url, lang: lang || 'zh' }),
                });
                const data = await res.json();

                if (data.status === 'completed' && data.video_url) {
                    updateTask(local_id, { status: 'succeed', video_url: data.video_url });
                    return;
                }

                if (!res.ok) {
                    updateTask(local_id, { status: 'failed', error: data.error || 'Generation failed' });
                    return;
                }

                if (data.error) {
                    updateTask(local_id, { status: 'failed', error: data.error });
                    return;
                }

                updateTask(local_id, { status: 'processing' });
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Poll failed';
                updateTask(local_id, { status: 'failed', error: msg });
                return;
            }
        }

        updateTask(local_id, {
            status: 'failed',
            error: zh
                ? '视频生成超时（已等待 10 分钟），请在 OpenRouter 控制台查看任务状态。'
                : 'Video generation timed out after 10 minutes. Check OpenRouter dashboard.',
        });
    }, [updateTask]);

    const resumePoll = useCallback((
        local_id: string,
        polling_url: string,
        apiKey: string,
        lang?: string
    ) => {
        updateTask(local_id, { status: 'processing' });
        void pollUntilDone(local_id, polling_url, apiKey, lang);
    }, [pollUntilDone, updateTask]);

    useEffect(() => {
        setTasks(loadTasks());
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (isLoaded) saveTasks(tasks);
    }, [tasks, isLoaded]);

    // Resume in-progress tasks after page reload
    useEffect(() => {
        if (!isLoaded) return;
        const apiKey = readApiKeyFromSettings();
        if (!apiKey) return;

        const pending = loadTasks().filter(
            t => (t.status === 'pending' || t.status === 'processing') && t.polling_url
        );
        for (const task of pending) {
            resumePoll(task.local_id, task.polling_url!, apiKey, task.lang);
        }
    }, [isLoaded, resumePoll]);

    const submitTask = useCallback(async (
        req: VideoGenerateRequest,
        apiKey: string
    ): Promise<string> => {
        const local_id = crypto.randomUUID();
        const lang = req.lang || 'zh';

        const newTask: VideoTask = {
            local_id,
            model: req.model,
            prompt: req.prompt,
            status: 'pending',
            lang,
            created_at: new Date().toISOString(),
        };

        setTasks(prev => [newTask, ...prev.slice(0, MAX_TASKS - 1)]);

        try {
            const response = await fetch('/api/video/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    prompt: req.prompt,
                    model: req.model,
                    lang,
                    duration: req.duration,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Submit failed');
            }

            if (data.status === 'completed' && data.video_url) {
                updateTask(local_id, {
                    status: 'succeed',
                    video_url: data.video_url,
                    revised_prompt: data.revised_prompt,
                    job_id: data.job_id,
                });
                return local_id;
            }

            if (!data.polling_url) {
                throw new Error(data.error || 'No polling URL returned');
            }

            updateTask(local_id, {
                status: 'processing',
                polling_url: data.polling_url,
                job_id: data.job_id,
                lang,
                duration: req.duration,
            });

            void pollUntilDone(local_id, data.polling_url, apiKey, lang);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            updateTask(local_id, { status: 'failed', error: errorMsg });
        }

        return local_id;
    }, [pollUntilDone, updateTask]);

    const removeTask = useCallback((local_id: string) => {
        pollAbortRef.current.set(local_id, true);
        setTasks(prev => prev.filter(t => t.local_id !== local_id));
    }, []);

    const retryTask = useCallback((local_id: string, apiKey: string) => {
        const task = tasks.find(t => t.local_id === local_id);
        if (!task) return;
        setTasks(prev => prev.filter(t => t.local_id !== local_id));
        submitTask({ prompt: task.prompt, model: task.model, lang: task.lang, duration: task.duration }, apiKey);
    }, [tasks, submitTask]);

    return {
        tasks,
        isLoaded,
        submitTask,
        removeTask,
        retryTask,
    };
}
