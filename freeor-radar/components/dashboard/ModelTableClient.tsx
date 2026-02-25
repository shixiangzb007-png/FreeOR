'use client';

import { useState, useMemo } from 'react';
import { FreeModel } from '@/types';
import { Eye, Wrench, Code, Copy, ExternalLink, Download, Video, Gauge } from 'lucide-react';

const CAPABILITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    vision: { label: 'Vision', icon: <Eye className="w-3 h-3" />, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    tool: { label: 'Tool', icon: <Wrench className="w-3 h-3" />, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
    coding: { label: 'Code', icon: <Code className="w-3 h-3" />, color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
};

const ALL_CAPABILITIES = ['vision', 'tool', 'coding'];

interface ModelTableClientProps {
    models: FreeModel[];
    initialSearch?: string;
}

/** 从 pricing / per_request_limits 派生限流级别 */
function getRateLimit(model: FreeModel): { label: string; color: string; hint: string } {
    const id = model.id.toLowerCase();
    // 已知高限流模型（启发式，基于 OpenRouter 的实际表现）
    if (id.includes('gemini') || id.includes('gemma')) {
        return { label: '较高', color: 'text-green-400', hint: 'Google 系模型，限流较宽松' };
    }
    if (id.includes('llama-3.1-8b') || id.includes('llama-3.2')) {
        return { label: '标准', color: 'text-yellow-400', hint: 'Meta Llama 小模型，标准限流' };
    }
    if (id.includes('deepseek') || id.includes('r1')) {
        return { label: '较低', color: 'text-orange-400', hint: 'DeepSeek，高峰期限流较严' };
    }
    if (id.includes('70b') || id.includes('72b') || id.includes('405b')) {
        return { label: '较低', color: 'text-red-400', hint: '大参数模型，免费层限流较严' };
    }
    if (id.includes('openrouter') || id.includes('free-models')) {
        return { label: '综合', color: 'text-blue-400', hint: 'OpenRouter 聚合路由' };
    }
    return { label: '标准', color: 'text-white/40', hint: '标准速率限制' };
}

export function ModelTableClient({ models, initialSearch = '' }: ModelTableClientProps) {
    const [search, setSearch] = useState(initialSearch);
    const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
    const [videoOnly, setVideoOnly] = useState(false);
    const [sortBy, setSortBy] = useState<'context' | 'last_updated'>('last_updated');
    const [sortAsc, setSortAsc] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    const toggleCapability = (cap: string) => {
        setSelectedCaps(prev =>
            prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap]
        );
    };

    const filtered = useMemo(() => {
        return models
            .filter(m => {
                const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
                    (m.provider || '').toLowerCase().includes(search.toLowerCase());
                const matchCaps = selectedCaps.length === 0 ||
                    selectedCaps.every(c => m.capabilities?.includes(c));
                const matchVideo = !videoOnly || m.is_video_supported;
                return matchSearch && matchCaps && matchVideo;
            })
            .sort((a, b) => {
                const aVal = sortBy === 'context' ? (a.context || 0) : new Date(a.last_updated).getTime();
                const bVal = sortBy === 'context' ? (b.context || 0) : new Date(b.last_updated).getTime();
                return sortAsc ? aVal - bVal : bVal - aVal;
            });
    }, [models, search, selectedCaps, videoOnly, sortBy, sortAsc]);

    function copyId(id: string) {
        navigator.clipboard.writeText(id);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    }

    function exportCsv() {
        const header = 'ID,Name,Provider,Context,Capabilities,VideoSupported,RateLimit,Last Updated';
        const rows = filtered.map(m => {
            const rl = getRateLimit(m);
            return `"${m.id}","${m.name}","${m.provider || ''}","${m.context || ''}","${(m.capabilities || []).join('|')}","${m.is_video_supported}","${rl.label}","${m.last_updated}"`;
        });
        const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `freeor-models-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索模型或提供商..."
                    className="flex-1 min-w-[200px] h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-green-500/40"
                />

                <div className="flex gap-2 flex-wrap">
                    {ALL_CAPABILITIES.map(cap => {
                        const cfg = CAPABILITY_CONFIG[cap];
                        const isSelected = selectedCaps.includes(cap);
                        return (
                            <button
                                key={cap}
                                onClick={() => toggleCapability(cap)}
                                className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-medium transition-all ${isSelected
                                    ? cfg.color + ' border-opacity-100'
                                    : 'text-white/40 bg-white/5 border-white/10 hover:border-white/20'
                                    }`}
                            >
                                {cfg.icon}
                                {cfg.label}
                            </button>
                        );
                    })}

                    {/* Video filter */}
                    <button
                        onClick={() => setVideoOnly(!videoOnly)}
                        className={`flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-medium transition-all ${videoOnly
                            ? 'text-purple-400 bg-purple-400/10 border-purple-400/30'
                            : 'text-white/40 bg-white/5 border-white/10 hover:border-white/20'
                            }`}
                    >
                        <Video className="w-3 h-3" />
                        Video
                    </button>
                </div>

                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as 'context' | 'last_updated')}
                    className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none cursor-pointer"
                >
                    <option value="last_updated">最新更新</option>
                    <option value="context">上下文长度</option>
                </select>

                <button
                    onClick={exportCsv}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
                >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                </button>

                <span className="text-xs text-white/30">{filtered.length} 个</span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/8 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/3">
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">模型名称</th>
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">提供商</th>
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold cursor-pointer hover:text-white/60"
                                    onClick={() => { setSortBy('context'); setSortAsc(!sortAsc); }}>
                                    上下文 {sortBy === 'context' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">能力</th>
                                {/* P0: 新增限流提示列 */}
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold">
                                    <span className="flex items-center gap-1">
                                        <Gauge className="w-3 h-3" />
                                        限流
                                    </span>
                                </th>
                                <th className="text-left px-4 py-3 text-xs text-white/40 font-semibold cursor-pointer hover:text-white/60"
                                    onClick={() => { setSortBy('last_updated'); setSortAsc(!sortAsc); }}>
                                    更新时间 {sortBy === 'last_updated' ? (sortAsc ? '↑' : '↓') : ''}
                                </th>
                                <th className="text-right px-4 py-3 text-xs text-white/40 font-semibold">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((model, i) => {
                                const rl = getRateLimit(model);
                                return (
                                    <tr
                                        key={model.id}
                                        className={`border-b border-white/4 hover:bg-white/3 transition-colors group ${i % 2 === 0 ? '' : 'bg-white/1'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="font-medium text-white/90 text-sm leading-tight flex items-center gap-1.5">
                                                        {model.name}
                                                        {model.is_video_supported && (
                                                            <span title="支持视频生成" className="inline-flex">
                                                                <Video className="w-3 h-3 text-purple-400 flex-shrink-0" />
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-white/30 font-mono mt-0.5">
                                                        {model.id.split('/').pop()}
                                                    </div>
                                                </div>
                                                <span className="badge-free opacity-0 group-hover:opacity-100 transition-opacity">:free</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-white/60">{model.provider || '—'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-white/70 font-mono">
                                                {model.context ? `${Math.round(model.context / 1000)}K` : '—'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1 flex-wrap">
                                                {(model.capabilities || []).slice(0, 3).map(cap => {
                                                    const cfg = CAPABILITY_CONFIG[cap];
                                                    return cfg ? (
                                                        <span
                                                            key={cap}
                                                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${cfg.color}`}
                                                        >
                                                            {cfg.icon}
                                                            {cfg.label}
                                                        </span>
                                                    ) : (
                                                        <span key={cap} className="cap-tag">{cap}</span>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                        {/* P0: 限流提示列 */}
                                        <td className="px-4 py-3">
                                            <span
                                                className={`text-xs font-medium cursor-help ${rl.color}`}
                                                title={rl.hint}
                                            >
                                                {rl.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs text-white/30">
                                                {new Date(model.last_updated).toLocaleDateString('zh-CN')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => copyId(model.id)}
                                                    title="复制模型 ID"
                                                    className="p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-green-400 transition-all"
                                                >
                                                    {copied === model.id
                                                        ? <span className="text-[10px] text-green-400 font-medium">✓</span>
                                                        : <Copy className="w-3.5 h-3.5" />
                                                    }
                                                </button>
                                                <a
                                                    href={`https://openrouter.ai/models/${model.id}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="在 OpenRouter 查看"
                                                    className="p-1.5 rounded-md hover:bg-white/10 text-white/30 hover:text-white/70 transition-all"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-white/30 text-sm">
                                        没有找到匹配的模型
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
