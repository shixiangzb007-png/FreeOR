import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '智能推荐 | AI 匹配最佳免费模型 | FreeOR Radar',
    description: '只需用自然语言描述您的任务需求（如长文总结、图片识别、代码编写等），FreeOR Radar 即可利用 AI 和规则引擎为您精准推荐最匹配的 OpenRouter 免费大模型。',
    openGraph: {
        title: '免费模型智能推荐引擎 | FreeOR Radar',
        description: '告诉 AI 你的任务，自动匹配最佳 OpenRouter 免费大模型解决方案与现成代码。',
    },
};

export default function RecommendLayout({ children }: { children: React.ReactNode }) {
    return children;
}
