import { Muxer, ArrayBufferTarget } from 'webm-muxer';
import { OverviewScene } from '@/types/overview';
import { normalizeSceneDuration } from './config';

const W = 1280;
const H = 720;
const COMPOSE_FPS = 15;

const FONT_ZH = 'Noto Sans SC';
const FONT_EN = 'Noto Sans';

let captionFontReady: Promise<{ family: string; lang: string }> | null = null;

/** Load Google Font so Canvas renders CJK captions correctly. */
export async function ensureCaptionFonts(lang: string): Promise<string> {
    const wantLang = lang === 'zh' ? 'zh' : 'en';
    if (captionFontReady) {
        const cached = await captionFontReady;
        if (cached.lang === wantLang) return cached.family;
    }

    const family = wantLang === 'zh' ? FONT_ZH : FONT_EN;
    const id = `freeor-overview-font-${wantLang}`;
    if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href =
            `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;600&display=swap`;
        document.head.appendChild(link);
    }

    captionFontReady = (async () => {
        try {
            await Promise.all([
                document.fonts.load(`600 22px "${family}"`),
                document.fonts.load(`500 28px "${family}"`),
            ]);
            await document.fonts.ready;
        } catch {
            // fall back to system fonts
        }
        return { family, lang: wantLang };
    })();

    const result = await captionFontReady;
    return result.family;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        if (!src) {
            reject(new Error('Scene image URL missing'));
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load scene image'));
        img.src = src;
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const ch of text) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = ch;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines.slice(0, 6);
}

function drawCaptionBlock(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    fontFamily: string
): void {
    const lineHeight = 38;
    const padX = 40;
    const padY = 20;
    const blockH = lines.length * lineHeight + padY * 2;
    const blockY = H - blockH - 32;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(padX - 8, blockY, W - padX * 2 + 16, blockH, 12);
    ctx.fill();

    ctx.font = `500 28px "${fontFamily}", "Microsoft YaHei", "PingFang SC", sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    let y = blockY + padY + 26;
    for (const ln of lines) {
        ctx.fillText(ln, padX + 8, y);
        y += lineHeight;
    }
    ctx.shadowBlur = 0;
}

function drawSceneFrame(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    narration: string,
    progress: number,
    fontFamily: string,
    title?: string
): void {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    const scale = 1.05 + progress * 0.12;
    const iw = img.width;
    const ih = img.height;
    const baseScale = Math.max(W / iw, H / ih);
    const sw = iw * baseScale * scale;
    const sh = ih * baseScale * scale;
    const ox = (W - sw) / 2 - progress * 30;
    const oy = (H - sh) / 2 - progress * 15;
    ctx.drawImage(img, ox, oy, sw, sh);

    const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.3, W, H * 0.7);

    if (title) {
        ctx.font = `600 22px "${fontFamily}", "Microsoft YaHei", sans-serif`;
        ctx.fillStyle = 'rgba(34,197,94,0.95)';
        ctx.fillText(title.slice(0, 48), 48, 48);
    }

    ctx.font = `500 28px "${fontFamily}", "Microsoft YaHei", "PingFang SC", sans-serif`;
    const lines = wrapText(ctx, narration, W - 120);
    drawCaptionBlock(ctx, lines, fontFamily);
}

function waitMs(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

function sceneFrameCount(scene: OverviewScene, fps: number, fallbackSec: number): number {
    const duration = normalizeSceneDuration(scene.duration_sec, scene.narration, fallbackSec);
    return Math.max(fps, Math.round(duration * fps));
}

interface FrameStep {
    sceneIdx: number;
    progress: number;
}

function buildFramePlan(scenes: OverviewScene[], fps: number, fallbackSec: number): FrameStep[] {
    const plan: FrameStep[] = [];
    for (let i = 0; i < scenes.length; i++) {
        const frames = sceneFrameCount(scenes[i], fps, fallbackSec);
        for (let f = 0; f < frames; f++) {
            plan.push({ sceneIdx: i, progress: f / Math.max(frames - 1, 1) });
        }
    }
    return plan;
}

function attachCanvas(canvas: HTMLCanvasElement): void {
    canvas.style.cssText =
        'position:fixed;left:-9999px;top:0;width:1280px;height:720px;pointer-events:none;opacity:0;';
    document.body.appendChild(canvas);
}

function detachCanvas(canvas: HTMLCanvasElement): void {
    if (canvas.parentNode) {
        document.body.removeChild(canvas);
    }
}

/** Fast offline encode via WebCodecs (~seconds, not minutes). */
async function composeWithWebCodecs(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    images: HTMLImageElement[],
    scenes: OverviewScene[],
    title: string,
    fontFamily: string,
    framePlan: FrameStep[],
    fps: number,
    onProgress?: (pct: number) => void
): Promise<Blob | null> {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
        return null;
    }

    const config = {
        codec: 'vp09.00.10.08',
        width: W,
        height: H,
        bitrate: 2_500_000,
        framerate: fps,
    };

    const supported = await VideoEncoder.isConfigSupported(config);
    if (!supported.supported) return null;

    const muxer = new Muxer({
        target: new ArrayBufferTarget(),
        video: { codec: 'V_VP9', width: W, height: H, frameRate: fps },
    });

    let encodeError: Error | null = null;
    const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => {
            encodeError = e;
        },
    });

    encoder.configure(config);

    const frameDurUs = Math.round(1_000_000 / fps);

    for (let i = 0; i < framePlan.length; i++) {
        if (encodeError) throw encodeError;

        const { sceneIdx, progress } = framePlan[i];
        const scene = scenes[sceneIdx];
        drawSceneFrame(
            ctx,
            images[sceneIdx],
            scene.narration,
            progress,
            fontFamily,
            sceneIdx === 0 ? title : undefined
        );

        const timestamp = i * frameDurUs;
        const frame = new VideoFrame(canvas, { timestamp, duration: frameDurUs });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();

        if ((i + 1) % 24 === 0 || i === framePlan.length - 1) {
            onProgress?.(Math.round(((i + 1) / framePlan.length) * 100));
            // Yield so React can update progress UI during long encodes.
            await waitMs(0);
        }
    }

    await encoder.flush();
    encoder.close();

    if (encodeError) throw encodeError;

    muxer.finalize();
    const buffer = muxer.target.buffer;
    if (!buffer) return null;
    return new Blob([buffer], { type: 'video/webm' });
}

/** Real-time fallback when WebCodecs is unavailable (slow). */
async function composeWithMediaRecorder(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    images: HTMLImageElement[],
    scenes: OverviewScene[],
    title: string,
    fontFamily: string,
    framePlan: FrameStep[],
    fps: number,
    onProgress?: (pct: number) => void
): Promise<Blob> {
    const frameIntervalMs = 1000 / fps;
    const stream = canvas.captureStream(0);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Video compose timed out — try Chrome/Edge or refresh'));
        }, Math.max(120_000, framePlan.length * frameIntervalMs + 60_000));

        recorder.onstop = () => {
            clearTimeout(timeout);
            resolve(new Blob(chunks, { type: mimeType }));
        };
        recorder.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('MediaRecorder failed'));
        };
    });

    drawSceneFrame(ctx, images[0], scenes[0].narration, 0, fontFamily, title);
    await waitMs(frameIntervalMs);
    recorder.start(1000);

    for (let i = 0; i < framePlan.length; i++) {
        const { sceneIdx, progress } = framePlan[i];
        const scene = scenes[sceneIdx];
        drawSceneFrame(
            ctx,
            images[sceneIdx],
            scene.narration,
            progress,
            fontFamily,
            sceneIdx === 0 ? title : undefined
        );

        if ((i + 1) % 12 === 0 || i === framePlan.length - 1) {
            onProgress?.(Math.round(((i + 1) / framePlan.length) * 100));
        }
        await waitMs(frameIntervalMs);
    }

    await waitMs(400);
    if (recorder.state === 'recording') {
        recorder.requestData();
        await waitMs(200);
        recorder.stop();
    }

    return done;
}

/**
 * Compose overview scenes into a single WebM video.
 * Prefers WebCodecs offline encoding (fast); falls back to real-time MediaRecorder.
 */
export async function composeOverviewVideo(
    scenes: OverviewScene[],
    title: string,
    lang: string,
    onProgress?: (pct: number) => void
): Promise<Blob> {
    if (typeof document === 'undefined') {
        throw new Error('composeOverviewVideo must run in the browser');
    }
    if (scenes.length === 0) throw new Error('No scenes to compose');

    const missing = scenes.findIndex(s => !s.image_url);
    if (missing >= 0) throw new Error(`Scene ${missing + 1} has no image`);

    const fontFamily = await ensureCaptionFonts(lang);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    attachCanvas(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        detachCanvas(canvas);
        throw new Error('Canvas 2D unavailable');
    }

    try {
        const images = await Promise.all(scenes.map(s => loadImage(s.image_url!)));
        const fallbackSec = 15;
        const framePlan = buildFramePlan(scenes, COMPOSE_FPS, fallbackSec);

        onProgress?.(0);

        const fastBlob = await composeWithWebCodecs(
            canvas,
            ctx,
            images,
            scenes,
            title,
            fontFamily,
            framePlan,
            COMPOSE_FPS,
            onProgress
        );

        if (fastBlob) {
            onProgress?.(100);
            return fastBlob;
        }

        // Slow path: warn via progress stall pattern; typically 1× video duration wall time.
        const slowBlob = await composeWithMediaRecorder(
            canvas,
            ctx,
            images,
            scenes,
            title,
            fontFamily,
            framePlan,
            COMPOSE_FPS,
            onProgress
        );
        onProgress?.(100);
        return slowBlob;
    } finally {
        detachCanvas(canvas);
    }
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportPlanJson(plan: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    downloadBlob(blob, filename);
}
