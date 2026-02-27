'use client';

import { useState, useEffect } from 'react';
import { Bell, Key, MessageCircle, Globe, Save, Check, Twitter } from 'lucide-react';
import { useLang } from '@/lib/i18n/lang-context';

const STORAGE_KEY = 'freeor-settings';

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

export default function SettingsPage() {
    const { t } = useLang();
    const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
    const [saved, setSaved] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Hydration-safe: load from localStorage after mount
    useEffect(() => {
        setSettings(loadSettings());
        setMounted(true);
    }, []);

    function update<K extends keyof Settings>(key: K, value: Settings[K]) {
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    function handleSave() {
        saveSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <MessageCircle className="w-3.5 h-3.5" />
                            Telegram Chat ID
                        </label>
                        <input
                            type="text"
                            value={settings.telegram}
                            onChange={e => update('telegram', e.target.value)}
                            placeholder="-1001234567890"
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                        />
                        <p className="text-[11px] text-white/20 mt-1">{t('settings.telegram.hint')}</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            Discord Webhook URL
                        </label>
                        <input
                            type="text"
                            value={settings.discord}
                            onChange={e => update('discord', e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                        />
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
        </div>
    );
}
