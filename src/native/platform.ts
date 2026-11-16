// Native (Android app) helpers usable from any screen. Zero cost on the web: the app's native bridge
// injects window.Capacitor before the page loads, so we don't import @capacitor/core here; native
// plugins are imported lazily only when running inside the app.
type CapGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };
const cap = (): CapGlobal | undefined => (typeof window !== 'undefined' ? (window as unknown as { Capacitor?: CapGlobal }).Capacitor : undefined);

/** True inside the Exera Cargo Android app. */
export const isNative = (): boolean => !!cap()?.isNativePlatform?.();

/** 'android' | 'ios' | 'web' */
export const platform = (): 'android' | 'ios' | 'web' => (cap()?.getPlatform?.() as 'android' | 'ios' | undefined) ?? 'web';

/**
 * Navigate the SPA from outside React (notification taps, deep links). React Router's
 * BrowserRouter listens to popstate, so push a history entry and notify it.
 */
export function navigateTo(path: string): void {
  if (!path.startsWith('/')) return;
  if (import.meta.env.VITE_ROUTER === 'hash') {
    window.location.hash = path;
    return;
  }
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** In-app path for a deep link: https://host/j/abc → /j/abc · exeracargo://j/abc → /j/abc */
export function pathFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol === 'exeracargo:') {
      // exeracargo://j/<token> parses as host "j", path "/<token>"
      const p = `/${u.host}${u.pathname}`.replace(/\/{2,}/g, '/');
      return p + u.search;
    }
    if (u.protocol === 'https:') return u.pathname + u.search;
  } catch {
    /* ignore */
  }
  return null;
}

/** Only routes the driver app owns may be opened from outside (no admin pages in the app). */
export function allowedAppPath(p: string): boolean {
  return /^\/(j\/[a-z0-9]{16,64}|driver(\/.*)?)(\?.*)?$/i.test(p);
}
