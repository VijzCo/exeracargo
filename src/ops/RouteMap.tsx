// Road route through a job's stops (free): "Open full route" in Google Maps + an embedded route map
// that only loads when asked for (keeps pages fast and avoids loading Google on every view).
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { routeEmbedUrl, routeUrls } from './maps';

export interface RouteMapProps {
  /** Ordered points: "lat,lng" or address text. */
  points: string[];
  /** Directions start at the phone's current location (driver app). */
  fromCurrent?: boolean;
  /** Points for the drawn map (default: `points`). */
  mapPoints?: string[];
  btnClass?: string;
  label?: string;
}

export function RouteLinks({ points, fromCurrent, btnClass = 'btn btn-ghost btn-sm', label = 'Open full route' }: Omit<RouteMapProps, 'mapPoints'>) {
  const urls = routeUrls(points, fromCurrent);
  if (!urls.length) return null;
  return (
    <>
      {urls.map((u, i) => (
        <a key={u} className={btnClass} href={u} target="_blank" rel="noopener noreferrer" aria-label={urls.length > 1 ? `${label}, part ${i + 1} of ${urls.length}, in Google Maps` : `${label} in Google Maps`}>
          <Icon name="gps" size={16} /> {urls.length > 1 ? `${label} · part ${i + 1}/${urls.length}` : label}
        </a>
      ))}
    </>
  );
}

export function RouteMap({ points, mapPoints, btnClass = 'btn btn-ghost btn-sm' }: RouteMapProps) {
  const [open, setOpen] = useState(false);
  const src = routeEmbedUrl(mapPoints ?? points);
  if (!src) return null;
  return (
    <div className="ops-routemap">
      <button type="button" className={btnClass} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="globe" size={16} /> {open ? 'Hide route map' : 'Show route map'}
      </button>
      {open ? (
        <div className="ops-routemap-frame" style={{ marginTop: 10, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          <iframe
            title="Route map"
            src={src}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            style={{ display: 'block', width: '100%', height: 340, border: 0 }}
            allowFullScreen
          />
        </div>
      ) : null}
    </div>
  );
}
