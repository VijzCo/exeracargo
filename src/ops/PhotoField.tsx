import { useRef, useState } from 'react';
import { compressImage } from './image';
import { Icon } from '../components/Icon';

export interface CapturedPhoto {
  dataUrl: string;
  w: number;
  h: number;
}

/** Take / choose up to `max` photos, compressed for Firestore. Thumbnails with remove. */
export default function PhotoField({
  label,
  value,
  onChange,
  max = 3,
  maxSide = 1280,
  quality = 0.7,
  hint,
}: {
  label: string;
  value: CapturedPhoto[];
  onChange: (p: CapturedPhoto[]) => void;
  max?: number;
  maxSide?: number;
  quality?: number;
  hint?: string;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const next = [...value];
      for (const f of Array.from(files)) {
        if (next.length >= max) break;
        if (!f.type.startsWith('image/')) continue;
        next.push(await compressImage(f, maxSide, quality));
      }
      onChange(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read the photo');
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = '';
      if (pickRef.current) pickRef.current.value = '';
    }
  };

  const full = value.length >= max;
  return (
    <div className="field drv-photos">
      <span className="label">
        {label} <span className="drv-count">{value.length}/{max}</span>
      </span>
      <div className="drv-photo-grid">
        {value.map((p, i) => (
          <div key={i} className="drv-thumb">
            <img src={p.dataUrl} alt={`${label} ${i + 1}`} />
            <button type="button" className="drv-thumb-x" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
        {!full && (
          <>
            <button type="button" className="drv-photo-add" onClick={() => camRef.current?.click()} disabled={busy}>
              <Icon name="eye" size={22} />
              <span>{busy ? 'Saving…' : 'Take photo'}</span>
            </button>
            <button type="button" className="drv-photo-add drv-photo-add-alt" onClick={() => pickRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={22} />
              <span>Gallery</span>
            </button>
          </>
        )}
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void add(e.target.files)} />
      <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} aria-label={`${label} from gallery`} />
      {hint && <span className="hint">{hint}</span>}
      {err && (
        <span className="field-error" role="alert">
          {err}
        </span>
      )}
    </div>
  );
}
