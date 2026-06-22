import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { CharacterFeedbackMode } from '@/types/character';

/**
 * POST /api/video/characters/feedback
 * Body: { client_id, character_id?, job_id?, mode, rating: 1|-1, comment? }
 *
 * GET /api/video/characters/feedback?character_id=
 *   → { up, down, score }
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const characterId = req.nextUrl.searchParams.get('character_id')?.trim();
    if (!characterId) {
        return NextResponse.json({ error: 'character_id is required' }, { status: 400 });
    }

    try {
        const supabase = createServiceClient();
        const { data, error } = await supabase
            .from('character_clip_feedback')
            .select('rating')
            .eq('character_id', characterId);

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ up: 0, down: 0, score: 0 });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const up = (data || []).filter(r => r.rating === 1).length;
        const down = (data || []).filter(r => r.rating === -1).length;
        const total = up + down;
        const score = total > 0 ? Math.round((up / total) * 100) : 0;

        return NextResponse.json({ character_id: characterId, up, down, score });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    if (!rateLimit(`charfb:${clientIp(req)}`, 30, 60_000)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let clientId = '';
    let characterId: string | null = null;
    let jobId: string | null = null;
    let mode: CharacterFeedbackMode = 'single';
    let rating = 0;
    let comment = '';

    try {
        const body = await req.json();
        clientId = (body.client_id || '').trim();
        characterId = body.character_id || null;
        jobId = body.job_id || null;
        if (body.mode) mode = body.mode;
        rating = Number(body.rating);
        comment = (body.comment || '').slice(0, 500);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!clientId || (rating !== 1 && rating !== -1)) {
        return NextResponse.json({ error: 'client_id and rating (1|-1) required' }, { status: 400 });
    }

    const validModes: CharacterFeedbackMode[] = ['single', 'multi', 'overview_host'];
    if (!validModes.includes(mode)) mode = 'single';

    try {
        const supabase = createServiceClient();
        const { error } = await supabase.from('character_clip_feedback').insert({
            client_id: clientId,
            character_id: characterId,
            job_id: jobId,
            mode,
            rating,
            comment: comment || null,
        });

        if (error) {
            if (error.code === '42P01') return NextResponse.json({ ok: true, cloud: false });
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
