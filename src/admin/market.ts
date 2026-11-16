// Admin-side market helpers: country switching defaults, money formatting for a
// draft (which may differ from the live tenant), and shared option lists.
import { COUNTRIES, countryInfo, getPlaces, type CountryCode, type CountryInfo } from '../geo';
import type { Lang, ServiceIcon, TenantConfig, VehicleType } from '../tenant/types';
import { logisticsDefaults } from '../tenant/presets/logistics';

export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export const COUNTRY_OPTIONS: { value: CountryCode; label: string }[] = COUNTRY_CODES.map((c) => ({
  value: c,
  label: `${COUNTRIES[c].name} (${COUNTRIES[c].currency})`,
}));

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'si', label: 'සිංහල (Sinhala)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'zu', label: 'isiZulu' },
];
export const langLabel = (l: Lang) => LANG_OPTIONS.find((o) => o.value === l)?.label ?? l;

export const DEFAULT_LANGS: Record<CountryCode, Lang[]> = {
  LK: ['en', 'si', 'ta'],
  ZA: ['en', 'af', 'zu'],
};

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'tipper', label: 'Tipper' },
  { value: 'lorry', label: 'Lorry' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'lowbed', label: 'Low-bed' },
  { value: 'prime-mover', label: 'Prime mover' },
  { value: 'container', label: 'Container truck' },
  { value: 'van', label: 'Van' },
  { value: 'bakkie', label: 'Bakkie (LDV)' },
  { value: 'tautliner', label: 'Tautliner (curtain-side)' },
  { value: 'superlink', label: 'Superlink (interlink)' },
  { value: 'reefer', label: 'Reefer (refrigerated)' },
];
export const vehicleTypeLabel = (t: VehicleType) => VEHICLE_TYPES.find((o) => o.value === t)?.label ?? t;

export const SERVICE_ICONS: { value: ServiceIcon; label: string }[] = [
  { value: 'sand', label: 'Sand' },
  { value: 'metal', label: 'Metal / aggregate' },
  { value: 'soil', label: 'Soil / gravel' },
  { value: 'debris', label: 'Debris removal' },
  { value: 'moving', label: 'Moving / household' },
  { value: 'container', label: 'Container' },
  { value: 'machinery', label: 'Machinery' },
  { value: 'contract', label: 'Contract hire' },
  { value: 'island', label: 'Nationwide / island-wide' },
  { value: 'freight', label: 'Freight (FTL)' },
  { value: 'pallet', label: 'Pallets / part-load' },
  { value: 'parcel', label: 'Parcels / courier' },
  { value: 'express', label: 'Express' },
  { value: 'crossborder', label: 'Cross-border' },
  { value: 'warehouse', label: 'Warehousing' },
  { value: 'reefer', label: 'Refrigerated' },
];

/** Money formatter for a country (mirrors TenantProvider.fmtMoney, but for a draft). */
export function moneyFormatter(country: CountryCode | CountryInfo | undefined): (n: number) => string {
  const c = typeof country === 'object' ? country : countryInfo(country);
  const nf = new Intl.NumberFormat(c.numberLocale, { maximumFractionDigits: 0 });
  return (n: number) => `${c.currencySymbol} ${nf.format(Math.round(Number.isFinite(n) ? n : 0))}`;
}

/** Number of bookable home-country towns for a set of service areas. */
export function bookableTownCount(country: CountryCode, regions: string[]): number {
  return regions.length ? getPlaces(country, { regions }).length : 0;
}

/**
 * Re-target a config to another home market: locale, currency, default VAT,
 * languages and service areas. Prices are NOT converted (owner must review).
 * Cross-border freight is only offered from ZA, so it is switched off elsewhere.
 */
export function applyMarket(cfg: TenantConfig, code: CountryCode): TenantConfig {
  const c = countryInfo(code);
  const languages = DEFAULT_LANGS[code];
  // rates are currency-specific: start from the market's defaults and let the owner review
  const logistics = logisticsDefaults(code);
  return {
    ...cfg,
    locale: { ...cfg.locale, country: code, currency: c.currency, languages, defaultLang: 'en' },
    booking: { ...cfg.booking, taxPct: c.defaultTaxPct },
    serviceAreas: [...c.regions],
    logistics,
  };
}

/** Section keys stored in older configs may miss newer keys: append them (visible) in default order. */
export function normaliseSectionOrder<K extends string>(order: readonly K[] | undefined, known: readonly K[]): K[] {
  const valid = (order ?? []).filter((k, i, a) => known.includes(k) && a.indexOf(k) === i);
  return [...valid, ...known.filter((k) => !valid.includes(k))];
}
