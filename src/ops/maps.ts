// Free maps helpers (no paid Google APIs, no key required):
//  - Google Maps "directions" deep links for one stop or the whole route
//  - an embeddable route map (official Maps Embed API when VITE_GOOGLE_MAPS_EMBED_KEY is set — free and
//    unlimited — otherwise Google's keyless legacy embed)
//  - parsing a pasted Google Maps link / coordinates into an exact pin
//  - which location to navigate to: dispatch's exact pin → driver's GPS pin → street address → town centre
import { findPlace, haversineKm } from '../geo';
import type { Job, JobStop, StopPin } from './types';

export interface LatLng {
  lat: number;
  lng: number;
}

const COUNTRY_NAME: Record<string, string> = {
  ZA: 'South Africa',
  LK: 'Sri Lanka',
  LS: 'Lesotho',
  SZ: 'Eswatini',
  BW: 'Botswana',
  NA: 'Namibia',
  ZW: 'Zimbabwe',
  MZ: 'Mozambique',
  ZM: 'Zambia',
};

/** Loose service area: southern Africa (SADC) or Sri Lanka. */
export function inServiceArea(p: LatLng): boolean {
  const sadc = p.lat >= -35.5 && p.lat <= -8 && p.lng >= 10 && p.lng <= 41.5;
  const lk = p.lat >= 5.5 && p.lat <= 10.2 && p.lng >= 79.3 && p.lng <= 82.2;
  return sadc || lk;
}

export const distanceM = (a: LatLng, b: LatLng): number => haversineKm(a, b) * 1000;

export const fmtLL = (p: LatLng): string => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

// ── parse a pasted link / coordinates ────────────────────────

export type ParsedPin = { ok: true; pin: LatLng } | { ok: false; error: string };

const NUM = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
const PATTERNS: RegExp[] = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`), // data=…!3d-26.1!4d28.2 (exact place pin — most precise, check first)
  new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr|center|sll)=(?:loc:)?${NUM}(?:,|%2C)\s*${NUM}`, 'i'),
  new RegExp(String.raw`@${NUM},${NUM}`), // /place/…/@-26.1,28.2,17z
  new RegExp(String.raw`^\s*${NUM}\s*[,;\s]\s*${NUM}\s*$`), // "-26.1, 28.2"
];

/** Turn a Google Maps link or "lat, lng" text into a pin. */
export function parsePin(input: string): ParsedPin {
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'Paste a Google Maps link or coordinates such as -26.1234, 28.2345.' };
  if (/^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)\//i.test(raw))
    return {
      ok: false,
      error: 'Short links can’t be read here. Open the link, then copy the full URL from the browser’s address bar — or long-press the pin in Google Maps and copy the coordinates.',
    };
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    if (!inServiceArea({ lat, lng }))
      return { ok: false, error: `${lat.toFixed(5)}, ${lng.toFixed(5)} is outside southern Africa — check the order (latitude first, it is negative south of the equator).` };
    return { ok: true, pin: { lat, lng } };
  }
  return { ok: false, error: 'No coordinates found. Use a full Google Maps link (with @… or ?q=…) or type them like -26.1234, 28.2345.' };
}

// ── which spot to navigate to ────────────────────────────────

type AnyStop = Pick<JobStop, 'address' | 'place' | 'placeId' | 'region' | 'lat' | 'lng' | 'pinned'>;

export type TargetKind = 'pin' | 'driver' | 'address' | 'town';
export interface StopTarget {
  kind: TargetKind;
  /** Value for Google Maps (coordinates or address text). */
  q: string;
  ll?: LatLng;
}

/** Driver's GPS pin for a stop (ignores pins that are only suggestions). */
export function driverPin(job: Pick<Job, 'pins'>, stopId: string): StopPin | undefined {
  const p = job.pins?.[stopId];
  return p && !p.suggested ? p : undefined;
}

export function addressText(s: AnyStop): string {
  const place = findPlace(s.placeId);
  const country = place ? COUNTRY_NAME[place.country] : undefined;
  return [s.address?.trim(), s.place, s.region, country].filter(Boolean).join(', ');
}

/** Best navigation target: dispatch's exact pin → driver's GPS pin → street address → town centre. */
export function stopTarget(s: AnyStop, pin?: StopPin): StopTarget {
  if (s.pinned && typeof s.lat === 'number' && typeof s.lng === 'number') return { kind: 'pin', q: fmtLL(s as LatLng), ll: { lat: s.lat, lng: s.lng } };
  if (pin) return { kind: 'driver', q: fmtLL(pin), ll: { lat: pin.lat, lng: pin.lng } };
  if (s.address?.trim()) return { kind: 'address', q: addressText(s) };
  const p = findPlace(s.placeId);
  const ll = typeof s.lat === 'number' && typeof s.lng === 'number' ? { lat: s.lat, lng: s.lng } : p ? { lat: p.lat, lng: p.lng } : undefined;
  return ll ? { kind: 'town', q: fmtLL(ll), ll } : { kind: 'town', q: addressText(s) };
}

export const TARGET_LABEL: Record<TargetKind, string> = {
  pin: 'Exact pin',
  driver: 'Driver’s GPS spot',
  address: 'Street address',
  town: 'Town only',
};

// ── links ────────────────────────────────────────────────────

/** Directions to one place (from the phone's current location). */
export const navUrl = (q: string): string => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=driving`;

export const wazeUrl = (t: StopTarget): string =>
  t.ll ? `https://waze.com/ul?ll=${t.ll.lat},${t.ll.lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(t.q)}&navigate=yes`;

export const viewUrl = (p: LatLng): string => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

/** Google Maps allows 9 waypoints per directions link. */
const MAX_WAYPOINTS = 9;

/**
 * Directions link(s) through all points in order. With `fromCurrent` the route starts at the phone's
 * location (no origin). More stops than one link allows → several "parts".
 */
export function routeUrls(points: string[], fromCurrent = false): string[] {
  const pts = points.filter(Boolean);
  if (!pts.length) return [];
  if (pts.length === 1) return [navUrl(pts[0])];
  const urls: string[] = [];
  let i = 0;
  let first = true;
  while (i < pts.length) {
    const useOrigin = !(first && fromCurrent);
    const origin = useOrigin ? pts[i] : undefined;
    const start = useOrigin ? i + 1 : i;
    const end = Math.min(pts.length - 1, start + MAX_WAYPOINTS); // index of destination
    if (useOrigin && start > pts.length - 1) break; // single point left that was already a destination
    const dest = pts[end];
    const way = pts.slice(start, end);
    const qs = new URLSearchParams({ api: '1', destination: dest, travelmode: 'driving' });
    if (origin) qs.set('origin', origin);
    if (way.length) qs.set('waypoints', way.join('|'));
    urls.push(`https://www.google.com/maps/dir/?${qs.toString()}`);
    if (end >= pts.length - 1) break;
    i = end; // next part starts where this one ended
    first = false;
  }
  return urls;
}

/** Embeddable road-route map through the points (free). */
export function routeEmbedUrl(points: string[]): string | null {
  const pts = points.filter(Boolean);
  if (pts.length < 2) return null;
  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY as string | undefined;
  if (key) {
    const qs = new URLSearchParams({ key, origin: pts[0], destination: pts[pts.length - 1], mode: 'driving' });
    const way = pts.slice(1, -1).slice(0, 20);
    if (way.length) qs.set('waypoints', way.join('|'));
    return `https://www.google.com/maps/embed/v1/directions?${qs.toString()}`;
  }
  const qs = new URLSearchParams({ saddr: pts[0], daddr: pts.slice(1).join(' to:'), output: 'embed' });
  return `https://maps.google.com/maps?${qs.toString()}`;
}

/** Same as routeEmbedUrl for a single spot. */
export function placeEmbedUrl(p: LatLng): string {
  const key = import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY as string | undefined;
  if (key) return `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q: `${p.lat},${p.lng}` }).toString()}`;
  return `https://maps.google.com/maps?${new URLSearchParams({ q: `${p.lat},${p.lng}`, z: '16', output: 'embed' }).toString()}`;
}

/**
 * GPS fix captured when the driver taps "Arrived" → pin to store for the stop (or null).
 * - no exact location yet → store the driver's spot (if the fix is reasonably accurate)
 * - dispatch already pinned it and the driver is > 300 m away with a good fix (≤ 50 m) → a suggestion for
 *   dispatch to confirm; dispatch's pin is never overwritten
 */
export function arrivalPin(
  stop: AnyStop,
  existing: StopPin | undefined,
  fix: { lat: number; lng: number; accuracy?: number } | null,
  uid: string,
): StopPin | null {
  if (!fix) return null;
  const acc = typeof fix.accuracy === 'number' ? Math.round(fix.accuracy) : undefined;
  const base: StopPin = { lat: fix.lat, lng: fix.lng, acc, at: Date.now(), by: uid, source: 'driver' };
  const opsPin = stop.pinned && typeof stop.lat === 'number' && typeof stop.lng === 'number' ? { lat: stop.lat, lng: stop.lng } : null;
  if (opsPin) return distanceM(opsPin, fix) > 300 && (acc ?? 999) <= 50 ? { ...base, suggested: true } : null;
  if (existing && !existing.suggested) return null;
  return (acc ?? 999) <= 150 ? base : null;
}
