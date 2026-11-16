/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "1" when the Android build includes google-services.json (native push). */
  readonly VITE_ANDROID_PUSH?: string;
  /** Release version of this web bundle (set by CI), used by the Android auto-updater. */
  readonly VITE_APP_VERSION?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_DEFAULT_TENANT?: string;
  readonly VITE_ROUTER?: 'hash' | 'browser';
  readonly VITE_PLATFORM_HOSTS?: string;
  readonly VITE_APPCHECK_SITE_KEY?: string;
  /** Web push (Firebase Cloud Messaging) public VAPID key — Project settings → Cloud Messaging → Web Push certificates. */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  /** Region of the Cloud Functions (default africa-south1). */
  readonly VITE_FUNCTIONS_REGION?: string;
  /** Public site origin used in one-time job links (https://exeracargo.web.app). Required in the Android app build. */
  readonly VITE_PUBLIC_ORIGIN?: string;
  /** '1' in the Android app build (vite --mode android). */
  readonly VITE_NATIVE?: string;
}
