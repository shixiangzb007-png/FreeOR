import { NextRequest } from 'next/server';

/**
 * 轻量级内存滑动窗口限速器。
 *
 * 注意：Serverless 环境下每个实例各自维护内存（非全局精确限速），
 * 但足以拦截单实例上的爆发式滥用（刷订阅 / 刷测试消息）。
 * 若未来需要精确的全局限速，可替换为 Upstash Redis / Supabase 计数表。
 */
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000; // 防止内存无限增长

/**
 * @returns true = 放行；false = 已超限
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter(ts => now - ts < windowMs);

    if (hits.length >= limit) {
        buckets.set(key, hits);
        return false;
    }

    hits.push(now);

    if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
        buckets.clear(); // 简单兜底：桶过多时整体重置
    }
    buckets.set(key, hits);
    return true;
}

/** 从请求头提取客户端 IP（Vercel/代理场景取 x-forwarded-for 首段） */
export function clientIp(req: NextRequest): string {
    const fwd = req.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'unknown';
}
