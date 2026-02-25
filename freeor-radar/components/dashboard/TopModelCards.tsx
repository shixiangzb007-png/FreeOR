import { FreeModel } from '@/types';
import { ExternalLink, Copy } from 'lucide-react';

interface TopModelCardsProps {
    models: FreeModel[];
}

export function TopModelCards({ models }: TopModelCardsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {models.map((model, i) => (
                <div key={model.id} className="card-glow rounded-xl p-4 relative group overflow-hidden">
                    {/* Rank badge */}
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white/30">#{i + 1}</span>
                    </div>

                    {/* Provider */}
                    <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1">
                        {model.provider || 'Unknown'}
                    </div>

                    {/* Model name */}
                    <div className="font-semibold text-sm text-white/90 leading-tight mb-3 pr-6 line-clamp-2">
                        {model.name}
                    </div>

                    {/* Stats */}
                    <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/30">上下文</span>
                            <span className="text-[11px] font-semibold text-white/70 font-mono">
                                {model.context ? `${Math.round(model.context / 1000)}K` : '—'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-white/30">能力</span>
                            <span className="text-[11px] text-white/50">
                                {(model.capabilities || []).slice(0, 2).join(', ') || 'text'}
                            </span>
                        </div>
                    </div>

                    {/* Free badge */}
                    <div className="badge-free mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        FREE
                    </div>

                    {/* Actions (hover) */}
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                            href={`https://openrouter.ai/models/${model.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-white/8 text-white/50 hover:text-white/80 text-[11px] transition-all"
                        >
                            <ExternalLink className="w-3 h-3" />
                            查看
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
