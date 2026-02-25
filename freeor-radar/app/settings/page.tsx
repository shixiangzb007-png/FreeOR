'use client';

import { useState } from 'react';
import { Bell, Key, MessageCircle, Globe, Save, Check } from 'lucide-react';

export default function SettingsPage() {
    const [saved, setSaved] = useState(false);
    const [notifications, setNotifications] = useState({
        new_models: true,
        removed_models: true,
        limit_changes: false,
        telegram: '',
        discord: '',
    });
    const [apiKey, setApiKey] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    function handleSave() {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">⚙️ 设置</h1>
                <p className="text-sm text-white/40 mt-1">通知、API Key 和个性化配置</p>
            </div>

            {/* Notification settings */}
            <div className="card-glow rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-green-400" />
                    <h2 className="text-sm font-semibold text-white/80">通知设置</h2>
                </div>

                <div className="space-y-3">
                    {[
                        { key: 'new_models', label: '新增免费模型', description: '有新模型加入免费列表时通知我' },
                        { key: 'removed_models', label: '模型下线', description: '模型从免费列表移除时通知我' },
                        { key: 'limit_changes', label: '限流变更', description: '现有免费模型限制发生变化时通知我' },
                    ].map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/3 border border-white/8">
                            <div>
                                <div className="text-sm font-medium text-white/80">{item.label}</div>
                                <div className="text-xs text-white/35 mt-0.5">{item.description}</div>
                            </div>
                            <button
                                onClick={() => setNotifications(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                                className={`relative w-11 h-6 rounded-full transition-all ${notifications[item.key as keyof typeof notifications]
                                        ? 'bg-green-500'
                                        : 'bg-white/15'
                                    }`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${notifications[item.key as keyof typeof notifications] ? 'left-6' : 'left-1'
                                    }`} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Notification channels */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                    <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">推送渠道</p>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <MessageCircle className="w-3.5 h-3.5" />
                            Telegram Chat ID
                        </label>
                        <input
                            type="text"
                            value={notifications.telegram}
                            onChange={e => setNotifications(prev => ({ ...prev, telegram: e.target.value }))}
                            placeholder="例：-1001234567890"
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs text-white/50 mb-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            Discord Webhook URL
                        </label>
                        <input
                            type="text"
                            value={notifications.discord}
                            onChange={e => setNotifications(prev => ({ ...prev, discord: e.target.value }))}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                        />
                    </div>
                </div>
            </div>

            {/* API Key management */}
            <div className="card-glow rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-green-400" />
                    <h2 className="text-sm font-semibold text-white/80">API Key 管理</h2>
                </div>

                <div className="p-3 rounded-xl bg-green-500/8 border border-green-500/15">
                    <p className="text-xs text-green-400/80">
                        ✅ FreeOR Radar 的所有<strong>免费模型列表功能</strong>无需 API Key。<br />
                        仅在使用<strong>智能推荐的 AI 分析功能</strong>时，需要一个 OpenRouter Key（免费注册可得）。
                    </p>
                </div>

                <div>
                    <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5 block">OpenRouter API Key（可选）</label>
                    <input
                        type="password"
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40 font-mono"
                    />
                    <p className="text-xs text-white/25 mt-1.5">
                        Key 仅存储在浏览器本地，不会上传到服务器。
                        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-green-400 ml-1 hover:text-green-300">
                            免费获取 Key →
                        </a>
                    </p>
                </div>

                <div>
                    <label className="text-xs text-white/50 font-semibold uppercase tracking-wider mb-1.5 block">您的站点 URL（可选）</label>
                    <input
                        type="text"
                        value={siteUrl}
                        onChange={e => setSiteUrl(e.target.value)}
                        placeholder="https://your-site.com"
                        className="w-full h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-green-500/40"
                    />
                    <p className="text-xs text-white/25 mt-1.5">用于 OpenRouter 的 HTTP-Referer 请求头</p>
                </div>
            </div>

            {/* Save button */}
            <button
                onClick={handleSave}
                className="w-full h-11 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? '已保存' : '保存设置'}
            </button>
        </div>
    );
}
