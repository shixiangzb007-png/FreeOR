import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '个人设置 | 推送管理 | FreeOR Radar',
    description: '自定义 OpenRouter 免费模型上下线的实时通知订阅，支持 Telegram Bot 与 Discord 频道推送。保护隐私且仅保存在浏览器的一站式设置中心。',
    openGraph: {
        title: '通知及 API 配置 | FreeOR Radar',
        description: '订阅模型变更即时推送，永远不再错过新上线的免费 AI 大模型。',
    },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
