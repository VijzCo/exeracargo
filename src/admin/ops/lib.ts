// Pure helpers for the dispatch console (no React).
import type { Driver, FleetUnit, Job, JobStatus, Transporter } from '../../ops/types';

export const DAY = 86_400_000;

/** Statuses where the job holds its vehicle + driver. */
export const ACTIVE: JobStatus[] = ['assigned', 'accepted', 'started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery', 'delivered'];
export const ON_ROAD: JobStatus[] = ['started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery'];
export const DONE: JobStatus[] = ['delivered', 'completed'];
export const CLOSED: JobStatus[] = ['completed', 'cancelled', 'failed'];

// ── dates in the tenant's time zone ─────────────────────────

const ymdFmt = new Map<string, Intl.DateTimeFormat>();
/** yyyy-mm-dd of `ts` in `tz`. */
export function ymdIn(tz: string, ts = Date.now()): string {
  let f = ymdFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    ymdFmt.set(tz, f);
  }
  return f.format(new Date(ts));
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Offset (ms) of `tz` from UTC at instant `ts`. */
function tzOffset(ts: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - (ts - (ts % 1000));
}

/** Epoch ms of a wall-clock date + time in `tz`. */
export function zonedEpoch(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const guess = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  const off = tzOffset(guess, tz);
  const first = guess - off;
  const off2 = tzOffset(first, tz);
  return off2 === off ? first : guess - off2;
}

export const scheduledAt = (j: Pick<Job, 'scheduledDate' | 'scheduledTime'>, tz: string) => zonedEpoch(j.scheduledDate, j.scheduledTime, tz);

/** Scheduled > 30 min ago and the driver hasn't started. */
export function isOverdue(j: Job, tz: string, now = Date.now()): boolean {
  return (j.status === 'assigned' || j.status === 'accepted' || j.status === 'draft') && scheduledAt(j, tz) + 30 * 60_000 < now;
}

export function timeAgo(ts: number | undefined, now = Date.now()): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : new Date(ts).toLocaleDateString();
}

export function fmtYmd(ymd: string | undefined): string {
  if (!ymd) return '—';
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function fmtTs(ts: number | undefined): string {
  return ts ? new Date(ts).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
}

// ── compliance ──────────────────────────────────────────────

export type Level = 'ok' | 'warn' | 'err' | 'none';

export function expiryLevel(ymd: string | undefined, today: string): { level: Level; days: number | null } {
  if (!ymd) return { level: 'none', days: null };
  const days = Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  if (Number.isNaN(days)) return { level: 'none', days: null };
  return { level: days < 0 ? 'err' : days <= 30 ? 'warn' : 'ok', days };
}

export function expiryText(label: string, days: number | null): string {
  if (days === null) return `${label}: not set`;
  if (days < 0) return `${label} expired ${-days} d ago`;
  if (days === 0) return `${label} expires today`;
  return `${label} expires in ${days} d`;
}

export const VEHICLE_DOCS: { key: 'licenceDiscExpiry' | 'roadworthyExpiry' | 'insuranceExpiry' | 'permitExpiry'; label: string }[] = [
  { key: 'licenceDiscExpiry', label: 'Licence disc' },
  { key: 'roadworthyExpiry', label: 'Roadworthy' },
  { key: 'insuranceExpiry', label: 'Insurance' },
  { key: 'permitExpiry', label: 'Permit' },
];
export const DRIVER_DOCS: { key: 'licenceExpiry' | 'prdpExpiry' | 'medicalExpiry'; label: string }[] = [
  { key: 'licenceExpiry', label: 'Licence' },
  { key: 'prdpExpiry', label: 'PrDP' },
  { key: 'medicalExpiry', label: 'Medical' },
];

/** km until next service (negative = overdue); null if not configured. */
export function serviceDueKm(v: FleetUnit): number | null {
  if (!v.serviceIntervalKm) return null;
  const next = (v.lastServiceKm ?? 0) + v.serviceIntervalKm;
  return Math.round(next - (v.odometerKm ?? 0));
}

export interface Alert {
  level: 'warn' | 'err';
  text: string;
  to: string;
  who: string;
}

export function complianceAlerts(vehicles: FleetUnit[], drivers: Driver[], today: string): Alert[] {
  const out: Alert[] = [];
  for (const v of vehicles) {
    if (v.status === 'inactive') continue;
    const to = `/admin/vehicles?open=${encodeURIComponent(v.id)}`;
    for (const d of VEHICLE_DOCS) {
      const e = expiryLevel(v[d.key], today);
      if (e.level === 'warn' || e.level === 'err') out.push({ level: e.level, text: expiryText(d.label, e.days), to, who: `${v.registration} · ${v.name}` });
    }
    const due = serviceDueKm(v);
    if (due !== null && due <= 1000) out.push({ level: due < 0 ? 'err' : 'warn', text: due < 0 ? `Service overdue by ${(-due).toLocaleString()} km` : `Service due in ${due.toLocaleString()} km`, to, who: `${v.registration} · ${v.name}` });
  }
  for (const dr of drivers) {
    if (!dr.active) continue;
    const to = `/admin/drivers?open=${encodeURIComponent(dr.id)}`;
    for (const d of DRIVER_DOCS) {
      const e = expiryLevel(dr[d.key], today);
      if (e.level === 'warn' || e.level === 'err') out.push({ level: e.level, text: expiryText(d.label, e.days), to, who: dr.name });
    }
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'err' ? -1 : 1));
}

// ── transporters (subcontractors) ───────────────────────────

export const TRANSPORTER_DOCS: { key: 'gitInsuranceExpiry' | 'taxClearanceExpiry' | 'bbbeeExpiry'; label: string }[] = [
  { key: 'gitInsuranceExpiry', label: 'GIT insurance' },
  { key: 'taxClearanceExpiry', label: 'Tax clearance' },
  { key: 'bbbeeExpiry', label: 'B-BBEE' },
];

/** Hard stops: a hired unit/driver may not be dispatched (no GIT cover, inactive transporter). */
export function transporterBlockers(transporterId: string | undefined, transporters: Transporter[], date: string, who: string): string[] {
  if (!transporterId) return [];
  const t = transporters.find((x) => x.id === transporterId);
  if (!t) return [`${who}: transporter not found — check the hired unit's transporter.`];
  const out: string[] = [];
  if (!t.active) out.push(`${t.name} is inactive — ${who} can't be dispatched.`);
  const git = expiryLevel(t.gitInsuranceExpiry, date);
  if (git.level === 'none') out.push(`${t.name}: no goods-in-transit insurance on file.`);
  else if (git.level === 'err') out.push(`${t.name}: GIT insurance expired ${fmtYmd(t.gitInsuranceExpiry)}.`);
  return out;
}

/** Assignment blockers for a vehicle + driver pair (hired units only). */
export function assignBlockers(v: FleetUnit | undefined, d: Driver | undefined, transporters: Transporter[], date: string): string[] {
  const out = new Set<string>();
  if (v?.ownership === 'hired') transporterBlockers(v.transporterId, transporters, date, v.registration).forEach((x) => out.add(x));
  if (d?.ownership === 'hired') transporterBlockers(d.transporterId, transporters, date, d.name).forEach((x) => out.add(x));
  return [...out];
}

export function transporterAlerts(transporters: Transporter[], today: string): Alert[] {
  const out: Alert[] = [];
  for (const t of transporters) {
    if (!t.active) continue;
    const to = `/admin/transporters?open=${encodeURIComponent(t.id)}`;
    for (const d of TRANSPORTER_DOCS) {
      const e = expiryLevel(t[d.key], today);
      if (e.level === 'warn' || e.level === 'err') out.push({ level: e.level, text: expiryText(d.label, e.days), to, who: t.name });
    }
  }
  return out;
}

// ── assignment conflicts ────────────────────────────────────

export function vehicleIssues(v: FleetUnit | undefined, job: Pick<Job, 'id' | 'scheduledDate'>, jobs: Job[], today: string): string[] {
  if (!v) return [];
  const out: string[] = [];
  if (v.status === 'maintenance') out.push(`${v.registration} is in maintenance.`);
  if (v.status === 'inactive') out.push(`${v.registration} is inactive.`);
  for (const d of VEHICLE_DOCS) {
    const e = expiryLevel(v[d.key], job.scheduledDate || today);
    if (e.level === 'err') out.push(`${d.label} expired (${fmtYmd(v[d.key])}).`);
  }
  const clash = jobs.find((j) => j.id !== job.id && j.vehicleId === v.id && ACTIVE.includes(j.status) && j.status !== 'delivered' && j.scheduledDate === job.scheduledDate);
  if (clash) out.push(`Already on ${clash.ref} (${clash.scheduledTime}) that day.`);
  // a trip from an earlier day that is still on the road (multi-day / cross-border)
  const onRoad = jobs.find((j) => j.id !== job.id && j.vehicleId === v.id && ON_ROAD.includes(j.status) && j.scheduledDate < (job.scheduledDate || today));
  if (onRoad) out.push(`Still on the road with ${onRoad.ref} (since ${fmtYmd(onRoad.scheduledDate)}).`);
  return out;
}

export function driverIssues(d: Driver | undefined, job: Pick<Job, 'id' | 'scheduledDate'>, jobs: Job[], today: string): string[] {
  if (!d) return [];
  const out: string[] = [];
  if (!d.active) out.push(`${d.name} is deactivated.`);
  if (d.status === 'off_duty' && job.scheduledDate === today) out.push(`${d.name} is off duty.`);
  for (const k of DRIVER_DOCS) {
    const e = expiryLevel(d[k.key], job.scheduledDate || today);
    if (e.level === 'err') out.push(`${k.label} expired (${fmtYmd(d[k.key])}).`);
  }
  const clash = jobs.find((j) => j.id !== job.id && j.driverId === d.id && ACTIVE.includes(j.status) && j.status !== 'delivered' && j.scheduledDate === job.scheduledDate);
  if (clash) out.push(`Already driving ${clash.ref} (${clash.scheduledTime}) that day.`);
  const onRoad = jobs.find((j) => j.id !== job.id && j.driverId === d.id && ON_ROAD.includes(j.status) && j.scheduledDate < (job.scheduledDate || today));
  if (onRoad) out.push(`Still on the road with ${onRoad.ref} (since ${fmtYmd(onRoad.scheduledDate)}).`);
  return out;
}

// ── misc ────────────────────────────────────────────────────

/**
 * advanceJob also updates the driver's duty status. A job sent by one-time link that hasn't been
 * opened yet has a placeholder driver ("link:<token>") with no driver doc — never write one.
 */
export function forAdvance(j: Job): Job {
  return j.driverId?.startsWith('link:') ? { ...j, driverId: undefined } : j;
}

export const mapsLink = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;

export function csv(rows: (string | number | undefined | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === undefined || c === null ? '' : String(c);
          // neutralise spreadsheet formula injection
          const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
          return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
        })
        .join(','),
    )
    .join('\r\n');
}

export function suggestTitle(cargo: string, from?: string, to?: string): string {
  const c = cargo.trim().split(/[.(\n]/)[0].trim().slice(0, 60);
  const route = from || to ? `${from || '?'} → ${to || '?'}` : '';
  return [c, route].filter(Boolean).join(' · ');
}

export function randomPin(len = 6): string {
  const b = new Uint32Array(len);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => String(x % 10)).join('');
}

export function jobMatches(j: Job, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return [j.ref, j.title, j.customer.name, j.customer.company, j.pickup.place, j.dropoff.place, j.vehicleReg, j.driverName, j.bookingRef]
    .filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(n));
}
