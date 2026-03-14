import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '集成中心 | 代码片段速查 | FreeOR Radar',
    description: '支持多种语言（Python、JavaScript、cURL、Aider 等）无缝接入 OpenRouter 免费 AI 资源。最快复制可用代码结构，实现业务零成本集成大模型能力。',
    openGraph: {
        title: '开发集成指南 | FreeOR Radar',
        description: '复制即用的多语言调用模版，分钟级接入免费大模型。',
    },
};

export default function IntegrationsLayout({ children }: { children: React.ReactNode }) {
    return children;
}
