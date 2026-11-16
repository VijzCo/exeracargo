// Exact stop locations without paid APIs: pick on a map (Leaflet + OpenStreetMap), paste a Google Maps
// link / coordinates, or reuse a saved place from the customer address book.
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '../../components/Icon';
import PlacePicker from '../../components/PlacePicker';
import { findPlace, haversineKm } from '../../geo';
import { newId, savePlace } from '../../ops/store';
import { distanceM, fmtLL, parsePin, viewUrl, type LatLng } from '../../ops/maps';
import type { SavedPlace } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { errMsg, Field, Modal, useUi } from '../ui';
import './ops-admin.css';

const pinIcon = (kind: 'pickup' | 'dropoff' = 'pickup') =>
  L.divIcon({ className: 'ops-mk-wrap', html: `<span class="ops-pin ops-pin-${kind} ops-pin-big" aria-hidden="true"></span>`, iconSize: [22, 22], iconAnchor: [11, 11] });

/** Leaflet map with one draggable pin. Click anywhere to move it. */
export function PinMap({ value, centre, onChange, height = 360, readOnly }: { value: LatLng | null; centre?: LatLng | null; onChange?: (p: LatLng) => void; height?: number; readOnly?: boolean }) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mkRef = useRef<L.Marker | null>(null);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const start = value ?? centre ?? { lat: -26.2, lng: 28.05 };
    const map = L.map(elRef.current, { zoomControl: true }).setView([start.lat, start.lng], value ? 16 : centre ? 13 : 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    const place = (p: LatLng) => {
      if (!mkRef.current) {
        const mk = L.marker([p.lat, p.lng], { icon: pinIcon(), draggable: !readOnly, keyboard: true, title: 'Exact location' }).addTo(map);
        mk.on('dragend', () => {
          const ll = mk.getLatLng();
          cbRef.current?.({ lat: ll.lat, lng: ll.lng });
        });
        mkRef.current = mk;
      } else mkRef.current.setLatLng([p.lat, p.lng]);
    };
    if (value) place(value);
    if (!readOnly)
      map.on('click', (e: L.LeafletMouseEvent) => {
        place({ lat: e.latlng.lat, lng: e.latlng.lng });
        cbRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      mkRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // external value changes (paste) → move pin + view
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;
    if (!mkRef.current) {
      const mk = L.marker([value.lat, value.lng], { icon: pinIcon(), draggable: !readOnly, keyboard: true, title: 'Exact location' }).addTo(map);
      mk.on('dragend', () => {
        const ll = mk.getLatLng();
        cbRef.current?.({ lat: ll.lat, lng: ll.lng });
      });
      mkRef.current = mk;
    } else {
      const cur = mkRef.current.getLatLng();
      if (Math.abs(cur.lat - value.lat) < 1e-7 && Math.abs(cur.lng - value.lng) < 1e-7) return;
      mkRef.current.setLatLng([value.lat, value.lng]);
    }
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
  }, [value, readOnly]);

  return <div ref={elRef} className="ops-pinmap" style={{ height, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }} role="application" aria-label={readOnly ? 'Map preview' : 'Map: click or drag the pin to set the exact location'} />;
}

/** Warning when a pin is far from the chosen town (likely a wrong paste / click). */
export function farFromTown(pin: LatLng, placeId?: string): string | null {
  const p = findPlace(placeId);
  if (!p) return null;
  const km = haversineKm(pin, p);
  return km > 50 ? `This pin is ${Math.round(km)} km from ${p.name} — check it’s the right spot.` : null;
}

/** "Pick on map" dialog with paste support. */
export function PinPickerModal({ open, onClose, title, initial, placeId, onPick }: { open: boolean; onClose: () => void; title: string; initial: LatLng | null; placeId?: string; onPick: (p: LatLng) => void }) {
  const town = findPlace(placeId);
  const [pin, setPin] = useState<LatLng | null>(initial);
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setPin(initial);
      setPaste('');
      setErr(null);
    }
  }, [open, initial]);
  const usePaste = () => {
    const r = parsePin(paste);
    if (r.ok) {
      setPin(r.pin);
      setErr(null);
    } else setErr(r.error);
  };
  const warn = pin ? farFromTown(pin, placeId) : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!pin} onClick={() => pin && (onPick(pin), onClose())}>
            <Icon name="check" size={16} /> Use this location
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        <p className="small muted" style={{ margin: 0 }}>
          Click the map (or drag the pin) to the gate / loading bay{town ? ` in ${town.name}` : ''}. Or paste a Google Maps link or coordinates below.
        </p>
        <div className="row" style={{ gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <Field label="Google Maps link or coordinates" error={err ?? undefined}>
            <input
              className="input"
              value={paste}
              placeholder="https://www.google.com/maps/…  or  -26.1234, 28.2345"
              aria-invalid={!!err || undefined}
              onChange={(e) => setPaste(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  usePaste();
                }
              }}
            />
          </Field>
          <button type="button" className="btn btn-ghost" onClick={usePaste} disabled={!paste.trim()}>
            Use link
          </button>
        </div>
        {open ? <PinMap value={pin} centre={town ? { lat: town.lat, lng: town.lng } : null} onChange={(p) => (setPin(p), setErr(null))} /> : null}
        <div className="small" aria-live="polite">
          {pin ? (
            <>
              <span className="mono">{fmtLL(pin)}</span> ·{' '}
              <a className="adm-link" href={viewUrl(pin)} target="_blank" rel="noopener noreferrer">
                Check in Google Maps
              </a>
              {warn ? <div className="ops-text-warn">{warn}</div> : null}
            </>
          ) : (
            <span className="muted">No pin yet.</span>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Search box over the address book (customer's places first, then most used). */
export function SavedPlaceSearch({ places, customer, onPick, id }: { places: SavedPlace[]; customer?: string; onPick: (p: SavedPlace) => void; id: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const list = useMemo(() => {
    const cust = (customer ?? '').trim().toLowerCase();
    const needle = q.trim().toLowerCase();
    const hit = (p: SavedPlace) => !needle || [p.label, p.customer, p.address, p.place].some((v) => v?.toLowerCase().includes(needle));
    const mine = (p: SavedPlace) => !!cust && (p.customer ?? '').toLowerCase().includes(cust);
    return places
      .filter(hit)
      .sort((a, b) => Number(mine(b)) - Number(mine(a)) || (b.uses ?? 0) - (a.uses ?? 0))
      .slice(0, 8);
  }, [places, q, customer]);
  if (!places.length) return null;
  return (
    <div className="ops-saved" ref={boxRef} style={{ position: 'relative' }}>
      <label className="sr-only" htmlFor={id}>
        Saved places
      </label>
      <input
        id={id}
        className="input"
        type="search"
        value={q}
        placeholder="Saved places — search customer or site…"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && list.length ? (
        <ul id={`${id}-list`} role="listbox" className="ops-saved-list">
          {list.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(p);
                  setQ('');
                  setOpen(false);
                }}
              >
                <strong>{p.label}</strong>
                <span className="tiny muted">
                  {[p.address, p.place].filter(Boolean).join(', ')}
                  {p.uses ? ` · used ${p.uses}×` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface PlaceDraft {
  id?: string;
  label: string;
  customer?: string;
  address: string;
  place: string;
  placeId?: string;
  region?: string;
  lat: number;
  lng: number;
  contact?: string;
  phone?: string;
  notes?: string;
  uses?: number;
  createdAt?: number;
}

/** Save / edit an address-book entry. */
export function SavePlaceModal({ open, onClose, draft, onSaved }: { open: boolean; onClose: () => void; draft: PlaceDraft | null; onSaved?: (p: SavedPlace) => void }) {
  const { tenant, country } = useTenant();
  const { toast } = useUi();
  const [f, setF] = useState<PlaceDraft | null>(draft);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(draft);
  }, [open, draft]);
  if (!f) return <Modal open={false} onClose={onClose} title="" />;
  const set = <K extends keyof PlaceDraft>(k: K, v: PlaceDraft[K]) => setF((p) => (p ? { ...p, [k]: v } : p));
  const save = async () => {
    if (!f.label.trim()) return toast('Give the place a name', 'err');
    if (!f.place) return toast('Choose the town / city', 'err');
    setBusy(true);
    try {
      const doc = {
        id: f.id ?? newId('PL'),
        label: f.label.trim(),
        customer: f.customer?.trim() || undefined,
        address: f.address.trim(),
        place: f.place,
        placeId: f.placeId || undefined,
        region: f.region || undefined,
        lat: f.lat,
        lng: f.lng,
        contact: f.contact?.trim() || undefined,
        phone: f.phone?.trim() || undefined,
        notes: f.notes?.trim() || undefined,
        uses: f.uses,
        createdAt: f.createdAt,
      };
      await savePlace(tenant.id, doc);
      toast(f.id ? 'Place updated' : 'Saved to address book');
      onSaved?.({ ...doc, uses: doc.uses ?? 0, createdAt: doc.createdAt ?? Date.now(), updatedAt: Date.now() });
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f.id ? 'Edit saved place' : 'Save to address book'}
      wide
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            <Icon name="check" size={16} /> {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        <div className="form-grid">
          <Field label="Name *" span hint="e.g. “ABC Steel – Isando gate 3”">
            <input className="input" value={f.label} maxLength={120} onChange={(e) => set('label', e.target.value)} data-autofocus />
          </Field>
          <Field label="Customer">
            <input className="input" value={f.customer ?? ''} maxLength={120} onChange={(e) => set('customer', e.target.value)} />
          </Field>
          <PlacePicker
            id="saved-place-town"
            label="Town / city *"
            country={country.code}
            crossBorder={tenant.logistics?.crossBorder?.enabled ? tenant.logistics.crossBorder.countries : undefined}
            value={f.placeId ?? ''}
            onChange={(p) => setF((x) => (x ? { ...x, placeId: p?.id, place: p?.name ?? '', region: p?.region } : x))}
          />
          <Field label="Street address / site">
            <input className="input" value={f.address} maxLength={200} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Site contact">
            <input className="input" value={f.contact ?? ''} maxLength={80} onChange={(e) => set('contact', e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <input className="input" type="tel" value={f.phone ?? ''} maxLength={24} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Notes for drivers" span>
            <input className="input" value={f.notes ?? ''} maxLength={300} placeholder="Gate code, opening hours, PPE…" onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
        {open ? <PinMap value={{ lat: f.lat, lng: f.lng }} onChange={(p) => setF((x) => (x ? { ...x, ...p } : x))} height={260} /> : null}
        <div className="small muted">
          <span className="mono">{fmtLL(f)}</span> · {f.place}
        </div>
      </div>
    </Modal>
  );
}

/** Metres → "120 m" / "1.4 km". */
export const fmtDist = (a: LatLng, b: LatLng): string => {
  const m = distanceM(a, b);
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
};
