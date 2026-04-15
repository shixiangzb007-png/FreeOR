'use client';

import { useState, useEffect, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────

export interface VideoTask {
    local_id: string;       // crypto.randomUUID()
    model: string;          // OpenRouter model ID
    prompt: string;         // Prompt submitted
    status: 'pending' | 'succeed' | 'failed';
    video_url?: string;     // Filled on success
    revised_prompt?: string;
    created_at: string;     // ISO string
    error?: string;         // Error message on failure
}

export interface VideoGenerateRequest {
    prompt: string;
    model: string;
    lang?: string;
}

// ── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = 'freeor_video_tasks';
const MAX_TASKS = 20;

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
        // Ignore storage quota errors
    }
}

// ── Hook ──────────────────────────────────────────────────────

export function useVideoTasks() {
    const [tasks, setTasks] = useState<VideoTask[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount (client only)
    useEffect(() => {
        setTasks(loadTasks());
        setIsLoaded(true);
    }, []);

    // Persist whenever tasks change (after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveTasks(tasks);
        }
    }, [tasks, isLoaded]);

    /**
     * Submit a new video generation task.
     * Returns the local_id of the new task.
     */
    const submitTask = useCallback(async (
        req: VideoGenerateRequest,
        apiKey: string
    ): Promise<string> => {
        const local_id = crypto.randomUUID();

        // Immediately write pending task to state
        const newTask: VideoTask = {
            local_id,
            model: req.model,
            prompt: req.prompt,
            status: 'pending',
            created_at: new Date().toISOString(),
        };

        setTasks(prev => [newTask, ...prev.slice(0, MAX_TASKS - 1)]);

        // Call the backend API
        try {
            const response = await fetch('/api/video/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    prompt: req.prompt,
                    model: req.model,
                    lang: req.lang || 'zh',
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.video_url) {
                throw new Error(data.error || 'Generation failed');
            }

            // Update task to succeed
            setTasks(prev => prev.map(t =>
                t.local_id === local_id
                    ? { ...t, status: 'succeed', video_url: data.video_url, revised_prompt: data.revised_prompt }
                    : t
            ));

        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';

            setTasks(prev => prev.map(t =>
                t.local_id === local_id
                    ? { ...t, status: 'failed', error: errorMsg }
                    : t
            ));
        }

        return local_id;
    }, []);

    /**
     * Remove a task by local_id
     */
    const removeTask = useCallback((local_id: string) => {
        setTasks(prev => prev.filter(t => t.local_id !== local_id));
    }, []);

    /**
     * Retry a failed task
     */
    const retryTask = useCallback((local_id: string, apiKey: string) => {
        const task = tasks.find(t => t.local_id === local_id);
        if (!task) return;

        // Remove old entry, submit new
        setTasks(prev => prev.filter(t => t.local_id !== local_id));
        submitTask({ prompt: task.prompt, model: task.model }, apiKey);
    }, [tasks, submitTask]);

    return {
        tasks,
        isLoaded,
        submitTask,
        removeTask,
        retryTask,
    };
}
