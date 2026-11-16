// ─────────────────────────────────────────────────────────────
// Data access layer. Every read/write in the app goes through here.
// Two adapters with one API: Firestore (when VITE_FIREBASE_* set) or
// localStorage "demo" mode (zero-config preview, single browser).
// ─────────────────────────────────────────────────────────────
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore/lite';
import { firebaseEnabled, getDb, getFbAuth } from './firebase';
import type {
  AdminProfile,
  Booking,
  BookingStatus,
  ContactMessage,
  NewBooking,
  TenantConfig,
  Tracking,
} from '../tenant/types';

export const dataMode: 'firebase' | 'demo' = firebaseEnabled ? 'firebase' : 'demo';

// ── helpers ──────────────────────────────────────────────────

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRef(prefix: string): string {
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += REF_ALPHABET[b % REF_ALPHABET.length];
  const p = (prefix || 'HP').replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'HP';
  return `${p}-${s}`;
}

function ls<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / sandbox) — demo data stays in memory only */
  }
}
const k = {
  tenant: (id: string) => `hp:tenant:${id}`,
  tenantIndex: 'hp:tenants',
  bookings: (id: string) => `hp:bookings:${id}`,
  tracking: (id: string) => `hp:tracking:${id}`,
  messages: (id: string) => `hp:messages:${id}`,
  auth: 'hp:demo-auth',
};

/** Strip undefined (Firestore rejects it). */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── tenants ──────────────────────────────────────────────────

/** Stored config for a tenant (overrides bundled preset). null if none stored. */
export async function fetchTenant(id: string): Promise<TenantConfig | null> {
  if (dataMode === 'demo') return ls<TenantConfig | null>(k.tenant(id), null);
  const snap = await getDoc(doc(getDb(), 'tenants', id));
  return snap.exists() ? (snap.data() as TenantConfig) : null;
}

/** Map hostname → tenant id via `domains/{hostname}`. */
export async function resolveDomain(hostname: string): Promise<string | null> {
  if (dataMode === 'demo') {
    const idx = ls<{ id: string; domains: string[] }[]>(k.tenantIndex, []);
    return idx.find((t) => t.domains.includes(hostname))?.id ?? null;
  }
  try {
    const snap = await getDoc(doc(getDb(), 'domains', hostname));
    return snap.exists() ? ((snap.data().tenantId as string) ?? null) : null;
  } catch {
    return null;
  }
}

const normHost = (h: string) => h.trim().toLowerCase();

/**
 * Save a tenant config. Domain → tenant mappings (`domains/{host}`) are only touched when
 * `domainSync` is passed (super-admin flows): new hosts are mapped, removed hosts deleted.
 * Ordinary content saves never write `domains/`, so they can't fail on another tenant's host.
 */
export async function saveTenant(cfg: TenantConfig, domainSync?: { previous: string[] }): Promise<void> {
  const data = clean({ ...cfg, updatedAt: Date.now() });
  if (dataMode === 'demo') {
    lsSet(k.tenant(cfg.id), data);
    const idx = ls<{ id: string; name: string; domains: string[] }[]>(k.tenantIndex, []);
    const next = idx.filter((t) => t.id !== cfg.id);
    next.push({ id: cfg.id, name: cfg.name, domains: cfg.domains });
    lsSet(k.tenantIndex, next);
    return;
  }
  const db = getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, 'tenants', cfg.id), data);
  if (domainSync) {
    const next = new Set(cfg.domains.map(normHost).filter(Boolean));
    const prev = new Set(domainSync.previous.map(normHost).filter(Boolean));
    for (const host of next) {
      if (prev.has(host)) continue;
      const cur = await getDoc(doc(db, 'domains', host)).catch(() => null);
      const owner = cur?.exists() ? (cur.data().tenantId as string) : null;
      if (owner && owner !== cfg.id) throw new Error(`${host} is already mapped to site “${owner}”. Remove it there first.`);
      batch.set(doc(db, 'domains', host), { tenantId: cfg.id });
    }
    for (const host of prev) {
      if (next.has(host)) continue;
      // only release hosts that still point at this tenant
      const snap = await getDoc(doc(db, 'domains', host)).catch(() => null);
      if (snap?.exists() && snap.data().tenantId === cfg.id) batch.delete(doc(db, 'domains', host));
    }
  }
  await batch.commit();
}

export async function listStoredTenants(): Promise<{ id: string; name: string; domains: string[] }[]> {
  if (dataMode === 'demo') return ls(k.tenantIndex, []);
  const snap = await getDocs(collection(getDb(), 'tenants'));
  return snap.docs.map((d) => {
    const t = d.data() as TenantConfig;
    return { id: d.id, name: t.name, domains: t.domains ?? [] };
  });
}

// ── bookings ─────────────────────────────────────────────────

export async function createBooking(input: NewBooking, refPrefix: string): Promise<{ id: string; ref: string }> {
  const ref = makeRef(refPrefix);
  const now = Date.now();
  const tracking: Tracking = {
    ref,
    status: 'pending',
    date: input.date,
    time: input.time,
    vehicleName: input.vehicleName,
    kind: input.kind,
    pickupPlace: input.pickup.place,
    dropoffPlace: input.dropoff.place,
    updatedAt: now,
  };

  if (dataMode === 'demo') {
    const id = ref;
    const booking: Booking = { ...clean(input), id, ref, status: 'pending', createdAt: now, updatedAt: now };
    const list = ls<Booking[]>(k.bookings(input.tenantId), []);
    list.unshift(booking);
    lsSet(k.bookings(input.tenantId), list);
    const tr = ls<Record<string, Tracking>>(k.tracking(input.tenantId), {});
    tr[ref] = tracking;
    lsSet(k.tracking(input.tenantId), tr);
    return { id, ref };
  }

  const db = getDb();
  // booking doc id == ref (rules require it so the public tracking doc can prove a real booking exists)
  const bRef = doc(db, 'tenants', input.tenantId, 'bookings', ref);
  const batch = writeBatch(db);
  batch.set(bRef, {
    ...clean(input),
    ref,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    serverCreatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'tenants', input.tenantId, 'tracking', ref), tracking);
  await batch.commit();
  return { id: bRef.id, ref };
}

export async function getTracking(tenantId: string, ref: string): Promise<Tracking | null> {
  const r = ref.trim().toUpperCase();
  if (!r) return null;
  if (dataMode === 'demo') return ls<Record<string, Tracking>>(k.tracking(tenantId), {})[r] ?? null;
  const snap = await getDoc(doc(getDb(), 'tenants', tenantId, 'tracking', r));
  return snap.exists() ? (snap.data() as Tracking) : null;
}

export async function listBookings(tenantId: string, max = 500): Promise<Booking[]> {
  if (dataMode === 'demo') return ls<Booking[]>(k.bookings(tenantId), []);
  const q = query(collection(getDb(), 'tenants', tenantId, 'bookings'), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Booking, 'id'>), id: d.id }));
}

export async function updateBookingStatus(
  tenantId: string,
  booking: Pick<Booking, 'id' | 'ref'>,
  status: BookingStatus,
  adminNote?: string,
): Promise<void> {
  const now = Date.now();
  if (dataMode === 'demo') {
    const list = ls<Booking[]>(k.bookings(tenantId), []).map((b) =>
      b.id === booking.id ? { ...b, status, updatedAt: now, adminNote: adminNote ?? b.adminNote } : b,
    );
    lsSet(k.bookings(tenantId), list);
    const tr = ls<Record<string, Tracking>>(k.tracking(tenantId), {});
    if (tr[booking.ref]) tr[booking.ref] = { ...tr[booking.ref], status, updatedAt: now, note: adminNote ?? tr[booking.ref].note };
    lsSet(k.tracking(tenantId), tr);
    return;
  }
  const db = getDb();
  const batch = writeBatch(db);
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (adminNote !== undefined) patch.adminNote = adminNote;
  batch.update(doc(db, 'tenants', tenantId, 'bookings', booking.id), patch);
  const tPatch: Record<string, unknown> = { status, updatedAt: now };
  if (adminNote !== undefined) tPatch.note = adminNote;
  batch.update(doc(db, 'tenants', tenantId, 'tracking', booking.ref), tPatch);
  await batch.commit();
}

// ── contact messages ─────────────────────────────────────────

export async function createMessage(tenantId: string, msg: ContactMessage): Promise<void> {
  const data = clean({ ...msg, createdAt: Date.now() });
  if (dataMode === 'demo') {
    const list = ls<ContactMessage[]>(k.messages(tenantId), []);
    list.unshift({ ...data, id: `m_${Date.now().toString(36)}` });
    lsSet(k.messages(tenantId), list);
    return;
  }
  await setDoc(doc(collection(getDb(), 'tenants', tenantId, 'messages')), data);
}

export async function listMessages(tenantId: string): Promise<ContactMessage[]> {
  if (dataMode === 'demo') return ls<ContactMessage[]>(k.messages(tenantId), []);
  const q = query(collection(getDb(), 'tenants', tenantId, 'messages'), orderBy('createdAt', 'desc'), limit(300));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...(d.data() as ContactMessage), id: d.id }));
}

// ── auth (admin console) ─────────────────────────────────────

export const DEMO_PASSWORD = 'demo1234';

export async function signIn(email: string, password: string): Promise<void> {
  if (dataMode === 'demo') {
    if (password !== DEMO_PASSWORD) throw new Error(`Demo mode: use password "${DEMO_PASSWORD}"`);
    lsSet(k.auth, { uid: 'demo', email });
    window.dispatchEvent(new Event('hp-auth'));
    return;
  }
  const [{ signInWithEmailAndPassword }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email: string): Promise<void> {
  if (dataMode === 'demo') return;
  const [{ sendPasswordResetEmail }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
  await sendPasswordResetEmail(auth, email);
}

export async function signOut(): Promise<void> {
  if (dataMode === 'demo') {
    try {
      localStorage.removeItem(k.auth);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event('hp-auth'));
    return;
  }
  const [{ signOut: fbSignOut }, auth] = await Promise.all([import('firebase/auth'), getFbAuth()]);
  await fbSignOut(auth);
}

/** Subscribe to admin auth. Callback receives profile (with role) or null. Returns unsubscribe. */
export function onAdminAuth(cb: (p: AdminProfile | null) => void): () => void {
  if (dataMode === 'demo') {
    const emit = () => {
      const a = ls<{ uid: string; email: string } | null>(k.auth, null);
      cb(a ? { uid: a.uid, email: a.email, role: 'super', tenants: ['*'] } : null);
    };
    emit();
    window.addEventListener('hp-auth', emit);
    return () => window.removeEventListener('hp-auth', emit);
  }
  let unsub: (() => void) | null = null;
  let cancelled = false;
  void Promise.all([import('firebase/auth'), getFbAuth()]).then(([{ onAuthStateChanged }, auth]) => {
    if (cancelled) return;
    unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return cb(null);
      try {
        const snap = await getDoc(doc(getDb(), 'admins', user.uid));
        if (!snap.exists()) return cb({ uid: user.uid, email: user.email ?? '', role: 'tenant', tenants: [] });
        const d = snap.data() as Partial<AdminProfile>;
        cb({ uid: user.uid, email: user.email ?? '', role: d.role ?? 'tenant', tenants: d.tenants ?? [] });
      } catch {
        cb({ uid: user.uid, email: user.email ?? '', role: 'tenant', tenants: [] });
      }
    });
  });
  return () => {
    cancelled = true;
    unsub?.();
  };
}

export function canManage(p: AdminProfile | null, tenantId: string): boolean {
  if (!p) return false;
  return p.role === 'super' || p.tenants.includes('*') || p.tenants.includes(tenantId);
}

