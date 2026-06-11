/**
 * 匿名客户端标识：浏览器本地生成的稳定 UUID（localStorage）。
 * 用于无登录场景下归属通知订阅（notification_subscriptions）
 * 与模型关注（model_watches）。
 */
const CLIENT_ID_KEY = 'freeor-client-id';

export function getClientId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
}
