// Push delivery: looks up device tokens (tenants/{t}/devices) and sends per platform.
//  - Android (Capacitor app): notification message on a channel → shown by the system even when the app is closed;
//    tapping it opens the app and passes `data.url` to the JS layer (src/push/usePush.ts).
//  - Web (dispatch console / driver PWA): data-only message → our service worker (public/driver-sw.js) shows it.
// Tokens rejected by FCM as unregistered/invalid are deleted.
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';

export type Channel = 'jobs' | 'chat' | 'alerts';

export interface Push {
  title: string;
  body: string;
  /** In-app path to open on tap, e.g. /driver/job/JOB-ABC1234 or /admin/chat */
  url: string;
  channel: Channel;
  /** Replaces an earlier notification with the same tag (e.g. one per job / chat thread). */
  tag: string;
}

interface DeviceDoc {
  uid: string;
  role: 'ops' | 'driver';
  token: string;
  platform: 'android' | 'ios' | 'web';
  tenantId: string;
}

const ACCENT = '#F5A524';
const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

/** Devices of the given users (any role) in tenant t. */
export async function devicesOfUsers(t: string, uids: string[]): Promise<FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[]> {
  const db = getFirestore();
  const unique = [...new Set(uids.filter(Boolean))];
  const out: FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[] = [];
  for (let i = 0; i < unique.length; i += 30) {
    const snap = await db
      .collection(`tenants/${t}/devices`)
      .where('uid', 'in', unique.slice(i, i + 30))
      .get();
    out.push(...(snap.docs as FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[]));
  }
  return out;
}

/** Every dispatcher device of tenant t. */
export async function opsDevices(t: string): Promise<FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[]> {
  const db = getFirestore();
  const snap = await db.collection(`tenants/${t}/devices`).where('role', '==', 'ops').get();
  const docs = snap.docs as FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[];
  // only users who can still manage this tenant (removed dispatchers stop receiving ops pushes)
  const uids = [...new Set(docs.map((d) => d.data().uid))];
  const ok = new Set<string>();
  await Promise.all(
    uids.map(async (u) => {
      const a = await db.doc(`admins/${u}`).get();
      const d = a.data() as { role?: string; tenants?: string[] } | undefined;
      if (d && (d.role === 'super' || (Array.isArray(d.tenants) && (d.tenants.includes(t) || d.tenants.includes('*'))))) ok.add(u);
    }),
  );
  return docs.filter((d) => ok.has(d.data().uid));
}

/** Devices of all active drivers of tenant t (broadcast). */
export async function activeDriverDevices(t: string): Promise<FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[]> {
  const drivers = await getFirestore().collection(`tenants/${t}/drivers`).where('active', '==', true).select('external', 'expiresAt').get();
  const now = Date.now();
  const uids = drivers.docs.filter((d) => !d.get('external') || (d.get('expiresAt') ?? 0) > now).map((d) => d.id);
  return devicesOfUsers(t, uids);
}

function messageFor(d: DeviceDoc, p: Push): Message {
  const data = { title: p.title, body: p.body, url: p.url, tag: p.tag, channel: p.channel };
  if (d.platform === 'web') {
    return {
      token: d.token,
      data,
      webpush: { headers: { Urgency: 'high', TTL: String(24 * 3600) } },
    };
  }
  return {
    token: d.token,
    data,
    android: {
      priority: 'high',
      collapseKey: p.tag.slice(0, 64),
      ttl: 24 * 3600 * 1000,
      notification: {
        title: p.title,
        body: p.body,
        channelId: p.channel,
        tag: p.tag,
        icon: 'ic_stat_notify',
        color: ACCENT,
        sound: 'default',
        defaultVibrateTimings: true,
      },
    },
    apns: { payload: { aps: { alert: { title: p.title, body: p.body }, sound: 'default', threadId: p.tag } } },
  };
}

/** Send one notification to many devices; prunes dead tokens. Returns the number delivered. */
export async function send(devices: FirebaseFirestore.QueryDocumentSnapshot<DeviceDoc>[], p: Push): Promise<number> {
  if (!devices.length) return 0;
  const body = p.body.length > 180 ? `${p.body.slice(0, 177)}…` : p.body;
  const msg = { ...p, body };
  let ok = 0;
  for (let i = 0; i < devices.length; i += 500) {
    const chunk = devices.slice(i, i + 500);
    const res = await getMessaging().sendEach(chunk.map((d) => messageFor(d.data(), msg)));
    ok += res.successCount;
    await Promise.all(
      res.responses.map(async (r, k) => {
        if (r.success) return;
        const code = r.error?.code ?? '';
        if (DEAD.has(code)) await chunk[k].ref.delete().catch(() => undefined);
        else logger.warn('push failed', { code, message: r.error?.message });
      }),
    );
  }
  return ok;
}
