export type LegalSection = { title: string; body: string[] };

export type LegalDoc = {
    title: string;
    updated: string;
    sections: LegalSection[];
};

export const PRIVACY_ZH: LegalDoc = {
    title: '隐私政策',
    updated: '2026-06-11',
    sections: [
        {
            title: '1. 概述',
            body: [
                'FreeOR Radar（以下简称「本站」）致力于帮助用户发现 OpenRouter 免费模型与相关 AI 工具。我们重视您的隐私，本政策说明我们如何处理与您使用本站相关的信息。',
            ],
        },
        {
            title: '2. 我们收集的信息',
            body: [
                '浏览器本地数据：您在「设置」中填写的 OpenRouter API Key、站点 URL、通知偏好、视频 Prompt 历史、角色库（Character Clip）等，默认保存在您设备的 localStorage 中，不会上传至我们的服务器（API Key 仅由您的浏览器直接发送至 OpenRouter）。',
                '匿名客户端标识：为支持模型关注、角色云端同步等功能，本站会在浏览器生成并保存一个匿名 client_id（UUID），用于关联您的云端数据，不包含姓名、邮箱等个人身份信息。',
                '云端存储（可选）：若服务端已配置 Supabase，您保存的角色参考图、关注列表、推送订阅等会按 client_id 存储于云端数据库与对象存储；参考图 bucket 为公开可读，以便 OpenRouter 通过 HTTPS 拉取。',
                '服务器日志：访问本站时，托管平台（如 Vercel）可能记录 IP、User-Agent、请求路径等标准 Web 日志，用于安全与运维。',
            ],
        },
        {
            title: '3. 信息的使用方式',
            body: [
                '提供核心功能：模型列表展示、智能推荐、视频生成代理、角色同步、变更推送等。',
                '改进产品：汇总匿名使用统计（如模型同步结果），不用于识别个人身份。',
                '我们不会出售您的个人信息，也不会将 OpenRouter API Key 存储在服务器端。',
            ],
        },
        {
            title: '4. 第三方服务',
            body: [
                'OpenRouter：视频生成、智能推荐、Overview 配图等需您自带 Key 并直接调用 OpenRouter；受其隐私政策约束。',
                'Supabase：用于数据库与文件存储（若已配置）。',
                'Telegram / Discord：您在设置中配置的 Chat ID 或 Webhook 用于向您推送模型变更通知。',
            ],
        },
        {
            title: '5. 您的选择与权利',
            body: [
                '您可随时清除浏览器 localStorage 以删除本地设置与 Key。',
                '角色与关注数据可通过界面删除；如需彻底删除云端数据，请联系我们或在 Supabase 管理端按 client_id 处理。',
                '请勿上传未授权真人照片或侵犯他人肖像权的素材（详见服务协议）。',
            ],
        },
        {
            title: '6. 政策更新',
            body: [
                '我们可能不时更新本政策，更新日期见文首。重大变更时会在站内适当位置提示。继续使用本站即表示您接受修订后的政策。',
            ],
        },
        {
            title: '7. 联系我们',
            body: [
                '如有隐私相关问题，请通过 GitHub 仓库 Issues 与我们联系：github.com/shixiangzb007-png/FreeOR',
            ],
        },
    ],
};

export const PRIVACY_EN: LegalDoc = {
    title: 'Privacy Policy',
    updated: '2026-06-11',
    sections: [
        {
            title: '1. Overview',
            body: [
                'FreeOR Radar ("the Site") helps you discover free OpenRouter models and related AI tools. This policy explains how we handle information when you use the Site.',
            ],
        },
        {
            title: '2. Information We Handle',
            body: [
                'Browser-local data: Your OpenRouter API Key, site URL, notification preferences, video prompt history, character library (Character Clip), etc. are stored in localStorage by default and are not uploaded to our servers (the key is sent from your browser directly to OpenRouter).',
                'Anonymous client ID: A random UUID is generated in your browser to link cloud features such as model watches and character sync. It is not tied to your name or email.',
                'Cloud storage (optional): With Supabase configured, saved character images, watches, and push subscriptions are stored under your client_id. Reference images may be in a public bucket so OpenRouter can fetch them via HTTPS.',
                'Server logs: Hosting providers (e.g. Vercel) may log IP, User-Agent, and request paths for security and operations.',
            ],
        },
        {
            title: '3. How We Use Information',
            body: [
                'To provide core features: model listings, recommendations, video proxies, character sync, and change notifications.',
                'To improve the product with aggregated, non-identifying statistics.',
                'We do not sell personal information or store your OpenRouter API Key on our servers.',
            ],
        },
        {
            title: '4. Third Parties',
            body: [
                'OpenRouter: Video, AI recommend, and Overview images use your BYOK and are subject to OpenRouter\'s policies.',
                'Supabase: Database and file storage when configured.',
                'Telegram / Discord: Chat IDs or webhooks you provide for model change alerts.',
            ],
        },
        {
            title: '5. Your Choices',
            body: [
                'Clear browser localStorage to remove local settings and keys.',
                'Delete characters and watches in the UI; contact us or use Supabase admin to remove cloud data by client_id.',
                'Do not upload unauthorized photos of real people (see Terms of Service).',
            ],
        },
        {
            title: '6. Updates',
            body: [
                'We may update this policy; the date is shown at the top. Continued use means acceptance of the revised policy.',
            ],
        },
        {
            title: '7. Contact',
            body: [
                'Privacy questions: GitHub Issues at github.com/shixiangzb007-png/FreeOR',
            ],
        },
    ],
};

export const TERMS_ZH: LegalDoc = {
    title: '服务协议',
    updated: '2026-06-11',
    sections: [
        {
            title: '1. 接受条款',
            body: [
                '访问或使用 FreeOR Radar 即表示您同意本服务协议。若不同意，请停止使用本站。',
            ],
        },
        {
            title: '2. 服务说明',
            body: [
                '本站提供 OpenRouter 免费模型信息聚合、智能推荐、Prompt 工具、Video Clip / Character Clip / Video Overview 等辅助功能。',
                '模型列表与变更信息来自 OpenRouter 公开数据及定时同步，仅供参考，不保证实时准确或可用。',
                '视频、图像、角色一致性等功能依赖第三方 AI 模型，结果为 best-effort，本站不保证 100% 可用、无瑕疵或符合特定用途。',
            ],
        },
        {
            title: '3. 用户责任',
            body: [
                '您需自行准备并保管 OpenRouter API Key，对 Key 的使用与费用负责（BYOK）。',
                '您上传或生成的内容须合法合规，不得侵犯知识产权、肖像权或传播违法信息。',
                'Character Clip：仅可上传原创插画、3D 渲染或虚拟角色设定；禁止上传未授权真人/名人照片。使用前须勾选原创/授权确认。',
                '不得对本站进行恶意爬取、攻击或干扰正常服务的行为。',
            ],
        },
        {
            title: '4. 知识产权',
            body: [
                '本站界面、代码与文档的知识产权归项目维护者所有（开源协议以仓库 LICENSE 为准）。',
                '您保留对自己上传素材与生成内容的所有权，但须确保拥有必要权利；因侵权产生的责任由您自行承担。',
            ],
        },
        {
            title: '5. 免责声明',
            body: [
                '本站按「现状」提供，不作明示或暗示的保证。因模型下线、限流、API 故障、网络问题导致的损失，本站不承担责任。',
                'AI 生成内容可能不准确、存在偏见或违反平台规则，请您人工审核后再公开使用。',
            ],
        },
        {
            title: '6. 服务变更与终止',
            body: [
                '我们可随时调整、暂停或终止部分或全部功能，无需事先通知。',
                '我们可更新本协议；更新后继续使用即视为接受新条款。',
            ],
        },
        {
            title: '7. 适用法律与联系',
            body: [
                '本协议适用中华人民共和国法律（不含冲突法规则）。',
                '疑问请通过 GitHub 仓库 Issues 联系：github.com/shixiangzb007-png/FreeOR',
            ],
        },
    ],
};

export const TERMS_EN: LegalDoc = {
    title: 'Terms of Service',
    updated: '2026-06-11',
    sections: [
        {
            title: '1. Acceptance',
            body: [
                'By using FreeOR Radar you agree to these Terms. If you do not agree, stop using the Site.',
            ],
        },
        {
            title: '2. Service Description',
            body: [
                'The Site aggregates free OpenRouter model info, recommendations, prompt tools, Video Clip, Character Clip, and Video Overview features.',
                'Listings and changelogs are synced periodically for reference only — not guaranteed real-time or accurate.',
                'Video, image, and character features rely on third-party AI; results are best-effort with no guarantee of perfection or fitness for a purpose.',
            ],
        },
        {
            title: '3. Your Responsibilities',
            body: [
                'You provide and secure your OpenRouter API Key and pay any usage charges (BYOK).',
                'Your uploads and generations must be lawful and must not infringe IP, likeness rights, or applicable law.',
                'Character Clip: original illustration, 3D, or fictional characters only — no unauthorized real-person photos. Check the originality confirmation before upload.',
                'Do not abuse, scrape, or disrupt the Site.',
            ],
        },
        {
            title: '4. Intellectual Property',
            body: [
                'Site UI, code, and docs belong to the project maintainers (see repo LICENSE).',
                'You retain rights to your uploads and outputs, provided you have the necessary rights; you are liable for infringement.',
            ],
        },
        {
            title: '5. Disclaimer',
            body: [
                'The Site is provided "as is" without warranties. We are not liable for losses from model removals, rate limits, API failures, or connectivity issues.',
                'AI outputs may be wrong or policy-violating — review before publishing.',
            ],
        },
        {
            title: '6. Changes',
            body: [
                'We may modify or discontinue features at any time.',
                'Updated Terms take effect when posted; continued use means acceptance.',
            ],
        },
        {
            title: '7. Law & Contact',
            body: [
                'These Terms are governed by the laws of the People\'s Republic of China (excluding conflict rules).',
                'Questions: GitHub Issues at github.com/shixiangzb007-png/FreeOR',
            ],
        },
    ],
};

export function getPrivacyDoc(lang: string): LegalDoc {
    return lang === 'en' ? PRIVACY_EN : PRIVACY_ZH;
}

export function getTermsDoc(lang: string): LegalDoc {
    return lang === 'en' ? TERMS_EN : TERMS_ZH;
}
