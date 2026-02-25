import { FreeModel, ModelDiff } from '@/types';

/**
 * P2: X (Twitter) 推送通知
 * 使用 Twitter API v2 / OAuth2 Bearer Token 发推文
 * 需要配置：X_BEARER_TOKEN 或 X_API_KEY + X_API_SECRET + X_ACCESS_TOKEN + X_ACCESS_SECRET
 */
export async function notifyX(diff: ModelDiff): Promise<void> {
    const bearerToken = process.env.X_BEARER_TOKEN;
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_SECRET;

    // 至少需要 Bearer Token（只读）或 OAuth1.0a 四元组（可发推）
    if (!accessToken || !accessSecret || !apiKey || !apiSecret) {
        if (bearerToken) {
            console.warn('[X] Warning: Bearer Token only supports read ops. Cannot post tweets.');
        }
        return;
    }

    const tweets = buildXTweets(diff);
    for (const text of tweets) {
        try {
            await postTweet(text, { apiKey, apiSecret, accessToken, accessSecret });
        } catch (err) {
            console.error('[X] Tweet failed:', err);
        }
    }
}

function buildXTweets(diff: ModelDiff): string[] {
    const tweets: string[] = [];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://freeor.app';

    if (diff.added.length > 0) {
        const modelLines = diff.added.slice(0, 3).map(m => {
            const ctx = m.context ? `${Math.round(m.context / 1000)}K ctx` : '';
            return `• ${m.name}${ctx ? ` (${ctx})` : ''}`;
        });
        const more = diff.added.length > 3 ? `\n+${diff.added.length - 3} more` : '';
        tweets.push(
            `🆓 ${diff.added.length} new FREE model${diff.added.length > 1 ? 's' : ''} on OpenRouter!\n\n` +
            modelLines.join('\n') + more +
            `\n\n👉 ${siteUrl}\n#OpenRouter #FreeAI #LLM`
        );
    }

    if (diff.removed.length > 0) {
        const modelLines = diff.removed.slice(0, 3).map(m => `• ${m.name}`);
        tweets.push(
            `⚠️ ${diff.removed.length} model${diff.removed.length > 1 ? 's' : ''} removed from free tier:\n\n` +
            modelLines.join('\n') +
            `\n\nCheck alternatives 👉 ${siteUrl}\n#OpenRouter #FreeAI`
        );
    }

    return tweets;
}

/** OAuth 1.0a 签名发推文（Twitter API v2） */
async function postTweet(
    text: string,
    auth: { apiKey: string; apiSecret: string; accessToken: string; accessSecret: string }
): Promise<void> {
    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).slice(2, 17);

    // OAuth 1.0a 参数
    const oauthParams: Record<string, string> = {
        oauth_consumer_key: auth.apiKey,
        oauth_nonce: nonce,
        oauth_signature_method: 'HMAC-SHA256',
        oauth_timestamp: timestamp,
        oauth_token: auth.accessToken,
        oauth_version: '1.0',
    };

    // Build signature base string
    const paramString = Object.entries(oauthParams)
        .sort()
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(auth.apiSecret)}&${encodeURIComponent(auth.accessSecret)}`;

    // HMAC-SHA256 signature (Web Crypto API, works in Edge Runtime)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(signingKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureBase));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sig)));

    const authHeader =
        'OAuth ' +
        Object.entries({ ...oauthParams, oauth_signature: signature })
            .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
            .join(', ');

    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`X API ${res.status}: ${err}`);
    }
}
