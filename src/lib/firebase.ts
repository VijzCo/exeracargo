import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';
import type { Auth } from 'firebase/auth';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** True when Firebase env vars are present. Otherwise the app runs in local demo mode. */
export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let authPromise: Promise<Auth> | null = null;

if (firebaseEnabled) {
  app = initializeApp(config);
  // Optional App Check (free): blocks scripted abuse of public booking/message writes.
  // Create a reCAPTCHA v3 key, register it in Firebase → App Check, set VITE_APPCHECK_SITE_KEY, then enforce for Firestore.
  const appCheckKey = env.VITE_APPCHECK_SITE_KEY;
  if (appCheckKey) {
    void import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) =>
      initializeAppCheck(app!, { provider: new ReCaptchaV3Provider(appCheckKey), isTokenAutoRefreshEnabled: true }),
    );
  }
  db = getFirestore(app);
}

export function getDb(): Firestore {
  if (!db) throw new Error('Firebase not configured');
  return db;
}

/** Auth SDK is loaded on demand (admin console only) to keep public pages light. */
export function getFbAuth(): Promise<Auth> {
  if (!app) return Promise.reject(new Error('Firebase not configured'));
  authPromise ??= import('firebase/auth').then(({ getAuth }) => getAuth(app!));
  return authPromise;
}
