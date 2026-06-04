import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isValidDiscordWebhook, isValidTelegramChatId } from '@/lib/env';

/**
 * Notification subscriptions API (no-auth / anonymous).
 *
 * Subscriptions are owned by a browser-generated `client_id` (UUID stored in
 * localStorage). All reads/writes go through the service-role client so the
 * `notification_subscriptions` table can stay locked down by RLS.
 *
 * GET  /api/subscriptions?client_id=<uuid>
 *   → { telegram: string, discord: string, event_types: string[] }
 *
 * POST /api/subscriptions
 *   Body: { client_id, telegram?, discord?, event_types?: string[] }
 *   Replaces all rows for this client_id with the provided active channels.
 */

const VALID_EVENT_TYPES = ['new', 'removed', 'limit_change'];

function normalizeEventTypes(input: unknown): string[] {
    if (!Array.isArray(input)) return ['new', 'removed'];
    const filtered = input.filter((e): e is string => typeof e === 'string' && VALID_EVENT_TYPES.includes(e));
    return filtered.length > 0 ? Array.from(new Set(filtered)) : ['new', 'removed'];
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    const clientId = req.nextUrl.searchParams.get('client_id')?.trim();
    if (!clientId) {
        return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('notification_subscriptions')
            .select('channel, target, event_types, is_active')
            .eq('client_id', clientId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const rows = data || [];
        const telegram = rows.find(r => r.channel === 'telegram');
        const discord = rows.find(r => r.channel === 'discord');
        // event_types are stored per-row; surface the union (they're saved identically).
        const eventTypes = telegram?.event_types || discord?.event_types || ['new', 'removed'];

        return NextResponse.json({
            telegram: telegram?.is_active ? (telegram.target || '') : '',
            discord: discord?.is_active ? (discord.target || '') : '',
            event_types: eventTypes,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    let clientId = '';
    let telegram = '';
    let discord = '';
    let eventTypes: string[] = ['new', 'removed'];

    try {
        const body = await req.json();
        clientId = (body.client_id || '').trim();
        telegram = (body.telegram || '').trim();
        discord = (body.discord || '').trim();
        eventTypes = normalizeEventTypes(body.event_types);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!clientId) {
        return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    // ── Validate channel targets (defense against bad/abusive input) ──
    if (telegram && !isValidTelegramChatId(telegram)) {
        return NextResponse.json(
            { error: 'INVALID_TELEGRAM', message: 'Telegram Chat ID must be a numeric id (e.g. -1001234567890)' },
            { status: 400 }
        );
    }
    if (discord && !isValidDiscordWebhook(discord)) {
        return NextResponse.json(
            { error: 'INVALID_DISCORD', message: 'Discord webhook must look like https://discord.com/api/webhooks/<id>/<token>' },
            { status: 400 }
        );
    }

    try {
        const supabase = createServiceClient();

        // Replace strategy: drop existing rows for this client, then insert active ones.
        const { error: delError } = await supabase
            .from('notification_subscriptions')
            .delete()
            .eq('client_id', clientId);
        if (delError) {
            return NextResponse.json({ error: delError.message }, { status: 500 });
        }

        const rows: Array<{ client_id: string; channel: string; target: string; event_types: string[]; is_active: boolean }> = [];
        if (telegram) rows.push({ client_id: clientId, channel: 'telegram', target: telegram, event_types: eventTypes, is_active: true });
        if (discord) rows.push({ client_id: clientId, channel: 'discord', target: discord, event_types: eventTypes, is_active: true });

        if (rows.length > 0) {
            const { error: insError } = await supabase
                .from('notification_subscriptions')
                .insert(rows);
            if (insError) {
                return NextResponse.json({ error: insError.message }, { status: 500 });
            }
        }

        return NextResponse.json({ ok: true, saved: rows.length });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
