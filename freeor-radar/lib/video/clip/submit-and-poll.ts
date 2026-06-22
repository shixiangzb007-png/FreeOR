const POLL_INTERVAL_MS = 4_000;
const POLL_MAX_MS = 10 * 60_000;

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

export interface VideoSubmitOptions {
    prompt: string;
    model: string;
    duration: number;
    lang: string;
    input_references?: Array<{ type: 'image_url'; image_url: { url: string } }>;
}

/** Submit video job and poll until completed or failed. */
export async function submitAndPollVideo(
    opts: VideoSubmitOptions,
    apiKey: string,
    onStatus?: (status: string) => void
): Promise<string> {
    const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            prompt: opts.prompt,
            model: opts.model,
            lang: opts.lang,
            duration: opts.duration,
            input_references: opts.input_references,
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Submit failed');
    }

    if (data.status === 'completed' && data.video_url) {
        return data.video_url as string;
    }

    const pollingUrl = data.polling_url as string | undefined;
    if (!pollingUrl) {
        throw new Error(data.error || 'No polling URL');
    }

    const deadline = Date.now() + POLL_MAX_MS;
    onStatus?.('processing');

    while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);

        const pollRes = await fetch('/api/video/poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ polling_url: pollingUrl, lang: opts.lang }),
        });
        const pollData = await pollRes.json();

        if (pollData.status === 'completed' && pollData.video_url) {
            return pollData.video_url as string;
        }
        if (!pollRes.ok || pollData.error) {
            throw new Error(pollData.error || 'Generation failed');
        }
        onStatus?.(pollData.status || 'processing');
    }

    throw new Error('TIMEOUT');
}
