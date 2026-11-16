import type { CountryCode, TenantConfig } from '../types';
import { deepMerge } from '../merge';
import { exera } from './exera';
import { maluti } from './maluti';
import { lankahaul } from './lankahaul';
import { insightsLibrary } from './insights';
import { TENANT_DEFAULTS } from './defaults';
import { logisticsDefaults } from './logistics';
import { countryInfo } from '../../geo/countries';
export { TENANT_DEFAULTS } from './defaults';

/** Bundled demo sites (South Africa). Firestore docs deep-merge over these. */
export const PRESETS: Record<string, TenantConfig> = {
  exera,
  maluti,
};

/**
 * Per-country starter content for new client sites (not publicly served).
 * Sri Lanka is kept so the platform can also be sold into that market.
 */
export const COUNTRY_TEMPLATES: Record<CountryCode, TenantConfig> = {
  ZA: exera,
  LK: { ...lankahaul, insights: insightsLibrary },
};

const envDefault = (import.meta.env.VITE_DEFAULT_TENANT as string | undefined) || '';
/** Falls back to the first bundled preset if the env names a site that isn't bundled. */
export const DEFAULT_TENANT_ID: string = PRESETS[envDefault] ? envDefault : 'exera';

/** Neutral defaults for a stored tenant of this country (no brand content). */
export function tenantDefaults(country: CountryCode | undefined): TenantConfig {
  const c = countryInfo(country);
  return deepMerge(TENANT_DEFAULTS, {
    locale: {
      country: c.code,
      currency: c.currency,
      languages: c.code === 'ZA' ? ['en', 'af', 'zu'] : ['en', 'si', 'ta'],
      defaultLang: 'en',
    },
    serviceAreas: c.regions,
    logistics: logisticsDefaults(c.code),
    booking: { taxPct: c.defaultTaxPct },
  });
}

/** Template for a brand-new white-label site (admin "New site" wizard). */
export function newTenantTemplate(id: string, name: string, country: CountryCode = 'ZA'): TenantConfig {
  const base = COUNTRY_TEMPLATES[country] ?? COUNTRY_TEMPLATES.ZA;
  const c = countryInfo(country);
  const t = deepMerge(base, {
    id,
    name,
    logoText: name,
    domains: [],
    tagline: country === 'ZA' ? 'Tippers, trucks and freight you can book online.' : 'Tipper & lorry hire you can book online.',
    seo: {
      title: `${name} — Truck Hire & Freight ${c.name}`,
      description: `Book trucks, tippers and freight online with ${name}. Instant ${c.currency} quotes.`,
      keywords: base.seo.keywords,
    },
    // never inherit another company's identity or claims
    contact: { phone: '', whatsapp: '', email: '', address: '', hours: 'Mon–Fri 07:00–18:00', mapEmbedUrl: undefined },
    social: {},
    stats: [],
    testimonials: [],
    promotions: [],
  });
  t.social = {};
  t.credentials = [];
  delete t.contact.mapEmbedUrl;
  delete t.logoUrl;
  return t;
}
