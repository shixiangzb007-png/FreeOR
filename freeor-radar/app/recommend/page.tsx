'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Send, Copy, ExternalLink, AlertTriangle, Zap, Bot, RefreshCw, FlaskConical } from 'lucide-react';
import { FreeModel, RecommendResult } from '@/types';
import { useLang } from '@/lib/i18n/lang-context';

const STORAGE_KEY = 'freeor-settings';

/** 从设置中读取已保存的 OpenRouter Key（统一键名，避免与旧版 'openrouter_key' 不一致） */
function readOpenRouterKey(): string {
    if (typeof window === 'undefined') return '';
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return '';
        const settings = JSON.parse(raw);
        return typeof settings.openrouter_key === 'string' ? settings.openrouter_key : '';
    } catch {
        return '';
    }
}

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

    // 测试调用状态
    const [testPrompt, setTestPrompt] = useState('');
    const [testOpen, setTestOpen] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testError, setTestError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ content: string; model: string; latency_ms: number; usage?: { total_tokens?: number } | null } | null>(null);

    // 从 localStorage 读取已保存的 OpenRouter Key
    useEffect(() => {
        setApiKey(readOpenRouterKey());
    }, []);

    const exampleTasks = lang === 'zh' ? EXAMPLE_TASKS_ZH : EXAMPLE_TASKS_EN;
    const hasKey = apiKey.length > 0;

    async function handleAnalyze() {
        if (!task.trim()) return;

        setIsAnalyzing(true);
        setError('');
        setResult(null);
        setTestOpen(false);
        setTestResult(null);
        setTestError(null);

        try {
            const key = readOpenRouterKey();
            const res = await fetch('/api/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(key ? { 'Authorization': `Bearer ${key}` } : {})
                },
                body: JSON.stringify({ task, lang })
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.error && data.error.includes('sync-now.mjs')) {
                    throw new Error(t('recommend.error.sync'));
                }
                throw new Error(data.error || t('recommend.error.network'));
            }

            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : t('recommend.error.network'));
        } finally {
            setIsAnalyzing(false);
        }
    }

    async function handleTest() {
        if (!result) return;
        const key = readOpenRouterKey();
        if (!key) {
            setTestError(t('recommend.test.nokey'));
            return;
        }

        setIsTesting(true);
        setTestError(null);
        setTestResult(null);

        try {
            const res = await fetch('/api/recommend/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: result.best_model.id,
                    prompt: testPrompt.trim(),
                    lang,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || t('recommend.test.error'));
            }
            setTestResult(data);
        } catch (err) {
            setTestError(err instanceof Error ? err.message : t('recommend.test.error'));
        } finally {
            setIsTesting(false);
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
                <h1 className="text-2xl font-bold text-white">{t('nav.recommend')}</h1>
                <p className="text-sm text-white/40 mt-1">{t('recommend.subtitle')}</p>
            </div>

            {/* 输入区域 */}
            <div className="card-glow rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex gap-2">
                        {exampleTasks.map((example) => (
                            <button
                                key={example}
                                onClick={() => setTask(example)}
                                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 transition-colors"
                            >
                                {exampleTasks.indexOf(example) + 1}
                            </button>
                        ))}
                    </div>
                    <div className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm w-fit ${hasKey
                        ? 'bg-green-500/8 border-green-500/20 text-green-400'
                        : 'bg-white/4 border-white/10 text-white/40'
                        }`}>
                        {hasKey
                            ? <><Bot className="w-4 h-4" />🤖 {t('recommend.mode.ai')}</>
                            : <><Zap className="w-4 h-4" />⚡ {t('recommend.mode.rule')} · <a href="/settings" className="underline hover:text-white/60 transition-colors">{t('recommend.mode.link')}</a></>
                        }
                    </div>
                </div>

                <div className="relative">
                    <textarea
                        value={task}
                        onChange={e => setTask(e.target.value)}
                        placeholder={t('recommend.placeholder')}
                        className="w-full h-32 bg-[#111] border border-white/10 rounded-2xl p-4 text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 resize-none transition-all"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                handleAnalyze();
                            }
                        }}
                    />
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !task.trim()}
                        className="absolute bottom-4 right-4 px-6 py-2 rounded-xl bg-white text-black font-semibold hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                        {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isAnalyzing ? t('common.loading') : t('nav.recommend')}
                    </button>
                </div>

                {error && (
                    <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            {error}
                            {error.includes('sync') || error.includes('同步') ? (
                                <div className="mt-2 text-xs opacity-70 font-mono">
                                    {t('recommend.error.tip')}
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>

            {/* 结果区域 */}
            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 py-2">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-xs font-mono text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                            {result.mode === 'llm'
                                ? (<><Bot className="w-3 h-3" /> {t('recommend.result.ai')}</>)
                                : (<><Zap className="w-3 h-3" /> {t('recommend.result.rule')}</>)
                            }
                        </span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

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
                            <div className="flex-shrink-0 flex flex-col gap-2">
                                <a
                                    href={`https://openrouter.ai/models/${result.best_model.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-green-500/15 border border-green-500/25 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    {t('recommend.view')}
                                </a>
                                <button
                                    onClick={() => setTestOpen(v => !v)}
                                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white/8 border border-white/15 text-white/70 text-sm font-medium hover:bg-white/12 hover:text-white transition-all"
                                >
                                    <FlaskConical className="w-3.5 h-3.5" />
                                    {t('recommend.test')}
                                </button>
                            </div>
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

                        {/* Test call panel */}
                        {testOpen && (
                            <div className="mt-4 pt-4 border-t border-white/8 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-2 mb-3">
                                    <FlaskConical className="w-3.5 h-3.5 text-green-400" />
                                    <span className="text-xs font-semibold text-white/70">{t('recommend.test.title')}</span>
                                    <code className="text-[11px] text-white/30 font-mono">{result.best_model.id}</code>
                                </div>

                                {!hasKey ? (
                                    <div className="p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15 text-xs text-yellow-300/80 flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span>
                                            {t('recommend.test.nokey')}
                                            <a href="/settings" className="underline ml-1 hover:text-yellow-200">{t('recommend.test.nokey.link')}</a>
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <textarea
                                                value={testPrompt}
                                                onChange={e => setTestPrompt(e.target.value)}
                                                placeholder={t('recommend.test.prompt')}
                                                className="w-full h-20 bg-[#111] border border-white/10 rounded-xl p-3 pr-28 text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 resize-none transition-all"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleTest();
                                                }}
                                            />
                                            <button
                                                onClick={handleTest}
                                                disabled={isTesting}
                                                className="absolute bottom-3 right-3 px-4 py-1.5 rounded-lg bg-green-500 text-black text-xs font-semibold hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                                            >
                                                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                {isTesting ? t('recommend.test.sending') : t('recommend.test.send')}
                                            </button>
                                        </div>

                                        {testError && (
                                            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                                <span>{testError}</span>
                                            </div>
                                        )}

                                        {testResult && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] text-white/40 font-medium uppercase">{t('recommend.test.response')}</span>
                                                    <span className="text-[11px] text-white/30 font-mono">
                                                        {t('recommend.test.latency')}: {testResult.latency_ms}ms
                                                        {testResult.usage?.total_tokens != null ? ` · ${testResult.usage.total_tokens} ${t('recommend.test.tokens')}` : ''}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-white/80 bg-white/3 border border-white/8 rounded-lg p-3 whitespace-pre-wrap">
                                                    {testResult.content || '—'}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Wrapper code */}
                    <div className="card-glow rounded-2xl p-6">
                        <h4 className="text-sm font-semibold text-white/80 mb-4">{t('recommend.code')}</h4>
                        <div className="space-y-3">
                            {Object.entries(result.wrapper_code).map(([language, code]) => (
                                <div key={language}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs text-white/40 font-medium uppercase">{language}</span>
                                        <button
                                            onClick={() => copy(code as string, language)}
                                            className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 font-medium"
                                        >
                                            <Copy className="w-3 h-3" />
                                            {copied === language ? t('video.copied') : t('video.copy')}
                                        </button>
                                    </div>
                                    <pre className="text-xs text-white/60 bg-white/3 border border-white/8 rounded-lg p-3 overflow-x-auto font-mono">
                                        {code as string}
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
