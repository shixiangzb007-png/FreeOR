import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '操作说明 | 快速上手指南 | FreeOR Radar',
    description: '完整了解 FreeOR Radar 的各项功能：实时免费模型监控、智能 AI 推荐、视频 Prompt 生成规则、集成指南及多渠道消息订阅推送等。',
    openGraph: {
        title: '完整使用指南 | FreeOR Radar',
        description: '掌握如何最大化利用 OpenRouter 免费大模型与平台各项数据。',
    },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
    return children;
}
