import { useEffect, useRef, useState } from 'react';
import { clearLocation, updateLocation } from '../ops/store';
import type { Driver } from '../ops/types';

const PREF_KEY = 'hp:drv:share-location';
const MIN_INTERVAL = 60_000;
const MIN_MOVE_M = 250;

export function getSharePref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== '0';
  } catch {
    return true;
  }
}
export function setSharePref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR;
  const dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export type LocState = 'off' | 'paused' | 'waiting' | 'sharing' | 'denied' | 'unavailable';

/**
 * Shares the driver's position while on duty AND the app is visible (browsers stop GPS in the
 * background anyway). Throttled to ≤ 1 write / 60 s unless moved > 250 m.
 */
export function useLiveLocation(tenantId: string, driver: Driver, jobId: string | undefined, enabled: boolean): { state: LocState; lastAt: number | null } {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const [state, setState] = useState<LocState>('off');
  const [lastAt, setLastAt] = useState<number | null>(null);
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const jobRef = useRef(jobId);
  jobRef.current = jobId;

  useEffect(() => {
    const on = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  const onDuty = driver.status === 'available' || driver.status === 'on_job';

  // off duty or sharing switched off → remove the last position from the dispatch map
  useEffect(() => {
    if (!onDuty || !enabled) {
      last.current = null;
      void clearLocation(tenantId, driver.id).catch(() => undefined);
    }
  }, [onDuty, enabled, tenantId, driver.id]);

  useEffect(() => {
    if (!onDuty) return setState('off');
    if (!enabled) return setState('paused');
    if (!('geolocation' in navigator)) return setState('unavailable');
    if (!visible) return; // keep the last state; resume when visible
    setState((s) => (s === 'sharing' ? s : 'waiting'));
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        const now = Date.now();
        const prev = last.current;
        setState('sharing');
        if (prev && now - prev.at < MIN_INTERVAL && distM(prev, pos) < MIN_MOVE_M) return;
        last.current = { ...pos, at: now };
        setLastAt(now);
        const speed = typeof p.coords.speed === 'number' && p.coords.speed >= 0 ? Math.round(p.coords.speed * 3.6) : undefined;
        const heading = typeof p.coords.heading === 'number' && !Number.isNaN(p.coords.heading) ? Math.round(p.coords.heading) : undefined;
        void updateLocation(tenantId, {
          driverId: driver.id,
          driverName: driver.name,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: Math.round(p.coords.accuracy),
          speedKmh: speed,
          heading,
          jobId: jobRef.current,
          at: now,
        }).catch((e) => console.warn('[driver] location write failed', e));
      },
      (e) => setState(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [onDuty, enabled, visible, tenantId, driver.id, driver.name]);

  return { state, lastAt };
}
