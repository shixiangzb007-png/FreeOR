import { ModelDiff } from '@/types';

/**
 * Send Discord Webhook notification about model changes
 */
export async function notifyDiscord(
    diff: ModelDiff,
    webhookUrl: string
): Promise<void> {
    if (!webhookUrl) return;

    const embeds = buildDiscordEmbeds(diff);
    if (embeds.length === 0) return;

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds }),
    });
}

function buildDiscordEmbeds(diff: ModelDiff) {
    const embeds = [];

    if (diff.added.length > 0) {
        embeds.push({
            title: `🆓 ${diff.added.length} 个新免费模型`,
            color: 0x22c55e, // green
            description: diff.added
                .slice(0, 10)
                .map(m => `**${m.name}** · ${m.provider || ''} · ${m.context ? `${Math.round(m.context / 1000)}K ctx` : ''} · \`${m.capabilities.join(', ') || 'text'}\``)
                .join('\n'),
            footer: { text: 'FreeOR Radar · freeor.app' },
            timestamp: new Date().toISOString(),
        });
    }

    if (diff.removed.length > 0) {
        embeds.push({
            title: `⚠️ ${diff.removed.length} 个模型移出免费列表`,
            color: 0xef4444, // red
            description: diff.removed
                .slice(0, 10)
                .map(m => `~~**${m.name}**~~ · ${m.provider || ''}`)
                .join('\n'),
            footer: { text: 'FreeOR Radar · freeor.app' },
            timestamp: new Date().toISOString(),
        });
    }

    return embeds.slice(0, 10); // Discord max 10 embeds per message
}
