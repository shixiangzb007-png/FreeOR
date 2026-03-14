import { Metadata } from 'next';

export const metadata: Metadata = {
    title: '变更日志 | 免费模型上下线动态 | FreeOR Radar',
    description: '实时追踪 OpenRouter 免费大模型的最新动态。查看每日模型新增上架、免费节点下线及速率限制规则更新（Rate Limit Changes）的完整历史。',
    openGraph: {
        title: '模型变动时间线 | FreeOR Radar',
        description: '捕捉每一次 OpenRouter 免费大模型的新增与下架动态。',
    },
};

export default function ChangelogLayout({ children }: { children: React.ReactNode }) {
    return children;
}
