// ─────────────────────────────────────────────────────────────
// Odometer OCR (Tesseract.js, self-hosted assets in /public/ocr).
// The worker + LSTM core + English data (~15 MB) download once on first use and are
// cached (IndexedDB for the language data, the driver service worker for the rest).
// Everything runs on-device: no cloud OCR, works on the Spark plan.
// ─────────────────────────────────────────────────────────────
import type Tesseract from 'tesseract.js';

export interface OcrCrop {
  /** 0..1 fractions of the source image. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrResult {
  km: number | null;
  confidence: number; // 0–100
  raw: string;
  candidates: { km: number; confidence: number }[];
}

export interface OcrProgress {
  status: string;
  /** 0..1 */
  progress: number;
}

type Listener = (p: OcrProgress) => void;

let workerP: Promise<Tesseract.Worker> | null = null;
let listener: Listener | null = null;

const OCR_READY_KEY = 'hp:ocr:ready';

/** True once the OCR engine has been downloaded on this device (best-effort hint for the UI). */
export function ocrCached(): boolean {
  try {
    return localStorage.getItem(OCR_READY_KEY) === '1';
  } catch {
    return false;
  }
}

/** Absolute URL of the self-hosted OCR assets (works with a sub-path / relative Vite base). */
const ocrBase = () => new URL(`${import.meta.env.BASE_URL || '/'}ocr/`.replace(/^\.\//, ''), document.baseURI).href;
let idleTimer: number | undefined;

async function getWorker(): Promise<Tesseract.Worker> {
  window.clearTimeout(idleTimer);
  workerP ??= (async () => {
    const mod = await import('tesseract.js');
    const T = ((mod as unknown as { default?: typeof Tesseract }).default ?? mod) as typeof Tesseract;
    const worker = await T.createWorker('eng', 1 /* LSTM only */, {
      workerPath: `${ocrBase()}worker.min.js`,
      corePath: ocrBase(),
      langPath: ocrBase(),
      gzip: true,
      cacheMethod: 'write',
      workerBlobURL: false,
      logger: (m: { status: string; progress: number }) => listener?.({ status: m.status, progress: m.progress ?? 0 }),
      errorHandler: (e: unknown) => console.warn('[ocr]', e),
    });
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789',
      tessedit_pageseg_mode: T.PSM.SINGLE_LINE,
      user_defined_dpi: '300',
    });
    try {
      localStorage.setItem(OCR_READY_KEY, '1');
    } catch {
      /* ignore */
    }
    return worker;
  })();
  try {
    return await workerP;
  } catch (e) {
    workerP = null;
    throw e;
  }
}

/** Start downloading the engine in the background (e.g. when the start-trip screen opens). */
export function warmOcr(): void {
  void getWorker().catch(() => undefined);
}

/** Free the engine's memory (~100 MB) once the capture screen has been closed for a while. */
export function releaseOcr(afterMs = 60_000): void {
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => void terminateOcr(), afterMs);
}

export async function terminateOcr(): Promise<void> {
  const p = workerP;
  workerP = null;
  if (!p) return;
  try {
    await (await p).terminate();
  } catch {
    /* ignore */
  }
}

// ── image preprocessing ──────────────────────────────────────

async function toCanvas(image: Blob | HTMLCanvasElement, crop?: OcrCrop): Promise<HTMLCanvasElement> {
  let src: CanvasImageSource;
  let sw: number;
  let sh: number;
  let close: (() => void) | null = null;
  if (image instanceof HTMLCanvasElement) {
    src = image;
    sw = image.width;
    sh = image.height;
  } else {
    let bmp: ImageBitmap | HTMLImageElement;
    try {
      bmp = await createImageBitmap(image, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      close = () => (bmp as ImageBitmap).close();
    } catch {
      const url = URL.createObjectURL(image);
      const img = new Image();
      img.src = url;
      await img.decode();
      URL.revokeObjectURL(url);
      bmp = img;
    }
    src = bmp;
    sw = bmp.width;
    sh = bmp.height;
  }
  const c = clampCrop(crop);
  const cx = Math.round(c.x * sw);
  const cy = Math.round(c.y * sh);
  const cw = Math.max(8, Math.round(c.w * sw));
  const ch = Math.max(8, Math.round(c.h * sh));
  // upscale to ~900 px wide (tesseract likes ~30–60 px glyph height), cap height
  let scale = 900 / cw;
  if (ch * scale > 420) scale = 420 / ch;
  const w = Math.max(32, Math.round(cw * scale));
  const h = Math.max(16, Math.round(ch * scale));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, w, h);
  close?.();
  return out;
}

function clampCrop(c?: OcrCrop): OcrCrop {
  if (!c) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(Math.max(c.x, 0), 0.98);
  const y = Math.min(Math.max(c.y, 0), 0.98);
  return { x, y, w: Math.min(Math.max(c.w, 0.02), 1 - x), h: Math.min(Math.max(c.h, 0.02), 1 - y) };
}

/** Luma, contrast-stretched to 2nd–98th percentile. */
function grayStretch(cv: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
  const n = cv.width * cv.height;
  const g = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const v = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
    g[i] = v;
    hist[g[i]]++;
  }
  let lo = 0;
  let hi = 255;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= n * 0.02) {
      lo = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= n * 0.02) {
      hi = i;
      break;
    }
  }
  if (hi - lo > 10) {
    const k = 255 / (hi - lo);
    for (let i = 0; i < n; i++) g[i] = (g[i] - lo) * k;
  }
  return g;
}

function otsu(g: Uint8ClampedArray): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < g.length; i++) hist[g[i]]++;
  const total = g.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/** 1 = ink (dark), 0 = paper. */
function binGlobal(g: Uint8ClampedArray, thr: number): Uint8Array {
  const b = new Uint8Array(g.length);
  for (let i = 0; i < g.length; i++) b[i] = g[i] <= thr ? 1 : 0;
  return b;
}

/** Bradley adaptive threshold (integral image), window ≈ height/2. */
function binAdaptive(g: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(h / 4));
  const b = new Uint8Array(g.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
      const s = ii[(y1 + 1) * (w + 1) + x1 + 1] - ii[y0 * (w + 1) + x1 + 1] - ii[(y1 + 1) * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      b[y * w + x] = g[y * w + x] * cnt <= s * 0.85 ? 1 : 0;
    }
  }
  return b;
}

function invert(b: Uint8Array): Uint8Array {
  const o = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) o[i] = b[i] ? 0 : 1;
  return o;
}

/** Ink should be the minority; flip when the "ink" covers most of the crop (light-on-dark displays). */
function normalisePolarity(b: Uint8Array): Uint8Array {
  let ink = 0;
  for (let i = 0; i < b.length; i++) ink += b[i];
  return ink > b.length * 0.5 ? invert(b) : b;
}

/** Remove ink touching the left/right borders (bezel edges, drum separators). */
function clearBorders(b: Uint8Array, w: number, h: number): Uint8Array {
  const o = b.slice();
  const stack: number[] = [];
  const seed = (i: number) => {
    if (o[i]) {
      o[i] = 0;
      stack.push(i);
    }
  };
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  let removed = 0;
  while (stack.length) {
    const i = stack.pop()!;
    removed++;
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i >= w) seed(i - w);
    if (i < (h - 1) * w) seed(i + w);
  }
  // if we wiped most of the ink (digits touched the border) keep the original
  let ink = 0;
  let inkO = 0;
  for (let i = 0; i < b.length; i++) {
    ink += b[i];
    inkO += o[i];
  }
  return removed && inkO < ink * 0.35 ? b : o;
}

function dilate(b: Uint8Array, w: number, h: number): Uint8Array {
  const o = new Uint8Array(b.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      o[i] = b[i] || (x > 0 && b[i - 1]) || (x < w - 1 && b[i + 1]) || (y > 0 && b[i - w]) || (y < h - 1 && b[i + w]) ? 1 : 0;
    }
  }
  return o;
}

function render(b: Uint8Array, w: number, h: number, pad = 24): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < b.length; i++) {
    const v = b[i] ? 0 : 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, pad, pad);
  return c;
}

// ── parsing ──────────────────────────────────────────────────

interface Read {
  digits: string;
  confidence: number;
  raw: string;
}

function parse(raw: string, confidence: number): Read | null {
  const runs = raw.replace(/[ \t]+/g, '').match(/\d+/g) ?? [];
  const digits = runs.sort((a, b) => b.length - a.length)[0] ?? '';
  if (digits.length < 3 || digits.length > 7) return null;
  return { digits, confidence, raw };
}

/**
 * Read an odometer from a photo (or canvas). `crop` = the odometer digits as 0..1 fractions.
 * Tries several binarisations (normal / inverted / adaptive / thickened) and keeps the most
 * confident 3–7 digit reading. A 7-digit read is ambiguous (tenths drum?) — both values are
 * returned in `candidates` so the UI can let the driver pick.
 */
export async function readOdometer(
  image: Blob | HTMLCanvasElement,
  crop?: OcrCrop,
  opts: { onProgress?: Listener } = {},
): Promise<OcrResult> {
  listener = opts.onProgress ?? null;
  try {
    const worker = await getWorker();
    opts.onProgress?.({ status: 'reading', progress: 0 });
    const cv = await toCanvas(image, crop);
    const w = cv.width;
    const h = cv.height;
    const g = grayStretch(cv);
    const base = normalisePolarity(binGlobal(g, otsu(g)));
    const variants: (() => Uint8Array)[] = [
      () => clearBorders(base, w, h),
      () => clearBorders(normalisePolarity(binAdaptive(g, w, h)), w, h),
      () => dilate(clearBorders(base, w, h), w, h),
      () => invert(base),
    ];
    const reads: Read[] = [];
    let firstRaw = '';
    for (let i = 0; i < variants.length; i++) {
      const canvas = render(variants[i](), w, h);
      let to: number | undefined;
      const { data } = await Promise.race([
        worker.recognize(canvas),
        new Promise<never>((_, rej) => {
          to = window.setTimeout(() => {
            void terminateOcr(); // a stuck worker is discarded; the next scan starts a fresh one
            rej(new Error('OCR timed out'));
          }, 30_000);
        }),
      ]).finally(() => window.clearTimeout(to));
      const raw = (data.text || '').trim();
      if (!firstRaw && raw) firstRaw = raw;
      const r = parse(raw, data.confidence ?? 0);
      if (r) reads.push(r);
      opts.onProgress?.({ status: 'reading', progress: (i + 1) / variants.length });
      // good enough — stop early
      if (r && r.confidence >= 88 && r.digits.length >= 4) break;
    }
    if (!reads.length) return { km: null, confidence: 0, raw: firstRaw, candidates: [] };

    // vote: same digit string from several variants boosts confidence
    const byDigits = new Map<string, Read & { votes: number }>();
    for (const r of reads) {
      const cur = byDigits.get(r.digits);
      if (cur) {
        cur.votes++;
        cur.confidence = Math.max(cur.confidence, r.confidence);
      } else byDigits.set(r.digits, { ...r, votes: 1 });
    }
    const ranked = [...byDigits.values()]
      .map((r) => ({ ...r, score: Math.min(100, r.confidence + (r.votes - 1) * 6) }))
      .sort((a, b) => b.score - a.score);
    const top = ranked[0];
    const candidates: { km: number; confidence: number }[] = [];
    const push = (km: number, confidence: number) => {
      if (!candidates.some((c) => c.km === km)) candidates.push({ km, confidence: Math.round(confidence) });
    };
    for (const r of ranked) {
      const n = Number(r.digits);
      if (r.digits.length === 7) {
        // most likely 6 km drums + a tenths drum
        push(Number(r.digits.slice(0, 6)), r.score);
        push(n, r.score * 0.8);
      } else {
        push(n, r.score);
      }
    }
    return { km: candidates[0]?.km ?? null, confidence: Math.round(top.score), raw: top.raw, candidates: candidates.slice(0, 4) };
  } finally {
    listener = null;
  }
}
