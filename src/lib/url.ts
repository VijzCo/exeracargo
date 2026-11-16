/** Tenant-supplied URLs are untrusted (any tenant admin can write their config). Only https is rendered. */
export function safeHttpsUrl(u: string | undefined | null): string | undefined {
  if (!u) return undefined;
  try {
    const url = new URL(u.trim());
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

const MAP_HOSTS = ['www.google.com', 'maps.google.com', 'www.openstreetmap.org'];

/** Only Google Maps / OpenStreetMap embeds are allowed in the contact iframe. */
export function safeMapEmbed(u: string | undefined | null): string | undefined {
  const s = safeHttpsUrl(u);
  if (!s) return undefined;
  const url = new URL(s);
  if (!MAP_HOSTS.includes(url.hostname)) return undefined;
  if (url.hostname !== 'www.openstreetmap.org' && !url.pathname.startsWith('/maps')) return undefined;
  return s;
}

/** CSS url() value, quoted and escaped. */
export function cssUrl(u: string | undefined | null): string | undefined {
  const s = safeHttpsUrl(u);
  return s ? `url("${s.replace(/["\\\n\r]/g, encodeURIComponent)}")` : undefined;
}
