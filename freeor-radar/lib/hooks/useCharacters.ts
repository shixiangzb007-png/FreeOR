'use client';

import { useState, useEffect, useCallback } from 'react';
import { getClientId } from '@/lib/client-id';
import { VideoCharacter, CharacterImageLabel } from '@/types/character';
import { loadCharacters, saveCharacters } from '@/lib/video/characters-storage';

export function useCharacters() {
    const [characters, setCharacters] = useState<VideoCharacter[]>([]);
    const [cloudEnabled, setCloudEnabled] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const refreshLocal = useCallback(() => {
        setCharacters(loadCharacters());
    }, []);

    useEffect(() => {
        refreshLocal();
        setIsLoaded(true);

        const cid = getClientId();
        if (!cid) return;

        fetch(`/api/video/characters?client_id=${encodeURIComponent(cid)}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (!data?.characters || !Array.isArray(data.characters)) return;
                setCloudEnabled(!!data.cloud);
                if (data.characters.length > 0) {
                    setCharacters(data.characters);
                    saveCharacters(data.characters);
                }
            })
            .catch(() => { /* offline: local only */ });
    }, [refreshLocal]);

    const saveCharacter = useCallback(async (character: VideoCharacter): Promise<VideoCharacter> => {
        const cid = getClientId();
        const local = loadCharacters();
        const idx = local.findIndex(c => c.id === character.id);
        const next = [...local];
        const toSave = { ...character, updated_at: new Date().toISOString() };
        if (idx >= 0) next[idx] = toSave;
        else next.unshift(toSave);
        saveCharacters(next);
        setCharacters(next);

        if (!cid) return toSave;

        setSyncing(true);
        try {
            const res = await fetch('/api/video/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: cid, action: 'upsert', character: toSave }),
            });
            const data = await res.json();
            if (res.ok && data.character) {
                const synced = data.character as VideoCharacter;
                const merged = next.map(c => (c.id === synced.id ? synced : c));
                saveCharacters(merged);
                setCharacters(merged);
                setCloudEnabled(!!data.cloud);
                return synced;
            }
        } catch {
            // keep local
        } finally {
            setSyncing(false);
        }
        return toSave;
    }, []);

    const removeCharacter = useCallback(async (id: string) => {
        const cid = getClientId();
        const next = loadCharacters().filter(c => c.id !== id);
        saveCharacters(next);
        setCharacters(next);

        if (!cid) return;
        try {
            await fetch('/api/video/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: cid, action: 'delete', character_id: id }),
            });
        } catch { /* ignore */ }
    }, []);

    const setOverviewHost = useCallback(async (id: string) => {
        const cid = getClientId();
        const next = loadCharacters().map(c => ({
            ...c,
            is_overview_host: c.id === id,
            updated_at: new Date().toISOString(),
        }));
        saveCharacters(next);
        setCharacters(next);

        if (!cid) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/video/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: cid, action: 'set_host', character_id: id }),
            });
            const data = await res.json();
            if (res.ok && data.character) {
                const host = data.character as VideoCharacter;
                const merged = next.map(c =>
                    c.id === host.id ? host : { ...c, is_overview_host: false }
                );
                saveCharacters(merged);
                setCharacters(merged);
            }
        } catch { /* ignore */ } finally {
            setSyncing(false);
        }
    }, []);

    const overviewHost = characters.find(c => c.is_overview_host) || null;

    return {
        characters,
        overviewHost,
        cloudEnabled,
        isLoaded,
        syncing,
        saveCharacter,
        removeCharacter,
        setOverviewHost,
        refreshLocal,
    };
}

export const ANGLE_SLOTS: { label: CharacterImageLabel; required: boolean }[] = [
    { label: 'front', required: true },
    { label: 'side', required: false },
    { label: 'full', required: false },
];
