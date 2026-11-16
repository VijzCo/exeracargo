// Android app start-up: status bar, splash, hardware back button, deep links (App Links + exeracargo://).
// Imported lazily from main.tsx only when running natively.
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { allowedAppPath, navigateTo, pathFromUrl } from './platform';

function openUrl(url: string) {
  const p = pathFromUrl(url);
  if (p && allowedAppPath(p)) navigateTo(p);
}

export async function bootNative(): Promise<void> {
  document.documentElement.classList.add('is-native');
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: '#0A0F1C' }).catch(() => undefined);

  // cold start from a link
  const launch = await App.getLaunchUrl().catch(() => undefined);
  if (launch?.url) openUrl(launch.url);
  // warm start from a link
  void App.addListener('appUrlOpen', (e) => openUrl(e.url));

  // hardware back: go back inside the app; leave the app from the jobs list / sign-in screen
  void App.addListener('backButton', ({ canGoBack }) => {
    const root = ['/driver', '/driver/', '/'].includes(window.location.pathname);
    if (canGoBack && !root) window.history.back();
    else void App.minimizeApp().catch(() => App.exitApp());
  });

  window.setTimeout(() => void SplashScreen.hide().catch(() => undefined), 300);

  // self-hosted auto-update (web bundle + APK notice)
  void import('./updater').then((m) => m.startUpdater());
}
