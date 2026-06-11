import { NextRequest, NextResponse } from 'next/server';
import { isValidDiscordWebhook, isValidTelegramChatId } from '@/lib/env';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * POST /api/subscriptions/test
 * Body: { channel: 'telegram' | 'discord', target: string, lang?: string }
 *
 * Sends a one-off test message so the user can verify their push channel
 * works immediately (instead of waiting for the next model change).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    // 防滥用：每 IP 每分钟最多 3 次测试
    if (!rateLimit(`subtest:${clientIp(req)}`, 3, 60_000)) {
        return NextResponse.json({ error: 'Too many requests, please retry later' }, { status: 429 });
    }

    let channel = '';
    let target = '';
    let lang = 'zh';
    try {
        const body = await req.json();
        channel = (body.channel || '').trim();
        target = (body.target || '').trim();
        if (body.lang) lang = body.lang;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const zh = lang === 'zh';
    const text = zh
        ? '✅ FreeOR Radar 测试消息：推送通道配置成功！当免费模型发生变更时，你会在这里收到通知。'
        : '✅ FreeOR Radar test message: your push channel is configured! You will receive notifications here when free models change.';

    try {
        if (channel === 'telegram') {
            if (!isValidTelegramChatId(target)) {
                return NextResponse.json({ error: zh ? 'Telegram Chat ID 格式无效' : 'Invalid Telegram Chat ID' }, { status: 400 });
            }
            const token = process.env.TELEGRAM_BOT_TOKEN;
            if (!token) {
                return NextResponse.json(
                    { error: zh ? '服务端未配置 TELEGRAM_BOT_TOKEN' : 'TELEGRAM_BOT_TOKEN is not configured on the server' },
                    { status: 503 }
                );
            }
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: target, text }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || data?.ok === false) {
                const desc = data?.description || `HTTP ${res.status}`;
                return NextResponse.json(
                    { error: zh ? `Telegram 发送失败：${desc}（请先与 Bot 建立对话）` : `Telegram send failed: ${desc} (start a chat with the bot first)` },
                    { status: 502 }
                );
            }
            return NextResponse.json({ ok: true });
        }

        if (channel === 'discord') {
            if (!isValidDiscordWebhook(target)) {
                return NextResponse.json({ error: zh ? 'Discord Webhook 格式无效' : 'Invalid Discord webhook URL' }, { status: 400 });
            }
            const res = await fetch(target, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
            });
            if (!res.ok) {
                return NextResponse.json(
                    { error: zh ? `Discord 发送失败：HTTP ${res.status}` : `Discord send failed: HTTP ${res.status}` },
                    { status: 502 }
                );
            }
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ error: 'channel must be "telegram" or "discord"' }, { status: 400 });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
