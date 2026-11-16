import { isNative } from '../native/platform';
/** Driver-app-only PWA wiring: manifest link + service worker (scope '/', handler only acts on /driver, /ocr/, /assets/). */
export function mountDriverPwa(): () => void {
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = '/driver-manifest.webmanifest';
  link.id = 'drv-manifest';
  document.head.appendChild(link);
  const apple = document.createElement('meta');
  apple.name = 'apple-mobile-web-app-capable';
  apple.content = 'yes';
  document.head.appendChild(apple);

  // not inside the Android app: assets are bundled there and a worker could serve stale screens
  if ('serviceWorker' in navigator && import.meta.env.PROD && window.isSecureContext && !isNative()) {
    navigator.serviceWorker.register('/driver-sw.js', { scope: '/' }).catch((e) => console.warn('[driver] service worker not registered', e));
  }
  return () => {
    link.remove();
    apple.remove();
  };
}
