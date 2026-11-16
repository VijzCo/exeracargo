import { PRESETS, DEFAULT_TENANT_ID, tenantDefaults } from './presets';
import { resolveDomain, fetchTenant } from '../lib/data';
import { deepMerge, normalizeTenant } from './merge';
import type { TenantConfig } from './types';

const SESSION_KEY = 'hp:site';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

export class SiteNotFoundError extends Error {
  constructor(host: string) {
    super(`No site is configured for ${host}.`);
    this.name = 'SiteNotFoundError';
  }
}

function sessionGet(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
function sessionSet(v: string | null) {
  try {
    if (v) sessionStorage.setItem(SESSION_KEY, v);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Platform hosts are the operator's own hosts (localhost, <project>.web.app, extra hosts in
 * VITE_PLATFORM_HOSTS). Only there may `?site=` switch tenants and only there do we fall back
 * to the default tenant. On a client's custom domain the domain alone decides the site, so a
 * crafted `?site=` link can't show another brand on a paying client's domain.
 */
export function isPlatformHost(host: string = window.location.hostname): boolean {
  const h = host.toLowerCase();
  const extra = ((import.meta.env.VITE_PLATFORM_HOSTS as string | undefined) ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extra.includes('*')) return true;
  const project = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined)?.toLowerCase();
  const builtIn = ['localhost', '127.0.0.1', '::1'];
  if (project) builtIn.push(`${project}.web.app`, `${project}.firebaseapp.com`);
  return builtIn.includes(h) || extra.includes(h);
}

/**
 * Tenant resolution order:
 *  1. `?site=<slug>` (platform hosts only; sticky per session; `?site=reset` clears)
 *  2. hostname listed in a bundled preset's `domains`
 *  3. hostname mapped in Firestore `domains/{hostname}`
 *  4. first hostname label when such a tenant exists (acme.web.app, acme.yourplatform.lk)
 *  5. platform hosts: VITE_DEFAULT_TENANT — anywhere else: SiteNotFoundError
 */
export async function resolveTenantId(loc: Location = window.location): Promise<string> {
  const host = loc.hostname.toLowerCase();
  const platform = isPlatformHost(host);

  if (platform) {
    const q = new URLSearchParams(loc.search).get('site')?.trim().toLowerCase();
    if (q === 'reset') sessionSet(null);
    else if (q && SLUG_RE.test(q)) {
      sessionSet(q);
      return q;
    }
    const sticky = sessionGet();
    if (sticky && SLUG_RE.test(sticky)) return sticky;
  } else {
    sessionSet(null);
  }

  for (const p of Object.values(PRESETS)) if (p.domains.includes(host)) return p.id;

  const mapped = await resolveDomain(host);
  if (mapped) return mapped;

  const label = host.split('.')[0];
  if (label && SLUG_RE.test(label) && label !== 'www') {
    if (PRESETS[label]) return label;
    if (await fetchTenant(label).catch(() => null)) return label;
  }
  if (platform) return DEFAULT_TENANT_ID;
  throw new SiteNotFoundError(host);
}

/**
 * Effective config. Stored docs (saved from the admin) are complete configs and are merged
 * over neutral TENANT_DEFAULTS only — never over another tenant's preset.
 */
export async function loadTenant(id: string): Promise<TenantConfig> {
  const preset = PRESETS[id];
  let stored: TenantConfig | null = null;
  let failed = false;
  try {
    stored = await fetchTenant(id);
  } catch (e) {
    failed = true;
    console.warn('[tenant] fetch failed', e);
  }
  if (stored) {
    const base = tenantDefaults(stored.locale?.country);
    // configs saved before freight existed: keep freight off until the owner reviews rates
    if (!('logistics' in stored)) base.logistics = { ...base.logistics, enabled: false };
    return normalizeTenant(deepMerge(base, { ...stored, id }));
  }
  if (preset) return preset;
  if (failed) throw new Error('This site is temporarily unavailable. Please call us or try again shortly.');
  if (isPlatformHost()) {
    // unknown ?site= on the operator's host: show the default, but never on a client domain
    return PRESETS[DEFAULT_TENANT_ID];
  }
  throw new SiteNotFoundError(window.location.hostname);
}
