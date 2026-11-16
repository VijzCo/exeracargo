// Realtime data hooks for the dispatch console.
import { useEffect, useMemo, useState } from 'react';
import { useAdmin } from '../AuthGate';
import { useTenant } from '../../tenant/TenantProvider';
import { opsMode, seedDemo, watchDrivers, watchFinance, watchFuel, watchJobs, watchLocations, watchSettlements, watchThreads, watchTransporters, watchVehicles } from '../../ops/store';
import type { Driver, DriverLocation, FleetUnit, FuelEntry, Job, JobFinance, OpsUser, Settlement, Thread, Transporter } from '../../ops/types';
import { seedHiredDemo } from './demoSeed';
import { ymdIn } from './lib';

const seeded = new Set<string>();
/** Demo mode: seed vehicles, a driver and jobs once per tenant. */
export function ensureSeed(tenantId: string, country: 'ZA' | 'LK') {
  if (opsMode !== 'demo' || seeded.has(tenantId)) return;
  seeded.add(tenantId);
  void seedDemo(tenantId, country)
    .then(() => seedHiredDemo(tenantId, country))
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

function useLive<T>(init: T, sub: (cb: (v: T) => void, onErr: (e: Error) => void) => () => void, deps: unknown[]): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: init, loading: true, error: null });
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    return sub(
      (v) => setState({ data: v, loading: false, error: null }),
      (e) => setState((s) => ({ ...s, loading: false, error: e.message })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

const EMPTY: never[] = [];

export function useJobs(sinceDays = 30): Live<Job[]> {
  const { tenant } = useTenant();
  return useLive<Job[]>(EMPTY, (cb, err) => watchJobs(tenant.id, { sinceDays }, cb, err), [tenant.id, sinceDays]);
}
export function useVehicles(): Live<FleetUnit[]> {
  const { tenant } = useTenant();
  return useLive<FleetUnit[]>(EMPTY, (cb) => watchVehicles(tenant.id, cb), [tenant.id]);
}
export function useDrivers(): Live<Driver[]> {
  const { tenant } = useTenant();
  return useLive<Driver[]>(EMPTY, (cb) => watchDrivers(tenant.id, cb), [tenant.id]);
}
export function useThreads(): Live<Thread[]> {
  const { tenant } = useTenant();
  return useLive<Thread[]>(EMPTY, (cb) => watchThreads(tenant.id, cb), [tenant.id]);
}
export function useLocations(): Live<DriverLocation[]> {
  const { tenant } = useTenant();
  return useLive<DriverLocation[]>(EMPTY, (cb) => watchLocations(tenant.id, cb), [tenant.id]);
}
export function useFuel(f: { vehicleId?: string; driverId?: string } = {}): Live<FuelEntry[]> {
  const { tenant } = useTenant();
  return useLive<FuelEntry[]>(EMPTY, (cb) => watchFuel(tenant.id, f, cb), [tenant.id, f.vehicleId, f.driverId]);
}

export function useTransporters(): Live<Transporter[]> {
  const { tenant } = useTenant();
  return useLive<Transporter[]>(EMPTY, (cb) => watchTransporters(tenant.id, cb), [tenant.id]);
}
export function useSettlements(): Live<Settlement[]> {
  const { tenant } = useTenant();
  return useLive<Settlement[]>(EMPTY, (cb) => watchSettlements(tenant.id, cb), [tenant.id]);
}
const EMPTY_MAP = new Map<string, JobFinance>();
/** Finance docs (sell price + buy cost) by job id — dispatch only. */
export function useFinance(): Live<Map<string, JobFinance>> {
  const { tenant } = useTenant();
  return useLive<Map<string, JobFinance>>(EMPTY_MAP, (cb) => watchFinance(tenant.id, (rows) => cb(new Map(rows.map((r) => [r.id, r])))), [tenant.id]);
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
