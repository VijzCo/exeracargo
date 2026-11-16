// Geography service: town search, distance estimates, border posts. Pure, synchronous, no network.
import type { BorderPost, CountryCode, CrossBorderCode, Place } from './types';
import { COUNTRIES, countryInfo } from './countries';
import { PLACES_LK } from './places/lk';
import { BORDER_POSTS, NEIGHBOUR_TOWNS, PLACES_ZA } from './places/za';

export * from './types';
export * from './countries';

const BY_COUNTRY: Record<CountryCode, Place[]> = { LK: PLACES_LK, ZA: PLACES_ZA };
const ALL: Place[] = [...PLACES_LK, ...PLACES_ZA, ...NEIGHBOUR_TOWNS];
const BY_ID = new Map(ALL.map((p) => [p.id, p]));

export interface PlaceQuery {
  /** Restrict to these regions (tenant service areas). Empty/undefined = all regions. */
  regions?: string[];
  /** Include towns in these neighbouring countries (cross-border freight). */
  crossBorder?: CrossBorderCode[];
  limit?: number;
}

/** Home-country places (optionally filtered by region) plus allowed cross-border towns. */
export function getPlaces(country: CountryCode, q: Omit<PlaceQuery, 'limit'> = {}): Place[] {
  const home = BY_COUNTRY[country] ?? [];
  const regions = q.regions?.length ? new Set(q.regions) : null;
  const list = regions ? home.filter((p) => regions.has(p.region)) : home.slice();
  if (country === 'ZA' && q.crossBorder?.length) {
    const allowed = new Set<string>(q.crossBorder);
    list.push(...NEIGHBOUR_TOWNS.filter((p) => allowed.has(p.country)));
  }
  return list;
}

export function findPlace(id: string | undefined | null): Place | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Resolve a free-text name (case/diacritic-insensitive, aliases) within a country's list. */
export function findPlaceByName(country: CountryCode, name: string): Place | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const list = [...(BY_COUNTRY[country] ?? []), ...NEIGHBOUR_TOWNS];
  return list.find((p) => norm(p.name) === n) ?? list.find((p) => p.aliases?.some((a) => norm(a) === n));
}

export function placeLabel(p: Place | undefined): string {
  return p ? `${p.name}, ${p.region}` : '';
}

function norm(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const KIND_WEIGHT: Record<Place['kind'], number> = { metro: 0, city: 1, port: 2, industrial: 2, mining: 2, town: 3, border: 4, suburb: 5 };

/** Ranked search: exact > prefix > word-prefix > alias > contains; bigger places first on ties. */
export function searchPlaces(country: CountryCode, query: string, q: PlaceQuery = {}): Place[] {
  const list = getPlaces(country, q);
  const limit = q.limit ?? 12;
  const n = norm(query);
  if (!n) return list.slice().sort(byImportance).slice(0, limit);
  const scored: { p: Place; s: number }[] = [];
  for (const p of list) {
    const name = norm(p.name);
    const region = norm(p.region);
    const aliases = (p.aliases ?? []).map(norm);
    let s = -1;
    if (name === n) s = 100;
    else if (name.startsWith(n)) s = 80;
    else if (name.split(' ').some((w) => w.startsWith(n))) s = 65;
    else if (aliases.some((a) => a === n || a.startsWith(n))) s = 60;
    else if (name.includes(n)) s = 45;
    else if (aliases.some((a) => a.includes(n))) s = 35;
    else if (region.startsWith(n)) s = 20;
    if (s >= 0) scored.push({ p, s: s - KIND_WEIGHT[p.kind] });
  }
  return scored
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .slice(0, limit)
    .map((x) => x.p);
}

function byImportance(a: Place, b: Place) {
  return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind] || a.name.localeCompare(b.name);
}

const R = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Indicative road distance between two places (great-circle × country road factor).
 * Cross-border trips are routed through the border post chosen (or the nearest one), so
 * Durban → Maseru goes via Maseru Bridge rather than over the mountains.
 * Same place → country's same-town minimum. Rounded to whole km. null if either id is unknown.
 */
export function estimateRoadKm(country: CountryCode, fromId: string | undefined, toId: string | undefined, borderPostId?: string): number | null {
  const a = findPlace(fromId);
  const b = findPlace(toId);
  if (!a || !b) return null;
  const c = countryInfo(country);
  if (a.id === b.id) return c.sameTownKm;
  const home = a.country === country ? a : b;
  const abroad = a.country === country ? b : a;
  if (abroad.country !== country && home.country === country) {
    const posts = borderPostsFor(country, abroad.country as CrossBorderCode, home);
    const post = posts.find((p) => p.id === borderPostId) ?? posts[0];
    // two legs via the post already follow the road corridor more closely → smaller factor
    if (post) return Math.max(c.sameTownKm, Math.round((haversineKm(home, post) + haversineKm(post, abroad)) * Math.max(1, c.roadFactor - 0.1)));
  }
  return Math.max(c.sameTownKm, Math.round(haversineKm(a, b) * c.roadFactor));
}

/** Border post by id. */
export function findBorderPost(id: string | undefined): BorderPost | undefined {
  return id ? BORDER_POSTS.find((b) => b.id === id) : undefined;
}

/** Border posts from the home country into `to`, nearest to the origin first. */
export function borderPostsFor(from: CountryCode, to: CrossBorderCode, origin?: Place): BorderPost[] {
  const list = BORDER_POSTS.filter((b) => b.from === from && b.to === to);
  return origin ? list.sort((x, y) => haversineKm(origin, x) - haversineKm(origin, y)) : list;
}

export function isCrossBorder(p: Place | undefined, home: CountryCode): boolean {
  return !!p && p.country !== home;
}

/** All border posts (read-only). */
export const BORDER_POSTS_ALL: readonly BorderPost[] = BORDER_POSTS;

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRIES) as CountryCode[];
