import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Finger signature pad (pointer events). Calls onChange with a trimmed PNG data URL
 * (white background, dark ink — readable on any console theme) or null when cleared.
 */
export default function SignaturePad({
  onChange,
  label = 'Signature',
  height = 200,
}: {
  onChange: (dataUrl: string | null) => void;
  label?: string;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    c.width = Math.round(w * dpr);
    c.height = Math.round(height * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${height}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.6;
    box.current = null;
    setEmpty(true);
  }, [height]);

  useEffect(() => {
    setup();
    // resizing would distort the strokes — reset only when the width really changes (rotation)
    let lastW = wrapRef.current?.clientWidth ?? 0;
    const onResize = () => {
      const w = wrapRef.current?.clientWidth ?? 0;
      if (Math.abs(w - lastW) > 40) {
        lastW = w;
        setup();
        onChange(null);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setup, onChange]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const grow = (p: { x: number; y: number }) => {
    const b = box.current;
    box.current = b
      ? { x0: Math.min(b.x0, p.x), y0: Math.min(b.y0, p.y), x1: Math.max(b.x1, p.x), y1: Math.max(b.y1, p.y) }
      : { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    grow(p);
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = '#111827';
    ctx.fill();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    const l = last.current;
    const mid = { x: (l.x + p.x) / 2, y: (l.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.quadraticCurveTo(l.x, l.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    grow(p);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setEmpty(false);
    onChange(exportPng());
  };

  const exportPng = (): string | null => {
    const c = canvasRef.current;
    const b = box.current;
    if (!c || !b) return null;
    const dpr = c.width / c.clientWidth || 1;
    const pad = 12;
    const x = Math.max(0, Math.floor((b.x0 - pad) * dpr));
    const y = Math.max(0, Math.floor((b.y0 - pad) * dpr));
    const w = Math.min(c.width - x, Math.ceil((b.x1 - b.x0 + pad * 2) * dpr));
    const h = Math.min(c.height - y, Math.ceil((b.y1 - b.y0 + pad * 2) * dpr));
    // normalise to ≤ 600 px wide to keep the media doc small
    const s = Math.min(1, 600 / w);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w * s));
    out.height = Math.max(1, Math.round(h * s));
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  const clear = () => {
    setup();
    onChange(null);
  };

  return (
    <div className="drv-sig">
      <div className="drv-sig-head">
        <span className="label" id="sig-label">
          {label}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={empty}>
          Clear
        </button>
      </div>
      <div className="drv-sig-pad" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-labelledby="sig-label"
          aria-describedby="sig-hint"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
          style={{ touchAction: 'none' }}
        />
        {empty && (
          <span className="drv-sig-ph" aria-hidden="true">
            Sign here with your finger
          </span>
        )}
        <span className="drv-sig-line" aria-hidden="true" />
      </div>
      <span id="sig-hint" className="hint">
        {empty ? 'Ask the recipient to sign inside the box.' : 'Signature captured.'}
      </span>
    </div>
  );
}
