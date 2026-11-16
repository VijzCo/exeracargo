import type { CountryCode, CountryInfo, CrossBorderCode } from './types';

export const COUNTRIES: Record<CountryCode, CountryInfo> = {
  LK: {
    code: 'LK',
    name: 'Sri Lanka',
    currency: 'LKR',
    currencySymbol: 'Rs',
    numberLocale: 'en-LK',
    timeZone: 'Asia/Colombo',
    dialCode: '94',
    nsnLength: 9,
    phonePlaceholder: '077 123 4567',
    defaultTaxPct: 18,
    taxLabel: 'VAT',
    regionLabel: 'District',
    regions: [
      'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota',
      'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
      'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
    ],
    roadFactor: 1.35,
    sameTownKm: 8,
    distanceUnit: 'km',
  },
  ZA: {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    currencySymbol: 'R',
    numberLocale: 'en-ZA',
    timeZone: 'Africa/Johannesburg',
    dialCode: '27',
    nsnLength: 9,
    phonePlaceholder: '082 123 4567',
    defaultTaxPct: 15,
    taxLabel: 'VAT',
    regionLabel: 'Province',
    regions: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Mpumalanga', 'Limpopo', 'North West', 'Northern Cape'],
    roadFactor: 1.2,
    sameTownKm: 12,
    distanceUnit: 'km',
  },
};

export const CROSS_BORDER_NAMES: Record<CrossBorderCode, string> = {
  LS: 'Lesotho',
  SZ: 'Eswatini',
  BW: 'Botswana',
  NA: 'Namibia',
  ZW: 'Zimbabwe',
  MZ: 'Mozambique',
  ZM: 'Zambia',
};

export function countryInfo(code: CountryCode | undefined): CountryInfo {
  return COUNTRIES[code ?? 'LK'] ?? COUNTRIES.LK;
}

// ── phone helpers (country-aware) ────────────────────────────

/** Normalise a local or international number to +<dial><nsn>. Returns trimmed input if it can't be parsed. */
export function normalisePhone(input: string, country: CountryCode): string {
  const c = countryInfo(country);
  const d = (input || '').replace(/\D/g, '');
  if (d.startsWith(c.dialCode) && d.length === c.dialCode.length + c.nsnLength) return `+${d}`;
  if (d.startsWith('0') && d.length === c.nsnLength + 1) return `+${c.dialCode}${d.slice(1)}`;
  if (d.length === c.nsnLength) return `+${c.dialCode}${d}`;
  // foreign numbers (e.g. cross-border consignee) — keep if it looks international
  if ((input || '').trim().startsWith('+') && d.length >= 8 && d.length <= 15) return `+${d}`;
  return (input || '').trim();
}

/** Valid if it normalises to the tenant's country format, or to any E.164 number when `allowForeign`. */
export function isValidPhone(input: string, country: CountryCode, allowForeign = false): boolean {
  const c = countryInfo(country);
  const n = normalisePhone(input, country).replace(/\D/g, '');
  if (new RegExp(`^${c.dialCode}\\d{${c.nsnLength}}$`).test(n)) return true;
  return allowForeign && /^\d{8,15}$/.test(n) && (input || '').trim().startsWith('+');
}
