// Android app auto-update (self-hosted, no app store needed).
//
// Every push to main (see .github/workflows/release.yml) publishes on Firebase Hosting:
//   /app-update/latest.json            manifest below (scripts/update-manifest.mjs)
//   /app-update/<version>/…            the app's web files, one URL each with its SHA-256 — the app downloads
//                                      only files it doesn't already have (delta), the rest is copied locally
//   /app-update/exera-cargo-driver.apk the full app
//
// 1. Web changes (almost every release): the app downloads the new bundle in the background and
//    switches to it on the next launch (or right away when the driver taps "Restart"). No reinstall.
// 2. Native changes (new plugin / permission): the manifest raises apk.minVersionCode. Older apps then
//    stop taking web bundles and ask the driver to install the new APK (one tap → download → install).
import { App } from '@capacitor/app';

export interface UpdateManifest {
  version: string; // web bundle version, e.g. "1.0.57"
  bundle?: { minVersionCode: number; manifest: { file_name: string; file_hash: string; download_url: string }[] };
  apk?: { url: string; versionCode: number; versionName: string; minVersionCode: number; size?: number };
  publishedAt?: string;
}

export type UpdateState =
  | { kind: 'none' }
  | { kind: 'ready'; version: string; id: string } // web bundle downloaded, applies on next launch
  | { kind: 'apk-required'; url: string; versionName: string }
  | { kind: 'apk-available'; url: string; versionName: string };

/** Version of the web bundle this app is running (baked in at build time). */
export const BUNDLE_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

const ORIGIN = (import.meta.env.VITE_PUBLIC_ORIGIN || 'https://exeracargo.web.app').replace(/\/$/, '');
const EVENT = 'exera-app-update';
const CHECK_EVERY_MS = 30 * 60_000;

let state: UpdateState = { kind: 'none' };
let lastCheck = 0;
let running = false;

function emit(s: UpdateState) {
  state = s;
  window.dispatchEvent(new CustomEvent<UpdateState>(EVENT, { detail: s }));
}
export function getUpdateState(): UpdateState {
  return state;
}
export function onUpdateState(cb: (s: UpdateState) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<UpdateState>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${ORIGIN}${u.startsWith('/') ? '' : '/'}${u}`);

async function check(): Promise<void> {
  if (running || Date.now() - lastCheck < 60_000) return;
  running = true;
  lastCheck = Date.now();
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    const res = await fetch(`${ORIGIN}/app-update/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const m = (await res.json()) as UpdateManifest;
    const build = Number((await App.getInfo()).build) || 0;

    // native update needed first: never load a web bundle the installed app can't run
    if (m.apk && build < m.apk.minVersionCode) return emit({ kind: 'apk-required', url: abs(m.apk.url), versionName: m.apk.versionName });

    if (m.bundle && m.version && m.version !== BUNDLE_VERSION && build >= m.bundle.minVersionCode) {
      const { bundles } = await CapacitorUpdater.list();
      let b = bundles.find((x) => x.version === m.version && x.status !== 'error');
      if (!b) b = await CapacitorUpdater.download({ url: `${ORIGIN}/app-update/${m.version}/index.html`, version: m.version, manifest: m.bundle.manifest });
      await CapacitorUpdater.next({ id: b.id }); // applied on the next app start
      return emit({ kind: 'ready', version: m.version, id: b.id });
    }
    if (m.apk && build < m.apk.versionCode) return emit({ kind: 'apk-available', url: abs(m.apk.url), versionName: m.apk.versionName });
  } catch (e) {
    console.warn('[update] check failed', e);
  } finally {
    running = false;
  }
}

/** Call once at native start-up. Confirms the running bundle works (else the plugin rolls back) and checks for updates. */
export async function startUpdater(): Promise<void> {
  try {
    const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {
    console.warn('[update] notifyAppReady failed', e);
  }
  window.setTimeout(() => void check(), 4000);
  void App.addListener('resume', () => {
    if (Date.now() - lastCheck > CHECK_EVERY_MS) void check();
  });
}

/** Switch to the downloaded bundle now (reloads the app). */
export async function applyNow(id: string): Promise<void> {
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater');
  await CapacitorUpdater.set({ id });
}

/** Hand the APK to Android's browser → download → "Install". */
export function installApk(url: string): void {
  // a URL outside the app's own origin is opened by Capacitor in the system browser
  window.location.href = url;
}
