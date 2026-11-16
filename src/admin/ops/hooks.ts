// Realtime data hooks for the dispatch console.
import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../AuthGate';
import { useTenant } from '../../tenant/TenantProvider';
import { opsMode, seedDemo, watchDrivers, watchFinance, watchFuel, watchJobs, watchLocations, watchPlaces, watchSettlements, watchThreads, watchTransporters, watchVehicles } from '../../ops/store';
import type { Driver, DriverLocation, FleetUnit, FuelEntry, Job, JobFinance, OpsUser, SavedPlace, Settlement, Thread, Transporter } from '../../ops/types';
import { seedHiredDemo, seedPlacesDemo } from './demoSeed';
import { ymdIn } from './lib';

const seeded = new Set<string>();
/** Demo mode: seed vehicles, a driver and jobs once per tenant. */
export function ensureSeed(tenantId: string, country: 'ZA' | 'LK') {
  if (opsMode !== 'demo' || seeded.has(tenantId)) return;
  seeded.add(tenantId);
  void seedDemo(tenantId, country)
    .then(() => seedHiredDemo(tenantId, country))
    .then(() => seedPlacesDemo(tenantId, country))
    .catch((e) => console.warn('[ops] seed failed', e));
}

export function useOpsUser(): OpsUser {
  const p = useAdmin();
  const { tenant } = useTenant();
  useEffect(() => ensureSeed(tenant.id, tenant.locale.country), [tenant.id, tenant.locale.country]);
  return useMemo(() => ({ uid: p.uid, name: displayName(p.email), role: 'ops', tenantId: tenant.id }), [p.uid, p.email, tenant.id]);
}

function displayName(email: string): string {
  const local = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return local ? `${local.charAt(0).toUpperCase()}${local.slice(1)} (dispatch)` : 'Dispatch';
}

interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

// ── shared live queries ─────────────────────────────────────────────
// One Firestore listener per query for the whole console, shared by every screen that needs it and
// kept alive for a while after the last screen leaves. Moving between Dispatch, Jobs, a job and back
// is then instant (no re-download, no loading flash) and costs no extra Firestore reads.
interface Entry {
  state: Live<unknown>;
  subs: Set<(s: Live<unknown>) => void>;
  stop?: () => void;
  linger?: number;
}
const LINGER_MS = 3 * 60_000;
const live = new Map<string, Entry>();

/** Drop every shared listener (sign-out / account switch). */
export function clearLive(): void {
  live.forEach((e) => {
    window.clearTimeout(e.linger);
    e.stop?.();
  });
  live.clear();
}

function attach<T>(key: string, init: T, sub: (cb: (v: T) => void, onErr: (e: Error) => void) => () => void, fn: (s: Live<T>) => void): () => void {
  let e = live.get(key);
  if (!e) {
    const entry: Entry = { state: { data: init, loading: true, error: null }, subs: new Set() };
    const emit = (s: Live<unknown>) => {
      entry.state = s;
      entry.subs.forEach((f) => f(s));
    };
    entry.stop = sub(
      (v) => emit({ data: v, loading: false, error: null }),
      (err) => emit({ ...entry.state, loading: false, error: err.message }),
    );
    live.set(key, entry);
    e = entry;
  }
  const entry = e;
  window.clearTimeout(entry.linger);
  const f = fn as (s: Live<unknown>) => void;
  entry.subs.add(f);
  return () => {
    entry.subs.delete(f);
    if (entry.subs.size === 0)
      entry.linger = window.setTimeout(() => {
        if (entry.subs.size) return;
        entry.stop?.();
        live.delete(key);
      }, LINGER_MS);
  };
}

function useLive<T>(name: string, init: T, sub: (cb: (v: T) => void, onErr: (e: Error) => void) => () => void, deps: unknown[]): Live<T> {
  const key = `${name}:${JSON.stringify(deps)}`;
  const [state, setState] = useState<Live<T>>(() => (live.get(key)?.state as Live<T> | undefined) ?? { data: init, loading: true, error: null });
  useEffect(() => {
    const cached = live.get(key)?.state as Live<T> | undefined;
    setState(cached ?? { data: init, loading: true, error: null });
    return attach<T>(key, init, sub, setState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

const EMPTY: never[] = [];

export function useJobs(sinceDays = 30): Live<Job[]> {
  const { tenant } = useTenant();
  return useLive<Job[]>('jobs', EMPTY, (cb, err) => watchJobs(tenant.id, { sinceDays }, cb, err), [tenant.id, sinceDays]);
}
export function useVehicles(): Live<FleetUnit[]> {
  const { tenant } = useTenant();
  return useLive<FleetUnit[]>('vehicles', EMPTY, (cb) => watchVehicles(tenant.id, cb), [tenant.id]);
}
export function useDrivers(): Live<Driver[]> {
  const { tenant } = useTenant();
  return useLive<Driver[]>('drivers', EMPTY, (cb) => watchDrivers(tenant.id, cb), [tenant.id]);
}
export function useThreads(): Live<Thread[]> {
  const { tenant } = useTenant();
  return useLive<Thread[]>('threads', EMPTY, (cb) => watchThreads(tenant.id, cb), [tenant.id]);
}
export function useLocations(): Live<DriverLocation[]> {
  const { tenant } = useTenant();
  return useLive<DriverLocation[]>('locations', EMPTY, (cb) => watchLocations(tenant.id, cb), [tenant.id]);
}
export function useFuel(f: { vehicleId?: string; driverId?: string } = {}): Live<FuelEntry[]> {
  const { tenant } = useTenant();
  return useLive<FuelEntry[]>('fuel', EMPTY, (cb) => watchFuel(tenant.id, f, cb), [tenant.id, f.vehicleId, f.driverId]);
}

export function useTransporters(): Live<Transporter[]> {
  const { tenant } = useTenant();
  return useLive<Transporter[]>('transporters', EMPTY, (cb) => watchTransporters(tenant.id, cb), [tenant.id]);
}
/** Customer address book (saved exact locations), most used first. */
export function usePlaces(): Live<SavedPlace[]> {
  const { tenant } = useTenant();
  return useLive<SavedPlace[]>('places', EMPTY, (cb) => watchPlaces(tenant.id, cb), [tenant.id]);
}
export function useSettlements(): Live<Settlement[]> {
  const { tenant } = useTenant();
  return useLive<Settlement[]>('settlements', EMPTY, (cb) => watchSettlements(tenant.id, cb), [tenant.id]);
}
const EMPTY_MAP = new Map<string, JobFinance>();
/** Finance docs (sell price + buy cost) by job id — dispatch only. */
export function useFinance(): Live<Map<string, JobFinance>> {
  const { tenant } = useTenant();
  return useLive<Map<string, JobFinance>>('finance', EMPTY_MAP, (cb) => watchFinance(tenant.id, (rows) => cb(new Map(rows.map((r) => [r.id, r])))), [tenant.id]);
}

/** Re-render every `ms` (relative times, freshness colours). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Today (yyyy-mm-dd) + time zone of the tenant's home country. */
export function useToday(): { today: string; tz: string } {
  const { country } = useTenant();
  const now = useNow(60_000);
  return { today: ymdIn(country.timeZone, now), tz: country.timeZone };
}

/** Total unread messages for dispatch (Shell badge). */
export function useUnreadOps(): number {
  const { tenant } = useTenant();
  const [n, setN] = useState(0);
  useEffect(() => watchThreads(tenant.id, (th) => setN(th.reduce((a, t) => a + (t.unreadOps || 0), 0))), [tenant.id]);
  return n;
}
