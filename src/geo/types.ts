// ─────────────────────────────────────────────────────────────
// Geography contracts. A tenant operates in one home country; places are
// city/town level with coordinates so the app can estimate road distance
// without a paid maps API (Spark plan, zero cost).
// ─────────────────────────────────────────────────────────────

/** Markets the platform ships presets for. */
export type CountryCode = 'LK' | 'ZA';

/** Destination countries reachable by road cross-border freight (ISO-3166 alpha-2). */
export type CrossBorderCode = 'LS' | 'SZ' | 'BW' | 'NA' | 'ZW' | 'MZ' | 'ZM';

export type Currency = 'LKR' | 'ZAR';

export type PlaceKind = 'metro' | 'city' | 'town' | 'suburb' | 'industrial' | 'port' | 'mining' | 'border';

export interface Place {
  /** Stable slug, unique within its country file, e.g. "za-gp-johannesburg". */
  id: string;
  name: string;
  /** Province (ZA) / District (LK) / country name for cross-border towns. */
  region: string;
  country: CountryCode | CrossBorderCode;
  lat: number;
  lng: number;
  kind: PlaceKind;
  /** Alternative spellings / old names, used by search (e.g. "Witbank" for eMalahleni). */
  aliases?: string[];
}

export interface BorderPost {
  id: string;
  name: string; // e.g. "Maseru Bridge"
  from: CountryCode; // ZA
  to: CrossBorderCode; // LS
  lat: number;
  lng: number;
  hours: string; // e.g. "24 hours" / "06:00–22:00"
  /** Typical commercial crossing delay in hours (indicative). */
  typicalDelayHrs: number;
}

export interface CountryInfo {
  code: CountryCode;
  name: string;
  currency: Currency;
  currencySymbol: string; // "Rs", "R"
  numberLocale: string; // Intl locale for numbers, e.g. "en-ZA"
  timeZone: string; // IANA
  dialCode: string; // "94", "27"
  /** National significant number length after the dial code. */
  nsnLength: number;
  phonePlaceholder: string;
  defaultTaxPct: number;
  taxLabel: string; // "VAT"
  regionLabel: string; // "District" / "Province"
  regions: string[];
  /** Road-distance factor applied to great-circle distance. */
  roadFactor: number;
  /** Minimum km for a move within the same town. */
  sameTownKm: number;
  distanceUnit: 'km';
}
