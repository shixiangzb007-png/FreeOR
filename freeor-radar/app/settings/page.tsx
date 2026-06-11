'use client';

import { useState, useEffect } from 'react';
import { Bell, Key, MessageCircle, Globe, Save, Check, Twitter, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';
import { getClientId } from '@/lib/client-id';

const STORAGE_KEY = 'freeor-settings';

type SyncStatus = 'idle' | 'saving' | 'ok' | 'error';

interface Settings {
    notify_new_models: boolean;
    notify_removed_models: boolean;
    notify_limit_changes: boolean;
    telegram: string;
    discord: string;
    openrouter_key: string;
    site_url: string;
}

const DEFAULT_SETTINGS: Settings = {
    notify_new_models: true,
    notify_removed_models: true,
    notify_limit_changes: false,
    telegram: '',
    discord: '',
    openrouter_key: '',
    site_url: '',
};

function loadSettings(): Settings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

function saveSettings(s: Settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

type TestState = 'idle' | 'sending' | 'ok' | 'error';

export default function SettingsPage() {
    const { t, lang } = useLang();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const [syncError, setSyncError] = useState('');
    const [testState, setTestState] = useState<Record<string, TestState>>({});
    const [testErrors, setTestErrors] = useState<Record<string, string>>({});

    // Hydration-safe: load from localStorage after mount
    useEffect(() => {
        setSettings(loadSettings());
        const cid = getClientId(); // ensure a client id exists
        setMounted(true);

        // 回读云端订阅：换设备/清缓存后仍能看到已生效的推送配置
        fetch(`/api/subscriptions?client_id=${encodeURIComponent(cid)}`)
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (!data || (!data.telegram && !data.discord)) return;
                const ev: string[] = Array.isArray(data.event_types) ? data.event_types : [];
                setSettings(prev => ({
                    ...prev,
                    telegram: data.telegram || prev.telegram,
                    discord: data.discord || prev.discord,
                    notify_new_models: ev.includes('new'),
                    notify_removed_models: ev.includes('removed'),
                    notify_limit_changes: ev.includes('limit_change'),
                }));
            })
            .catch(() => { /* 离线或服务端未配置时静默，使用本地值 */ });
    }, []);

    async function handleTestChannel(channel: 'telegram' | 'discord') {
        const target = (channel === 'telegram' ? settings.telegram : settings.discord).trim();
        if (!target) return;

        setTestState(prev => ({ ...prev, [channel]: 'sending' }));
        setTestErrors(prev => ({ ...prev, [channel]: '' }));
        try {
            const res = await fetch('/api/subscriptions/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, target, lang }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || t('settings.test.fail'));
            setTestState(prev => ({ ...prev, [channel]: 'ok' }));
            setTimeout(() => setTestState(prev => ({ ...prev, [channel]: 'idle' })), 5000);
        } catch (err) {
            setTestState(prev => ({ ...prev, [channel]: 'error' }));
            setTestErrors(prev => ({
                ...prev,
                [channel]: err instanceof Error ? err.message : t('settings.test.fail'),
            }));
        }
    }

    function update<K extends keyof Settings>(key: K, value: Settings[K]) {
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    /** Map the three notification toggles to subscription event_types. */
    function deriveEventTypes(s: Settings): string[] {
        const types: string[] = [];
        if (s.notify_new_models) types.push('new');
        if (s.notify_removed_models) types.push('removed');
        if (s.notify_limit_changes) types.push('limit_change');
        return types.length > 0 ? types : ['new', 'removed'];
    }

    async function handleSave() {
        // Always persist locally first (instant UX, source of truth for the form).
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Sync Telegram / Discord targets to the server so the hourly Cron can push to them.
        setSyncError('');
        setSyncStatus('saving');
        try {
            const res = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: getClientId(),
                    telegram: settings.telegram.trim(),
                    discord: settings.discord.trim(),
                    event_types: deriveEventTypes(settings),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (data?.error === 'INVALID_TELEGRAM') throw new Error(t('settings.sync.invalid_telegram'));
                if (data?.error === 'INVALID_DISCORD') throw new Error(t('settings.sync.invalid_discord'));
                throw new Error(data?.message || data?.error || t('settings.sync.failed'));
            }
            setSyncStatus('ok');
        } catch (err) {
            setSyncStatus('error');
            setSyncError(err instanceof Error ? err.message : t('settings.sync.failed'));
        }
    }

    if (!mounted) {
        return <div className="max-w-2xl mx-auto h-64 rounded-2xl bg-white/3 animate-pulse" />;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">⚙️ {t('settings.title')}</h1>
                <p className="text-sm text-white/40 mt-1">{t('settings.subtitle')}</p>
            </div>

            {/* Notification settings */}
            <div className="card-glow rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-green-400" />
                    <h2 className="text-sm font-semibold text-white/80">{t('settings.notify.title')}</h2>
                </div>

                <div className="space-y-3">
                    {[
                        { key: 'notify_new_models', label: t('settings.notify.new'), desc: t('settings.notify.new.desc') },
                        { key: 'notify_removed_models', label: t('settings.notify.removed'), desc: t('settings.notify.removed.desc') },
                        { key: 'notify_limit_changes', label: t('settings.notify.limit'), desc: t('settings.notify.limit.desc') },
                    ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8">
                            <div>
                                <div className="text-sm font-medium text-white/80">{item.label}</div>
                                <div className="text-xs text-white/35 mt-0.5">{item.desc}</div>
                            </div>
                            <button
                                onClick={() => update(item.key as keyof Settings, !settings[item.key as keyof Settings])}
                                className={`relative w-11 h-6 rounded-full transition-all ${settings[item.key as keyof Settings] ? 'bg-green-500' : 'bg-white/15'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${settings[item.key as keyof Settings] ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Notification channels */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">{t('settings.channels')}</p>
                    <p className="text-[11px] text-white/30 leading-relaxed">{t('settings.channels.cloud')}</p>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <MessageCircle className="w-3.5 h-3.5" />
                            Telegram Chat ID
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.telegram}
                                onChange={e => update('telegram', e.target.value)}
                                placeholder="-1001234567890"
                                className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                            />
                            <button
                                onClick={() => handleTestChannel('telegram')}
                                disabled={!settings.telegram.trim() || testState.telegram === 'sending'}
                                className="h-9 px-3 rounded-lg bg-white/8 border border-white/15 text-xs text-white/60 hover:text-white hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                            >
                                {testState.telegram === 'sending' ? t('settings.test.sending') : t('settings.test.send')}
                            </button>
                        </div>
                        <p className="text-[11px] text-white/20 mt-1">{t('settings.telegram.hint')}</p>
                        {testState.telegram === 'ok' && (
                            <p className="text-[11px] text-green-400 mt-1">{t('settings.test.ok')}</p>
                        )}
                        {testState.telegram === 'error' && (
                            <p className="text-[11px] text-red-400 mt-1">{testErrors.telegram || t('settings.test.fail')}</p>
                        )}
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            Discord Webhook URL
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={settings.discord}
                                onChange={e => update('discord', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                            />
                            <button
                                onClick={() => handleTestChannel('discord')}
                                disabled={!settings.discord.trim() || testState.discord === 'sending'}
                                className="h-9 px-3 rounded-lg bg-white/8 border border-white/15 text-xs text-white/60 hover:text-white hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                            >
                                {testState.discord === 'sending' ? t('settings.test.sending') : t('settings.test.send')}
                            </button>
                        </div>
                        {testState.discord === 'ok' && (
                            <p className="text-[11px] text-green-400 mt-1">{t('settings.test.ok')}</p>
                        )}
                        {testState.discord === 'error' && (
                            <p className="text-[11px] text-red-400 mt-1">{testErrors.discord || t('settings.test.fail')}</p>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/15">
                        <div className="flex items-center gap-2 mb-1">
                            <Twitter className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs text-blue-400 font-semibold">X (Twitter) {t('settings.x.config')}</span>
                        </div>
                        <p className="text-xs text-white/30">{t('settings.x.hint')}</p>
                    </div>
                </div>
            </div>

            {/* API Key management */}
            <div className="card-glow rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-green-400" />
                    <h2 className="text-sm font-semibold text-white/80">{t('settings.apikey.title')}</h2>
                </div>

                <div className="p-3 rounded-xl bg-green-500/8 border border-green-500/15">
                    <p className="text-xs text-green-400/80">{t('settings.apikey.info')}</p>
                </div>

                <div>
                    <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5 block">
                        OpenRouter API Key {t('settings.optional')}
                    </label>
                    <input
                        type="password"
                        value={settings.openrouter_key}
                        onChange={e => update('openrouter_key', e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40 font-mono"
                    />
                    <p className="text-xs text-white/25 mt-1.5">
                        {t('settings.apikey.local')}
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-green-400 ml-1 hover:text-green-300">
                            {t('settings.apikey.get')} →
                        </a>
                    </p>
                </div>

                <div>
                    <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5 block">
                        {t('settings.siteurl')} {t('settings.optional')}
                    </label>
                    <input
                        type="text"
                        value={settings.site_url}
                        onChange={e => update('site_url', e.target.value)}
                        placeholder="https://your-site.com"
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                    />
                    <p className="text-xs text-white/25 mt-1.5">{t('settings.siteurl.hint')}</p>
                </div>
            </div>

            {/* Save button */}
            <button
                onClick={handleSave}
                className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? t('settings.saved') : t('settings.save')}
            </button>

            {saved && (
                <p className="text-center text-xs text-green-400/70">{t('settings.saved.hint')}</p>
            )}

            {/* Cloud sync status for Telegram / Discord subscriptions */}
            {syncStatus !== 'idle' && (
                <div className={`flex items-center justify-center gap-2 text-xs ${
                    syncStatus === 'ok' ? 'text-green-400/80'
                    : syncStatus === 'error' ? 'text-red-400'
                    : 'text-white/40'
                }`}>
                    {syncStatus === 'saving' && <><RefreshCw className="w-3.5 h-3.5 animate-spin" />{t('settings.sync.saving')}</>}
                    {syncStatus === 'ok' && <><Cloud className="w-3.5 h-3.5" />{t('settings.sync.ok')}</>}
                    {syncStatus === 'error' && <><CloudOff className="w-3.5 h-3.5" />{syncError || t('settings.sync.failed')}</>}
                </div>
            )}
        </div>
    );
}
