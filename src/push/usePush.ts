// ─────────────────────────────────────────────────────────────
// Push notifications (Firebase Cloud Messaging) for the driver app and the dispatch console.
//  - Android app: @capacitor/push-notifications (channels jobs/chat/alerts). Drivers are asked
//    for permission right after signing in.
//  - Browsers (dispatch console, driver PWA in Chrome): Firebase Messaging web push through the
//    existing /driver-sw.js service worker (one SW per scope). Permission is asked from a user
//    gesture (<PushPrompt/>); once granted, the token is refreshed on every visit.
// Tokens are stored in tenants/{t}/devices/{uid}__{installId}; Cloud Functions send.
// No-op in demo mode, without a VAPID key (web) or without google-services.json (Android).
// ─────────────────────────────────────────────────────────────
import { useEffect, useSyncExternalStore } from 'react';
import { getFbApp } from '../lib/firebase';
import { opsMode, registerDevice, unregisterDevice } from '../ops/store';
import { allowedAppPath, isNative, navigateTo } from '../native/platform';
import { getInstallId } from './installId';
import { showPushToast } from './toast';

export type PushRole = 'ops' | 'driver';
export type PushState = 'unsupported' | 'default' | 'denied' | 'granted' | 'error';

interface Ctx {
  tenantId: string;
  uid: string;
  role: PushRole;
}

// ── tiny external store so every <PushPrompt/> shows the same state ──
let state: PushState = 'unsupported';
let lastError = '';
const subs = new Set<() => void>();
function setState(s: PushState, err = '') {
  state = s;
  lastError = err;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

let ctx: Ctx | null = null;

// notification clicked while a tab was already open → the service worker asks us to route
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const m = e.data as { type?: string; url?: string } | null;
    if (m?.type === 'exera:navigate' && typeof m.url === 'string' && m.url.startsWith('/')) navigateTo(m.url);
  });
}
const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;

async function saveToken(token: string, platform: 'android' | 'web') {
  if (!ctx) return;
  await registerDevice(ctx.tenantId, { uid: ctx.uid, role: ctx.role, token, platform, tenantId: ctx.tenantId, installId: getInstallId() });
}

// ═════════════════════════ Android (Capacitor) ═════════════════════════

let nativeReady: Promise<typeof import('@capacitor/push-notifications')> | null = null;

function nativeSetup() {
  nativeReady ??= import('@capacitor/push-notifications').then(async (mod) => {
    const { PushNotifications } = mod;
    await Promise.all([
      PushNotifications.createChannel({ id: 'jobs', name: 'Jobs', description: 'New, changed and cancelled jobs', importance: 5, visibility: 1, vibration: true }),
      PushNotifications.createChannel({ id: 'chat', name: 'Dispatch chat', description: 'Messages from dispatch', importance: 4, visibility: 1, vibration: true }),
      PushNotifications.createChannel({ id: 'alerts', name: 'Alerts', description: 'Expiring documents and problems', importance: 4, visibility: 1 }),
    ]).catch(() => undefined);
    await PushNotifications.addListener('registration', (t) => {
      void saveToken(t.value, 'android').catch((e) => console.warn('[push] token not saved', e));
    });
    await PushNotifications.addListener('registrationError', (e) => {
      console.warn('[push] registration failed (google-services.json missing?)', e);
      setState('error', 'Push registration failed');
    });
    // app open: show a banner instead of a system notification
    await PushNotifications.addListener('pushNotificationReceived', (n) => {
      const d = (n.data ?? {}) as Record<string, string>;
      showPushToast(n.title ?? d.title ?? 'Exera Cargo', n.body ?? d.body ?? '', d.url);
    });
    // tap on a notification
    await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
      const url = (a.notification.data as Record<string, string> | undefined)?.url;
      if (url && allowedAppPath(url)) navigateTo(url);
      else navigateTo('/driver');
    });
    return mod;
  });
  return nativeReady;
}

async function nativeRegister(ask: boolean): Promise<void> {
  // FCM needs google-services.json at build time; without it register() would crash the app
  if (import.meta.env.VITE_ANDROID_PUSH !== '1') return setState('unsupported', 'This app build has no push set-up (GOOGLE_SERVICES_JSON missing in the build).');
  const { PushNotifications } = await nativeSetup();
  let p = await PushNotifications.checkPermissions();
  if (p.receive !== 'granted' && ask) p = await PushNotifications.requestPermissions();
  if (p.receive === 'granted') {
    setState('granted');
    await PushNotifications.register(); // → 'registration' listener saves the token
  } else setState(p.receive === 'denied' ? 'denied' : 'default');
}

// ═════════════════════════ Web (FCM web push) ═════════════════════════

async function webSupported(): Promise<boolean> {
  if (!VAPID || !getFbApp() || !('serviceWorker' in navigator) || !('Notification' in window) || !window.isSecureContext) return false;
  const { isSupported } = await import('firebase/messaging');
  return isSupported().catch(() => false);
}

function webUnsupportedReason(): string {
  if (!VAPID) return 'Web push is not set up on this site (VITE_FIREBASE_VAPID_KEY missing in the build).';
  if (!window.isSecureContext) return 'Notifications need a secure (https) address.';
  if (!('Notification' in window) || !('serviceWorker' in navigator))
    return 'This browser cannot receive notifications here. On iPhone/iPad, add the site to the Home Screen first.';
  return 'This browser does not support web push.';
}

async function webRegister(ask: boolean): Promise<void> {
  if (Notification.permission === 'denied') return setState('denied');
  if (Notification.permission !== 'granted') {
    if (!ask) return setState('default');
    const r = await Notification.requestPermission();
    if (r !== 'granted') return setState(r === 'denied' ? 'denied' : 'default');
  }
  const [{ getMessaging, getToken }, reg] = await Promise.all([
    import('firebase/messaging'),
    // the driver PWA worker also handles push for the console (one worker per scope '/')
    navigator.serviceWorker.register('/driver-sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready),
  ]);
  const token = await getToken(getMessaging(getFbApp()!), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  if (!token) throw new Error('No push token');
  await saveToken(token, 'web');
  setState('granted');
}

// ═════════════════════════ public API ═════════════════════════

async function enable(ask: boolean): Promise<void> {
  if (!ctx) return;
  // Safari only shows the permission prompt when it is requested directly inside the click — so ask
  // first, before any await (loading Firebase Messaging would otherwise break the user-gesture chain).
  if (ask && !isNative() && VAPID && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      const r = await Notification.requestPermission();
      if (r !== 'granted') return setState(r === 'denied' ? 'denied' : 'default');
    } catch {
      /* older Safari: callback form only — fall through to the normal path */
    }
  }
  try {
    if (isNative()) await nativeRegister(ask);
    else if (await webSupported()) await webRegister(ask);
    else setState('unsupported', webUnsupportedReason());
  } catch (e) {
    console.warn('[push] not enabled', e);
    setState('error', e instanceof Error ? e.message : String(e));
  }
}

/**
 * Register this device for push once the user is known. Mount once per signed-in shell:
 *   driver app → usePushRegistration({ tenantId, uid: driver.id, role: 'driver' })
 *   console    → usePushRegistration({ tenantId, uid: user.uid, role: 'ops' })
 * Drivers in the Android app are asked for permission immediately; browsers wait for <PushPrompt/>.
 */
export function usePushRegistration(c: { tenantId: string; uid: string | null | undefined; role: PushRole }): PushState {
  const { tenantId, uid, role } = c;
  useEffect(() => {
    if (opsMode !== 'firebase' || !uid) {
      setState('unsupported', opsMode !== 'firebase' ? 'Not available in demo mode.' : '');
      return;
    }
    ctx = { tenantId, uid, role };
    void enable(isNative() && role === 'driver');
    return () => {
      if (ctx?.uid === uid) ctx = null;
    };
  }, [tenantId, uid, role]);
  return useSyncExternalStore(subscribe, () => state);
}

/** Current push state (for custom UI). */
export function usePushState(): { state: PushState; error: string; request: () => Promise<void>; ctx: Ctx | null } {
  const s = useSyncExternalStore(subscribe, () => state);
  return { state: s, error: lastError, request: () => enable(true), ctx };
}

/** Call BEFORE signing out so this device stops receiving the user's notifications. */
export async function pushSignOut(tenantId: string, uid: string): Promise<void> {
  ctx = null;
  if (opsMode !== 'firebase') return;
  await unregisterDevice(tenantId, uid, getInstallId()).catch(() => undefined);
  if (isNative()) {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    await PushNotifications.unregister().catch(() => undefined);
  }
  setState('default');
}
