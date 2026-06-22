'use client';

import { useCallback, useState } from 'react';
import { getClientId } from '@/lib/client-id';
import { CharacterFeedbackMode } from '@/types/character';

export function useCharacterFeedback() {
    const [submitting, setSubmitting] = useState(false);
    const [lastRating, setLastRating] = useState<number | null>(null);
    const [stats, setStats] = useState<{ up: number; down: number; score: number } | null>(null);

    const loadStats = useCallback(async (characterId: string) => {
        try {
            const res = await fetch(
                `/api/video/characters/feedback?character_id=${encodeURIComponent(characterId)}`
            );
            if (!res.ok) return;
            const data = await res.json();
            setStats({ up: data.up, down: data.down, score: data.score });
        } catch { /* ignore */ }
    }, []);

    const submitFeedback = useCallback(async (opts: {
        characterId: string;
        jobId: string;
        mode: CharacterFeedbackMode;
        rating: 1 | -1;
        comment?: string;
    }) => {
        const clientId = getClientId();
        if (!clientId) return;

        setSubmitting(true);
        try {
            await fetch('/api/video/characters/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    character_id: opts.characterId,
                    job_id: opts.jobId,
                    mode: opts.mode,
                    rating: opts.rating,
                    comment: opts.comment,
                }),
            });
            setLastRating(opts.rating);
            await loadStats(opts.characterId);
        } finally {
            setSubmitting(false);
        }
    }, [loadStats]);

    return { submitting, lastRating, stats, loadStats, submitFeedback };
}
