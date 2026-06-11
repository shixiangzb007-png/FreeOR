import { FreeModel, ModelDiff } from '@/types';

const TELEGRAM_BASE_URL = 'https://api.telegram.org/bot';

/**
 * Send Telegram notification about model changes
 */
export async function notifyTelegram(
    diff: ModelDiff,
    chatId: string
): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const messages = buildTelegramMessages(diff);

    for (const message of messages) {
        await fetch(`${TELEGRAM_BASE_URL}${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
            }),
        });
    }
}

function buildTelegramMessages(diff: ModelDiff): string[] {
    const messages: string[] = [];

    // New models (batch up to 5 per message)
    if (diff.added.length > 0) {
        const chunks = chunkArray(diff.added, 5);
        for (const chunk of chunks) {
            const lines = chunk.map(m => formatModelLine(m, '🆕'));
            messages.push(
                `*🆓 新增免费模型 ${escMd(`(${diff.added.length})`)}\n\n` +
                lines.join('\n') +
                `\n\n🔗 [FreeOR Radar](https://freeor\\.app)`
            );
        }
    }

    // Removed models
    if (diff.removed.length > 0) {
        const lines = diff.removed.map(m => formatModelLine(m, '❌'));
        messages.push(
            `*⚠️ 模型移出免费列表 ${escMd(`(${diff.removed.length})`)}\n\n` +
            lines.join('\n') +
            `\n\n🔗 [FreeOR Radar](https://freeor\\.app)`
        );
    }

    // Changed models (limit / spec changes)
    if (diff.changed.length > 0) {
        const lines = diff.changed.slice(0, 5).map(({ model, changes }) => {
            const fields = Object.keys(changes).join(', ');
            return `🔄 \`${escMd(model.name)}\`\n   🛠️ ${escMd(fields)}`;
        });
        const more = diff.changed.length > 5 ? `\n${escMd(`…以及另外 ${diff.changed.length - 5} 个`)}` : '';
        messages.push(
            `*🔄 模型限流/规格变更 ${escMd(`(${diff.changed.length})`)}\n\n` +
            lines.join('\n') + more +
            `\n\n🔗 [FreeOR Radar](https://freeor\\.app)`
        );
    }

    return messages;
}

function formatModelLine(model: FreeModel, emoji: string): string {
    const cap = model.capabilities.slice(0, 3).join('/') || 'text';
    const ctx = model.context ? `${Math.round(model.context / 1000)}K` : 'N/A';
    return `${emoji} \`${escMd(model.name)}\`\n   📦 ${escMd(model.provider || '')} \\| 📐 ${escMd(ctx)} \\| 🏷️ ${escMd(cap)}`;
}

/** Escape MarkdownV2 special characters */
function escMd(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
