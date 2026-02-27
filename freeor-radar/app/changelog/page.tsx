import { createClient } from '@/lib/supabase/server';
import { ChangeLog } from '@/types';
import ChangelogView from './view';

function groupByDate(logs: ChangeLog[]): Record<string, ChangeLog[]> {
    return logs.reduce((acc, log) => {
        const date = new Date(log.created_at).toLocaleDateString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        if (!acc[date]) acc[date] = [];
        acc[date].push(log);
        return acc;
    }, {} as Record<string, ChangeLog[]>);
}

export const revalidate = 300;

export default async function ChangelogPage() {
    const supabase = await createClient();
    const { data } = await supabase
        .from('change_logs')
        .select('*, model:model_id(id, name, provider, context, capabilities)')
        .order('created_at', { ascending: false })
        .limit(100);

    const logs = (data as ChangeLog[]) || [];
    const grouped = groupByDate(logs);

    return <ChangelogView logs={logs} grouped={grouped} />;
}
