// Live map (Leaflet + OpenStreetMap tiles): driver positions + active job routes. Lazy-loaded route.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Icon } from '../../components/Icon';
import { findPlace } from '../../geo';
import JobStatusPill from '../../ops/JobStatusPill';
import { JOB_STATUS_LABEL, type DriverLocation, type Job } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { PageHeader } from '../ui';
import { useDrivers, useJobs, useLocations, useNow, useOpsUser, useVehicles } from './hooks';
import { timeAgo } from './lib';
import { DutyBadge } from './widgets';
import './ops-admin.css';

type Fresh = 'live' | 'stale' | 'old' | 'none';
const freshness = (at: number | undefined, now: number): Fresh => (!at ? 'none' : now - at < 5 * 60_000 ? 'live' : now - at < 60 * 60_000 ? 'stale' : 'old');
const FRESH_LABEL: Record<Fresh, string> = { live: 'Live', stale: 'Stale', old: 'Old', none: 'No position' };
const CENTRE: Record<string, [number, number, number]> = { ZA: [-29.0, 25.0, 5], LK: [7.85, 80.7, 7] };
const ON_MAP: Job['status'][] = ['assigned', 'accepted', 'started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function coords(s: Job['pickup']): [number, number] | null {
  if (typeof s.lat === 'number' && typeof s.lng === 'number') return [s.lat, s.lng];
  const p = findPlace(s.placeId);
  return p ? [p.lat, p.lng] : null;
}

export default function LiveMap() {
  useOpsUser();
  const { tenant } = useTenant();
  const nav = useNavigate();
  const now = useNow(20_000);
  const { data: locs } = useLocations();
  const { data: drivers } = useDrivers();
  const { data: vehicles } = useVehicles();
  const { data: jobs } = useJobs(7);
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [showJobs, setShowJobs] = useState(true);

  const active = useMemo(() => jobs.filter((j) => ON_MAP.includes(j.status)), [jobs]);
  const locByDriver = useMemo(() => new Map(locs.map((l) => [l.driverId, l])), [locs]);
  const jobFor = (l: DriverLocation): Job | undefined => (l.jobId ? jobs.find((j) => j.id === l.jobId) : undefined) ?? active.find((j) => j.driverId === l.driverId && j.status !== 'assigned' && j.status !== 'accepted') ?? active.find((j) => j.driverId === l.driverId);

  // init once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const [lat, lng, z] = CENTRE[tenant.locale.country] ?? CENTRE.ZA;
    const map = L.map(elRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lng], z);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);
    let errors = 0;
    tiles.on('tileerror', () => {
      errors++;
      if (errors >= 4) setTilesFailed(true);
    });
    tiles.on('tileload', () => setTilesFailed(false));
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const el = elRef.current;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      if (a?.dataset.nav) {
        e.preventDefault();
        nav(a.dataset.nav);
      }
    };
    el.addEventListener('click', onClick);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => {
      el.removeEventListener('click', onClick);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    if (showJobs) {
      for (const j of active) {
        const a = coords(j.pickup);
        const b = coords(j.dropoff);
        const pop = `<div class="ops-pop"><strong class="mono">${esc(j.ref)}</strong> · ${esc(JOB_STATUS_LABEL[j.status])}<br>${esc(j.title)}<br><span class="ops-pop-muted">${esc(j.scheduledDate)} ${esc(j.scheduledTime)} · ${esc(j.driverName ?? 'unassigned')}</span><br><a href="/admin/jobs/${encodeURIComponent(j.id)}" data-nav="/admin/jobs/${encodeURIComponent(j.id)}">Open job →</a></div>`;
        if (a && b) L.polyline([a, b], { className: 'ops-line', dashArray: '6 8', weight: 3, interactive: false }).addTo(layer);
        if (a) {
          L.marker(a, { icon: L.divIcon({ className: 'ops-mk-wrap', html: '<span class="ops-pin ops-pin-pickup" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }), title: `${j.ref} pickup: ${j.pickup.place}`, keyboard: true })
            .bindPopup(`<div class="ops-pop-kind">Pickup · ${esc(j.pickup.place)}</div>${pop}`)
            .addTo(layer);
          bounds.push(a);
        }
        if (b) {
          L.marker(b, { icon: L.divIcon({ className: 'ops-mk-wrap', html: '<span class="ops-pin ops-pin-dropoff" aria-hidden="true"></span>', iconSize: [16, 16], iconAnchor: [8, 8] }), title: `${j.ref} delivery: ${j.dropoff.place}`, keyboard: true })
            .bindPopup(`<div class="ops-pop-kind">Delivery · ${esc(j.dropoff.place)}</div>${pop}`)
            .addTo(layer);
          bounds.push(b);
        }
      }
    }

    for (const l of locs) {
      if (typeof l.lat !== 'number' || typeof l.lng !== 'number') continue;
      const f = freshness(l.at, now);
      const d = drivers.find((x) => x.id === l.driverId);
      const job = jobFor(l);
      const v = vehicles.find((x) => x.id === (job?.vehicleId ?? d?.defaultVehicleId));
      const name = d?.name ?? l.driverName;
      const html = `<span class="ops-mk ops-mk-${f}"><span>${esc(name.charAt(0).toUpperCase())}</span></span>`;
      const pop = `<div class="ops-pop"><strong>${esc(name)}</strong> <span class="ops-pop-fresh ops-pop-${f}">${FRESH_LABEL[f]}</span><br>
        ${v ? `${esc(v.registration)} · ${esc(v.name)}<br>` : ''}
        ${job ? `<a href="/admin/jobs/${encodeURIComponent(job.id)}" data-nav="/admin/jobs/${encodeURIComponent(job.id)}" class="mono">${esc(job.ref)}</a> · ${esc(JOB_STATUS_LABEL[job.status])}<br>` : '<span class="ops-pop-muted">No active job</span><br>'}
        <span class="ops-pop-muted">${typeof l.speedKmh === 'number' ? `${Math.round(l.speedKmh)} km/h · ` : ''}${esc(timeAgo(l.at, now))}${l.accuracy ? ` · ±${Math.round(l.accuracy)} m` : ''}</span><br>
        <a href="/admin/chat?t=${encodeURIComponent(l.driverId)}" data-nav="/admin/chat?t=${encodeURIComponent(l.driverId)}">Chat</a></div>`;
      L.marker([l.lat, l.lng], { icon: L.divIcon({ className: 'ops-mk-wrap', html, iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -16] }), title: `${name} (${FRESH_LABEL[f]})`, keyboard: true, zIndexOffset: 1000 })
        .bindPopup(pop)
        .addTo(layer);
      bounds.push([l.lat, l.lng]);
    }

    if (!fittedRef.current && bounds.length) {
      fittedRef.current = true;
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 12 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locs, active, drivers, vehicles, now, showJobs]);

  const fit = () => {
    const map = mapRef.current;
    if (!map) return;
    const pts: L.LatLngExpression[] = locs.filter((l) => typeof l.lat === 'number').map((l) => [l.lat, l.lng] as [number, number]);
    if (showJobs) for (const j of active) for (const c of [coords(j.pickup), coords(j.dropoff)]) if (c) pts.push(c);
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
    else {
      const [lat, lng, z] = CENTRE[tenant.locale.country] ?? CENTRE.ZA;
      map.setView([lat, lng], z);
    }
  };
  const focus = (l: DriverLocation) => mapRef.current?.flyTo([l.lat, l.lng], Math.max(mapRef.current.getZoom(), 11), { duration: 0.6 });

  const list = useMemo(
    () =>
      drivers
        .filter((d) => d.active)
        .map((d) => ({ d, l: locByDriver.get(d.id) }))
        .sort((a, b) => (b.l?.at ?? 0) - (a.l?.at ?? 0)),
    [drivers, locByDriver],
  );
  const counts = { live: 0, stale: 0, old: 0 };
  for (const l of locs) {
    const f = freshness(l.at, now);
    if (f !== 'none') counts[f]++;
  }

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Live map"
        subtitle={`${counts.live} live · ${counts.stale} stale · ${counts.old} old · ${active.length} active job${active.length === 1 ? '' : 's'}`}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" aria-pressed={showJobs} onClick={() => setShowJobs((v) => !v)}>
              <Icon name="pin" size={16} /> {showJobs ? 'Hide jobs' : 'Show jobs'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={fit}>
              <Icon name="gps" size={16} /> Fit all
            </button>
          </>
        }
      />
      <div className="ops-map-wrap">
        <div className="card ops-map-card">
          <div ref={elRef} className="ops-map" role="region" aria-label="Map of drivers and active jobs" />
          {tilesFailed ? <div className="ops-map-note">Map tiles unavailable (offline?) — markers are still live.</div> : null}
          <div className="ops-legend tiny" aria-hidden>
            <span>
              <i className="ops-lg ops-mk-live" /> Live &lt;5 min
            </span>
            <span>
              <i className="ops-lg ops-mk-stale" /> Stale &lt;1 h
            </span>
            <span>
              <i className="ops-lg ops-mk-old" /> Old
            </span>
            <span>
              <i className="ops-lg ops-pin-pickup" /> Pickup
            </span>
            <span>
              <i className="ops-lg ops-pin-dropoff" /> Delivery
            </span>
          </div>
        </div>
        <aside className="card ops-map-side" aria-label="Drivers">
          <h2 className="adm-h2">Drivers</h2>
          {list.length === 0 ? (
            <p className="muted small">No active drivers.</p>
          ) : (
            <ul className="ops-map-list">
              {list.map(({ d, l }) => {
                const f = freshness(l?.at, now);
                const job = l ? jobFor(l) : active.find((j) => j.driverId === d.id);
                return (
                  <li key={d.id} className="ops-map-item">
                    <button type="button" className="ops-map-name" onClick={() => l && focus(l)} disabled={!l} title={l ? 'Show on map' : 'No position yet'}>
                      <span className={`ops-dot ops-mk-${f}`} aria-hidden />
                      <span>
                        <strong>{d.name}</strong>
                        <span className="tiny muted">
                          {FRESH_LABEL[f]}
                          {l ? ` · ${timeAgo(l.at, now)}` : ''}
                          {l && typeof l.speedKmh === 'number' ? ` · ${Math.round(l.speedKmh)} km/h` : ''}
                        </span>
                      </span>
                    </button>
                    <div className="ops-map-row">
                      <DutyBadge d={d} />
                      {job ? <JobStatusPill status={job.status} /> : null}
                    </div>
                    <div className="ops-map-row">
                      <Link className="btn btn-ghost btn-sm" to={`/admin/chat?t=${encodeURIComponent(d.id)}`}>
                        <Icon name="mail" size={14} /> Chat
                      </Link>
                      {job ? (
                        <Link className="btn btn-ghost btn-sm" to={`/admin/jobs/${encodeURIComponent(job.id)}`}>
                          {job.ref}
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
