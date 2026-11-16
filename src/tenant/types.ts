// ─────────────────────────────────────────────────────────────
// Exera Cargo white-label tenant schema. One TenantConfig = one website.
// Stored at Firestore `tenants/{id}`; bundled presets are the fallback.
// ─────────────────────────────────────────────────────────────
import type { CountryCode, Currency, CrossBorderCode } from '../geo/types';
export type { CountryCode, Currency, CrossBorderCode };

/** UI languages: English, Sinhala, Tamil (LK); Afrikaans, isiZulu (ZA). */
export type Lang = 'en' | 'si' | 'ta' | 'af' | 'zu';

export type SectionKey =
  | 'hero'
  | 'stats'
  | 'services'
  | 'fleet'
  | 'promotions'
  | 'process'
  | 'insights'
  | 'areas'
  | 'testimonials'
  | 'faq'
  | 'trust'
  | 'logistics'
  | 'story'
  | 'cta';

export type VehicleType =
  | 'tipper'
  | 'lorry'
  | 'flatbed'
  | 'lowbed'
  | 'prime-mover'
  | 'container'
  | 'van'
  | 'bakkie'
  | 'tautliner'
  | 'superlink'
  | 'reefer';

export type Hero3D = 'tipper' | 'truck' | 'convoy' | 'none';

export interface Theme {
  mode: 'dark' | 'light';
  primary: string; // brand colour (buttons, highlights)
  accent: string; // secondary highlight
  bg: string;
  surface: string;
  text: string;
  muted: string;
  radius: number; // px
  font: 'Inter' | 'Poppins' | 'Montserrat' | 'Barlow' | 'Manrope';
  hero3d: Hero3D;
}

export interface Contact {
  phone: string; // display + tel:
  whatsapp: string; // international digits only e.g. 94771234567
  email: string;
  address: string;
  hours: string;
  mapEmbedUrl?: string;
}

export interface Social {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
}

export type ServiceIcon =
  | 'sand' | 'metal' | 'soil' | 'debris' | 'moving' | 'container' | 'machinery' | 'contract' | 'island'
  | 'freight' | 'pallet' | 'parcel' | 'express' | 'crossborder' | 'warehouse' | 'reefer';

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: ServiceIcon;
  priceFrom?: number;
  unit?: string; // e.g. "per trip", "per cube"
  /** Optional booking deep link, e.g. "/book?mode=freight&service=ltl". Defaults to /book?service=<id>. */
  href?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: VehicleType;
  capacity: number;
  capacityUnit: 'cube' | 'ton' | 'ft';
  features: string[];
  baseFare: number; // LKR, call-out / loading
  perKm: number; // LKR per km (loaded leg)
  perDay?: number; // LKR, day hire
  available: boolean;
  imageUrl?: string;
}

export interface Credential {
  title: string; // "RTMS certified"
  detail: string; // "Certificate no. …, valid to 2027-06"
  icon: 'shield' | 'check' | 'star' | 'globe' | 'contract';
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  code?: string;
  discountPct?: number;
  validUntil?: string; // ISO date
  badge?: string;
  active: boolean;
}

export interface Insight {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string; // paragraphs separated by blank lines; lines starting "## " are headings, "- " bullets
  category: 'Market' | 'Guide' | 'Company' | 'Safety' | 'Pricing';
  date: string; // ISO
  readMins: number;
  coverUrl?: string;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  rating: number;
}

export interface Faq {
  q: string;
  a: string;
}

export interface TimeWindow {
  start: string; // HH:mm
  end: string; // HH:mm (exclusive)
}

export interface BookingSettings {
  enabled: boolean;
  minNoticeHours: number;
  loadTypes: string[];
  taxPct: number; // VAT applied on quote (0 to disable)
  depositPct: number; // informational
  paymentNote: string;
  whatsappConfirm: boolean; // show "send to WhatsApp" after booking
  roundTrip: boolean; // add empty return leg at 50% perKm
  /** Monthly diesel-index surcharge on distance charges (e.g. 6.5). 0 disables. */
  fuelSurchargePct: number;
  notices: string[]; // shown on booking page (e.g. school-hour restrictions, fuel clause)
  restrictedWindows: { loadTypes: string[]; weekdaysOnly: boolean; windows: TimeWindow[] }; // HH:mm ranges blocked for listed load types (objects: Firestore forbids nested arrays)
}

export interface TenantConfig {
  id: string; // slug, unique
  name: string;
  tagline: string;
  logoText: string; // used when no logoUrl
  logoUrl?: string;
  domains: string[]; // hostnames that resolve to this tenant
  theme: Theme;
  contact: Contact;
  social: Social;
  /** Home market. `currency` must match COUNTRIES[country].currency. */
  locale: { country: CountryCode; currency: Currency; languages: Lang[]; defaultLang: Lang };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badges: string[];
  };
  stats: { label: string; value: number; suffix?: string }[];
  services: Service[];
  fleet: Vehicle[];
  /** Regions served (Districts in LK, Provinces in ZA). Bookable towns = all towns in these regions. */
  serviceAreas: string[];
  logistics: LogisticsSettings;
  /** Verifiable credentials shown as trust badges (RTMS, GIT insurance, C-BRTA permits, B-BBEE…). */
  credentials: Credential[];
  promotions: Promotion[];
  insights: Insight[];
  testimonials: Testimonial[];
  faqs: Faq[];
  booking: BookingSettings;
  seo: { title: string; description: string; keywords: string };
  sections: { order: SectionKey[]; hidden: SectionKey[] };
  features: { insights: boolean; promotions: boolean; tracking: boolean; languageSwitcher: boolean };
  /** Company details printed in the legal documents (Terms, Privacy, agreements) + optional text overrides. */
  legal?: LegalSettings;
  /** "Our story" block on the home page. */
  story?: Story;
  updatedAt?: number;
}

export type LegalDocId = 'terms' | 'privacy' | 'driver' | 'hired' | 'booking' | 'transporter';

export interface LegalSettings {
  legalName?: string; // registered name, e.g. "Exera Cargo (Pty) Ltd"
  regNo?: string; // CIPC registration number
  vatNo?: string;
  address?: string; // registered / physical address
  email?: string; // legal & privacy contact
  infoOfficer?: string; // POPIA Information Officer (name)
  jurisdiction?: string; // e.g. "Gauteng Division of the High Court, Johannesburg"
  gitLimit?: number; // liability cap per consignment in the booking terms (rand)
  payTermsDays?: number; // transporter payment terms
  /** Replace a document's default text (Markdown-lite: "## Heading", paragraphs, "- " bullets). Changing it bumps the version. */
  overrides?: Partial<Record<LegalDocId, { body: string; version: string }>>;
}

export interface Story {
  eyebrow?: string;
  title: string;
  body: string; // paragraphs separated by blank lines
  values: { title: string; text: string }[];
}

// ── Bookings ─────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'assigned' | 'in_transit' | 'completed' | 'cancelled';

export const BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'assigned',
  'in_transit',
  'completed',
  'cancelled',
];

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  base: number;
  distance: number;
  returnLeg: number;
  /** Insurance, tail-lift, helpers, after-hours, service-level surcharge. */
  addOns: number;
  /** Cross-border fees (border + documentation). */
  border: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: Currency;
  /** Human-readable breakdown shown to customer and admin. */
  lines: QuoteLine[];
}

// ── Logistics (freight) ─────────────────────────────────────

/** ftl = full truckload (dedicated vehicle), ltl = part-load by pallet/kg, courier = parcels, removals = home/office moves. */
export type FreightKind = 'ftl' | 'ltl' | 'courier' | 'removals';
export type ServiceLevel = 'economy' | 'express' | 'sameday';

export interface FreightService {
  id: FreightKind;
  title: string;
  description: string;
  enabled: boolean;
}

export interface LogisticsSettings {
  enabled: boolean;
  services: FreightService[];
  /** Part-load pricing: max(pallets × perPalletKm, chargeableKg × perKgKm) × km + baseFee, floored at minCharge. */
  ltl: { baseFee: number; perPalletKm: number; perKgKm: number; minCharge: number; maxPallets: number; palletMaxKg: number };
  /** Parcel pricing: baseFee + perKg × chargeableKg + perKm × km, floored at minCharge. */
  courier: { baseFee: number; perKg: number; perKm: number; minCharge: number; maxKg: number };
  /** cm³ per kg for volumetric weight (5000 = industry standard road/courier). */
  volumetricDivisor: number;
  levels: Record<ServiceLevel, { enabled: boolean; multiplier: number; label: string; eta: string; maxKm?: number }>;
  addOns: {
    insurancePct: number; // % of declared value
    insuranceMin: number;
    tailLift: number;
    helperPerPerson: number;
    afterHours: number;
  };
  crossBorder: {
    enabled: boolean;
    countries: CrossBorderCode[];
    borderFee: number; // per consignment
    docsFee: number; // clearing/documentation handling
    zeroRateVat: boolean; // exports zero-rated
    /** Waiting time at the border, charged per hour × the post's typical delay (estimate, finalised on delivery). */
    waitingPerHour: number;
    note: string;
  };
  /** Fleet vehicle types offered for FTL / removals. */
  ftlTypes: VehicleType[];
  removalsTypes: VehicleType[];
}

export interface FreightDetails {
  service: FreightKind;
  level: ServiceLevel;
  packages: number; // parcels / pieces
  pallets: number;
  weightKg: number; // total actual weight
  lengthCm: number; // per package (largest)
  widthCm: number;
  heightCm: number;
  description: string;
  declaredValue: number;
  insured: boolean;
  hazardous: boolean;
  tailLift: boolean;
  helpers: number;
  afterHours: boolean;
  crossBorder?: { country: CrossBorderCode; borderPostId: string; borderPostName: string; delayHrs: number };
}

/** Town-level stop. `placeId` refers to src/geo places; `place`/`region` are denormalised for display. */
export interface Stop {
  address: string;
  placeId: string;
  place: string; // town / city
  region: string; // district / province / country
}

export interface NewBooking {
  tenantId: string;
  customer: { name: string; phone: string; email?: string; company?: string; vatNo?: string; poNumber?: string };
  /** vehicle = hire a tipper/truck; freight = logistics consignment. */
  kind: 'vehicle' | 'freight';
  /** '' when freight is LTL/courier (no dedicated vehicle). */
  vehicleId: string;
  vehicleName: string;
  serviceId?: string;
  loadType: string;
  pickup: Stop;
  dropoff: Stop;
  /** Consignee for freight deliveries. */
  recipient?: { name: string; phone: string };
  freight?: FreightDetails;
  /** Customer asked for a firm quote (FTL / cross-border); the shown price is indicative only. */
  rfq?: boolean;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  distanceKm: number;
  trips: number;
  notes?: string;
  promoCode?: string;
  quote: Quote;
  lang: Lang;
  /** Booking Terms + Privacy versions the customer accepted ("2026-11-16+2026-11-16") and when (ms). */
  termsVersion?: string;
  termsAcceptedAt?: number;
}

export interface Booking extends NewBooking {
  id: string;
  ref: string;
  status: BookingStatus;
  createdAt: number;
  updatedAt: number;
  adminNote?: string;
}

/** Public, PII-free tracking record at tenants/{t}/tracking/{ref}. */
export interface Tracking {
  ref: string;
  status: BookingStatus;
  date: string;
  time: string;
  vehicleName: string; // vehicle or freight service label
  kind: 'vehicle' | 'freight';
  pickupPlace: string;
  dropoffPlace: string;
  updatedAt: number;
  note?: string;
}

export interface ContactMessage {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  message: string;
  createdAt?: number;
}

export interface AdminProfile {
  uid: string;
  email: string;
  role: 'super' | 'tenant';
  tenants: string[]; // tenant ids this admin manages ('*' for all)
}
