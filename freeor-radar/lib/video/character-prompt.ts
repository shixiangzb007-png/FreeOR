import { VideoCharacter } from '@/types/character';
import { characterInputReferences } from './characters-cloud';

const CHARACTER_SUFFIX =
    'Keep the exact same person as the reference images: same face, hair, outfit, and art style. ' +
    'Do not change character identity. No extra limbs or duplicated hands.';

export function buildCharacterVideoPrompt(
    userActionPrompt: string,
    character: Pick<VideoCharacter, 'name' | 'description'>
): string {
    const desc = character.description.trim();
    const identity = desc
        ? `Character "${character.name}": ${desc}.`
        : `Character "${character.name}".`;

    return (
        `[Character reference images provided] ${identity} ${CHARACTER_SUFFIX} ` +
        `Scene action: ${userActionPrompt.trim()}`
    ).trim();
}

export function buildSegmentSystemHint(segmentIndex: number, totalSegments: number): string {
    if (totalSegments <= 1) return '';
    if (segmentIndex === 1) {
        return 'Opening shot of the sequence. Same character as references.';
    }
    if (segmentIndex === totalSegments) {
        return 'Final shot of the sequence. Continue narrative from previous segments. Same character.';
    }
    return `Middle shot ${segmentIndex}/${totalSegments}. Continue the story. Same character as references.`;
}

export function characterToInputReferences(
    images: { data_url?: string; url?: string }[]
): Array<{ type: 'image_url'; image_url: { url: string } }> {
    return characterInputReferences({ images: images.map((img, i) => ({
        id: String(i),
        ...img,
    })) });
}

export function buildHostVisualPrompt(basePrompt: string, character: { name: string; description: string }): string {
    const desc = character.description.trim();
    return (
        `Consistent host presenter "${character.name}"${desc ? `: ${desc}` : ''}. ` +
        `Same face, hair, outfit, and art style as reference images in every scene. ` +
        `${basePrompt}`
    ).trim();
}
