/**
 * FreeOR Radar — 视频平台额度爬虫脚本
 * 
 * 用法：
 *   node scripts/scrape-credits.mjs --update
 * 
 * 功能：
 *   - 使用 Playwright 登录各视频平台抓取今日剩余额度
 *   - 将结果 upsert 到 Supabase video_credits 表
 * 
 * 支持平台：Kling / Pika / Genmo / Higgsfield / OpenArt
 * 
 * 依赖安装：
 *   npm install playwright @playwright/test dotenv
 *   npx playwright install chromium
 * 
 * 环境变量（在 .env.local 中配置）：
 *   KLING_EMAIL / KLING_PASSWORD
 *   PIKA_EMAIL / PIKA_PASSWORD
 *   GENMO_EMAIL / GENMO_PASSWORD
 *   HIGGSFIELD_EMAIL / HIGGSFIELD_PASSWORD
 *   OPENART_EMAIL / OPENART_PASSWORD
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * 
 * ⚠️ 注意：
 *   - 此脚本仅供本地/服务器定时运行，不应部署在 Vercel
 *   - 需要您拥有各平台账号并在 .env.local 配置凭据
 *   - 各平台可能随时更新 UI，需要相应维护选择器
 */

import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ── 环境变量加载 ───────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
    const envPaths = [
        path.join(__dirname, '../.env.local'),
        path.join(__dirname, '../.env'),
    ];
    for (const p of envPaths) {
        if (!existsSync(p)) continue;
        const lines = readFileSync(p, 'utf-8').split('\n');
        for (const line of lines) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
        }
        break;
    }
}
loadEnv();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── 平台配置 ──────────────────────────────────────────────────

const PLATFORMS = {
    kling: {
        name: 'Kling',
        daily_credits: 66,
        loginUrl: 'https://klingai.com',
        emailEnv: 'KLING_EMAIL',
        passEnv: 'KLING_PASSWORD',
        /**
         * @param {import('playwright').Page} page
         * @returns {Promise<number>} Used credits today
         */
        async scrape(page) {
            // 登录
            await page.goto('https://klingai.com/login', { waitUntil: 'networkidle' });
            await page.fill('input[type="email"]', process.env.KLING_EMAIL || '');
            await page.fill('input[type="password"]', process.env.KLING_PASSWORD || '');
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });

            // 导航到账户额度页面
            await page.goto('https://klingai.com/account', { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            // 尝试解析额度数字（选择器按实际 UI 调整）
            const creditText = await page.textContent('[data-testid="daily-credits"], .credit-count, .daily-quota')
                .catch(() => null);

            if (creditText) {
                const match = creditText.match(/(\d+)/);
                if (match) {
                    const remaining = parseInt(match[1]);
                    return 66 - remaining; // used = total - remaining
                }
            }
            return 0;
        }
    },

    pika: {
        name: 'Pika',
        daily_credits: 80,
        loginUrl: 'https://pika.art',
        emailEnv: 'PIKA_EMAIL',
        passEnv: 'PIKA_PASSWORD',
        async scrape(page) {
            await page.goto('https://pika.art/login', { waitUntil: 'networkidle' });
            await page.fill('input[name="email"]', process.env.PIKA_EMAIL || '');
            await page.fill('input[name="password"]', process.env.PIKA_PASSWORD || '');
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });

            // Pika 在 profile 页显示 credits
            await page.goto('https://pika.art/profile', { waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            const creditText = await page.textContent('.credits, [data-credits], .generation-count')
                .catch(() => null);
            if (creditText) {
                const match = creditText.match(/(\d+)/);
                if (match) return 80 - parseInt(match[1]);
            }
            return 0;
        }
    },

    genmo: {
        name: 'Genmo',
        daily_credits: 999999, // 无限制
        loginUrl: 'https://www.genmo.ai',
        emailEnv: '',
        passEnv: '',
        async scrape(_page) {
            // Genmo 目前提供无限免费生成
            return 0;
        }
    },

    higgsfield: {
        name: 'Higgsfield',
        daily_credits: 10,
        loginUrl: 'https://higgsfield.ai',
        emailEnv: 'HIGGSFIELD_EMAIL',
        passEnv: 'HIGGSFIELD_PASSWORD',
        async scrape(page) {
            await page.goto('https://higgsfield.ai/signin', { waitUntil: 'networkidle' });
            await page.fill('input[type="email"]', process.env.HIGGSFIELD_EMAIL || '');
            await page.fill('input[type="password"]', process.env.HIGGSFIELD_PASSWORD || '');
            await page.click('button[type="submit"]');
            await page.waitForNavigation({ waitUntil: 'networkidle' });
            await page.waitForTimeout(2000);

            const creditText = await page.textContent('[class*="credits"], [class*="quota"]')
                .catch(() => null);
            if (creditText) {
                const match = creditText.match(/(\d+)/);
                if (match) return 10 - parseInt(match[1]);
            }
            return 0;
        }
    },

    openart: {
        name: 'OpenArt',
        daily_credits: 50,
        loginUrl: 'https://openart.ai',
        emailEnv: 'OPENART_EMAIL',
        passEnv: 'OPENART_PASSWORD',
        async scrape(page) {
            await page.goto('https://openart.ai/account', { waitUntil: 'networkidle' });
            await page.waitForTimeout(3000);

            const creditText = await page.textContent('[class*="credit"], [data-testid*="credit"]')
                .catch(() => null);
            if (creditText) {
                const match = creditText.match(/(\d+)/);
                if (match) {
                    const remaining = parseInt(match[1]);
                    return Math.max(0, 50 - remaining);
                }
            }
            return 0;
        }
    },
};

// ── 主执行逻辑 ─────────────────────────────────────────────────

async function scrapePlatform(name, config, browser) {
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    try {
        console.log(`[${name}] 开始抓取...`);

        // 跳过未配置凭据的平台
        if (config.emailEnv && !process.env[config.emailEnv]) {
            console.log(`[${name}] ⚠️ 未配置 ${config.emailEnv}，跳过`);
            return null;
        }

        const usedToday = await config.scrape(page);
        console.log(`[${name}] ✅ 今日已用: ${usedToday} / ${config.daily_credits}`);
        return { tool: name, daily_credits: config.daily_credits, used_today: usedToday };
    } catch (err) {
        console.error(`[${name}] ❌ 抓取失败: ${err.message}`);
        return null;
    } finally {
        await context.close();
    }
}

async function updateSupabase(results) {
    for (const row of results) {
        const { error } = await supabase
            .from('video_credits')
            .upsert({
                ...row,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'tool' });

        if (error) {
            console.error(`[Supabase] upsert ${row.tool} failed:`, error.message);
        } else {
            console.log(`[Supabase] ✅ ${row.tool} updated`);
        }
    }
}

async function main() {
    const doUpdate = process.argv.includes('--update');

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL 未配置');
        process.exit(1);
    }

    console.log('🎬 FreeOR 视频额度爬虫启动');
    console.log(`模式: ${doUpdate ? '抓取 + 写入 Supabase' : '仅抓取（dry run）'}`);
    console.log('─────────────────────────────────');

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const results = [];
    for (const [name, config] of Object.entries(PLATFORMS)) {
        const result = await scrapePlatform(name, config, browser);
        if (result) results.push(result);
    }

    await browser.close();

    console.log('\n📊 抓取结果汇总:');
    console.table(results.map(r => ({
        平台: r.tool,
        总额度: r.daily_credits === 999999 ? '∞' : r.daily_credits,
        今日已用: r.used_today,
        剩余: r.daily_credits === 999999 ? '∞' : r.daily_credits - r.used_today,
    })));

    if (doUpdate && results.length > 0) {
        console.log('\n⬆️ 写入 Supabase...');
        await updateSupabase(results);
    } else if (!doUpdate) {
        console.log('\n💡 使用 --update 参数将结果写入 Supabase');
    }

    console.log('\n✅ 完成');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
