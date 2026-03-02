/**
 * FreeOR Radar — 视频平台静态配置
 *
 * 各平台均无公开 API 获取用户实时额度，采用"每日重置策略"：
 *   - Cron 每日 UTC 01:00 将 used_today 清零
 *   - daily_credits 使用平台公开的免费 tier 限额
 *   - 管理员可通过 POST /api/admin/video-credits 手动更新真实已用量
 */

export interface PlatformConfig {
    /** Supabase video_credits 表主键 */
    tool: string;
    /** 平台显示名称 */
    label: string;
    /** 每日免费额度（999999 = 无限制） */
    daily_credits: number;
    /** 额度重置周期描述 */
    reset_label: string;
    /** 官网 */
    homepage: string;
    /** 数据来源说明（用于透明度展示） */
    credit_source: string;
}

export const PLATFORM_CONFIGS: PlatformConfig[] = [
    {
        tool: 'kling',
        label: 'Kling',
        daily_credits: 66,
        reset_label: '每日',
        homepage: 'https://klingai.com',
        credit_source: '官网公开免费 tier（2024-Q4）',
    },
    {
        tool: 'pika',
        label: 'Pika',
        daily_credits: 80,
        reset_label: '每日',
        homepage: 'https://pika.art',
        credit_source: '官网公开免费 tier（2024-Q4）',
    },
    {
        tool: 'genmo',
        label: 'Genmo',
        daily_credits: 999999,
        reset_label: '无限制',
        homepage: 'https://www.genmo.ai',
        credit_source: '无限制免费使用',
    },
    {
        tool: 'runway',
        label: 'Runway',
        daily_credits: 125, // 新用户赠送 125 credits，不每日重置
        reset_label: '注册赠送',
        homepage: 'https://runwayml.com',
        credit_source: '新用户赠送 125 credits（一次性）',
    },
    {
        tool: 'veo',
        label: 'Veo 2',
        daily_credits: 10,
        reset_label: '每月',
        homepage: 'https://deepmind.google/technologies/veo/',
        credit_source: 'Google Labs 公开配额（2025-Q1）',
    },
    {
        tool: 'higgsfield',
        label: 'Higgsfield',
        daily_credits: 10,
        reset_label: '每日',
        homepage: 'https://higgsfield.ai',
        credit_source: '官网公开免费 tier（2024-Q4）',
    },
    {
        tool: 'openart',
        label: 'OpenArt',
        daily_credits: 50,
        reset_label: '每日',
        homepage: 'https://openart.ai',
        credit_source: '官网公开免费 tier（2024-Q4）',
    },
];

/** 根据 tool key 快速查找配置 */
export function getPlatformConfig(tool: string): PlatformConfig | undefined {
    return PLATFORM_CONFIGS.find(p => p.tool === tool);
}
