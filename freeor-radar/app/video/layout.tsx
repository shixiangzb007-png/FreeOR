import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '视频专区 | 一键生成专属 Prompt | FreeOR Radar',
    description: '为 Kling、Veo、Runway、Genmo、Pika、Higgsfield 和 OpenArt 等 AI 视频平台一键生成专业、高质量的场景描述提示词 (Prompt)，支持中英双语。',
    openGraph: {
        title: 'AI 视频提示词一键生成 | FreeOR Radar',
        description: '免费获取顶级 AI 视频平台专业 Prompt 模板与实时可用生成工具。',
    },
};

export default function VideoLayout({ children }: { children: React.ReactNode }) {
    return children;
}
