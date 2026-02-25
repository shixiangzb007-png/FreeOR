import { createClient } from '@/lib/supabase/server';
import { ChangeLog } from '@/types';

const CHANGE_TYPE_CONFIG = {
    new: { label: '新增', color: 'text-green-400 bg-green-400/10 border-green-400/20', dot: 'bg-green-400' },
    removed: { label: '下线', color: 'text-red-400 bg-red-400/10 border-red-400/20', dot: 'bg-red-400' },
    limit_change: { label: '变更', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', dot: 'bg-yellow-400' },
    restored: { label: '恢复', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', dot: 'bg-blue-400' },
};

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

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">📋 变更日志</h1>
                <p className="text-sm text-white/40 mt-1">OpenRouter 免费模型变更历史</p>
            </div>

            {logs.length === 0 ? (
                <div className="card-glow rounded-2xl p-12 text-center">
                    <p className="text-white/30 text-sm">暂无变更记录，等待 Cron 首次运行后将自动填充数据</p>
                    <p className="text-white/20 text-xs mt-2">手动触发: POST /api/cron</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {Object.entries(grouped).map(([date, dayLogs]) => (
                        <div key={date}>
                            {/* Date header */}
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-sm font-semibold text-white/60">{date}</span>
                                <div className="flex-1 h-px bg-white/5" />
                                <span className="text-xs text-white/30">{dayLogs.length} 条</span>
                            </div>

                            {/* Timeline */}
                            <div className="relative pl-6 space-y-4">
                                {/* Timeline line */}
                                <div className="absolute left-2 top-0 bottom-0 w-px bg-white/8" />

                                {dayLogs.map(log => {
                                    const cfg = CHANGE_TYPE_CONFIG[log.change_type] || CHANGE_TYPE_CONFIG.limit_change;
                                    const model = log.model;

                                    return (
                                        <div key={log.id} className="relative">
                                            {/* Timeline dot */}
                                            <div className={`absolute -left-4 top-4 w-2 h-2 rounded-full ${cfg.dot}`} />

                                            <div className="card-glow rounded-xl p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1.5">
                                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
                                                                {cfg.label}
                                                            </span>
                                                            {model && (
                                                                <span className="text-sm font-semibold text-white/90">{model.name}</span>
                                                            )}
                                                        </div>
                                                        {log.description && (
                                                            <p className="text-xs text-white/40 mt-1">{log.description}</p>
                                                        )}
                                                        {model && (
                                                            <div className="flex gap-3 mt-2 text-xs text-white/30">
                                                                {model.provider && <span>📦 {model.provider}</span>}
                                                                {model.context && <span>📐 {Math.round(model.context / 1000)}K ctx</span>}
                                                                {model.capabilities?.length > 0 && (
                                                                    <span>🏷️ {model.capabilities.slice(0, 2).join(', ')}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <time className="text-xs text-white/25 flex-shrink-0">
                                                        {new Date(log.created_at).toLocaleTimeString('zh-CN', {
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </time>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
