import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '操作说明 | 快速上手指南 | FreeOR Radar',
    description: 'FreeOR Radar 完整使用指南：免费模型监控与关注、Video Clip / Character Clip / Video Overview 视频工作流、智能推荐、集成代码与 Telegram 推送配置。',
    openGraph: {
        title: '完整使用指南 | FreeOR Radar',
        description: '掌握 OpenRouter 免费模型雷达、三 Tab 视频生成、角色库云端同步与推送通知。',
    },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
    return children;
}
