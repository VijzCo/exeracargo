// Multi-stop + trip logic for the driver app (pure helpers, no React).
// A multi-stop job has `stops`; single-leg jobs keep the classic NEXT flow in JobDetail.
import type { Job, JobStatus, JobStop, OdoReading } from '../ops/types';

export const isMultiStop = (j: Job): boolean => (j.stops?.length ?? 0) > 0;

export const ordered = (stops: JobStop[]): JobStop[] => [...stops].sort((a, b) => a.seq - b.seq);

/** The stop the driver is at (arrived) or heading to next (first pending). */
export function currentStop(j: Job): JobStop | undefined {
  const s = ordered(j.stops ?? []);
  return s.find((x) => x.status === 'arrived') ?? s.find((x) => x.status === 'pending');
}

/** Stops still to do after `stop` (pending, excluding it). */
export function remainingAfter(j: Job, stop: JobStop): JobStop[] {
  return ordered(j.stops ?? []).filter((x) => x.id !== stop.id && (x.status === 'pending' || x.status === 'arrived'));
}

/** Mirror of firestore.rules driverStep (forward moves only). */
const STEP: Partial<Record<JobStatus, JobStatus[]>> = {
  assigned: ['accepted'],
  accepted: ['started'],
  started: ['at_pickup', 'in_transit'],
  at_pickup: ['loaded'],
  loaded: ['in_transit', 'at_pickup'],
  in_transit: ['at_pickup', 'at_delivery'],
  at_delivery: ['delivered', 'in_transit'],
  delivered: ['completed'],
};
export const canStep = (from: JobStatus, to: JobStatus): boolean => !!STEP[from]?.includes(to);

export type StopAction =
  | { kind: 'arrive'; stop: JobStop; next: 'at_pickup' | 'at_delivery' }
  | { kind: 'depart'; stop: JobStop }
  | { kind: 'load'; stop: JobStop }
  | { kind: 'deliver'; stop: JobStop; last: boolean }
  | { kind: 'close' }
  | { kind: 'stuck' };

/** Next driver action for a multi-stop job that has been started. */
export function stopAction(j: Job): StopAction | null {
  if (['draft', 'assigned', 'accepted', 'completed', 'failed', 'cancelled'].includes(j.status)) return null;
  if (j.status === 'delivered') return { kind: 'close' };
  const cur = currentStop(j);
  if (!cur) return { kind: 'stuck' };
  if (cur.status === 'arrived') {
    if (cur.kind === 'pickup') return canStep(j.status, 'loaded') ? { kind: 'load', stop: cur } : { kind: 'stuck' };
    const last = remainingAfter(j, cur).length === 0;
    return canStep(j.status, last ? 'delivered' : 'in_transit') ? { kind: 'deliver', stop: cur, last } : { kind: 'stuck' };
  }
  const arrive = cur.kind === 'pickup' ? 'at_pickup' : 'at_delivery';
  if (canStep(j.status, arrive)) return { kind: 'arrive', stop: cur, next: arrive };
  if (canStep(j.status, 'in_transit')) return { kind: 'depart', stop: cur };
  return { kind: 'stuck' };
}

/** Copy of the stop list with one stop patched. */
export function patchStop(j: Job, id: string, patch: Partial<JobStop>): JobStop[] {
  return ordered(j.stops ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s));
}

/** Status after a stop could not be completed (driver is at that stop). */
export function statusAfterFailedStop(j: Job, stop: JobStop): JobStatus {
  if (stop.kind === 'pickup') return 'loaded'; // only legal move from at_pickup; next stop continues
  if (remainingAfter(j, stop).length) return 'in_transit';
  const anyDelivered = (j.stops ?? []).some((s) => s.kind === 'delivery' && s.status === 'done');
  return anyDelivered ? 'delivered' : 'failed';
}

export const stopLabel = (s: JobStop) => (s.kind === 'pickup' ? 'Pickup' : 'Delivery');

/** Trip helpers ───────────────────────────────────────────── */

export const DONE: JobStatus[] = ['completed', 'failed', 'cancelled'];

export function tripJobs(all: Job[], tripId: string): Job[] {
  return all.filter((j) => j.tripId === tripId).sort((a, b) => (a.tripSeq ?? 0) - (b.tripSeq ?? 0));
}

/** Local yyyy-mm-dd of a timestamp in the tenant's time zone. */
export function dayOf(ms: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export interface TripPrev {
  ref: string;
  /** Latest end reading of an earlier job in the trip. */
  odoEnd?: OdoReading;
  /** An earlier job in the trip had its pre-trip inspection done today. */
  inspectedRef?: string;
}

/** What an earlier job of the same trip already captured (for the 2nd+ job of a trip). */
export function tripPrev(all: Job[] | null, job: Job, today: string, timeZone: string): TripPrev | null {
  if (!all || !job.tripId) return null;
  const earlier = tripJobs(all, job.tripId)
    .filter((j) => j.id !== job.id && (j.tripSeq ?? 0) < (job.tripSeq ?? 0))
    .reverse();
  if (!earlier.length) return null;
  const withOdo = earlier.find((j) => j.odoEnd);
  const inspected = earlier.find((j) => j.inspection && dayOf(j.inspection.at, timeZone) === today);
  if (!withOdo && !inspected) return null;
  return {
    ref: (withOdo ?? inspected)!.ref,
    odoEnd: withOdo?.odoEnd,
    inspectedRef: inspected?.ref,
  };
}
