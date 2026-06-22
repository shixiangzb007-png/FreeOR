import { CharacterImage, VideoCharacter } from '@/types/character';

const STORAGE_KEY = 'freeor_video_characters';
const MAX_CHARACTERS = 12;
const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function loadCharacters(): VideoCharacter[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as VideoCharacter[]) : [];
    } catch {
        return [];
    }
}

export function saveCharacters(chars: VideoCharacter[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chars.slice(0, MAX_CHARACTERS)));
    } catch {
        // quota exceeded
    }
}

export function getCharacter(id: string): VideoCharacter | undefined {
    return loadCharacters().find(c => c.id === id);
}

export function upsertCharacter(input: {
    id?: string;
    name: string;
    description: string;
    images: CharacterImage[];
}): VideoCharacter {
    const now = new Date().toISOString();
    const chars = loadCharacters();
    const existing = input.id ? chars.find(c => c.id === input.id) : undefined;

    const character: VideoCharacter = {
        id: existing?.id ?? crypto.randomUUID(),
        name: input.name.trim().slice(0, 64) || 'Character',
        description: input.description.trim().slice(0, 500),
        images: input.images.slice(0, MAX_IMAGES),
        created_at: existing?.created_at ?? now,
        updated_at: now,
    };

    const next = existing
        ? chars.map(c => (c.id === character.id ? character : c))
        : [character, ...chars];

    saveCharacters(next);
    return character;
}

export function deleteCharacter(id: string): void {
    saveCharacters(loadCharacters().filter(c => c.id !== id));
}

export async function fileToCharacterImage(
    file: File,
    label: CharacterImage['label'] = 'front'
): Promise<CharacterImage> {
    if (!file.type.startsWith('image/')) {
        throw new Error('INVALID_IMAGE');
    }
    if (file.size > MAX_IMAGE_BYTES) {
        throw new Error('IMAGE_TOO_LARGE');
    }

    const data_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('READ_FAILED'));
        reader.readAsDataURL(file);
    });

    return {
        id: crypto.randomUUID(),
        data_url,
        label,
    };
}
