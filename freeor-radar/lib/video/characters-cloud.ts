import { CharacterImage, CharacterContentType, VideoCharacter } from '@/types/character';

export interface DbCharacterRow {
    id: string;
    client_id: string;
    name: string;
    description: string | null;
    images: CharacterImage[] | null;
    content_type: CharacterContentType;
    is_overview_host: boolean;
    created_at: string;
    updated_at: string;
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl.trim());
    if (!m) return null;
    try {
        return { mime: m[1], bytes: Buffer.from(m[2], 'base64') };
    } catch {
        return null;
    }
}

export function extForMime(mime: string): string {
    if (mime.includes('png')) return 'png';
    if (mime.includes('webp')) return 'webp';
    return 'jpg';
}

export function rowToCharacter(row: DbCharacterRow): VideoCharacter {
    const images = (row.images || []).map(img => ({
        id: img.id,
        label: img.label,
        url: img.url,
        storage_path: img.storage_path,
        data_url: img.data_url,
    }));
    return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        images,
        content_type: row.content_type,
        is_overview_host: row.is_overview_host,
        created_at: row.created_at,
        updated_at: row.updated_at,
        synced: true,
    };
}

export function imageRefUrl(img: CharacterImage): string {
    return img.url || img.data_url || '';
}

export function characterInputReferences(
    character: Pick<VideoCharacter, 'images'>
): Array<{ type: 'image_url'; image_url: { url: string } }> {
    return character.images
        .map(img => imageRefUrl(img))
        .filter(Boolean)
        .slice(0, 3)
        .map(url => ({ type: 'image_url' as const, image_url: { url } }));
}
