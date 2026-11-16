/* Driver app service worker. Registered from /driver with scope '/', but only handles:
   - navigations to /driver*      → network-first, fallback to the cached app shell (offline start)
   - /ocr/*  (Tesseract assets)    → cache-first (large, immutable per release)
   - /assets/* (hashed Vite build) → cache-first
   Everything else (Firestore, googleapis, fonts, other pages) goes straight to the network.
   It also shows web push notifications (FCM data messages) for drivers AND the dispatch console —
   only one service worker can control scope '/', so the console registers this same file. */
const VERSION = 'drv-v2';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
// kept across app versions (≈15 MB). Bump when tesseract.js is upgraded (scripts/copy-ocr-assets.mjs).
const OCR = 'drv-ocr-tess7';
const KEEP = [SHELL, STATIC, OCR];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.add(new Request('/index.html', { cache: 'reload' })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('drv-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch Firestore / googleapis / CDNs
  const p = url.pathname;

  if (req.mode === 'navigate') {
    if (p === '/driver' || p.startsWith('/driver/')) e.respondWith(shell(req));
    return;
  }
  if (p.startsWith('/ocr/')) return e.respondWith(cacheFirst(req, OCR));
  if (p.startsWith('/assets/')) return e.respondWith(cacheFirst(req, STATIC));
});

async function shell(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const c = await caches.open(SHELL);
      await c.put('/index.html', res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match('/index.html', { cacheName: SHELL });
    return cached || new Response('Offline — open the app again when you have signal.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

const MAX_STATIC = 120;

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req, { ignoreSearch: name === OCR });
  if (hit) return hit;
  const res = await fetch(req);
  // The hosting SPA rewrite answers a missing asset with index.html (200) — never cache that as a script.
  const type = res.headers.get('content-type') || '';
  if (res.ok && res.type === 'basic' && !type.includes('text/html')) {
    c.put(req, res.clone())
      .then(() => (name === STATIC ? trim(c) : undefined))
      .catch(() => undefined);
  }
  return res;
}

async function trim(c) {
  const keys = await c.keys();
  if (keys.length > MAX_STATIC) await Promise.all(keys.slice(0, keys.length - MAX_STATIC).map((k) => c.delete(k)));
}

// ── Web push (Firebase Cloud Messaging, data-only messages from functions/src/send.ts) ──

self.addEventListener('push', (e) => {
  let p = {};
  try {
    p = e.data ? e.data.json() : {};
  } catch {
    p = { data: { title: 'Exera Cargo', body: e.data ? e.data.text() : '' } };
  }
  // FCM wraps data messages as { data: {...}, from, fcmMessageId }; notification messages as { notification: {...} }
  const d = Object.assign({}, p.notification || {}, p.data || {});
  const title = d.title || 'Exera Cargo';
  const url = typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      icon: '/driver-icon.svg',
      badge: '/driver-icon.svg',
      data: { url },
      requireInteraction: d.channel === 'alerts',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  const target = new URL(url, self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // reuse a tab of the same area (/admin or /driver) and route it; otherwise open a new one
      const area = new URL(target).pathname.split('/')[1];
      const same = wins.find((w) => new URL(w.url).pathname.split('/')[1] === area);
      if (same) {
        same.postMessage({ type: 'exera:navigate', url });
        return same.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

// token rotation is handled by the page on its next visit (getToken refreshes it)
self.addEventListener('pushsubscriptionchange', () => undefined);
