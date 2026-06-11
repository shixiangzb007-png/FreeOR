'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientId } from '@/lib/client-id';

const CACHE_KEY = 'freeor-watches';

function loadCache(): string[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

function saveCache(ids: string[]): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(ids));
    } catch {
        // ignore quota errors
    }
}

/**
 * 模型关注（收藏）hook。
 * - localStorage 缓存保证首屏即时渲染
 * - 云端（model_watches，client_id 归属）为事实来源，挂载时回读覆盖
 * - 切换为乐观更新，失败回滚
 */
export function useWatches() {
    const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        setWatchedIds(new Set(loadCache()));
        setIsLoaded(true);

        const cid = getClientId();
        if (!cid) return;
        fetch(`/api/watches?client_id=${encodeURIComponent(cid)}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (data && Array.isArray(data.model_ids)) {
                    setWatchedIds(new Set(data.model_ids));
                    saveCache(data.model_ids);
                }
            })
            .catch(() => { /* 离线时沿用本地缓存 */ });
    }, []);

    const toggleWatch = useCallback(async (modelId: string) => {
        const cid = getClientId();
        if (!cid) return;

        let action: 'add' | 'remove' = 'add';

        // 乐观更新
        setWatchedIds(prev => {
            const next = new Set(prev);
            if (next.has(modelId)) {
                next.delete(modelId);
                action = 'remove';
            } else {
                next.add(modelId);
                action = 'add';
            }
            saveCache(Array.from(next));
            return next;
        });

        try {
            const res = await fetch('/api/watches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: cid, model_id: modelId, action }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch {
            // 失败回滚
            setWatchedIds(prev => {
                const next = new Set(prev);
                if (action === 'add') next.delete(modelId);
                else next.add(modelId);
                saveCache(Array.from(next));
                return next;
            });
        }
    }, []);

    return { watchedIds, isLoaded, toggleWatch };
}
