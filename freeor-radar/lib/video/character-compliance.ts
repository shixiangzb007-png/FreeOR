import { CharacterContentType } from '@/types/character';

const BLOCKED_NAME_PATTERNS = [
    /selfie/i,
    /护照|身份证|id[\s_-]?card/i,
    /celebrity|名人/i,
];

export interface ComplianceInput {
    confirmedOriginal: boolean;
    contentType: CharacterContentType;
    fileName?: string;
    lang?: string;
}

export function validateCharacterCompliance(input: ComplianceInput): { ok: true } | { ok: false; errorKey: string } {
    const zh = input.lang !== 'en';

    if (!input.confirmedOriginal) {
        return { ok: false, errorKey: 'character.compliance.confirm_required' };
    }

    if (input.fileName) {
        for (const pat of BLOCKED_NAME_PATTERNS) {
            if (pat.test(input.fileName)) {
                return { ok: false, errorKey: 'character.compliance.blocked_name' };
            }
        }
    }

    if (!['illustration', 'original_character'].includes(input.contentType)) {
        return { ok: false, errorKey: 'character.compliance.invalid_type' };
    }

    return { ok: true };
}

export function complianceHint(contentType: CharacterContentType, lang: string): string {
    const zh = lang !== 'en';
    if (contentType === 'illustration') {
        return zh
            ? '仅限原创插画、3D 渲染或虚拟角色，禁止上传真人/名人照片。'
            : 'Original illustration, 3D renders, or fictional characters only—no real-person photos.';
    }
    return zh
        ? '原创虚拟角色设定；您确认对该形象拥有使用权，且非未经授权的真人 likeness。'
        : 'Original fictional character art only; you confirm usage rights and no unauthorized real-person likeness.';
}
