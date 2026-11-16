import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Driver, OpsUser } from '../ops/types';

export interface DriverCtx {
  tenantId: string;
  driver: Driver;
  user: OpsUser;
  online: boolean;
  /** Polite live-region announcement + toast. */
  notify: (msg: string, tone?: 'ok' | 'warn' | 'err') => void;
}

const Ctx = createContext<DriverCtx | null>(null);
export const DriverProvider = ({ value, children }: { value: DriverCtx; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export function useDriver(): DriverCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDriver outside DriverProvider');
  return c;
}

export function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

export interface Toast {
  id: number;
  msg: string;
  tone: 'ok' | 'warn' | 'err';
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((msg: string, tone: Toast['tone'] = 'ok') => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-1), { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 2600);
  }, []);
  return { toasts, push };
}

/**
 * Firestore write promises only resolve when the server acknowledges — offline they hang
 * even though the write is already in the local cache (and will sync). Treat a slow or
 * offline write as "queued" so the driver can keep working.
 */
export async function queued<T>(p: Promise<T>, ms = 4000): Promise<'ok' | 'queued'> {
  if (!navigator.onLine) {
    p.catch((e) => console.warn('[driver] queued write failed', e));
    return 'queued';
  }
  let timer = 0;
  const r = await Promise.race([
    p.then(() => 'ok' as const),
    new Promise<'queued'>((res) => {
      timer = window.setTimeout(() => res('queued'), ms);
    }),
  ]);
  window.clearTimeout(timer);
  return r;
}

export function isoToday(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function daysUntil(iso: string | undefined, today: string): number | null {
  if (!iso) return null;
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

export function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      });
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const fmtKm = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
