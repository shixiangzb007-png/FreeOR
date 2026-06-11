import { ModelDiff } from '@/types';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidDiscordWebhook, isValidTelegramChatId } from '@/lib/env';
import { syncLog } from '@/lib/openrouter/sync-logger';

/**
 * 定向提醒：当用户「关注」的模型发生变化（下线 / 恢复 / 限流变更）时，
 * 通过该用户已配置的 Telegram / Discord 渠道发送专属消息。
 *
 * 数据链路：model_watches（关注关系）× notification_subscriptions（推送渠道），
 * 两者都以匿名 client_id 归属。
 */

interface WatchAlertItem {
    name: string;
    kind: 'removed' | 'restored' | 'changed';
}

const KIND_LABEL: Record<WatchAlertItem['kind'], string> = {
    removed: '❌ 已移出免费列表',
    restored: '✅ 恢复免费',
    changed: '🔄 限流/规格变更',
};

/**
 * @returns 实际发送的提醒条数
 */
export async function notifyWatchers(
    supabase: SupabaseClient,
    diff: ModelDiff
): Promise<number> {
    // ── 1. 收集受影响模型（新模型不可能被关注，added 命中即为 restored）──
    const affected = new Map<string, WatchAlertItem>();
    for (const m of diff.removed) affected.set(m.id, { name: m.name, kind: 'removed' });
    for (const { model } of diff.changed) affected.set(model.id, { name: model.name, kind: 'changed' });
    for (const m of diff.added) affected.set(m.id, { name: m.name, kind: 'restored' });

    if (affected.size === 0) return 0;

    // ── 2. 找到关注这些模型的 client ─────────────────────────────
    const { data: watches, error: watchError } = await supabase
        .from('model_watches')
        .select('client_id, model_id')
        .in('model_id', Array.from(affected.keys()));

    if (watchError) {
        syncLog('warn', `Watch alerts: failed to load watches: ${watchError.message}`);
        return 0;
    }
    if (!watches || watches.length === 0) return 0;

    const byClient = new Map<string, WatchAlertItem[]>();
    for (const w of watches) {
        const item = affected.get(w.model_id);
        if (!item) continue;
        const list = byClient.get(w.client_id) || [];
        list.push(item);
        byClient.set(w.client_id, list);
    }
    if (byClient.size === 0) return 0;

    // ── 3. 取这些 client 的推送渠道 ──────────────────────────────
    const { data: subs, error: subError } = await supabase
        .from('notification_subscriptions')
        .select('client_id, channel, target')
        .eq('is_active', true)
        .in('client_id', Array.from(byClient.keys()));

    if (subError) {
        syncLog('warn', `Watch alerts: failed to load subscriptions: ${subError.message}`);
        return 0;
    }
    if (!subs || subs.length === 0) {
        syncLog('info', `Watch alerts: ${byClient.size} watcher(s) affected but none has a push channel configured`);
        return 0;
    }

    // ── 4. 逐用户发送定向消息 ────────────────────────────────────
    const tasks: Promise<void>[] = [];
    for (const sub of subs) {
        const items = byClient.get(sub.client_id);
        if (!items || items.length === 0) continue;

        const text = buildAlertText(items);
        if (sub.channel === 'telegram' && isValidTelegramChatId(sub.target)) {
            tasks.push(
                sendTelegramPlain(sub.target, text)
                    .catch(e => syncLog('error', `Watch alert Telegram failed: ${e.message}`))
            );
        } else if (sub.channel === 'discord' && isValidDiscordWebhook(sub.target)) {
            tasks.push(
                sendDiscordAlert(sub.target, items)
                    .catch(e => syncLog('error', `Watch alert Discord failed: ${e.message}`))
            );
        }
    }

    if (tasks.length > 0) {
        await Promise.allSettled(tasks);
        syncLog('info', `Watch alerts: dispatched ${tasks.length} targeted notification(s)`);
    }
    return tasks.length;
}

function buildAlertText(items: WatchAlertItem[]): string {
    const lines = items.slice(0, 10).map(i => `${KIND_LABEL[i.kind]}: ${i.name}`);
    const more = items.length > 10 ? `\n…以及另外 ${items.length - 10} 个` : '';
    return `⭐ 你关注的模型有变化：\n\n${lines.join('\n')}${more}\n\n🔗 https://freeor.app`;
}

/** 纯文本发送（不用 MarkdownV2，避免模型名中的特殊字符转义问题） */
async function sendTelegramPlain(chatId: string, text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
}

async function sendDiscordAlert(webhookUrl: string, items: WatchAlertItem[]): Promise<void> {
    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            embeds: [{
                title: `⭐ 你关注的 ${items.length} 个模型有变化`,
                color: 0xf59e0b, // amber
                description: items
                    .slice(0, 10)
                    .map(i => `${KIND_LABEL[i.kind]}: **${i.name}**`)
                    .join('\n'),
                footer: { text: 'FreeOR Radar · freeor.app' },
                timestamp: new Date().toISOString(),
            }],
        }),
    });
}
