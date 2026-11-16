import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Exera Cargo Driver — Android app (Capacitor).
 * The web build (dist/) is bundled into the APK; the app opens at /driver (see src/native/boot.ts).
 * Build: `npm run build:android` → `npx cap open android` (Android Studio) or CI (.github/workflows/android.yml).
 */
const config: CapacitorConfig = {
  appId: 'com.exeracargo.driver',
  appName: 'Exera Cargo Driver',
  webDir: 'dist',
  android: {
    // https://localhost origin: secure context (camera, geolocation, IndexedDB) and an authorised Firebase Auth domain
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      launchAutoHide: true,
      backgroundColor: '#0A0F1C',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0F1C',
      overlaysWebView: false,
    },
    // Self-hosted live updates (src/native/updater.ts): no Capgo cloud, no stats sent anywhere.
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      updateUrl: '',
      channelUrl: '',
      appReadyTimeout: 15000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
