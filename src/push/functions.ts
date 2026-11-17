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

/** Ask the server to push a test notification to all of this user's registered devices. */
export async function sendTestPush(tenantId: string, role: 'ops' | 'driver'): Promise<{ devices: number; sent: number; platforms: string[] }> {
  if (opsMode === 'demo') throw new Error('Not available in demo mode.');
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const call = httpsCallable<{ tenantId: string; role: string }, { devices: number; sent: number; platforms: string[] }>(getFunctions(getFbApp()!, REGION), 'sendTestPush');
  try {
    return (await call({ tenantId, role })).data;
  } catch (e) {
    const { code = '', message = '' } = e as { code?: string; message?: string };
    if (code === 'functions/not-found' || (code === 'functions/internal' && /^internal$/i.test(message)))
      throw new Error('The test function is not deployed yet (it ships with the next automatic release).');
    throw new Error(message || 'Test failed.');
  }
}
