// ─────────────────────────────────────────────────────────────
// Ops data layer: realtime subscriptions + writes for dispatch and drivers.
// Firebase mode uses the full Firestore SDK (onSnapshot + offline cache), loaded lazily
// so the public website keeps the small Lite SDK. Demo mode keeps everything in
// localStorage and syncs across browser tabs (open /admin and /driver side by side).
// ─────────────────────────────────────────────────────────────
import type { Firestore } from 'firebase/firestore';
import { firebaseEnabled, firebaseConfig, getFbApp, getFbAuth } from '../lib/firebase';
import type {
  ChatMessage,
  Driver,
  DriverLocation,
  FleetUnit,
  FuelEntry,
  Job,
  JobEvent,
  JobFinance,
  JobLink,
  JobStatus,
  JobStop,
  Media,
  OpsUser,
  Settlement,
  Thread,
  Transporter,
} from './types';
import { LINK_DRIVER_PREFIX } from './types';
import type { BookingStatus } from '../tenant/types';

export const opsMode: 'firebase' | 'demo' = firebaseEnabled ? 'firebase' : 'demo';
export type Unsub = () => void;

// ── ids ──────────────────────────────────────────────────────

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newId(prefix = ''): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += ALPHA[x % ALPHA.length];
  return prefix ? `${prefix}-${s.slice(0, 7)}` : s.toLowerCase();
}

/** Strip undefined recursively (Firestore rejects it). */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Map a job status to the public booking/tracking status customers see. */
export function trackingStatusFor(s: JobStatus): BookingStatus | null {
  switch (s) {
    case 'assigned':
    case 'accepted':
      return 'assigned';
    case 'started':
    case 'at_pickup':
    case 'loaded':
    case 'in_transit':
    case 'at_delivery':
      return 'in_transit';
    case 'delivered':
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'failed':
      return 'cancelled';
    default:
      return null;
  }
}

// ═════════════════════════════════════════════════════════════
// Demo adapter (localStorage + cross-tab sync)
// ═════════════════════════════════════════════════════════════

type Rec = Record<string, Record<string, unknown>>;
const listeners = new Map<string, Set<() => void>>();
const LS = (path: string) => `hp:ops:${path}`;
let bc: BroadcastChannel | null = null;
try {
  bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('hp-ops') : null;
  if (bc) bc.onmessage = (e) => fire(String(e.data), false);
} catch {
  bc = null;
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('hp:ops:')) fire(e.key.slice('hp:ops:'.length), false);
  });
}

function readColl(path: string): Rec {
  try {
    return JSON.parse(localStorage.getItem(LS(path)) || '{}') as Rec;
  } catch {
    return {};
  }
}
function writeColl(path: string, data: Rec) {
  try {
    localStorage.setItem(LS(path), JSON.stringify(data));
  } catch (e) {
    console.warn('[ops demo] storage full', e);
  }
  fire(path, true);
}
function fire(path: string, broadcast: boolean) {
  listeners.get(path)?.forEach((f) => f());
  if (broadcast) bc?.postMessage(path);
}
function demoSet(path: string, id: string, doc: Record<string, unknown>, merge = false) {
  const c = readColl(path);
  c[id] = merge ? { ...(c[id] ?? {}), ...clean(doc) } : clean(doc);
  writeColl(path, c);
}
function demoDel(path: string, id: string) {
  const c = readColl(path);
  delete c[id];
  writeColl(path, c);
}
function demoGet<T>(path: string, id: string): T | null {
  return (readColl(path)[id] as T | undefined) ?? null;
}
function demoWatch<T>(path: string, cb: (rows: T[]) => void, filter?: (r: T) => boolean, sort?: (a: T, b: T) => number): Unsub {
  const run = () => {
    let rows = Object.entries(readColl(path)).map(([id, d]) => ({ ...(d as object), id }) as T);
    if (filter) rows = rows.filter(filter);
    if (sort) rows.sort(sort);
    cb(rows);
  };
  const set = listeners.get(path) ?? new Set();
  set.add(run);
  listeners.set(path, set);
  queueMicrotask(run);
  return () => set.delete(run);
}

// ═════════════════════════════════════════════════════════════
// Firebase adapter (full SDK, lazy)
// ═════════════════════════════════════════════════════════════

type FS = typeof import('firebase/firestore');
let fsMod: Promise<{ fs: FS; db: Firestore }> | null = null;

/** Full Firestore with an offline cache (multi-tab) — drivers keep working in dead zones. */
function full(): Promise<{ fs: FS; db: Firestore }> {
  fsMod ??= import('firebase/firestore').then((fs) => {
    const app = getFbApp();
    if (!app) throw new Error('Firebase not configured');
    let db: Firestore;
    try {
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
    } catch {
      db = fs.getFirestore(app);
    }
    return { fs, db };
  });
  return fsMod;
}

/** Subscribe helper: resolves the SDK lazily, returns a sync unsubscribe. */
function fbWatch<T>(build: (fs: FS, db: Firestore) => import('firebase/firestore').Query, cb: (rows: T[]) => void, onError?: (e: Error) => void): Unsub {
  let unsub: Unsub | null = null;
  let dead = false;
  void full().then(({ fs, db }) => {
    if (dead) return;
    unsub = fs.onSnapshot(
      build(fs, db),
      (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T)),
      (e) => {
        console.warn('[ops] listener error', e);
        onError?.(e);
      },
    );
  });
  return () => {
    dead = true;
    unsub?.();
  };
}

const P = {
  jobs: (t: string) => `tenants/${t}/jobs`,
  events: (t: string, j: string) => `tenants/${t}/jobs/${j}/events`,
  vehicles: (t: string) => `tenants/${t}/vehicles`,
  drivers: (t: string) => `tenants/${t}/drivers`,
  media: (t: string) => `tenants/${t}/media`,
  threads: (t: string) => `tenants/${t}/threads`,
  messages: (t: string, th: string) => `tenants/${t}/threads/${th}/messages`,
  locations: (t: string) => `tenants/${t}/locations`,
  fuel: (t: string) => `tenants/${t}/fuel`,
  tracking: (t: string) => `tenants/${t}/tracking`,
  bookings: (t: string) => `tenants/${t}/bookings`,
  transporters: (t: string) => `tenants/${t}/transporters`,
  finance: (t: string) => `tenants/${t}/finance`,
  settlements: (t: string) => `tenants/${t}/settlements`,
  devices: (t: string) => `tenants/${t}/devices`,
  links: () => `jobLinks`,
};

async function fbSet(path: string, id: string, doc: Record<string, unknown>, merge = false) {
  const { fs, db } = await full();
  await fs.setDoc(fs.doc(db, path, id), clean(doc), { merge });
}
async function fbGet<T>(path: string, id: string): Promise<T | null> {
  const { fs, db } = await full();
  const s = await fs.getDoc(fs.doc(db, path, id));
  return s.exists() ? ({ ...(s.data() as object), id: s.id } as T) : null;
}

const set = (path: string, id: string, doc: Record<string, unknown>, merge = false) =>
  opsMode === 'demo' ? Promise.resolve(demoSet(path, id, doc, merge)) : fbSet(path, id, doc, merge);
const get = <T,>(path: string, id: string): Promise<T | null> => (opsMode === 'demo' ? Promise.resolve(demoGet<T>(path, id)) : fbGet<T>(path, id));

// ═════════════════════════════════════════════════════════════
// Subscriptions
// ═════════════════════════════════════════════════════════════

export interface JobFilter {
  /** Driver view: only this driver's jobs (required for drivers — rules enforce it). */
  driverId?: string;
  /** Hide completed/cancelled/failed older than `sinceDays`. */
  sinceDays?: number;
}

/** Console listener caps (Spark read budget). Reports note these limits. */
export const JOBS_CAP = 1500;
export const FUEL_CAP = 1000;

const byScheduled = (a: Job, b: Job) => `${a.scheduledDate} ${a.scheduledTime}`.localeCompare(`${b.scheduledDate} ${b.scheduledTime}`);

export function watchJobs(t: string, f: JobFilter, cb: (jobs: Job[]) => void, onError?: (e: Error) => void): Unsub {
  const since = Date.now() - (f.sinceDays ?? 30) * 86_400_000;
  const keep = (j: Job) => (!f.driverId || j.driverId === f.driverId) && (j.updatedAt >= since || !['completed', 'cancelled', 'failed'].includes(j.status));
  if (opsMode === 'demo') return demoWatch<Job>(P.jobs(t), cb, keep, byScheduled);
  return fbWatch<Job>(
    (fs, db) =>
      f.driverId
        ? fs.query(fs.collection(db, P.jobs(t)), fs.where('driverId', '==', f.driverId), fs.orderBy('updatedAt', 'desc'), fs.limit(200))
        : fs.query(fs.collection(db, P.jobs(t)), fs.orderBy('updatedAt', 'desc'), fs.limit(JOBS_CAP)),
    (rows) => cb(rows.filter(keep).sort(byScheduled)),
    onError,
  );
}

export function watchJob(t: string, id: string, cb: (job: Job | null) => void): Unsub {
  if (opsMode === 'demo') return demoWatch<Job>(P.jobs(t), (rows) => cb(rows[0] ?? null), (j) => j.id === id);
  let unsub: Unsub | null = null;
  let dead = false;
  void full().then(({ fs, db }) => {
    if (!dead) unsub = fs.onSnapshot(fs.doc(db, P.jobs(t), id), (s) => cb(s.exists() ? ({ ...(s.data() as object), id: s.id } as Job) : null));
  });
  return () => {
    dead = true;
    unsub?.();
  };
}

export function watchJobEvents(t: string, jobId: string, cb: (ev: JobEvent[]) => void): Unsub {
  const sort = (a: JobEvent, b: JobEvent) => a.at - b.at;
  if (opsMode === 'demo') return demoWatch<JobEvent>(P.events(t, jobId), cb, undefined, sort);
  return fbWatch<JobEvent>((fs, db) => fs.query(fs.collection(db, P.events(t, jobId)), fs.orderBy('at', 'asc'), fs.limit(200)), cb);
}

export function watchVehicles(t: string, cb: (v: FleetUnit[]) => void): Unsub {
  const sort = (a: FleetUnit, b: FleetUnit) => a.registration.localeCompare(b.registration);
  if (opsMode === 'demo') return demoWatch<FleetUnit>(P.vehicles(t), cb, undefined, sort);
  return fbWatch<FleetUnit>((fs, db) => fs.query(fs.collection(db, P.vehicles(t))), (r) => cb(r.sort(sort)));
}

export function watchDrivers(t: string, cb: (d: Driver[]) => void): Unsub {
  const sort = (a: Driver, b: Driver) => (a.name ?? '').localeCompare(b.name ?? '');
  if (opsMode === 'demo') return demoWatch<Driver>(P.drivers(t), cb, undefined, sort);
  return fbWatch<Driver>((fs, db) => fs.query(fs.collection(db, P.drivers(t))), (r) => cb(r.sort(sort)));
}

export function watchThreads(t: string, cb: (th: Thread[]) => void): Unsub {
  const sort = (a: Thread, b: Thread) => b.lastAt - a.lastAt;
  if (opsMode === 'demo') return demoWatch<Thread>(P.threads(t), cb, undefined, sort);
  return fbWatch<Thread>((fs, db) => fs.query(fs.collection(db, P.threads(t)), fs.orderBy('lastAt', 'desc'), fs.limit(200)), cb);
}

export function watchThread(t: string, threadId: string, cb: (th: Thread | null) => void): Unsub {
  if (opsMode === 'demo') return demoWatch<Thread>(P.threads(t), (r) => cb(r[0] ?? null), (x) => x.id === threadId);
  let unsub: Unsub | null = null;
  let dead = false;
  void full().then(({ fs, db }) => {
    if (!dead) unsub = fs.onSnapshot(fs.doc(db, P.threads(t), threadId), (s) => cb(s.exists() ? ({ ...(s.data() as object), id: s.id } as Thread) : null), () => cb(null));
  });
  return () => {
    dead = true;
    unsub?.();
  };
}

export function watchMessages(t: string, threadId: string, cb: (m: ChatMessage[]) => void, max = 200): Unsub {
  const sort = (a: ChatMessage, b: ChatMessage) => a.at - b.at;
  if (opsMode === 'demo') return demoWatch<ChatMessage>(P.messages(t, threadId), (r) => cb(r.slice(-max)), undefined, sort);
  return fbWatch<ChatMessage>(
    (fs, db) => fs.query(fs.collection(db, P.messages(t, threadId)), fs.orderBy('at', 'desc'), fs.limit(max)),
    (r) => cb(r.sort(sort)),
  );
}

export function watchLocations(t: string, cb: (l: DriverLocation[]) => void): Unsub {
  if (opsMode === 'demo') return demoWatch<DriverLocation>(P.locations(t), cb);
  return fbWatch<DriverLocation>((fs, db) => fs.query(fs.collection(db, P.locations(t))), cb);
}

export function watchFuel(t: string, f: { driverId?: string; vehicleId?: string }, cb: (e: FuelEntry[]) => void): Unsub {
  const sort = (a: FuelEntry, b: FuelEntry) => b.at - a.at;
  const keep = (e: FuelEntry) => (!f.driverId || e.driverId === f.driverId) && (!f.vehicleId || e.vehicleId === f.vehicleId);
  if (opsMode === 'demo') return demoWatch<FuelEntry>(P.fuel(t), cb, keep, sort);
  return fbWatch<FuelEntry>(
    (fs, db) =>
      f.driverId
        ? fs.query(fs.collection(db, P.fuel(t)), fs.where('driverId', '==', f.driverId), fs.orderBy('at', 'desc'), fs.limit(100))
        : fs.query(fs.collection(db, P.fuel(t)), fs.orderBy('at', 'desc'), fs.limit(FUEL_CAP)),
    (r) => cb(r.filter(keep)),
  );
}

// ═════════════════════════════════════════════════════════════
// Media (photos / signatures as compressed data URLs)
// ═════════════════════════════════════════════════════════════

const MAX_MEDIA_CHARS = 900_000;
const mediaCache = new Map<string, Promise<Media | null>>();

/**
 * Store a photo. Offline-safe: Firestore writes are applied to the local cache immediately and only
 * resolve once the server acks, so we wait briefly (to surface rule errors when online) and then
 * return the id — the upload completes in the background when signal returns.
 */
export async function putMedia(t: string, m: Omit<Media, 'id'>): Promise<string> {
  if (m.dataUrl.length > MAX_MEDIA_CHARS) throw new Error('Image too large — retake it closer or at lower quality.');
  const id = newId();
  const write = set(P.media(t), id, { ...m });
  if (opsMode === 'demo') {
    await write;
  } else {
    write.catch((e) => console.warn('[ops] media upload failed', e));
    await Promise.race([write, new Promise((r) => setTimeout(r, 1500))]);
  }
  mediaCache.set(`${t}/${id}`, Promise.resolve({ ...m, id }));
  return id;
}

export function getMedia(t: string, id: string): Promise<Media | null> {
  const key = `${t}/${id}`;
  if (!mediaCache.has(key)) mediaCache.set(key, get<Media>(P.media(t), id));
  return mediaCache.get(key)!;
}

// ═════════════════════════════════════════════════════════════
// Jobs
// ═════════════════════════════════════════════════════════════

export type NewJob = Omit<Job, 'id' | 'ref' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status'> & { status?: JobStatus; ref?: string };

async function addEvent(t: string, jobId: string, e: Omit<JobEvent, 'id'>) {
  await set(P.events(t, jobId), newId(), { ...e });
}

/** Sync the public tracking record (and booking status) for jobs created from a website booking. */
async function syncTracking(t: string, job: Pick<Job, 'bookingRef'>, status: JobStatus, note?: string) {
  const ts = trackingStatusFor(status);
  if (!job.bookingRef || !ts) return;
  const now = Date.now();
  const patch: Record<string, unknown> = { status: ts, updatedAt: now };
  if (note) patch.note = note.slice(0, 300);
  try {
    if (opsMode === 'demo') {
      // demo tracking lives in the website's demo store
      const key = `hp:tracking:${t}`;
      const tr = JSON.parse(localStorage.getItem(key) || '{}') as Record<string, Record<string, unknown>>;
      if (tr[job.bookingRef]) tr[job.bookingRef] = { ...tr[job.bookingRef], ...patch };
      localStorage.setItem(key, JSON.stringify(tr));
      const bk = `hp:bookings:${t}`;
      const list = JSON.parse(localStorage.getItem(bk) || '[]') as Record<string, unknown>[];
      localStorage.setItem(bk, JSON.stringify(list.map((b) => (b.ref === job.bookingRef ? { ...b, status: ts, updatedAt: now } : b))));
      return;
    }
    const { fs, db } = await full();
    const batch = fs.writeBatch(db);
    batch.update(fs.doc(db, P.tracking(t), job.bookingRef), patch);
    batch.update(fs.doc(db, P.bookings(t), job.bookingRef), { status: ts, updatedAt: now });
    await batch.commit();
  } catch (e) {
    console.warn('[ops] tracking sync skipped', e);
  }
}

export async function createJob(t: string, input: NewJob, user: OpsUser): Promise<Job> {
  const now = Date.now();
  const ref = input.ref || input.bookingRef || newId('JOB');
  const status: JobStatus = input.status ?? (input.driverId && input.vehicleId ? 'assigned' : 'draft');
  // the sell price lives in finance/{jobId}: drivers (incl. hired ones) can read jobs
  const { price, ...rest } = input;
  const job: Job = { ...withEnds(rest as NewJob), id: ref, ref, status, createdBy: user.uid, createdAt: now, updatedAt: now, lastEventAt: now };
  if (opsMode === 'demo' && demoGet(P.jobs(t), ref)) throw new Error(`A job with reference ${ref} already exists.`);
  if (opsMode === 'firebase' && (await fbGet(P.jobs(t), ref))) throw new Error(`A job with reference ${ref} already exists.`);
  await set(P.jobs(t), ref, job as unknown as Record<string, unknown>);
  if (price !== undefined) await saveFinance(t, ref, { price, currency: input.currency });
  await addEvent(t, ref, { status, at: now, by: user.uid, byName: user.name, role: 'ops', note: 'Job created' });
  if (status === 'assigned') await syncTracking(t, job, status);
  return job;
}

/** Ops edit (any field). Adds a note event when `note` is given. */
export async function updateJob(t: string, id: string, patch: Partial<Job>, user: OpsUser, note?: string): Promise<void> {
  const now = Date.now();
  const { price, ...rest } = patch;
  const extra: Record<string, unknown> = {};
  if (price !== undefined) {
    await saveFinance(t, id, { price, currency: patch.currency ?? 'ZAR' });
    extra.price = null; // drivers can read jobs — never keep the price there
  }
  await set(P.jobs(t), id, { ...withEnds(rest as Partial<Job>), ...extra, updatedAt: now }, true);
  if (note) await addEvent(t, id, { status: 'note', at: now, by: user.uid, byName: user.name, role: user.role, note });
}

export async function assignJob(
  t: string,
  job: Job,
  a: { vehicle?: FleetUnit | null; driver?: Driver | null },
  user: OpsUser,
  opt: { silent?: boolean; extra?: Partial<Job> } = {},
): Promise<void> {
  const now = Date.now();
  if (IN_PROGRESS.includes(job.status) && ((a.driver && a.driver.id !== job.driverId) || (a.vehicle && a.vehicle.id !== job.vehicleId)))
    throw new Error('This trip is under way — the driver or vehicle can only be changed before it starts. Mark it failed/cancelled and create a new job instead.');
  const assigned = !!(a.vehicle ?? job.vehicleId) && !!(a.driver ?? job.driverId);
  const patch: Partial<Job> = {
    vehicleId: a.vehicle?.id ?? job.vehicleId,
    vehicleReg: a.vehicle?.registration ?? job.vehicleReg,
    driverId: a.driver?.id ?? job.driverId,
    driverName: a.driver?.name ?? job.driverName,
    updatedAt: now,
    lastEventAt: now,
  };
  const hiredFrom = a.vehicle?.ownership === 'hired' ? a.vehicle : a.driver?.ownership === 'hired' ? a.driver : null;
  if (a.vehicle || a.driver) {
    // null (not undefined) so a merge clears a previous transporter
    Object.assign(patch, { ownership: hiredFrom ? 'hired' : 'own', transporterId: hiredFrom?.transporterId ?? null, transporterName: hiredFrom?.transporterName ?? null });
  }
  const reassign = !!job.driverId && !!a.driver && a.driver.id !== job.driverId;
  if (assigned && (job.status === 'draft' || reassign)) patch.status = 'assigned';
  if (opt.extra) Object.assign(patch, opt.extra);
  // moving a job away from a one-time link driver: take it off that link
  const leavingLink = !!job.extLink && !!a.driver && a.driver.id !== job.driverId;
  if (leavingLink) (patch as Record<string, unknown>).extLink = null;
  await set(P.jobs(t), job.id, patch as Record<string, unknown>, true);
  if (leavingLink) await detachFromLink(job.extLink!.token, job.id);
  await addEvent(t, job.id, {
    status: reassign ? 'reassigned' : patch.status ?? 'note',
    at: now,
    by: user.uid,
    byName: user.name,
    role: 'ops',
    note: `Assigned ${patch.vehicleReg ?? '—'} · ${patch.driverName ?? '—'}`,
  });
  if (patch.status === 'assigned') await syncTracking(t, job, 'assigned');
  // notify the driver in chat
  if (!opt.silent && a.driver && (reassign || patch.status === 'assigned')) {
    await sendMessage(t, a.driver.id, { text: `New job ${job.ref}: ${job.title} — ${job.scheduledDate} ${job.scheduledTime}. Open My jobs for details.`, jobId: job.id, jobRef: job.ref, auto: true }, user, a.driver.name);
  }
}

export interface AdvanceExtra {
  /** Multi-stop jobs: the updated stop list (status / POD / photos of the stop just handled). */
  stops?: JobStop[];
  note?: string;
  /** Photos taken at this step (e.g. load photos) — recorded on the timeline event. */
  photoIds?: string[];
  lat?: number;
  lng?: number;
  odoStart?: Job['odoStart'];
  odoEnd?: Job['odoEnd'];
  inspection?: Job['inspection'];
  pod?: Job['pod'];
  failReason?: string;
}

/**
 * Move a job to `next` status (driver or ops). Also: vehicle odometer/status, driver status,
 * public tracking sync and an audit event with location.
 */
/** A real driver uid (not the placeholder of an unopened one-time link). */
const realDriver = (j: Pick<Job, 'driverId'>) => !!j.driverId && !j.driverId.startsWith(LINK_DRIVER_PREFIX);

/** Statuses at which the trip is physically under way (no reassigning / unassigning). */
export const IN_PROGRESS: JobStatus[] = ['started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery', 'delivered'];
/** Max odometer jump a single reading may record (guards OCR extra-digit errors). */
export const MAX_ODO_JUMP_KM = 5000;

export async function advanceJob(t: string, job: Job, next: JobStatus, user: OpsUser, x: AdvanceExtra = {}): Promise<void> {
  const now = Date.now();
  const patch: Partial<Job> = { status: next, updatedAt: now, lastEventAt: now };
  if (x.odoStart) patch.odoStart = x.odoStart;
  const start = x.odoStart?.km ?? job.odoStart?.km;
  if (x.odoEnd) {
    if (typeof start === 'number' && x.odoEnd.km < start) throw new Error(`End reading (${x.odoEnd.km} km) is lower than the start reading (${start} km).`);
    if (typeof start === 'number' && x.odoEnd.km - start > MAX_ODO_JUMP_KM) throw new Error(`End reading is more than ${MAX_ODO_JUMP_KM.toLocaleString()} km above the start — please re-check.`);
    patch.odoEnd = x.odoEnd;
    if (typeof start === 'number') patch.actualKm = Math.round((x.odoEnd.km - start) * 10) / 10;
  }
  if (x.inspection) patch.inspection = x.inspection;
  if (x.pod) patch.pod = x.pod;
  if (x.stops) patch.stops = x.stops;
  if (x.failReason) patch.failReason = x.failReason.slice(0, 300);
  const ev: Omit<JobEvent, 'id'> = { status: next, at: now, by: user.uid, byName: user.name, role: user.role, note: x.note?.slice(0, 1000), photoIds: x.photoIds?.slice(0, 6), lat: x.lat, lng: x.lng };

  // vehicle + driver side effects
  const terminal = next === 'completed' || next === 'cancelled' || next === 'failed';
  const vPatch: Record<string, unknown> = { updatedAt: now, lastJobId: job.id };
  if (next === 'started') vPatch.status = 'on_job';
  if (terminal) vPatch.status = 'available';
  const odo = x.odoEnd?.km ?? x.odoStart?.km;
  const ds = next === 'started' ? 'on_job' : terminal ? 'available' : null;

  if (opsMode === 'demo') {
    await set(P.jobs(t), job.id, patch as Record<string, unknown>, true);
    await addEvent(t, job.id, ev);
    if (job.vehicleId) {
      const v = demoGet<FleetUnit>(P.vehicles(t), job.vehicleId);
      if (typeof odo === 'number' && (!v || odo >= (v.odometerKm ?? 0))) vPatch.odometerKm = odo;
      if (Object.keys(vPatch).length > 2) await set(P.vehicles(t), job.vehicleId, vPatch, true);
    }
    if (realDriver(job) && ds) await set(P.drivers(t), job.driverId!, { status: ds, updatedAt: now }, true);
  } else {
    // One atomic batch: offline it is queued locally as a unit (nothing is lost if the app is killed).
    const { fs, db } = await full();
    const batch = fs.writeBatch(db);
    batch.set(fs.doc(db, P.jobs(t), job.id), clean(patch as Record<string, unknown>), { merge: true });
    batch.set(fs.doc(db, P.events(t, job.id), newId()), clean(ev as Record<string, unknown>));
    if (job.vehicleId) {
      if (typeof odo === 'number') {
        // cache only — never block on the network; rules reject a lower or wildly higher reading
        const v = await fs
          .getDocFromCache(fs.doc(db, P.vehicles(t), job.vehicleId))
          .then((d) => (d.exists() ? (d.data() as FleetUnit) : null))
          .catch(() => null);
        if (v && odo >= (v.odometerKm ?? 0) && odo - (v.odometerKm ?? 0) <= MAX_ODO_JUMP_KM) vPatch.odometerKm = odo;
      }
      // separate, best-effort: a stale odometer must never make the rules reject the status/POD batch
      if (Object.keys(vPatch).length > 2)
        void fs.setDoc(fs.doc(db, P.vehicles(t), job.vehicleId), vPatch, { merge: true }).catch((e) => console.warn('[ops] vehicle update skipped', e));
    }
    if (realDriver(job) && ds) batch.set(fs.doc(db, P.drivers(t), job.driverId!), { status: ds, updatedAt: now }, { merge: true });
    await batch.commit();
  }
  // customer-facing status: internal failure remarks are never published
  void syncTracking(t, job, next, next === 'failed' ? 'Delivery could not be completed — we will contact you shortly.' : undefined);
}

/** Delete a job with its timeline + job photos, and release the customer tracking status. */
export async function deleteJob(t: string, id: string): Promise<void> {
  const cur = await get<Job>(P.jobs(t), id).catch(() => null);
  if (cur?.extLink) await detachFromLink(cur.extLink.token, id);
  if (opsMode === 'demo') {
    demoDel(P.jobs(t), id);
    writeColl(P.events(t, id), {});
    const media = readColl(P.media(t));
    for (const [k, m] of Object.entries(media)) if ((m as { jobId?: string }).jobId === id) delete media[k];
    writeColl(P.media(t), media);
    return;
  }
  const { fs, db } = await full();
  const [ev, media] = await Promise.all([
    fs.getDocs(fs.collection(db, P.events(t, id))),
    fs.getDocs(fs.query(fs.collection(db, P.media(t)), fs.where('jobId', '==', id))),
  ]);
  const refs = [...ev.docs, ...media.docs].map((d) => d.ref);
  for (let i = 0; i < refs.length; i += 400) {
    const b = fs.writeBatch(db);
    refs.slice(i, i + 400).forEach((r) => b.delete(r));
    await b.commit();
  }
  await fs.deleteDoc(fs.doc(db, P.jobs(t), id));
}

// ═════════════════════════════════════════════════════════════
// Vehicles & drivers
// ═════════════════════════════════════════════════════════════

export async function saveVehicle(t: string, v: Omit<FleetUnit, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<void> {
  const now = Date.now();
  await set(P.vehicles(t), v.id, { ...v, createdAt: v.createdAt ?? now, updatedAt: now });
}
export async function deleteVehicle(t: string, id: string): Promise<void> {
  if (opsMode === 'demo') return demoDel(P.vehicles(t), id);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.vehicles(t), id));
}

export async function saveDriver(t: string, d: Omit<Driver, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<void> {
  const now = Date.now();
  await set(P.drivers(t), d.id, { ...d, createdAt: d.createdAt ?? now, updatedAt: now });
}

/** Remove a driver record (their Firebase Auth user must be deleted in the console — no Cloud Functions). */
export async function deleteDriver(t: string, id: string): Promise<void> {
  if (opsMode === 'demo') return demoDel(P.drivers(t), id);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.drivers(t), id));
}

/** Clear the vehicle and/or driver from a job (back to draft if nothing assigned). */
export async function unassignJob(t: string, job: Job, what: { vehicle?: boolean; driver?: boolean }, user: OpsUser): Promise<void> {
  if (IN_PROGRESS.includes(job.status)) throw new Error('This trip is under way — it cannot be unassigned. Mark it failed/cancelled instead.');
  const now = Date.now();
  const { fs, db } = opsMode === 'firebase' ? await full() : { fs: null, db: null };
  const patch: Record<string, unknown> = { updatedAt: now, lastEventAt: now };
  if (what.vehicle) {
    patch.vehicleId = fs ? fs.deleteField() : null;
    patch.vehicleReg = fs ? fs.deleteField() : null;
  }
  if (what.driver) {
    patch.driverId = fs ? fs.deleteField() : null;
    patch.driverName = fs ? fs.deleteField() : null;
    if (job.extLink) patch.extLink = fs ? fs.deleteField() : null;
  }
  if (['assigned', 'accepted'].includes(job.status)) patch.status = 'draft';
  if (opsMode === 'demo') {
    const c = readColl(P.jobs(t));
    const cur = { ...(c[job.id] ?? {}) } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) if (v === null) delete cur[k];
    else cur[k] = v;
    c[job.id] = cur;
    writeColl(P.jobs(t), c);
  } else {
    await fs!.updateDoc(fs!.doc(db!, P.jobs(t), job.id), patch);
  }
  if (what.driver && job.extLink) await detachFromLink(job.extLink.token, job.id);
  await addEvent(t, job.id, { status: 'note', at: now, by: user.uid, byName: user.name, role: 'ops', note: `Unassigned ${[what.vehicle && 'vehicle', what.driver && 'driver'].filter(Boolean).join(' & ')}` });
}

/** Driver's own status toggle (off duty / available). */
export async function setDriverStatus(t: string, uid: string, status: Driver['status']): Promise<void> {
  await set(P.drivers(t), uid, { status, updatedAt: Date.now() }, true);
}

/** Login e-mail derived from the phone number — drivers sign in with phone + PIN. */
export function driverLoginEmail(phoneE164: string, tenantId: string): string {
  return `${phoneE164.replace(/\D/g, '')}.${tenantId}@drivers.exeracargo.app`;
}

/**
 * Create a driver login (Firebase Auth email/password with a phone-derived e-mail and a PIN).
 * Uses a throwaway secondary Firebase app so the admin stays signed in.
 * Returns the new uid. Demo mode returns a generated id and stores the PIN locally.
 */
export async function createDriverLogin(t: string, phoneE164: string, pin: string): Promise<string> {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN must be 6–12 digits.');
  if (opsMode === 'demo') {
    const uid = `drv_${newId()}`;
    const logins = JSON.parse(localStorage.getItem('hp:ops:demo-logins') || '{}') as Record<string, { uid: string; pin: string; t: string }>;
    logins[phoneE164.replace(/\D/g, '')] = { uid, pin, t };
    localStorage.setItem('hp:ops:demo-logins', JSON.stringify(logins));
    return uid;
  }
  const [{ initializeApp, deleteApp }, { getAuth, createUserWithEmailAndPassword, signOut }] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const tmp = initializeApp(firebaseConfig, `driver-create-${Date.now()}`);
  try {
    const auth = getAuth(tmp);
    const cred = await createUserWithEmailAndPassword(auth, driverLoginEmail(phoneE164, t), pin);
    await signOut(auth);
    return cred.user.uid;
  } finally {
    await deleteApp(tmp);
  }
}

/** Link a driver uid to its tenant (lets the driver app verify membership). */
export async function indexDriver(uid: string, tenantId: string): Promise<void> {
  if (opsMode === 'demo') return;
  const { fs, db } = await full();
  await fs.setDoc(fs.doc(db, 'driverIndex', uid), { tenantId });
}

// ═════════════════════════════════════════════════════════════
// Driver auth (driver app)
// ═════════════════════════════════════════════════════════════

const DEMO_DRIVER_KEY = 'hp:ops:demo-driver';

export async function driverSignIn(t: string, phoneE164: string, pin: string): Promise<void> {
  if (opsMode === 'demo') {
    const logins = JSON.parse(localStorage.getItem('hp:ops:demo-logins') || '{}') as Record<string, { uid: string; pin: string; t: string }>;
    const l = logins[phoneE164.replace(/\D/g, '')];
    if (!l || l.pin !== pin || l.t !== t) throw new Error('Phone number or PIN is incorrect.');
    localStorage.setItem(DEMO_DRIVER_KEY, l.uid);
    window.dispatchEvent(new Event('hp-driver-auth'));
    return;
  }
  const [{ signInWithEmailAndPassword }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
  try {
    await signInWithEmailAndPassword(auth, driverLoginEmail(phoneE164, t), pin);
  } catch {
    throw new Error('Phone number or PIN is incorrect.');
  }
}

export async function driverSignOut(): Promise<void> {
  if (opsMode === 'demo') {
    localStorage.removeItem(DEMO_DRIVER_KEY);
    window.dispatchEvent(new Event('hp-driver-auth'));
    return;
  }
  const [{ signOut }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
  await signOut(auth);
}

/** Resolves the signed-in driver's profile for this tenant (null = signed out or not a driver here). */
export function onDriverAuth(t: string, cb: (d: Driver | null) => void): Unsub {
  if (opsMode === 'demo') {
    let inner: Unsub | null = null;
    const emit = () => {
      inner?.();
      const uid = localStorage.getItem(DEMO_DRIVER_KEY);
      if (!uid) return cb(null);
      inner = demoWatch<Driver>(P.drivers(t), (r) => cb(r[0] && r[0].active ? r[0] : null), (d) => d.id === uid);
    };
    emit();
    window.addEventListener('hp-driver-auth', emit);
    return () => {
      inner?.();
      window.removeEventListener('hp-driver-auth', emit);
    };
  }
  let unsubAuth: Unsub | null = null;
  let unsubDoc: Unsub | null = null;
  let dead = false;
  void Promise.all([import('firebase/auth'), getFbAuth()]).then(([{ onAuthStateChanged }, auth]) => {
    if (dead) return;
    unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubDoc?.();
      unsubDoc = null;
      if (!u) return cb(null);
      let unsubSnap: Unsub | null = null;
      void full().then(({ fs, db }) => {
        unsubSnap = fs.onSnapshot(
          fs.doc(db, P.drivers(t), u.uid),
          (s) => cb(s.exists() && (s.data() as Driver).active ? ({ ...(s.data() as Driver), id: s.id }) : null),
          () => cb(null),
        );
      });
      unsubDoc = () => unsubSnap?.();
    });
  });
  return () => {
    dead = true;
    unsubDoc?.();
    unsubAuth?.();
  };
}

// ═════════════════════════════════════════════════════════════
// Chat
// ═════════════════════════════════════════════════════════════

export const BROADCAST = 'broadcast';

/**
 * Send a chat message in a thread. Thread id == driver uid (1:1 with dispatch) or 'broadcast'.
 * Maintains thread summary + unread counters.
 */
export async function sendMessage(
  t: string,
  threadId: string,
  msg: { text: string; jobId?: string; jobRef?: string; imageId?: string; auto?: boolean },
  user: OpsUser,
  driverName?: string,
): Promise<void> {
  const text = msg.text.trim().slice(0, 2000);
  if (!text && !msg.imageId) return;
  const now = Date.now();
  const m: Omit<ChatMessage, 'id'> = { from: user.uid, fromName: user.name, role: user.role, text, at: now, jobId: msg.jobId, jobRef: msg.jobRef, imageId: msg.imageId, auto: msg.auto || undefined };
  const summary: Record<string, unknown> = {
    lastText: text || '📷 Photo',
    lastAt: now,
    lastFrom: user.role,
  };
  if (threadId !== BROADCAST) summary.driverId = threadId;
  const name = driverName ?? (user.role === 'driver' ? user.name : undefined);
  if (name) summary.driverName = name;
  if (opsMode === 'demo') {
    await set(P.messages(t, threadId), newId(), m as Record<string, unknown>);
    const prev = demoGet<Thread>(P.threads(t), threadId);
    if (user.role === 'driver') summary.unreadOps = (prev?.unreadOps ?? 0) + 1;
    else if (threadId !== BROADCAST) summary.unreadDriver = (prev?.unreadDriver ?? 0) + 1;
    await set(P.threads(t), threadId, summary, true);
    return;
  }
  const { fs, db } = await full();
  // each side only ever increments the OTHER side's counter, atomically
  if (user.role === 'driver') summary.unreadOps = fs.increment(1);
  else if (threadId !== BROADCAST) summary.unreadDriver = fs.increment(1);
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, P.messages(t, threadId), newId()), clean(m as Record<string, unknown>));
  batch.set(fs.doc(db, P.threads(t), threadId), summary, { merge: true });
  // resolve once queued locally; server confirmation can arrive later (offline-friendly)
  const commit = batch.commit();
  await Promise.race([commit, new Promise((r) => setTimeout(r, 2500))]);
  commit.catch((e) => console.warn('[ops] message sync failed', e));
}

export async function markThreadRead(t: string, threadId: string, role: 'ops' | 'driver'): Promise<void> {
  await set(P.threads(t), threadId, role === 'ops' ? { unreadOps: 0 } : { unreadDriver: 0 }, true).catch(() => undefined);
}

// ═════════════════════════════════════════════════════════════
// Location & fuel
// ═════════════════════════════════════════════════════════════

export async function updateLocation(t: string, loc: DriverLocation): Promise<void> {
  await set(P.locations(t), loc.driverId, loc as unknown as Record<string, unknown>);
}

/** Stop showing the driver on the live map (called when they go off duty / sign out). */
export async function clearLocation(t: string, driverId: string): Promise<void> {
  if (opsMode === 'demo') return demoDel(P.locations(t), driverId);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.locations(t), driverId)).catch(() => undefined);
}

export async function addFuel(t: string, e: Omit<FuelEntry, 'id'>): Promise<void> {
  await set(P.fuel(t), newId(), e as Record<string, unknown>);
}

// ═════════════════════════════════════════════════════════════
// Demo seed (so a fresh demo has vehicles, a driver and jobs)
// ═════════════════════════════════════════════════════════════

export const DEMO_DRIVER = { phone: '+27821112222', pin: '123456', name: 'Sipho Dlamini' };

export async function seedDemo(t: string, country: 'ZA' | 'LK'): Promise<void> {
  if (opsMode !== 'demo' || Object.keys(readColl(P.vehicles(t))).length) return;
  const now = Date.now();
  const za = country === 'ZA';
  const vehicles: FleetUnit[] = [
    { id: 'v1', registration: za ? 'GP 482-119' : 'WP LK-4821', name: 'Tipper 10m³ #1', type: 'tipper', capacity: '10 m³', status: 'available', odometerKm: 184_220, serviceIntervalKm: 15_000, lastServiceKm: 172_000, licenceDiscExpiry: isoIn(25), roadworthyExpiry: isoIn(120), insuranceExpiry: isoIn(300), createdAt: now, updatedAt: now },
    { id: 'v2', registration: za ? 'GP 771-904' : 'WP LB-7719', name: '8-ton Rigid', type: 'lorry', capacity: '8 t', status: 'available', odometerKm: 96_410, serviceIntervalKm: 20_000, lastServiceKm: 80_000, licenceDiscExpiry: isoIn(200), roadworthyExpiry: isoIn(14), insuranceExpiry: isoIn(250), createdAt: now, updatedAt: now },
    { id: 'v3', registration: za ? 'FS 220-731' : 'NW LC-2207', name: 'Superlink 34t', type: 'superlink', capacity: '34 t', status: 'maintenance', odometerKm: 612_880, serviceIntervalKm: 25_000, lastServiceKm: 590_000, licenceDiscExpiry: isoIn(90), roadworthyExpiry: isoIn(160), insuranceExpiry: isoIn(45), permitExpiry: isoIn(60), createdAt: now, updatedAt: now },
  ];
  for (const v of vehicles) demoSet(P.vehicles(t), v.id, v as unknown as Record<string, unknown>);
  const uid = await createDriverLogin(t, DEMO_DRIVER.phone, DEMO_DRIVER.pin);
  const d: Driver = { id: uid, name: DEMO_DRIVER.name, phone: DEMO_DRIVER.phone, licenceCode: 'EC', licenceExpiry: isoIn(400), prdpExpiry: isoIn(20), status: 'available', active: true, loginId: DEMO_DRIVER.phone, defaultVehicleId: 'v1', createdAt: now, updatedAt: now };
  demoSet(P.drivers(t), uid, d as unknown as Record<string, unknown>);
  const user: OpsUser = { uid: 'demo', name: 'Dispatch', role: 'ops', tenantId: t };
  const today = isoIn(0);
  await createJob(
    t,
    {
      kind: 'vehicle',
      title: za ? '10m³ building sand · Midrand → Sandton' : '4 cube sand · Kadawatha → Kandy',
      customer: { name: za ? 'Mokoena Builders' : 'Perera Constructions', phone: za ? '+27831234567' : '+94771234567', company: za ? 'Mokoena Builders (Pty) Ltd' : undefined },
      pickup: za
        ? { address: 'Lanseria Rd quarry yard', placeId: 'za-gp-midrand', place: 'Midrand', region: 'Gauteng', contact: 'Yard foreman', phone: '+27820000001' }
        : { address: 'Main yard', placeId: 'lk-kadawatha', place: 'Kadawatha', region: 'Gampaha' },
      dropoff: za
        ? { address: '14 Rivonia Rd site gate B', placeId: 'za-gp-sandton', place: 'Sandton', region: 'Gauteng', contact: 'Site manager', phone: '+27820000002' }
        : { address: 'Site office', placeId: 'lk-kandy', place: 'Kandy', region: 'Kandy' },
      cargo: za ? '10 m³ building sand' : '4 cube sand',
      instructions: 'Call the site manager 15 minutes before arrival. Hard hats required on site.',
      scheduledDate: today,
      scheduledTime: '09:00',
      priority: 'high',
      vehicleId: 'v1',
      vehicleReg: vehicles[0].registration,
      driverId: uid,
      driverName: d.name,
      price: za ? 2544 : 32_400,
      currency: za ? 'ZAR' : 'LKR',
      estimatedKm: za ? 18 : 116,
    },
    user,
  );
  await createJob(
    t,
    {
      kind: 'freight',
      title: za ? '4 pallets · Bloemfontein → Maseru' : '2 pallets · Colombo → Galle',
      customer: { name: za ? 'Maluti Retail' : 'Lanka Traders', phone: za ? '+26622000000' : '+94112345678' },
      pickup: za ? { address: 'Hamilton Industrial', placeId: 'za-fs-bloemfontein', place: 'Bloemfontein', region: 'Free State' } : { address: 'Warehouse 3', placeId: 'lk-colombo', place: 'Colombo', region: 'Colombo' },
      dropoff: za ? { address: 'Thetsane Industrial', placeId: 'ls-maseru', place: 'Maseru', region: 'Lesotho' } : { address: 'Store', placeId: 'lk-galle', place: 'Galle', region: 'Galle' },
      cargo: '4 pallets boxed retail stock (1.6 t)',
      scheduledDate: isoIn(1),
      scheduledTime: '07:30',
      priority: 'normal',
      currency: za ? 'ZAR' : 'LKR',
      estimatedKm: za ? 145 : 119,
    },
    user,
  );
  await sendMessage(t, uid, { text: 'Morning Sipho — your first job is loaded in the app. Shout if anything’s unclear.' }, user, d.name);
}

function isoIn(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// ═════════════════════════════════════════════════════════════
// Multi-stop helpers
// ═════════════════════════════════════════════════════════════

/** Keep `pickup` / `dropoff` (first pickup, last delivery) in sync with `stops`. */
export function withEnds<T extends Partial<Job>>(j: T): T {
  const stops = j.stops;
  if (!stops?.length) return j;
  const ordered = [...stops].sort((a, b) => a.seq - b.seq);
  const pick = (k: JobStop['kind']) => (k === 'pickup' ? ordered.find((s) => s.kind === k) : [...ordered].reverse().find((s) => s.kind === k));
  const end = (s: JobStop | undefined) =>
    s ? { address: s.address, placeId: s.placeId, place: s.place, region: s.region, contact: s.contact, phone: s.phone, lat: s.lat, lng: s.lng } : undefined;
  return { ...j, stops: ordered.map((s, i) => ({ ...s, seq: i })), pickup: end(pick('pickup')) ?? j.pickup, dropoff: end(pick('delivery')) ?? j.dropoff };
}

/** Stops of any job — single-leg jobs are presented as two stops so all screens share one code path. */
export function jobStops(j: Job): JobStop[] {
  if (j.stops?.length) return [...j.stops].sort((a, b) => a.seq - b.seq);
  const done = (st: JobStatus[]) => st.includes(j.status);
  const after = (s: JobStatus) => JOB_ORDER.indexOf(j.status) > JOB_ORDER.indexOf(s);
  return [
    { ...j.pickup, id: 'p', kind: 'pickup', seq: 0, cargo: j.cargo, status: after('at_pickup') ? 'done' : done(['at_pickup']) ? 'arrived' : 'pending' },
    { ...j.dropoff, id: 'd', kind: 'delivery', seq: 1, status: done(['delivered', 'completed']) ? 'done' : done(['at_delivery']) ? 'arrived' : 'pending', pod: j.pod },
  ];
}
const JOB_ORDER: JobStatus[] = ['draft', 'assigned', 'accepted', 'started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery', 'delivered', 'completed'];

// ═════════════════════════════════════════════════════════════
// Trips — several jobs dispatched together to one truck / driver
// ═════════════════════════════════════════════════════════════

/** Assign jobs (in the given order) to one vehicle + driver as a trip. One chat message to the driver. */
export async function assignTrip(t: string, jobs: Job[], a: { vehicle?: FleetUnit | null; driver?: Driver | null }, user: OpsUser): Promise<string> {
  if (!jobs.length) throw new Error('Select at least one job.');
  const busy = jobs.find((j) => IN_PROGRESS.includes(j.status) || j.status === 'completed');
  if (busy) throw new Error(`${busy.ref} is already under way or closed — remove it from the selection.`);
  const tripId = jobs.length > 1 ? newId('TRP') : undefined;
  for (const [i, j] of jobs.entries()) await assignJob(t, j, a, user, { silent: true, extra: tripId ? { tripId, tripSeq: i } : undefined });
  if (a.driver) {
    const list = jobs.map((j, i) => `${i + 1}. ${j.ref} ${j.pickup.place} → ${j.dropoff.place}`).join('\n');
    await sendMessage(t, a.driver.id, { text: `New ${jobs.length > 1 ? `trip (${jobs.length} jobs)` : 'job'} for ${jobs[0].scheduledDate}:\n${list}\nOpen My jobs for details.`, jobId: jobs[0].id, jobRef: jobs[0].ref, auto: true }, user, a.driver.name);
  }
  return tripId ?? jobs[0].id;
}

/** Take a job out of its trip. */
export async function leaveTrip(t: string, job: Job): Promise<void> {
  await set(P.jobs(t), job.id, { tripId: null, tripSeq: null, updatedAt: Date.now() } as unknown as Record<string, unknown>, true);
}

// ═════════════════════════════════════════════════════════════
// Transporters (subcontractors), finance, settlements
// ═════════════════════════════════════════════════════════════

export function watchTransporters(t: string, cb: (r: Transporter[]) => void): Unsub {
  const sort = (a: Transporter, b: Transporter) => (a.name ?? '').localeCompare(b.name ?? '');
  if (opsMode === 'demo') return demoWatch<Transporter>(P.transporters(t), cb, undefined, sort);
  return fbWatch<Transporter>((fs, db) => fs.query(fs.collection(db, P.transporters(t))), (r) => cb(r.sort(sort)));
}
export async function saveTransporter(t: string, x: Omit<Transporter, 'createdAt' | 'updatedAt'> & { createdAt?: number }): Promise<void> {
  const now = Date.now();
  await set(P.transporters(t), x.id, { ...x, createdAt: x.createdAt ?? now, updatedAt: now });
}
export async function deleteTransporter(t: string, id: string): Promise<void> {
  if (opsMode === 'demo') return demoDel(P.transporters(t), id);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.transporters(t), id));
}

/** Sell price + buy cost per job (dispatch only). */
export function watchFinance(t: string, cb: (r: JobFinance[]) => void): Unsub {
  if (opsMode === 'demo') return demoWatch<JobFinance>(P.finance(t), cb);
  return fbWatch<JobFinance>((fs, db) => fs.query(fs.collection(db, P.finance(t)), fs.orderBy('updatedAt', 'desc'), fs.limit(JOBS_CAP)), cb);
}
export function watchJobFinance(t: string, jobId: string, cb: (f: JobFinance | null) => void): Unsub {
  if (opsMode === 'demo') return demoWatch<JobFinance>(P.finance(t), (r) => cb(r[0] ?? null), (f) => f.id === jobId);
  return fbWatch<JobFinance>((fs, db) => fs.query(fs.collection(db, P.finance(t)), fs.where(fs.documentId(), '==', jobId)), (r) => cb(r[0] ?? null));
}
export async function saveFinance(t: string, jobId: string, patch: Partial<Omit<JobFinance, 'id'>>): Promise<void> {
  await set(P.finance(t), jobId, { ...patch, updatedAt: Date.now() }, true);
}
/** Sell price of a job (finance doc first, legacy job.price as fallback). */
export function jobPrice(job: Pick<Job, 'price'>, fin?: JobFinance | null): number | undefined {
  return fin?.price ?? job.price;
}

export function watchSettlements(t: string, cb: (r: Settlement[]) => void): Unsub {
  const sort = (a: Settlement, b: Settlement) => b.createdAt - a.createdAt;
  if (opsMode === 'demo') return demoWatch<Settlement>(P.settlements(t), cb, undefined, sort);
  return fbWatch<Settlement>((fs, db) => fs.query(fs.collection(db, P.settlements(t)), fs.orderBy('createdAt', 'desc'), fs.limit(500)), cb);
}
/** Save a statement and lock (or release) the jobs' costs to it. */
export async function saveSettlement(t: string, st: Settlement, release: string[] = []): Promise<void> {
  const now = Date.now();
  if (opsMode === 'demo') {
    await set(P.settlements(t), st.id, { ...st, updatedAt: now });
    for (const l of st.lines) await saveFinance(t, l.jobId, { settlementId: st.id });
    for (const id of release) await set(P.finance(t), id, { settlementId: null, updatedAt: now } as unknown as Record<string, unknown>, true);
    return;
  }
  // transaction: a job can only ever sit on one statement, even with two dispatchers at once
  const { fs, db } = await full();
  await fs.runTransaction(db, async (tx) => {
    const refs = st.lines.map((l) => fs.doc(db, P.finance(t), l.jobId));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    snaps.forEach((s, i) => {
      const other = s.exists() ? (s.data() as JobFinance).settlementId : undefined;
      if (other && other !== st.id) throw new Error(`${st.lines[i].ref} is already on another statement.`);
    });
    tx.set(fs.doc(db, P.settlements(t), st.id), clean({ ...st, updatedAt: now }));
    refs.forEach((r) => tx.set(r, { settlementId: st.id, updatedAt: now }, { merge: true }));
    release.forEach((id) => tx.set(fs.doc(db, P.finance(t), id), { settlementId: null, updatedAt: now }, { merge: true }));
  });
}
export async function deleteSettlement(t: string, st: Settlement): Promise<void> {
  if (st.status === 'paid') throw new Error('A paid statement cannot be deleted.');
  for (const l of st.lines) await set(P.finance(t), l.jobId, { settlementId: null, updatedAt: Date.now() } as unknown as Record<string, unknown>, true);
  if (opsMode === 'demo') return demoDel(P.settlements(t), st.id);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.settlements(t), st.id));
}

// ═════════════════════════════════════════════════════════════
// One-time job links (external / hired drivers)
// ═════════════════════════════════════════════════════════════

function linkToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
}

/** URL the external driver opens (WhatsApp/SMS). Works in the browser and opens the Android app when installed. */
export function jobLinkUrl(token: string, tenantId?: string): string {
  const base = (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined) || window.location.origin;
  // ?site= picks the right company on shared platform hosts (ignored on a client's own domain)
  return `${base.replace(/\/$/, '')}/j/${token}${tenantId ? `?site=${encodeURIComponent(tenantId)}` : ''}`;
}

/**
 * Give one job (or a trip of several) to an external driver via a one-time link.
 * Jobs get a placeholder driver until the link is opened; the first phone that opens it becomes the driver.
 */
export async function createJobLink(
  t: string,
  jobs: Job[],
  d: { driverName: string; phone?: string; vehicle?: FleetUnit | null; vehicleReg?: string; transporter?: Transporter | null; validHours?: number },
  user: OpsUser,
): Promise<JobLink> {
  if (!jobs.length) throw new Error('Select at least one job.');
  const busy = jobs.find((j) => IN_PROGRESS.includes(j.status) || j.status === 'completed');
  if (busy) throw new Error(`${busy.ref} is already under way or closed.`);
  const now = Date.now();
  const days = jobs.map((j) => j.scheduledDate).sort();
  const lastDay = days[days.length - 1] ?? '';
  const endOfLastDay = lastDay ? new Date(`${lastDay}T23:59:59`).getTime() : now;
  const expiresAt = Math.max(now + (d.validHours ?? 24) * 3600_000, endOfLastDay + 24 * 3600_000);
  const token = linkToken();
  const vehicleReg = d.vehicle?.registration ?? d.vehicleReg?.trim() ?? undefined;
  const link: JobLink = {
    token,
    tenantId: t,
    jobIds: jobs.map((j) => j.id),
    driverName: d.driverName.trim(),
    phone: d.phone,
    vehicleReg,
    transporterId: d.transporter?.id,
    transporterName: d.transporter?.name,
    status: 'open',
    createdBy: user.uid,
    createdAt: now,
    expiresAt,
  };
  await set(P.links(), token, link as unknown as Record<string, unknown>);
  const tripId = jobs.length > 1 ? newId('TRP') : undefined;
  for (const [i, j] of jobs.entries()) {
    // the job leaves its previous link (that link stays valid for its other jobs)
    if (j.extLink && j.extLink.token !== token) await detachFromLink(j.extLink.token, j.id);
    const patch: Record<string, unknown> = {
      driverId: LINK_DRIVER_PREFIX + token,
      driverName: `${link.driverName} (link)`,
      vehicleId: d.vehicle?.id ?? (vehicleReg ? null : j.vehicleId),
      vehicleReg: vehicleReg ?? j.vehicleReg,
      ownership: 'hired',
      transporterId: d.transporter?.id ?? j.transporterId,
      transporterName: d.transporter?.name ?? j.transporterName,
      extLink: { token, status: 'open', expiresAt, driverName: link.driverName, phone: d.phone },
      status: 'assigned',
      updatedAt: now,
      lastEventAt: now,
    };
    if (tripId) Object.assign(patch, { tripId, tripSeq: i });
    await set(P.jobs(t), j.id, patch, true);
    await addEvent(t, j.id, { status: 'assigned', at: now, by: user.uid, byName: user.name, role: 'ops', note: `One-time link sent to ${link.driverName}${vehicleReg ? ` · ${vehicleReg}` : ''}` });
    await syncTracking(t, j, 'assigned');
  }
  return link;
}

export async function revokeJobLink(t: string, link: Pick<JobLink, 'token' | 'claimedBy'>, jobs: Job[], user: OpsUser): Promise<void> {
  const now = Date.now();
  await set(P.links(), link.token, { status: 'revoked' }, true);
  if (link.claimedBy) {
    // the same phone may also hold a newer link — only lock it out if this is its current one
    const d = await get<Driver>(P.drivers(t), link.claimedBy).catch(() => null);
    if (d?.linkToken === link.token) await set(P.drivers(t), link.claimedBy, { active: false, updatedAt: now }, true);
  }
  for (const j of jobs) {
    if (j.extLink?.token !== link.token) continue;
    const patch: Record<string, unknown> = { extLink: { ...j.extLink, status: 'revoked' }, updatedAt: now };
    if (!IN_PROGRESS.includes(j.status) && j.status !== 'completed') Object.assign(patch, { driverId: null, driverName: null, status: 'draft' });
    await set(P.jobs(t), j.id, patch, true);
    await addEvent(t, j.id, { status: 'note', at: now, by: user.uid, byName: user.name, role: 'ops', note: 'One-time link revoked' });
  }
}

export async function getJobLink(token: string): Promise<JobLink | null> {
  return get<JobLink>(P.links(), token);
}

/**
 * External driver opens /j/{token}: signs in anonymously (no account needed), claims the link
 * and becomes the jobs' driver. Re-opening on the same phone just signs back in.
 * Returns the tenant + the driver uid. The regular driver app then works for those jobs only.
 */
export async function claimJobLink(token: string): Promise<{ tenantId: string; uid: string; link: JobLink }> {
  const link = await getJobLink(token);
  if (!link) throw new Error('This link is not valid. Ask dispatch to send a new one.');
  if (link.status === 'revoked') throw new Error('This link was cancelled by dispatch.');
  if (Date.now() > link.expiresAt) throw new Error('This link has expired. Ask dispatch to send a new one.');
  const t = link.tenantId;
  const now = Date.now();

  let uid: string;
  if (opsMode === 'demo') {
    const key = 'hp:ops:demo-ext-uid';
    uid = localStorage.getItem(key) || `ext_${newId()}`;
    localStorage.setItem(key, uid);
  } else {
    const [{ signInAnonymously }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
    const cur = auth.currentUser;
    if (cur && !cur.isAnonymous) throw new Error('This phone is signed in as a company driver. Sign out first, or ask dispatch to assign the job to you directly.');
    uid = cur?.uid ?? (await signInAnonymously(auth)).user.uid;
  }
  if (link.status === 'claimed' && link.claimedBy !== uid) throw new Error('This link was already opened on another phone. Ask dispatch to send a new one.');

  const driver: Record<string, unknown> = {
    name: link.driverName,
    phone: link.phone ?? '',
    status: 'available',
    active: true,
    ownership: 'hired',
    transporterId: link.transporterId ?? null,
    transporterName: link.transporterName ?? null,
    external: true,
    linkToken: token,
    expiresAt: link.expiresAt,
    loginId: 'link',
    updatedAt: now,
  };
  if (opsMode === 'demo') {
    if (link.status === 'open') {
      demoSet(P.links(), token, { status: 'claimed', claimedBy: uid, claimedAt: now }, true);
      demoSet(P.drivers(t), uid, { createdAt: now, ...driver }, true);
      for (const id of link.jobIds) {
        const j = demoGet<Job>(P.jobs(t), id);
        if (j && j.driverId === LINK_DRIVER_PREFIX + token)
          demoSet(P.jobs(t), id, { driverId: uid, driverName: link.driverName, extLink: { ...j.extLink, status: 'claimed' }, updatedAt: now }, true);
      }
    }
    localStorage.setItem(DEMO_DRIVER_KEY, uid);
    window.dispatchEvent(new Event('hp-driver-auth'));
    return { tenantId: t, uid, link: { ...link, status: 'claimed', claimedBy: uid } };
  }
  if (link.status === 'open') {
    const { fs, db } = await full();
    // a phone that opened an earlier link already has a driver doc → update instead of create
    const existing = await fs.getDoc(fs.doc(db, P.drivers(t), uid)).catch(() => null);
    // a phone holding an earlier, longer link keeps that expiry (rules allow keeping the previous value)
    const prevExp = existing?.exists() ? Number((existing.data() as Driver).expiresAt ?? 0) : 0;
    if (prevExp > link.expiresAt) driver.expiresAt = prevExp;
    const b = fs.writeBatch(db);
    b.update(fs.doc(db, P.links(), token), { status: 'claimed', claimedBy: uid, claimedAt: now });
    b.set(fs.doc(db, P.drivers(t), uid), existing?.exists() ? driver : { ...driver, createdAt: now }, { merge: true });
    for (const id of link.jobIds) {
      // job docs are not readable before the claim — update blindly; rules check the placeholder driver
      b.update(fs.doc(db, P.jobs(t), id), { driverId: uid, driverName: link.driverName, 'extLink.status': 'claimed', updatedAt: now });
    }
    await b.commit();
  }
  return { tenantId: t, uid, link: { ...link, status: 'claimed', claimedBy: uid } };
}

// ═════════════════════════════════════════════════════════════
// Push notification devices (token registry; Cloud Functions send)
// ═════════════════════════════════════════════════════════════

export async function registerDevice(t: string, d: Omit<import('./types').Device, 'id' | 'updatedAt'> & { installId: string }): Promise<void> {
  const id = `${d.uid}__${d.installId}`;
  const { installId: _i, ...rest } = d;
  void _i;
  await set(P.devices(t), id, { ...rest, updatedAt: Date.now() });
}
export async function unregisterDevice(t: string, uid: string, installId: string): Promise<void> {
  const id = `${uid}__${installId}`;
  if (opsMode === 'demo') return demoDel(P.devices(t), id);
  const { fs, db } = await full();
  await fs.deleteDoc(fs.doc(db, P.devices(t), id)).catch(() => undefined);
}

/** Remove a job from a one-time link (re-assigned, re-linked or deleted). An emptied open link is revoked. */
async function detachFromLink(token: string, jobId: string): Promise<void> {
  try {
    const l = await get<JobLink>(P.links(), token);
    if (!l) return;
    const jobIds = l.jobIds.filter((x) => x !== jobId);
    await set(P.links(), token, { jobIds, ...(jobIds.length === 0 && l.status === 'open' ? { status: 'revoked' } : {}) }, true);
  } catch (e) {
    console.warn('[ops] link detach skipped', e);
  }
}

/** One-off: move legacy job.price into finance/{jobId} so drivers can no longer read it. */
export async function migrateJobPrices(t: string, jobs: Job[], finance: JobFinance[]): Promise<number> {
  const fin = new Map(finance.map((f) => [f.id, f]));
  let n = 0;
  for (const j of jobs) {
    if (typeof j.price !== 'number') continue;
    if (fin.get(j.id)?.price === undefined) await saveFinance(t, j.id, { price: j.price, currency: j.currency });
    await set(P.jobs(t), j.id, { price: null }, true);
    n++;
  }
  return n;
}
