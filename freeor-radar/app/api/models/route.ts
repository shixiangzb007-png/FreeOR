import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/models
 * Returns list of free models from Supabase
 * Falls back to OpenRouter if DB is empty
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const capability = searchParams.get('capability');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'last_updated';
    const order = searchParams.get('order') === 'asc' ? true : false;

    const supabase = await createClient();

    let query = supabase
        .from('free_models')
        .select('*')
        .eq('is_free', true)
        .order(sortBy, { ascending: order });

    if (capability) {
        query = query.contains('capabilities', [capability]);
    }

    if (search) {
        query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query.limit(200);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ models: data, total: data?.length ?? 0 });
}
