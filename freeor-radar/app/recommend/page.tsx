'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Send, Copy, ExternalLink, AlertTriangle, Zap, Bot } from 'lucide-react';
import { FreeModel, RecommendResult } from '@/types';
import { useLang } from '@/lib/i18n/lang-context';

const STORAGE_KEY = 'freeor-settings';

const EXAMPLE_TASKS_ZH = [
    '我需要一个支持长文档摘要（100K+ tokens）的免费模型',
    '帮我找一个可以分析图片内容的免费视觉模型',
    '我要做代码 review，需要一个强代码能力的免费模型',
    '我需要一个支持中文的免费聊天模型',
];

const EXAMPLE_TASKS_EN = [
    'I need a free model that supports long document summarization (100K+ tokens)',
    'Find me a free vision model that can analyze image content',
    'I need to do code review, looking for a free model with strong coding ability',
    'I need a free chat model with good Chinese language support',
];

type ResultWithMode = RecommendResult & { mode?: 'llm' | 'rule' };

export default function RecommendPage() {
    const { t, lang } = useLang();
    const [task, setTask] = useState('');
    const [result, setResult] = useState<ResultWithMode | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [apiKey, setApiKey] = useState('');

    // 从 localStorage 读取已保存的 OpenRouter Key
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const settings = JSON.parse(raw);
                if (settings.openrouter_key) setApiKey(settings.openrouter_key);
            }
        } catch {
            // ignore
        }
    }, []);

    const exampleTasks = lang === 'zh' ? EXAMPLE_TASKS_ZH : EXAMPLE_TASKS_EN;
    const hasKey = apiKey.length > 0;

    async function handleAnalyze() {
        if (!task.trim()) return;
        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch('/api/recommend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task,
                    ...(hasKey ? { apiKey } : {}),
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data);
            } else {
                setError(data.error || 'Unknown error');
            }
        } catch {
            setError(lang === 'zh' ? '网络错误，请稍后重试' : 'Network error, please try again');
        } finally {
            setIsAnalyzing(false);
        }
    }

    function copy(text: string, key: string) {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">{t('recommend.title')}</h1>
                <p className="text-sm text-white/40 mt-1">{t('recommend.subtitle')}</p>
            </div>

            {/* Mode indicator */}
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm w-fit ${hasKey
                    ? 'bg-green-500/8 border-green-500/20 text-green-400'
                    : 'bg-white/4 border-white/10 text-white/40'
                }`}>
                {hasKey
                    ? <><Bot className="w-4 h-4" />🤖 {lang === 'zh' ? 'AI 分析模式（LLM 推荐）' : 'AI Mode (LLM Recommend)'}</>
                    : <><Zap className="w-4 h-4" />⚡ {lang === 'zh' ? '规则引擎模式' : 'Rule Engine Mode'} · <a href="/settings" className="underline hover:text-white/60 transition-colors">{lang === 'zh' ? '设置 API Key 启用 AI 推荐 →' : 'Set API Key to enable AI →'}</a></>
                }
            </div>

            {/* Input area */}
            <div className="card-glow rounded-2xl p-6 space-y-4">
                <textarea
                    value={task}
                    onChange={e => setTask(e.target.value)}
                    placeholder={t('recommend.placeholder')}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-green-500/40 resize-none"
                />

                {/* Example tasks */}
                <div className="space-y-2">
                    <p className="text-xs text-white/30 font-medium">{t('recommend.quick')}</p>
                    <div className="flex flex-wrap gap-2">
                        {exampleTasks.map(example => (
                            <button
                                key={example}
                                onClick={() => setTask(example)}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all text-left"
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400">{error}</p>
                        {error.includes('同步') || error.includes('sync') ? (
                            <p className="text-xs text-white/30 mt-1">
                                {lang === 'zh' ? '提示：先运行 node scripts/sync-now.mjs 填充数据' : 'Tip: Run node scripts/sync-now.mjs first to populate data'}
                            </p>
                        ) : null}
                    </div>
                )}

                <button
                    onClick={handleAnalyze}
                    disabled={!task.trim() || isAnalyzing}
                    className="flex items-center gap-2 h-11 px-6 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 text-black font-bold text-sm transition-all"
                >
                    {isAnalyzing ? <Sparkles className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isAnalyzing ? t('recommend.analyzing') : t('recommend.analyze')}
                </button>
            </div>

            {/* Results */}
            {result && (
                <div className="space-y-4">
                    {/* Mode badge on result */}
                    {result.mode && (
                        <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full w-fit ${result.mode === 'llm'
                                ? 'bg-green-500/12 text-green-400 border border-green-500/20'
                                : 'bg-white/6 text-white/40 border border-white/10'
                            }`}>
                            {result.mode === 'llm'
                                ? (<><Bot className="w-3 h-3" /> {lang === 'zh' ? 'AI 推荐结果' : 'AI Recommendation'}</>)
                                : (<><Zap className="w-3 h-3" /> {lang === 'zh' ? '规则引擎结果' : 'Rule Engine Result'}</>)
                            }
                        </div>
                    )}

                    {/* Best model */}
                    <div className="card-glow rounded-2xl p-6 border-green-500/20">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="badge-free">{t('recommend.best')}</span>
                                </div>
                                <h3 className="text-lg font-bold text-white">{result.best_model.name}</h3>
                                <p className="text-sm text-white/50 mt-1">{result.best_model.provider}</p>
                                <p className="text-sm text-white/70 mt-3">{result.reason}</p>
                            </div>
                            <a
                                href={`https://openrouter.ai/models/${result.best_model.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {t('recommend.view')}
                            </a>
                        </div>

                        {/* Risk warnings */}
                        {result.risk_warnings.length > 0 && (
                            <div className="mt-4 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                                    <span className="text-xs text-yellow-400 font-semibold">{t('recommend.risks')}</span>
                                </div>
                                <ul className="space-y-1">
                                    {result.risk_warnings.map((w, i) => (
                                        <li key={i} className="text-xs text-yellow-300/70">• {w}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Wrapper code */}
                    <div className="card-glow rounded-2xl p-6">
                        <h4 className="text-sm font-semibold text-white/80 mb-4">{t('recommend.code')}</h4>
                        <div className="space-y-3">
                            {Object.entries(result.wrapper_code).map(([lang, code]) => (
                                <div key={lang}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-white/40 font-medium uppercase">{lang}</span>
                                        <button
                                            onClick={() => copy(code, lang)}
                                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 font-medium"
                                        >
                                            <Copy className="w-3 h-3" />
                                            {copied === lang ? t('video.copied') : t('video.copy')}
                                        </button>
                                    </div>
                                    <pre className="text-xs text-white/60 bg-white/3 border border-white/8 rounded-lg p-3 overflow-x-auto font-mono">
                                        {code}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alternatives */}
                    <div className="card-glow rounded-2xl p-6">
                        <h4 className="text-sm font-semibold text-white/80 mb-4">{t('recommend.alts')}</h4>
                        <div className="space-y-2">
                            {result.alternatives.map((m: FreeModel, i: number) => (
                                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/7">
                                    <span className="text-xs text-white/30 font-bold w-4">#{i + 1}</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-white/80">{m.name}</div>
                                        <div className="text-xs text-white/30">{m.provider} · {m.context ? `${Math.round(m.context / 1000)}K ctx` : ''}</div>
                                    </div>
                                    <a
                                        href={`https://openrouter.ai/models/${m.id}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-white/30 hover:text-white/60 transition-colors"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
