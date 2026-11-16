// Client wrappers for callable Cloud Functions (Blaze plan).
import { getFbApp } from '../lib/firebase';
import { opsMode } from '../ops/store';

const REGION = import.meta.env.VITE_FUNCTIONS_REGION || 'africa-south1';

/**
 * Set a new PIN for a company driver without re-creating the login (keeps uid, chat, history).
 * Throws a readable Error. Demo mode updates the local demo login.
 */
export async function resetDriverPin(tenantId: string, driverId: string, pin: string): Promise<void> {
  if (!/^\d{6,12}$/.test(pin)) throw new Error('PIN must be 6–12 digits.');
  if (opsMode === 'demo') {
    const KEY = 'hp:ops:demo-logins';
    const logins = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, { uid: string; pin: string; t: string }>;
    const k = Object.keys(logins).find((p) => logins[p].uid === driverId);
    if (!k) throw new Error('No login found for this driver.');
    logins[k].pin = pin;
    localStorage.setItem(KEY, JSON.stringify(logins));
    return;
  }
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ tenantId: string; driverId: string; pin: string }, { ok: boolean }>(getFunctions(getFbApp()!, REGION), 'resetDriverPin');
  try {
    await call({ tenantId, driverId, pin });
  } catch (e) {
    const { code = '', message = '' } = e as { code?: string; message?: string };
    // a missing function surfaces as functions/not-found or a bare "internal" (CORS on the 404)
    if (code === 'functions/not-found' || (code === 'functions/internal' && /^internal$/i.test(message)))
      throw new Error('PIN reset is not available yet — deploy the Cloud Functions (Blaze plan) first.');
    throw new Error(message || 'Could not reset the PIN.');
  }
}
