import type { TenantConfig } from '../types';
import { logisticsDefaults } from './logistics';
import { COUNTRIES } from '../../geo/countries';
import { insightsZA } from './insights-za';

/**
 * Exera Cargo — flagship South Africa site: tippers + trucks + freight + SADC cross-border.
 * Rates are indicative 2026 benchmarks (see docs/za-market-research.md) — every client must set their own.
 */
export const exera: TenantConfig = {
  id: 'exera',
  name: 'Exera Cargo',
  tagline: 'Tippers, trucks and freight across South Africa and SADC — priced in seconds.',
  logoText: 'Exera Cargo',
  domains: ['exeracargo.web.app', 'exeracargo.firebaseapp.com'],
  theme: {
    mode: 'dark',
    primary: '#FFB61E',
    accent: '#3B82F6',
    bg: '#0A0F1C',
    surface: '#121A2B',
    text: '#EEF2F8',
    muted: '#93A0B4',
    radius: 12,
    font: 'Montserrat',
    hero3d: 'convoy',
  },
  contact: {
    phone: '+27 82 000 0000',
    whatsapp: '27820000000',
    email: 'bookings@exeracargo.example',
    address: 'Isando Industrial, Kempton Park, Gauteng',
    hours: 'Mon–Fri 06:00–19:00 · Sat 07:00–13:00 · 24/7 freight desk',
    mapEmbedUrl: 'https://www.google.com/maps?q=Isando,+Kempton+Park&output=embed',
  },
  social: { facebook: 'https://facebook.com/', instagram: 'https://instagram.com/', linkedin: 'https://linkedin.com/' },
  locale: { country: 'ZA', currency: 'ZAR', languages: ['en', 'af', 'zu'], defaultLang: 'en' },
  hero: {
    eyebrow: 'Tippers · Trucks · Freight · SADC cross-border',
    title: 'From one load of sand to a superlink to Maseru — priced in seconds.',
    subtitle:
      'Book tippers, bakkies and trucks, ship pallets and parcels, or move full loads across the border. Every quote shows fuel, VAT and border fees up front. Town-to-town, all 9 provinces.',
    ctaPrimary: 'Get a price',
    ctaSecondary: 'Instant quote',
    badges: ['All-in pricing incl. VAT', 'Live status & WhatsApp updates', 'GIT-insured loads', 'Cross-border desk'],
  },
  stats: [
    { label: 'Vehicle classes', value: 11 },
    { label: 'Towns covered', value: 180, suffix: '+' },
    { label: 'Provinces', value: 9 },
    { label: 'SADC countries', value: 6 },
  ],
  services: [
    { id: 'sand', title: 'Sand & stone delivery', description: 'Building and plaster sand, crusher stone, G5 fill — tipped on site by 6, 10 or 18 cube tipper.', icon: 'sand', priceFrom: 1800, unit: 'per 10 m³ load' },
    { id: 'debris', title: 'Rubble removal', description: 'Builders’ rubble cleared and taken to a licensed tip site. Tip fees shown before you book.', icon: 'debris', priceFrom: 650, unit: 'per bakkie load' },
    { id: 'ftl', title: 'Full truckload', description: 'Dedicated 8-ton, tri-axle or superlink — JHB–DBN, JHB–CPT and every lane between.', icon: 'freight', priceFrom: 18, unit: 'per km', href: '/book?mode=freight&service=ftl' },
    { id: 'ltl', title: 'Part-load pallets', description: 'Ship 1–12 pallets without paying for the whole truck. Consolidated on scheduled lanes.', icon: 'pallet', priceFrom: 450, unit: 'per pallet', href: '/book?mode=freight&service=ltl' },
    { id: 'courier', title: 'Courier & express', description: 'Parcels up to 70 kg — economy, next-day or same-day in metro areas.', icon: 'parcel', priceFrom: 95, unit: 'per parcel', href: '/book?mode=freight&service=courier' },
    { id: 'crossborder', title: 'Cross-border SADC', description: 'Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique — permits, docs checklist and border-wait estimates.', icon: 'crossborder', href: '/book?mode=freight&service=ftl' },
    { id: 'removals', title: 'Removals', description: 'Home and office moves with crew, blankets and straps — local or long-distance.', icon: 'moving', priceFrom: 1950, unit: 'per local move', href: '/book?mode=freight&service=removals' },
    { id: 'machinery', title: 'Plant & lowbed', description: 'TLBs, excavators and rollers moved on lowbeds — abnormal-load permits arranged.', icon: 'machinery', priceFrom: 6500, unit: 'per move' },
  ],
  fleet: [
    { id: 'bakkie-1t', name: 'Bakkie 1-ton', type: 'bakkie', capacity: 1, capacityUnit: 'ton', features: ['Rubble & small moves', 'Same-day courier', 'Metro runs'], baseFare: 450, perKm: 9.5, perDay: 1950, available: true },
    { id: 'truck-4t', name: '4-ton Truck', type: 'lorry', capacity: 4, capacityUnit: 'ton', features: ['Closed or dropside', 'Removals', 'Tail-lift option'], baseFare: 950, perKm: 14, perDay: 3800, available: true },
    { id: 'truck-8t', name: '8-ton Rigid', type: 'lorry', capacity: 8, capacityUnit: 'ton', features: ['Tautliner body', 'Palletised freight', 'Regional lanes'], baseFare: 1450, perKm: 18, perDay: 5600, available: true },
    { id: 'reefer-8t', name: '8-ton Reefer', type: 'reefer', capacity: 8, capacityUnit: 'ton', features: ['−25 °C to +15 °C', 'Food & pharma', 'Temp logging'], baseFare: 1850, perKm: 21, available: true },
    { id: 'tri-axle', name: 'Tri-axle Tautliner', type: 'tautliner', capacity: 30, capacityUnit: 'ton', features: ['30 t payload', '28 pallets', 'National lanes'], baseFare: 3000, perKm: 26, available: true },
    { id: 'superlink', name: 'Superlink 34 t', type: 'superlink', capacity: 34, capacityUnit: 'ton', features: ['34 t payload', '36 pallets', 'JHB–DBN–CPT'], baseFare: 3500, perKm: 28, available: true },
    { id: 'flatdeck', name: 'Superlink Flatdeck', type: 'flatbed', capacity: 34, capacityUnit: 'ton', features: ['Steel & timber', 'Bricks & blocks', 'Side-loading'], baseFare: 3500, perKm: 28, available: true },
    { id: 'tip-6', name: 'Tipper 6 Cube', type: 'tipper', capacity: 6, capacityUnit: 'cube', features: ['Residential sites', 'Sand & stone', 'Rubble'], baseFare: 950, perKm: 18, perDay: 3400, available: true },
    { id: 'tip-10', name: 'Tipper 10 Cube', type: 'tipper', capacity: 10, capacityUnit: 'cube', features: ['Most popular', '6×4', 'Earthworks'], baseFare: 1350, perKm: 22, perDay: 4420, available: true },
    { id: 'tip-18', name: 'Side Tipper 18 Cube', type: 'tipper', capacity: 18, capacityUnit: 'cube', features: ['Bulk aggregate', 'Coal & mining', 'Quarry runs'], baseFare: 2200, perKm: 28, perDay: 6900, available: true },
    { id: 'lowbed', name: 'Lowbed', type: 'lowbed', capacity: 40, capacityUnit: 'ton', features: ['TLBs & excavators', 'Abnormal permits', 'Escort on request'], baseFare: 6500, perKm: 38, available: true },
  ],
  serviceAreas: COUNTRIES.ZA.regions,
  logistics: logisticsDefaults('ZA'),
  credentials: [
    { title: 'RTMS-aligned operations', detail: 'Load, driver-wellness and vehicle checks to the Road Transport Management System standard.', icon: 'shield' },
    { title: 'Goods-in-transit cover', detail: 'GIT insurance on every load; higher cover on request.', icon: 'check' },
    { title: 'C-BRTA cross-border permits', detail: 'Permitted for Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique.', icon: 'globe' },
    { title: 'VAT invoices & 30-day accounts', detail: 'Business accounts with PO numbers and monthly statements.', icon: 'contract' },
  ],
  promotions: [
    { id: 'first', title: '10% off your first load', description: 'New customers save on any tipper, truck or freight booking made online.', code: 'FIRSTLOAD', discountPct: 10, validUntil: '2027-01-31', badge: 'New customers', active: true },
    { id: 'site', title: 'Site bundle — 5+ loads', description: 'Book 5 or more tipper loads for the same site and save 12% on every load.', code: 'SITE12', discountPct: 12, validUntil: '2027-03-31', badge: 'Contractors', active: true },
    { id: 'lesotho', title: 'Maseru & Maputsoe lanes', description: 'Part-load and FTL into Lesotho at 8% less this quarter.', code: 'LESOTHO8', discountPct: 8, validUntil: '2027-02-28', badge: 'Cross-border', active: true },
  ],
  insights: insightsZA,
  testimonials: [],
  faqs: [
    { q: 'What’s included in the price?', a: 'Call-out, distance, the monthly fuel surcharge and 15% VAT are all shown before you book. Optional extras — insurance top-up, tail-lift, helpers, after-hours — are itemised. Tolls and tip-site fees are passed through at cost.' },
    { q: 'How many cubes do I need?', a: 'Tipper bodies are measured in cubic metres. A 6-cube tipper carries about 6 m³ of sand, a 10-cube about 10 m³. Measure length × width × depth in metres and add 10% for compaction.' },
    { q: 'Can you deliver into Lesotho or other SADC countries?', a: 'Yes. Choose a destination town in Lesotho, Eswatini, Botswana, Namibia, Zimbabwe or Mozambique. We show the border post, typical waiting time and the document checklist. Exports are zero-rated for VAT with proof of export.' },
    { q: 'Is my load insured?', a: 'Every load carries goods-in-transit cover. Declare the value at booking to top up cover for high-value goods.' },
    { q: 'How do I pay?', a: 'EFT, card or Instant EFT. Business customers can apply for 30-day accounts with VAT invoices and PO numbers.' },
    { q: 'Do you move dangerous goods?', a: 'Hazchem loads need DG-certified drivers and vehicles. Please call our freight desk — they cannot be booked online.' },
  ],
  booking: {
    enabled: true,
    minNoticeHours: 2,
    loadTypes: ['Building sand', 'Plaster sand', 'Crusher stone / aggregate', 'G5 / G7 fill', 'Topsoil', 'Rubble', 'Furniture', 'Pallets / general', 'Machinery', 'Other'],
    taxPct: 15,
    depositPct: 0,
    paymentNote: 'Pay by EFT, card or Instant EFT. Prices include VAT; tolls and tip fees are passed through at cost. Your dispatcher confirms the final price before dispatch.',
    whatsappConfirm: true,
    roundTrip: true,
    fuelSurchargePct: 4.5,
    notices: [
      'Fuel surcharge is reviewed monthly when the diesel price changes (first Wednesday of the month).',
      'Loads stay within legal mass limits. Abnormal loads need a permit — allow 3 working days.',
      'Waiting time beyond 1 hour at loading or delivery is charged per hour.',
    ],
    restrictedWindows: { loadTypes: [], weekdaysOnly: true, windows: [] },
  },
  story: {
    eyebrow: 'Our story',
    title: 'Built by people who move South Africa’s loads',
    body: `Exera Cargo started with a simple frustration: customers waiting on a truck that “is on its way”, with no one able to say where it actually was. We set out to run haulage the way it should be run — on time, on record and on the phone when you need us.

Today we move sand, stone and rubble with our tippers, run dedicated trucks and part-loads across Gauteng and the provinces, and take freight across the border into Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique. Every job is dispatched, tracked and closed with photo and signature proof of delivery, so you always know what happened to your load.

We are a South African business that hires and trains locally, works with vetted owner-drivers and transport partners, and keeps every truck we send compliant, insured and roadworthy.`,
    values: [
      { title: 'On time, on record', text: 'Live status from dispatch to delivery, with photo + signature POD on every load.' },
      { title: 'Safety first', text: 'Daily pre-trip inspections, trained drivers and no phone use while driving.' },
      { title: 'Straight pricing', text: 'All-in quotes in rand up front — waiting time and extras agreed before we roll.' },
      { title: 'Across the border', text: 'SADC cross-border runs with the right permits, paperwork and border know-how.' },
    ],
  },
  legal: {
    legalName: 'Exera Cargo (Pty) Ltd',
    jurisdiction: 'Gauteng Division of the High Court, Johannesburg',
    payTermsDays: 30,
  },
  seo: {
    title: 'Exera Cargo — Tipper Hire, Truck Hire & Freight South Africa | Instant Quotes',
    description: 'Book tippers (6–18 cube), bakkies, 8-ton and superlink trucks, part-load pallets, courier and cross-border freight to Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique. Instant all-in ZAR quotes.',
    keywords: 'tipper hire johannesburg, truck hire south africa, freight quote, part load pallets, cross border trucking lesotho, rubble removal, sand delivery',
  },
  sections: {
    order: ['hero', 'stats', 'services', 'logistics', 'fleet', 'trust', 'story', 'promotions', 'process', 'insights', 'areas', 'faq', 'cta'],
    hidden: [],
  },
  features: { insights: true, promotions: true, tracking: true, languageSwitcher: true },
};
