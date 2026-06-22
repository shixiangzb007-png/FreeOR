import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import {
    DbCharacterRow,
    extForMime,
    parseDataUrl,
    rowToCharacter,
} from '@/lib/video/characters-cloud';
import { CharacterContentType, CharacterImage, VideoCharacter } from '@/types/character';

const BUCKET = 'video-characters';
const MAX_CHARACTERS = 12;

function isMissingTable(err: { code?: string; message?: string }): boolean {
    return err.code === '42P01' || (err.message || '').includes('video_characters');
}

async function uploadImage(
    supabase: ReturnType<typeof createServiceClient>,
    clientId: string,
    characterId: string,
    img: CharacterImage
): Promise<CharacterImage> {
    if (img.url && img.storage_path) return img;

    const dataUrl = img.data_url;
    if (!dataUrl?.startsWith('data:image')) {
        if (img.url) return img;
        throw new Error('Image missing data');
    }

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw new Error('Invalid image data');

    const ext = extForMime(parsed.mime);
    const path = `${clientId}/${characterId}/${img.id}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, parsed.bytes, {
        contentType: parsed.mime,
        upsert: true,
    });
    if (error) throw new Error(error.message);

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return {
        id: img.id,
        label: img.label,
        storage_path: path,
        url: pub.publicUrl,
    };
}

async function deleteStorageObjects(
    supabase: ReturnType<typeof createServiceClient>,
    images: CharacterImage[]
): Promise<void> {
    const paths = images.map(i => i.storage_path).filter(Boolean) as string[];
    if (paths.length === 0) return;
    await supabase.storage.from(BUCKET).remove(paths);
}

/**
 * GET /api/video/characters?client_id=
 * POST /api/video/characters
 *   { client_id, action: 'upsert'|'delete'|'set_host', character?, character_id? }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const clientId = req.nextUrl.searchParams.get('client_id')?.trim();
    if (!clientId) {
        return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('video_characters')
            .select('*')
            .eq('client_id', clientId)
            .order('updated_at', { ascending: false })
            .limit(MAX_CHARACTERS);

        if (error) {
            if (isMissingTable(error)) return NextResponse.json({ characters: [], cloud: false });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const characters = ((data || []) as DbCharacterRow[]).map(rowToCharacter);
        return NextResponse.json({ characters, cloud: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    if (!rateLimit(`chars:${clientIp(req)}`, 20, 60_000)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let clientId = '';
    let action = '';
    let character: VideoCharacter | null = null;
    let characterId = '';

    try {
        const body = await req.json();
        clientId = (body.client_id || '').trim();
        action = (body.action || 'upsert').trim();
        characterId = (body.character_id || '').trim();
        if (body.character) character = body.character as VideoCharacter;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!clientId) {
        return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    try {
        if (action === 'delete') {
            const id = characterId || character?.id;
            if (!id) return NextResponse.json({ error: 'character_id required' }, { status: 400 });

            const { data: existing } = await supabase
                .from('video_characters')
                .select('images')
                .eq('client_id', clientId)
                .eq('id', id)
                .maybeSingle();

            if (existing?.images) {
                await deleteStorageObjects(supabase, existing.images as CharacterImage[]);
            }

            const { error } = await supabase
                .from('video_characters')
                .delete()
                .eq('client_id', clientId)
                .eq('id', id);

            if (error) {
                if (isMissingTable(error)) return NextResponse.json({ ok: true, cloud: false });
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }

        if (action === 'set_host') {
            const id = characterId || character?.id;
            if (!id) return NextResponse.json({ error: 'character_id required' }, { status: 400 });

            await supabase
                .from('video_characters')
                .update({ is_overview_host: false })
                .eq('client_id', clientId);

            const { data, error } = await supabase
                .from('video_characters')
                .update({ is_overview_host: true, updated_at: new Date().toISOString() })
                .eq('client_id', clientId)
                .eq('id', id)
                .select('*')
                .maybeSingle();

            if (error) {
                if (isMissingTable(error)) return NextResponse.json({ ok: true, cloud: false });
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({
                character: data ? rowToCharacter(data as DbCharacterRow) : null,
            });
        }

        // upsert
        if (!character?.name?.trim()) {
            return NextResponse.json({ error: 'character.name required' }, { status: 400 });
        }
        if (!character.images?.length) {
            return NextResponse.json({ error: 'character.images required' }, { status: 400 });
        }

        const id = character.id || crypto.randomUUID();
        const contentType: CharacterContentType =
            character.content_type === 'original_character' ? 'original_character' : 'illustration';

        const uploaded: CharacterImage[] = [];
        for (const img of character.images.slice(0, 3)) {
            uploaded.push(await uploadImage(supabase, clientId, id, img));
        }

        const { data: existingRow } = await supabase
            .from('video_characters')
            .select('id, created_at, images')
            .eq('id', id)
            .eq('client_id', clientId)
            .maybeSingle();

        const row = {
            id,
            client_id: clientId,
            name: character.name.trim().slice(0, 64),
            description: (character.description || '').slice(0, 500),
            images: uploaded,
            content_type: contentType,
            is_overview_host: !!character.is_overview_host,
            created_at: existingRow?.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        if (row.is_overview_host) {
            await supabase
                .from('video_characters')
                .update({ is_overview_host: false })
                .eq('client_id', clientId);
        }

        const { count } = await supabase
            .from('video_characters')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);

        if (!existingRow && (count || 0) >= MAX_CHARACTERS) {
            return NextResponse.json({ error: 'Character limit reached' }, { status: 400 });
        }

        // Remove stale storage files when images replaced
        if (existingRow?.images) {
            const oldPaths = (existingRow.images as CharacterImage[])
                .map(i => i.storage_path)
                .filter(Boolean) as string[];
            const newPaths = new Set(uploaded.map(i => i.storage_path).filter(Boolean));
            const toRemove = oldPaths.filter(p => !newPaths.has(p));
            if (toRemove.length) await supabase.storage.from(BUCKET).remove(toRemove);
        }

        const { data, error } = await supabase
            .from('video_characters')
            .upsert(row, { onConflict: 'id' })
            .select('*')
            .single();

        if (error) {
            if (isMissingTable(error)) {
                return NextResponse.json({ character: { ...character, id, synced: false }, cloud: false });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ character: rowToCharacter(data as DbCharacterRow), cloud: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
