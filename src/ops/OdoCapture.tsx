import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { MediaKind, OdoReading, OpsUser } from './types';
import { putMedia } from './store';
import { compressImage } from './image';
import { ocrCached, readOdometer, releaseOcr, warmOcr, type OcrCrop, type OcrResult } from './ocr';
import { Icon } from '../components/Icon';

type Mode = 'choose' | 'camera' | 'manual';
type Drag = { kind: 'move' | 'tl' | 'br'; px: number; py: number; start: OcrCrop } | null;

const DEFAULT_CROP: OcrCrop = { x: 0.14, y: 0.38, w: 0.72, h: 0.24 };
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/**
 * Odometer capture: scan (photo → crop → on-device OCR → driver confirms) or type it in.
 * Always stores the photo when one was taken. `method` is 'manual' when the driver edits the OCR value.
 */
export default function OdoCapture({
  tenantId,
  user,
  kind,
  minKm,
  lastKnownKm,
  jobId,
  label: labelProp,
  onDone,
  onCancel,
}: {
  tenantId: string;
  user: OpsUser;
  kind: Extract<MediaKind, 'odo_start' | 'odo_end' | 'fuel_odo'>;
  minKm?: number;
  lastKnownKm?: number;
  jobId?: string;
  /** Field label, defaults to "Start odometer" / "End odometer". */
  label?: string;
  onDone: (reading: OdoReading) => void;
  onCancel?: () => void;
}) {
  const [mode, setMode] = useState<Mode>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<OcrCrop>(DEFAULT_CROP);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrErr, setOcrErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ status: string; progress: number } | null>(null);
  const [value, setValue] = useState('');
  const [ack, setAck] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => () => releaseOcr(), []);
  const label = labelProp ?? (kind === 'odo_start' ? 'Start odometer' : 'End odometer');

  // ── validation ──
  const parsed = /^\d{1,7}([.,]\d)?$/.test(value.trim()) ? Number(value.trim().replace(',', '.')) : NaN;
  const invalid = value.trim() !== '' && Number.isNaN(parsed);
  const belowMin = !Number.isNaN(parsed) && typeof minKm === 'number' && parsed < minKm;
  const warn =
    !Number.isNaN(parsed) && typeof lastKnownKm === 'number' && lastKnownKm > 0
      ? parsed < lastKnownKm
        ? `Lower than the last known reading (${fmt(lastKnownKm)} km).`
        : parsed > lastKnownKm + 2000
          ? `${fmt(parsed - lastKnownKm)} km more than the last known reading (${fmt(lastKnownKm)} km).`
          : null
      : null;
  useEffect(() => {
    setAck(false);
  }, [value]);
  const canSave = !Number.isNaN(parsed) && !belowMin && (!warn || ack) && !saving;

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setCrop(DEFAULT_CROP);
    setOcr(null);
    setOcrErr(null);
    setMode('camera');
    warmOcr();
  };

  const runOcr = async () => {
    if (!file) return;
    setOcrErr(null);
    setOcr(null);
    setProgress({ status: ocrCached() ? 'starting' : 'downloading', progress: 0 });
    try {
      const r = await readOdometer(file, crop, { onProgress: setProgress });
      setOcr(r);
      if (r.km === null) setOcrErr('Could not read the digits. Move the box tightly over the numbers and try again — or type the reading.');
      else setValue(String(bestCandidate(r, lastKnownKm)));
    } catch (e) {
      console.warn('[odo] OCR failed', e);
      setOcrErr('Scanning is not available right now. Please type the reading below.');
    } finally {
      setProgress(null);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setErr(null);
    try {
      let photoId: string | undefined;
      if (file) {
        const img = await compressImage(file, 1280, 0.7);
        photoId = await putMedia(tenantId, { kind, jobId, dataUrl: img.dataUrl, by: user.uid, at: Date.now(), w: img.w, h: img.h });
      }
      const usedOcr = ocr?.km != null && ocr.candidates.some((c) => c.km === parsed);
      onDone({
        km: parsed,
        at: Date.now(),
        method: usedOcr ? 'ocr' : 'manual',
        ocrKm: ocr?.km ?? undefined,
        ocrConfidence: ocr?.km != null ? ocr.confidence : undefined,
        photoId,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the reading');
      setSaving(false);
    }
  };

  // ── crop box dragging ──
  const onDown = (k: 'move' | 'tl' | 'br') => (e: RPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: k, px: e.clientX, py: e.clientY, start: crop };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    const el = boxRef.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - d.px) / r.width;
    const dy = (e.clientY - d.py) / r.height;
    const s = d.start;
    const MIN = 0.06;
    let n: OcrCrop;
    if (d.kind === 'move') n = { ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) };
    else if (d.kind === 'br') n = { ...s, w: clamp(s.w + dx, MIN, 1 - s.x), h: clamp(s.h + dy, MIN, 1 - s.y) };
    else {
      const x = clamp(s.x + dx, 0, s.x + s.w - MIN);
      const y = clamp(s.y + dy, 0, s.y + s.h - MIN);
      n = { x, y, w: s.w + (s.x - x), h: s.h + (s.y - y) };
    }
    setCrop(n);
  };
  const onUp = () => {
    if (drag.current) setOcr(null);
    drag.current = null;
  };

  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const progressLabel = progress
    ? progress.status === 'reading'
      ? `Reading digits… ${Math.round(progress.progress * 100)}%`
      : /load|download|core|lang/i.test(progress.status) && !ocrCached()
        ? `Downloading scanner (one-time, ~15 MB)… ${Math.round(progress.progress * 100)}%`
        : 'Starting scanner…'
    : '';

  return (
    <div className="drv-odo">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />

      {mode === 'choose' && (
        <div className="drv-odo-choose">
          <button type="button" className="drv-bigchoice" onClick={() => fileRef.current?.click()}>
            <Icon name="eye" size={30} />
            <strong>Scan odometer</strong>
            <span>Take a photo — the app reads the number</span>
          </button>
          <button type="button" className="drv-bigchoice drv-bigchoice-alt" onClick={() => setMode('manual')}>
            <Icon name="settings" size={30} />
            <strong>Type it in</strong>
            <span>Enter the km reading yourself</span>
          </button>
          {typeof lastKnownKm === 'number' && lastKnownKm > 0 && <p className="hint drv-center">Last known reading: {fmt(lastKnownKm)} km</p>}
          {onCancel && (
            <button type="button" className="btn btn-ghost btn-block" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      )}

      {mode === 'camera' && url && (
        <div className="drv-odo-cam">
          <p className="hint">Drag the box over the odometer digits (km only). Use the corner handles to resize.</p>
          <div className="drv-crop" ref={boxRef} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <img src={url} alt="Odometer photo" draggable={false} />
            <div className="drv-crop-shade" style={{ clipPath: shadePath(crop) }} aria-hidden="true" />
            <div
              className="drv-crop-box"
              style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
              onPointerDown={onDown('move')}
              role="presentation"
            >
              <span className="drv-crop-h drv-crop-tl" onPointerDown={onDown('tl')} />
              <span className="drv-crop-h drv-crop-br" onPointerDown={onDown('br')} />
            </div>
          </div>
          <div className="drv-row2">
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={!!progress}>
              Retake
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void runOcr()} disabled={!!progress}>
              {progress ? 'Reading…' : ocr ? 'Read again' : 'Read number'}
            </button>
          </div>
          {progress && (
            <div className="drv-progress" role="status" aria-live="polite">
              <div className="drv-progress-bar">
                <span style={{ width: `${Math.round(Math.max(0.05, progress.progress) * 100)}%` }} />
              </div>
              <span className="small">{progressLabel}</span>
            </div>
          )}
          {ocr?.km != null && (
            <div className="drv-ocr-result" role="status" aria-live="polite">
              <span className="small muted">Scanner read</span>
              <strong className="drv-ocr-km">{fmt(ocr.km)} km</strong>
              <span className={`drv-conf ${ocr.confidence >= 80 ? 'hi' : ocr.confidence >= 55 ? 'mid' : 'lo'}`}>{ocr.confidence}% sure</span>
              {ocr.candidates.length > 1 && (
                <div className="drv-chips" role="group" aria-label="Other possible readings">
                  {ocr.candidates.map((c) => (
                    <button key={c.km} type="button" className={`drv-chip ${String(c.km) === value ? 'on' : ''}`} onClick={() => setValue(String(c.km))}>
                      {fmt(c.km)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {ocrErr && (
            <p className="alert alert-warn" role="alert">
              {ocrErr}
            </p>
          )}
        </div>
      )}

      {mode !== 'choose' && (
        <div className="drv-odo-entry">
          <label className="field">
            <span className="label">{label} (km){mode === 'camera' ? ' — check it matches the dial' : ''}</span>
            <input
              className="input drv-km-input"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              placeholder={typeof lastKnownKm === 'number' && lastKnownKm > 0 ? String(Math.round(lastKnownKm)) : 'e.g. 184235'}
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, '').slice(0, 9))}
              aria-invalid={invalid || belowMin}
              autoFocus={mode === 'manual'}
            />
          </label>
          {invalid && <p className="field-error">Whole km, or one decimal (e.g. 184235 or 184235.4).</p>}
          {belowMin && <p className="field-error">Must be at least {fmt(minKm!)} km (start of trip).</p>}
          {warn && !belowMin && (
            <div className="alert alert-warn">
              <div className="stack" style={{ gap: 8 }}>
                <span>{warn} Please double-check.</span>
                <label className="checkbox drv-check">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>I checked — the reading is correct</span>
                </label>
              </div>
            </div>
          )}
          {mode === 'manual' && !file && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => fileRef.current?.click()}>
              <Icon name="eye" size={18} /> Add photo of the odometer (recommended)
            </button>
          )}
          {err && (
            <p className="field-error" role="alert">
              {err}
            </p>
          )}
          <div className="drv-row2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode('choose');
                setFile(null);
                setOcr(null);
                setOcrErr(null);
                setValue('');
              }}
            >
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => void save()}>
              {saving ? 'Saving…' : Number.isNaN(parsed) ? 'Confirm' : `Confirm ${fmt(parsed)} km`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

/** Darken everything outside the crop box (polygon with a hole). */
function shadePath(c: OcrCrop): string {
  const p = (n: number) => `${(n * 100).toFixed(2)}%`;
  const [l, t, r, b] = [p(c.x), p(c.y), p(c.x + c.w), p(c.y + c.h)];
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l} ${t}, ${l} ${b}, ${r} ${b}, ${r} ${t}, ${l} ${t})`;
}

/** Prefer the candidate that makes sense against the last known reading. */
function bestCandidate(r: OcrResult, lastKnownKm?: number): number {
  if (!r.candidates.length) return r.km ?? 0;
  if (typeof lastKnownKm !== 'number' || lastKnownKm <= 0) return r.candidates[0].km;
  const plausible = r.candidates.filter((c) => c.km >= lastKnownKm - 1 && c.km <= lastKnownKm + 5000);
  if (!plausible.length) return r.candidates[0].km;
  return plausible.sort((a, b) => b.confidence - a.confidence)[0].km;
}
