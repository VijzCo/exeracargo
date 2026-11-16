// Small shared UI pieces for the dispatch console.
import { useEffect, useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { getMedia } from '../../ops/store';
import type { Driver, DriverStatus, FleetUnit, Job, Ownership, Priority, VehicleStatus } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { useTransporters } from './hooks';
import { assignBlockers, driverIssues, expiryLevel, fmtYmd, serviceDueKm, vehicleIssues } from './lib';

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  available: 'Available',
  on_job: 'On a job',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
};
export const DUTY_LABEL: Record<DriverStatus, string> = { available: 'On duty', on_job: 'On a job', off_duty: 'Off duty' };
export const PRIORITY_LABEL: Record<Priority, string> = { normal: 'Normal', high: 'High', urgent: 'Urgent' };

export function VehicleStatusBadge({ s }: { s: VehicleStatus }) {
  return <span className={`ops-chip ops-v-${s}`}>{VEHICLE_STATUS_LABEL[s]}</span>;
}
export function DutyBadge({ d }: { d: Pick<Driver, 'status' | 'active'> }) {
  if (!d.active) return <span className="ops-chip ops-d-inactive">Deactivated</span>;
  return <span className={`ops-chip ops-d-${d.status}`}>{DUTY_LABEL[d.status]}</span>;
}
/** "Hired · <transporter>" tag for subcontracted units, drivers and jobs. */
export function HiredTag({ x, short }: { x: { ownership?: Ownership; transporterName?: string }; short?: boolean }) {
  if (x.ownership !== 'hired') return null;
  return (
    <span className="ops-chip ops-hired" title={x.transporterName ? `Hired from ${x.transporterName}` : 'Hired'}>
      Hired{!short && x.transporterName ? ` · ${x.transporterName}` : ''}
    </span>
  );
}

/** Trip badge for jobs dispatched together. */
export function TripTag({ j }: { j: Pick<Job, 'tripId' | 'tripSeq'> }) {
  if (!j.tripId) return null;
  return (
    <span className="ops-chip ops-trip" title={`Trip ${j.tripId}`}>
      {j.tripId}
      {j.tripSeq !== undefined && j.tripSeq !== null ? ` #${j.tripSeq + 1}` : ''}
    </span>
  );
}

/** Hard blockers for assigning these (hired transporter compliance). */
export function useAssignBlockers(v: FleetUnit | undefined, d: Driver | undefined, date: string): string[] {
  const { data: transporters } = useTransporters();
  return assignBlockers(v, d, transporters, date);
}

export function PriorityTag({ p }: { p: Priority }) {
  if (p === 'normal') return null;
  return <span className={`ops-prio ops-prio-${p}`}>{PRIORITY_LABEL[p]}</span>;
}

/** Red (expired) / amber (≤ 30 days) / neutral expiry badge. */
export function ExpiryBadge({ label, date, today, hideOk }: { label: string; date?: string; today: string; hideOk?: boolean }) {
  const e = expiryLevel(date, today);
  if (e.level === 'none') return hideOk ? null : <span className="ops-chip ops-lvl-none">{label}: —</span>;
  if (e.level === 'ok' && hideOk) return null;
  const title = e.level === 'err' ? `${label} expired on ${fmtYmd(date)}` : `${label} expires ${fmtYmd(date)}`;
  return (
    <span className={`ops-chip ops-lvl-${e.level}`} title={title}>
      {label} {e.level === 'err' ? 'expired' : e.level === 'warn' ? `${e.days} d` : fmtYmd(date)}
    </span>
  );
}

export function ServiceBadge({ v }: { v: FleetUnit }) {
  const due = serviceDueKm(v);
  if (due === null) return null;
  const level = due < 0 ? 'err' : due <= 1000 ? 'warn' : 'ok';
  return (
    <span className={`ops-chip ops-lvl-${level}`} title={`Next service at ${((v.lastServiceKm ?? 0) + (v.serviceIntervalKm ?? 0)).toLocaleString()} km`}>
      {due < 0 ? `Service overdue ${(-due).toLocaleString()} km` : `Service in ${due.toLocaleString()} km`}
    </span>
  );
}

/** Thumbnail of a stored media item (data URL); opens full size in a new tab. */
export function MediaThumb({ id, alt, size = 96 }: { id?: string; alt: string; size?: number }) {
  const { tenant } = useTenant();
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!id) return;
    let live = true;
    void getMedia(tenant.id, id)
      .then((m) => live && setSrc(m?.dataUrl ?? null))
      .catch(() => live && setSrc(null));
    return () => {
      live = false;
    };
  }, [tenant.id, id]);
  if (!id) return null;
  if (src === undefined) return <span className="skeleton ops-thumb" style={{ width: size, height: size }} aria-label="Loading photo" />;
  if (src === null)
    return (
      <span className="ops-thumb ops-thumb-missing" style={{ width: size, height: size }}>
        Photo unavailable
      </span>
    );
  return (
    <button
      type="button"
      className="ops-thumb"
      style={{ width: size, height: size }}
      onClick={() => {
        const w = window.open();
        if (w) {
          w.document.title = alt;
          const img = w.document.createElement('img');
          img.src = src;
          img.alt = alt;
          img.style.maxWidth = '100%';
          w.document.body.style.margin = '0';
          w.document.body.style.background = '#111';
          w.document.body.appendChild(img);
        }
      }}
      aria-label={`Open ${alt}`}
    >
      <img src={src} alt={alt} loading="lazy" />
    </button>
  );
}

const V_ORDER: Record<VehicleStatus, number> = { available: 0, on_job: 1, maintenance: 2, inactive: 3 };
const D_ORDER: Record<DriverStatus, number> = { available: 0, on_job: 1, off_duty: 2 };

/** Vehicle + driver selects with live conflict warnings. */
export function AssignFields({
  job,
  jobs,
  vehicles,
  drivers,
  vehicleId,
  driverId,
  onChange,
  today,
}: {
  job: Pick<Job, 'id' | 'scheduledDate'>;
  jobs: Job[];
  vehicles: FleetUnit[];
  drivers: Driver[];
  vehicleId: string;
  driverId: string;
  onChange: (v: { vehicleId: string; driverId: string }) => void;
  today: string;
}) {
  const vid = useId();
  const did = useId();
  const v = vehicles.find((x) => x.id === vehicleId);
  const d = drivers.find((x) => x.id === driverId);
  const vWarn = vehicleIssues(v, job, jobs, today);
  const dWarn = driverIssues(d, job, jobs, today);
  const blockers = useAssignBlockers(v, d, job.scheduledDate || today);
  const vs = [...vehicles].sort((a, b) => V_ORDER[a.status] - V_ORDER[b.status] || a.registration.localeCompare(b.registration));
  const ds = [...drivers].filter((x) => ((x.active && !x.external) || x.id === driverId)).sort((a, b) => D_ORDER[a.status] - D_ORDER[b.status] || a.name.localeCompare(b.name));
  const busy = (field: 'vehicleId' | 'driverId', id: string) =>
    jobs.some((j) => j.id !== job.id && j[field] === id && j.scheduledDate === job.scheduledDate && ['assigned', 'accepted', 'started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery'].includes(j.status));

  return (
    <div className="ops-assign">
      <div className="ops-assign-grid">
        <label className="field" htmlFor={vid}>
          <span className="label">Vehicle</span>
          <select id={vid} className="select" value={vehicleId} onChange={(e) => onChange({ vehicleId: e.target.value, driverId })} aria-invalid={vWarn.length ? true : undefined}>
            <option value="">— Not assigned —</option>
            {vs.map((x) => (
              <option key={x.id} value={x.id}>
                {x.registration} · {x.name}
                {x.ownership === 'hired' ? ` · HIRED${x.transporterName ? ` (${x.transporterName})` : ''}` : ''} — {VEHICLE_STATUS_LABEL[x.status]}
                {busy('vehicleId', x.id) ? ' · booked that day' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor={did}>
          <span className="label">Driver</span>
          <select
            id={did}
            className="select"
            value={driverId}
            aria-invalid={dWarn.length ? true : undefined}
            onChange={(e) => {
              const nd = drivers.find((x) => x.id === e.target.value);
              onChange({ driverId: e.target.value, vehicleId: vehicleId || nd?.defaultVehicleId || '' });
            }}
          >
            <option value="">— Not assigned —</option>
            {ds.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.external ? ' · LINK' : x.ownership === 'hired' ? ' · HIRED' : ''} — {x.active ? DUTY_LABEL[x.status] : 'Deactivated'}
                {busy('driverId', x.id) ? ' · booked that day' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      {blockers.length ? (
        <div className="alert alert-err ops-warn" role="alert">
          <Icon name="x" size={18} />
          <div>
            <strong>Can’t dispatch</strong>
            <ul>
              {blockers.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
      {vWarn.length + dWarn.length > 0 ? (
        <div className="alert alert-warn ops-warn" role="status">
          <Icon name="shield" size={18} />
          <div>
            <strong>Check before dispatch</strong>
            <ul>
              {[...vWarn, ...dWarn].map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function LoadingRows({ n = 4, h = 56 }: { n?: number; h?: number }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}
