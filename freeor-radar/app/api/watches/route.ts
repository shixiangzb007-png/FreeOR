import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * Model watch (favorites) API — anonymous, owned by browser client_id.
 * All reads/writes go through the service-role client; the table is RLS-locked.
 *
 * GET  /api/watches?client_id=<uuid>
 *   → { model_ids: string[] }
 *
 * POST /api/watches
 *   Body: { client_id, model_id, action: 'add' | 'remove' }
 */

const MAX_WATCHES_PER_CLIENT = 100;

export async function GET(req: NextRequest): Promise<NextResponse> {
    const clientId = req.nextUrl.searchParams.get('client_id')?.trim();
    if (!clientId) {
        return NextResponse.json({ error: 'client_id is required' }, { status: 400 });
    }

    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('model_watches')
            .select('model_id')
            .eq('client_id', clientId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ model_ids: (data || []).map(r => r.model_id) });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    // 防滥用：每 IP 每分钟最多 30 次切换
    if (!rateLimit(`watch:${clientIp(req)}`, 30, 60_000)) {
        return NextResponse.json({ error: 'Too many requests, please retry later' }, { status: 429 });
    }

    let clientId = '';
    let modelId = '';
    let action = '';
    try {
        const body = await req.json();
        clientId = (body.client_id || '').trim();
        modelId = (body.model_id || '').trim();
        action = (body.action || '').trim();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!clientId || !modelId || (action !== 'add' && action !== 'remove')) {
        return NextResponse.json(
            { error: 'client_id, model_id and action ("add" | "remove") are required' },
            { status: 400 }
        );
    }

    try {
        const supabase = createServiceClient();

        if (action === 'remove') {
            const { error } = await supabase
                .from('model_watches')
                .delete()
                .eq('client_id', clientId)
                .eq('model_id', modelId);
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ ok: true });
        }

        // action === 'add' — enforce per-client cap
        const { count, error: countError } = await supabase
            .from('model_watches')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);
        if (countError) {
            return NextResponse.json({ error: countError.message }, { status: 500 });
        }
        if ((count ?? 0) >= MAX_WATCHES_PER_CLIENT) {
            return NextResponse.json(
                { error: `Watch limit reached (max ${MAX_WATCHES_PER_CLIENT})` },
                { status: 422 }
            );
        }

        const { error } = await supabase
            .from('model_watches')
            .upsert(
                { client_id: clientId, model_id: modelId },
                { onConflict: 'client_id,model_id', ignoreDuplicates: true }
            );
        if (error) {
            // FK violation = unknown model id
            const status = error.code === '23503' ? 404 : 500;
            return NextResponse.json({ error: error.message }, { status });
        }
        return NextResponse.json({ ok: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
