/**
 * Concatenate multiple video URLs into one WebM/MP4 blob using ffmpeg.wasm (client-only).
 */
export async function stitchVideoUrls(
    videoUrls: string[],
    onProgress?: (pct: number) => void
): Promise<Blob> {
    if (typeof window === 'undefined') {
        throw new Error('stitchVideoUrls must run in the browser');
    }
    if (videoUrls.length === 0) throw new Error('No videos to stitch');
    if (videoUrls.length === 1) {
        const res = await fetch(videoUrls[0]);
        if (!res.ok) throw new Error('Failed to fetch video');
        return res.blob();
    }

    onProgress?.(5);

    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

    const ffmpeg = new FFmpeg();
    const base = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

    ffmpeg.on('progress', ({ progress }) => {
        if (progress > 0) onProgress?.(20 + Math.round(progress * 70));
    });

    await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    onProgress?.(15);

    const listLines: string[] = [];
    for (let i = 0; i < videoUrls.length; i++) {
        const name = `seg${i}.mp4`;
        const data = await fetchFile(videoUrls[i]);
        await ffmpeg.writeFile(name, data);
        listLines.push(`file '${name}'`);
    }

    await ffmpeg.writeFile('list.txt', listLines.join('\n'));
    onProgress?.(25);

    await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'list.txt',
        '-c', 'copy',
        'out.mp4',
    ]);

    onProgress?.(95);

    const out = await ffmpeg.readFile('out.mp4');
    const bytes = out instanceof Uint8Array ? out : new TextEncoder().encode(String(out));
    onProgress?.(100);

    return new Blob([bytes.slice()], { type: 'video/mp4' });
}

export function downloadVideoBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
