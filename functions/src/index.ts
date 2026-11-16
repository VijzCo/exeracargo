// ─────────────────────────────────────────────────────────────
// Exera Cargo — Cloud Functions (requires the Firebase Blaze plan).
//   onJobWritten      push: new / changed / cancelled job → driver; driver progress → dispatch
//   onChatMessage     push: driver → dispatch, dispatch → driver (broadcast → all active drivers)
//   resetDriverPin    callable: dispatcher sets a new PIN for a company driver (no re-create)
//   expiryDigest      daily 06:00 SAST: documents expiring within 14 days → dispatch
// Firestore triggers must run in the database's region (africa-south1, Johannesburg).
// Deploy: cd functions && npm i && npm run deploy
// ─────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { setGlobalOptions, logger } from 'firebase-functions';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { activeDriverDevices, devicesOfUsers, opsDevices, send } from './send';

initializeApp();

/** Region of the Firestore database (triggers must match it). Override with FUNCTIONS_REGION in functions/.env */
const REGION = process.env.FUNCTIONS_REGION || 'africa-south1';
/** Cloud Scheduler is not offered in every region — the digest runs in europe-west1 unless overridden. */
const SCHEDULE_REGION = process.env.SCHEDULE_REGION || 'europe-west1';

setGlobalOptions({ region: REGION, maxInstances: 10, memory: '256MiB' });

// ── helpers ────────────────────────────────────────────────────

type Job = {
  ref?: string;
  title?: string;
  status?: string;
  driverId?: string | null;
  driverName?: string | null;
  scheduledDate?: string;
  scheduledTime?: string;
  pickup?: { place?: string };
  dropoff?: { place?: string };
  stops?: unknown[];
  instructions?: string;
  cargo?: string;
  tripId?: string | null;
};

const realDriver = (id?: string | null): id is string => !!id && !id.startsWith('link:');
const route = (j: Job) => `${j.pickup?.place ?? '?'} → ${j.dropoff?.place ?? '?'}`;
const when = (j: Job) => [j.scheduledDate, j.scheduledTime].filter(Boolean).join(' ');
const OPEN = ['assigned', 'accepted'];
const TERMINAL = ['completed', 'cancelled', 'failed'];
const OPS_STATUS: Record<string, string> = {
  accepted: 'accepted',
  started: 'started the trip',
  delivered: 'delivered',
  completed: 'completed',
  failed: 'could not complete',
};
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ── jobs ───────────────────────────────────────────────────────

export const onJobWritten = onDocumentWritten('tenants/{t}/jobs/{jobId}', async (event) => {
  const { t, jobId } = event.params;
  const before = event.data?.before.exists ? (event.data.before.data() as Job) : null;
  const after = event.data?.after.exists ? (event.data.after.data() as Job) : null;
  const ref = after?.ref ?? before?.ref ?? jobId;
  const jobUrl = `/driver/job/${encodeURIComponent(jobId)}`;
  const tasks: Promise<unknown>[] = [];

  // deleted while a driver had it
  if (!after) {
    if (before && realDriver(before.driverId) && !TERMINAL.includes(before.status ?? ''))
      tasks.push(
        devicesOfUsers(t, [before.driverId]).then((d) =>
          send(d, { title: `Job ${ref} removed`, body: `${route(before)} was removed by dispatch.`, url: '/driver', channel: 'jobs', tag: `job-${jobId}` }),
        ),
      );
    await Promise.all(tasks);
    return;
  }

  const newDriver = realDriver(after.driverId) && after.driverId !== before?.driverId;
  const lostDriver = before && realDriver(before.driverId) && after.driverId !== before.driverId;

  // 1) newly assigned to a driver (incl. an external driver claiming a link: no push — they just opened it)
  if (newDriver && !TERMINAL.includes(after.status ?? '') && !(before?.driverId ?? '').startsWith('link:')) {
    const trip = after.tripId ? ` (trip ${after.tripId})` : '';
    tasks.push(
      devicesOfUsers(t, [after.driverId!]).then((d) =>
        send(d, {
          title: `New job ${ref}${trip}`,
          body: `${route(after)} · ${when(after)}${after.cargo ? ` · ${after.cargo}` : ''}`,
          url: jobUrl,
          channel: 'jobs',
          tag: after.tripId ? `trip-${after.tripId}` : `job-${jobId}`,
        }),
      ),
    );
  }
  // 2) taken away from the previous driver
  if (lostDriver && OPEN.concat('draft').includes(after.status ?? '')) {
    tasks.push(
      devicesOfUsers(t, [before!.driverId!]).then((d) =>
        send(d, { title: `Job ${ref} reassigned`, body: `${route(after)} is no longer assigned to you.`, url: '/driver', channel: 'jobs', tag: `job-${jobId}` }),
      ),
    );
  }

  if (before && !newDriver && realDriver(after.driverId)) {
    // 3) cancelled by dispatch
    if (after.status === 'cancelled' && before.status !== 'cancelled') {
      tasks.push(
        devicesOfUsers(t, [after.driverId]).then((d) =>
          send(d, { title: `Job ${ref} cancelled`, body: `${route(after)} · ${when(after)} was cancelled by dispatch.`, url: jobUrl, channel: 'jobs', tag: `job-${jobId}` }),
        ),
      );
    }
    // 4) edited by dispatch while the driver has it (drivers can't change these fields)
    const edited =
      before.status === after.status &&
      !TERMINAL.includes(after.status ?? '') &&
      (!same(before.scheduledDate, after.scheduledDate) ||
        !same(before.scheduledTime, after.scheduledTime) ||
        !same(before.instructions, after.instructions) ||
        !same(before.cargo, after.cargo) ||
        !same((before.pickup as { address?: string } | undefined)?.address, (after.pickup as { address?: string } | undefined)?.address) ||
        !same((before.dropoff as { address?: string } | undefined)?.address, (after.dropoff as { address?: string } | undefined)?.address) ||
        (before.stops?.length ?? 0) !== (after.stops?.length ?? 0));
    if (edited)
      tasks.push(
        devicesOfUsers(t, [after.driverId]).then((d) =>
          send(d, { title: `Job ${ref} updated`, body: `Check the new details: ${route(after)} · ${when(after)}`, url: jobUrl, channel: 'jobs', tag: `job-${jobId}` }),
        ),
      );
  }

  // 5) driver progress → dispatch
  if (before && after.status !== before.status && OPS_STATUS[after.status ?? ''] && after.driverId === before.driverId) {
    const who = after.driverName ?? 'Driver';
    tasks.push(
      opsDevices(t).then((d) =>
        send(d, {
          title: `${ref} ${OPS_STATUS[after.status!]}`,
          body: `${who} · ${route(after)}`,
          url: `/admin/jobs/${encodeURIComponent(jobId)}`,
          channel: after.status === 'failed' ? 'alerts' : 'jobs',
          tag: `ops-job-${jobId}`,
        }),
      ),
    );
  }

  await Promise.all(tasks).catch((e) => logger.error('job push failed', e));
});

// ── chat ───────────────────────────────────────────────────────

type Msg = { from: string; fromName?: string; role: 'ops' | 'driver'; text?: string; imageId?: string; jobRef?: string; auto?: boolean };

export const onChatMessage = onDocumentCreated('tenants/{t}/threads/{th}/messages/{mid}', async (event) => {
  const { t, th } = event.params;
  const m = event.data?.data() as Msg | undefined;
  // automatic assignment messages: the job trigger already pushed a 'New job' notification
  if (!m || m.auto) return;
  const body = (m.text?.trim() || '📷 Photo') + (m.jobRef ? ` · ${m.jobRef}` : '');
  try {
    if (m.role === 'driver') {
      await send(await opsDevices(t), { title: m.fromName ?? 'Driver', body, url: `/admin/chat?t=${encodeURIComponent(th)}`, channel: 'chat', tag: `chat-${th}` });
    } else if (th === 'broadcast') {
      await send(await activeDriverDevices(t), { title: 'Dispatch (all drivers)', body, url: '/driver/chat', channel: 'chat', tag: 'chat-broadcast' });
    } else {
      await send(await devicesOfUsers(t, [th]), { title: `Dispatch${m.fromName ? ` · ${m.fromName}` : ''}`, body, url: '/driver/chat', channel: 'chat', tag: `chat-${th}` });
    }
  } catch (e) {
    logger.error('chat push failed', e);
  }
});

// ── PIN reset ──────────────────────────────────────────────────

async function canManage(uid: string, t: string): Promise<boolean> {
  const a = await getFirestore().doc(`admins/${uid}`).get();
  if (!a.exists) return false;
  const d = a.data() as { role?: string; tenants?: string[] };
  return d.role === 'super' || (Array.isArray(d.tenants) && (d.tenants.includes(t) || d.tenants.includes('*')));
}

/** Dispatcher sets a new PIN for a company driver. The driver's other devices are signed out. */
export const resetDriverPin = onCall({ enforceAppCheck: false }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { tenantId, driverId, pin } = (req.data ?? {}) as { tenantId?: string; driverId?: string; pin?: string };
  if (!tenantId || !driverId || typeof pin !== 'string') throw new HttpsError('invalid-argument', 'tenantId, driverId and pin are required.');
  if (!/^\d{6,12}$/.test(pin)) throw new HttpsError('invalid-argument', 'PIN must be 6–12 digits.');
  if (!(await canManage(uid, tenantId))) throw new HttpsError('permission-denied', 'You cannot manage this site.');
  const drv = await getFirestore().doc(`tenants/${tenantId}/drivers/${driverId}`).get();
  if (!drv.exists) throw new HttpsError('not-found', 'Driver not found.');
  if (drv.get('external')) throw new HttpsError('failed-precondition', 'One-time-link drivers have no PIN.');
  // the target must be a phone+PIN driver login of THIS tenant — never an admin or another account
  if ((await getFirestore().doc(`admins/${driverId}`).get()).exists) throw new HttpsError('permission-denied', 'Not a driver login.');
  let email = '';
  try {
    const u = await getAuth().getUser(driverId);
    email = u.email ?? '';
    if (u.customClaims?.admin) throw new Error('admin');
  } catch {
    throw new HttpsError('not-found', 'Driver login not found.');
  }
  if (!email.endsWith(`.${tenantId}@drivers.exeracargo.app`)) throw new HttpsError('permission-denied', 'Not a driver login of this site.');
  try {
    await getAuth().updateUser(driverId, { password: pin });
    await getAuth().revokeRefreshTokens(driverId);
  } catch (e) {
    logger.error('pin reset failed', e);
    throw new HttpsError('internal', 'Could not update the PIN.');
  }
  logger.info('driver PIN reset', { tenantId, driverId, by: uid });
  return { ok: true };
});

// ── daily expiry digest ───────────────────────────────────────

const DAY = 86_400_000;
type Item = { what: string; date: string };

function due(items: Item[], label: string, date: unknown, limit: number) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  if (new Date(`${date}T00:00:00Z`).getTime() <= limit) items.push({ what: label, date });
}

export const expiryDigest = onSchedule(
  { schedule: '0 6 * * *', timeZone: 'Africa/Johannesburg', region: SCHEDULE_REGION },
  async () => {
    const db = getFirestore();
    const limit = Date.now() + 14 * DAY;
    const tenants = await db.collection('tenants').select().get();
    for (const tdoc of tenants.docs) {
      const t = tdoc.id;
      const [vehicles, drivers, transporters] = await Promise.all([
        db.collection(`tenants/${t}/vehicles`).get(),
        db.collection(`tenants/${t}/drivers`).where('active', '==', true).get(),
        db.collection(`tenants/${t}/transporters`).where('active', '==', true).get(),
      ]);
      const items: Item[] = [];
      for (const v of vehicles.docs) {
        const d = v.data();
        if (d.status === 'inactive') continue;
        const reg = d.registration ?? v.id;
        due(items, `${reg} licence disc`, d.licenceDiscExpiry, limit);
        due(items, `${reg} roadworthy`, d.roadworthyExpiry, limit);
        due(items, `${reg} insurance`, d.insuranceExpiry, limit);
        due(items, `${reg} permit`, d.permitExpiry, limit);
      }
      for (const dr of drivers.docs) {
        const d = dr.data();
        if (d.external) continue;
        due(items, `${d.name} licence`, d.licenceExpiry, limit);
        due(items, `${d.name} PrDP`, d.prdpExpiry, limit);
      }
      for (const tr of transporters.docs) {
        const d = tr.data();
        due(items, `${d.name} GIT insurance`, d.gitInsuranceExpiry, limit);
      }
      if (!items.length) continue;
      items.sort((a, b) => a.date.localeCompare(b.date));
      const today = new Date().toISOString().slice(0, 10);
      const expired = items.filter((i) => i.date < today).length;
      const head = items.slice(0, 3).map((i) => `${i.what} (${i.date})`).join(', ');
      await send(await opsDevices(t), {
        title: `${items.length} document${items.length > 1 ? 's' : ''} expiring${expired ? ` · ${expired} expired` : ''}`,
        body: head + (items.length > 3 ? ` +${items.length - 3} more` : ''),
        url: '/admin/vehicles',
        channel: 'alerts',
        tag: 'expiry-digest',
      }).catch((e) => logger.error('digest push failed', { t, e }));
    }
  },
);
