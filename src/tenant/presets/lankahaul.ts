import type { TenantConfig } from '../types';
import { logisticsDefaults } from './logistics';
import { COUNTRIES } from '../../geo/countries';

export const SL_DISTRICTS = COUNTRIES.LK.regions;

/** Flagship demo tenant. Every other preset is a deep-merge over this. */
export const lankahaul: TenantConfig = {
  id: 'lankahaul',
  name: 'LankaHaul',
  tagline: 'Tippers & trucks, island-wide. Booked in 60 seconds.',
  logoText: 'LankaHaul',
  domains: ['lankahaul.web.app', 'lankahaul.firebaseapp.com'],
  theme: {
    mode: 'dark',
    primary: '#F5A524',
    accent: '#2DD4BF',
    bg: '#0B0F14',
    surface: '#141B23',
    text: '#EEF2F6',
    muted: '#93A1B1',
    radius: 14,
    font: 'Barlow',
    hero3d: 'tipper',
  },
  contact: {
    phone: '+94 77 123 4567',
    whatsapp: '94771234567',
    email: 'bookings@lankahaul.lk',
    address: 'No. 42, Baseline Road, Colombo 09, Sri Lanka',
    hours: 'Mon–Sat 6:00–20:00 · Sun on request',
    mapEmbedUrl: 'https://www.google.com/maps?q=Baseline+Road+Colombo+09&output=embed',
  },
  social: { facebook: 'https://facebook.com/', instagram: 'https://instagram.com/', tiktok: 'https://tiktok.com/' },
  locale: { country: 'LK', currency: 'LKR', languages: ['en', 'si', 'ta'], defaultLang: 'en' },
  hero: {
    eyebrow: 'Sri Lanka’s on-demand haulage network',
    title: 'Move sand, metal, soil and cargo — without the phone tag.',
    subtitle:
      'GPS-tracked tippers from 2.5 to 16 cube, lorries and container prime movers. Upfront quotes, licensed drivers and permit-ready loads across all 25 districts.',
    ctaPrimary: 'Book a vehicle',
    ctaSecondary: 'Get instant quote',
    badges: ['Upfront LKR pricing', 'Same-day dispatch', 'Insured loads', 'WhatsApp updates'],
  },
  stats: [
    { label: 'Vehicles on network', value: 60, suffix: '+' },
    { label: 'Trips completed', value: 12500, suffix: '+' },
    { label: 'Districts served', value: 25 },
    { label: 'On-time arrival', value: 97, suffix: '%' },
  ],
  services: [
    { id: 'sand', title: 'Sand delivery', description: 'River and sea-washed sand delivered by the cube to site, with permit-compliant loads.', icon: 'sand', priceFrom: 9500, unit: 'per trip' },
    { id: 'metal', title: 'Metal & aggregate', description: '¾”, ½”, quarry dust and ABC from partner quarries — tipped exactly where you need it.', icon: 'metal', priceFrom: 9000, unit: 'per trip' },
    { id: 'soil', title: 'Soil & earth filling', description: 'Gravel, red soil and filling for land development, plots and road bases.', icon: 'soil', priceFrom: 8500, unit: 'per trip' },
    { id: 'debris', title: 'Debris removal', description: 'Construction waste and demolition debris cleared and disposed at approved sites.', icon: 'debris', priceFrom: 7500, unit: 'per trip' },
    { id: 'moving', title: 'House & office moving', description: 'Covered lorries with loading crew for homes, offices and stores.', icon: 'moving', priceFrom: 6500, unit: 'per trip' },
    { id: 'container', title: 'Container transport', description: '20ft / 40ft containers between Colombo Port, BOI zones and warehouses.', icon: 'container', priceFrom: 28000, unit: 'per move' },
    { id: 'machinery', title: 'Machinery lowbed', description: 'Excavators, rollers and generators moved safely on lowbed trailers.', icon: 'machinery', priceFrom: 35000, unit: 'per move' },
    { id: 'contract', title: 'Project contracts', description: 'Dedicated fleet on monthly contract for contractors and developers, with consolidated invoicing.', icon: 'contract' },
  ],
  fleet: [
    { id: 'tip-2-5', name: 'Mini Tipper 2.5 Cube', type: 'tipper', capacity: 2.5, capacityUnit: 'cube', features: ['Narrow lanes', 'Residential sites', 'Quick turnaround'], baseFare: 3500, perKm: 180, perDay: 18000, available: true },
    { id: 'tip-4', name: 'Tipper 4 Cube', type: 'tipper', capacity: 4, capacityUnit: 'cube', features: ['Most popular', 'Sand · metal · soil', 'Hydraulic tip'], baseFare: 5000, perKm: 240, perDay: 28000, available: true },
    { id: 'tip-10', name: 'Tipper 10 Cube', type: 'tipper', capacity: 10, capacityUnit: 'cube', features: ['Bulk filling', '6-wheel', 'Site-to-site'], baseFare: 9000, perKm: 380, perDay: 55000, available: true },
    { id: 'tip-16', name: 'Heavy Tipper 16 Cube', type: 'tipper', capacity: 16, capacityUnit: 'cube', features: ['10-wheel', 'Infrastructure projects', 'Quarry runs'], baseFare: 14000, perKm: 520, perDay: 78000, available: true },
    { id: 'lor-7', name: 'Mini Lorry 7 ft', type: 'van', capacity: 0.75, capacityUnit: 'ton', features: ['Tata Ace class', 'Appliances & parcels', 'City runs'], baseFare: 3000, perKm: 120, perDay: 14000, available: true },
    { id: 'lor-10', name: 'Lorry 10 ft', type: 'lorry', capacity: 1.5, capacityUnit: 'ton', features: ['Covered or open', 'Small moves', 'Retail deliveries'], baseFare: 3500, perKm: 150, perDay: 18000, available: true },
    { id: 'lor-14', name: 'Lorry 14.5 ft', type: 'lorry', capacity: 3, capacityUnit: 'ton', features: ['Covered body', 'House moving', 'Loading crew optional'], baseFare: 4500, perKm: 250, perDay: 24000, available: true },
    { id: 'lor-16', name: 'Lorry 16.5 ft', type: 'lorry', capacity: 6, capacityUnit: 'ton', features: ['Office moves', 'Hardware stock', 'Tail-lift option'], baseFare: 6000, perKm: 320, perDay: 32000, available: true },
    { id: 'lor-20', name: 'Lorry 20 ft', type: 'lorry', capacity: 15, capacityUnit: 'ton', features: ['3-axle', 'Pallets & FMCG', 'Island-wide'], baseFare: 8000, perKm: 420, perDay: 42000, available: true },
    { id: 'flat-40', name: 'Flatbed 40 ft', type: 'flatbed', capacity: 25, capacityUnit: 'ton', features: ['Steel & timber', 'Side-loading', 'Strapping supplied'], baseFare: 15000, perKm: 520, available: true },
    { id: 'pm-40', name: 'Prime Mover + 40 ft', type: 'container', capacity: 40, capacityUnit: 'ft', features: ['Port clearance runs', 'BOI zones', 'Night moves'], baseFare: 18000, perKm: 650, available: true },
    { id: 'lowbed', name: 'Lowbed Trailer', type: 'lowbed', capacity: 40, capacityUnit: 'ton', features: ['Excavators & rollers', 'Escort on request', 'Permits handled'], baseFare: 25000, perKm: 850, available: true },
  ],
  serviceAreas: SL_DISTRICTS,
  logistics: logisticsDefaults('LK'),
  credentials: [
    { title: 'Insured loads', detail: 'Goods-in-transit and third-party cover on every vehicle.', icon: 'shield' },
    { title: 'Permit-ready', detail: 'GSMB-compliant sand and soil loads when we source the material.', icon: 'check' },
    { title: 'Licensed drivers', detail: 'Heavy-vehicle licences and background checks for all drivers.', icon: 'contract' },
  ],
  promotions: [
    { id: 'first', title: '10% off your first booking', description: 'New customers save on any tipper or lorry booked online this month.', code: 'FIRST10', discountPct: 10, validUntil: '2026-12-31', badge: 'New customers', active: true },
    { id: 'bulk', title: 'Contractor bulk rate', description: 'Book 5+ trips on the same job and save 12% on every load.', code: 'BULK12', discountPct: 12, validUntil: '2027-03-31', badge: 'Contractors', active: true },
    { id: 'night', title: 'Off-peak night moves', description: 'Container and lowbed moves between 22:00 and 05:00 at 8% less.', code: 'NIGHT8', discountPct: 8, validUntil: '2027-01-31', badge: 'Logistics', active: true },
  ],
  insights: [],
  testimonials: [
    { name: 'Ruwan P.', role: 'Site engineer, Kurunegala', quote: 'Booked three 10-cube loads before breakfast and got WhatsApp updates for every trip. No more chasing drivers.', rating: 5 },
    { name: 'Shalini F.', role: 'Homeowner, Dehiwala', quote: 'The mini tipper fit down our lane and the price was exactly what the quote said.', rating: 5 },
    { name: 'M. Rizwan', role: 'Operations, BOI exporter', quote: 'Reliable container moves from the port with clear status at every step.', rating: 4 },
  ],
  faqs: [
    { q: 'How is my price calculated?', a: 'Each vehicle has a fixed call-out fare plus a per-km rate for the loaded distance. Multiple trips are multiplied, promo codes are applied, and VAT is shown separately. Material cost is not included unless you ask us to source it.' },
    { q: 'How many cubes do I need?', a: 'One cube is 100 cubic feet. A typical single-storey house foundation uses 8–12 cubes of metal and sand combined. Not sure? Send us your BOQ on WhatsApp and we’ll size it.' },
    { q: 'Do you handle sand transport permits?', a: 'Sand loads are carried with the transport permit issued for the source. When we source the sand for you, permit-compliant loads are part of the service.' },
    { q: 'Can I book for today?', a: 'Yes — same-day dispatch is available subject to vehicle availability. Online bookings need at least 3 hours’ notice; for urgent jobs, call or WhatsApp us.' },
    { q: 'How do I pay?', a: 'Cash on delivery, bank transfer or card. Contract customers get monthly invoicing.' },
  ],
  booking: {
    enabled: true,
    minNoticeHours: 3,
    loadTypes: ['Sand', 'Metal / aggregate', 'Soil / gravel', 'Debris', 'Household goods', 'Pallets / cartons', 'Container', 'Machinery', 'Other'],
    taxPct: 18,
    depositPct: 0,
    paymentNote: 'Pay on delivery by cash, card or bank transfer. Final price is confirmed by our dispatcher before dispatch.',
    whatsappConfirm: true,
    roundTrip: true,
    fuelSurchargePct: 0,
    notices: [
      'Sand, metal and soil cannot be transported on school days between 06:30–07:45 and 11:30–14:30. Those slots are blocked automatically.',
      'Rates are indicative and based on current fuel prices. Your dispatcher confirms the final price before dispatch.',
      'Loads stay within legal axle limits. No overloading.',
    ],
    restrictedWindows: {
      loadTypes: ['Sand', 'Metal / aggregate', 'Soil / gravel'],
      weekdaysOnly: true,
      windows: [
        { start: '06:30', end: '07:45' },
        { start: '11:30', end: '14:30' },
      ],
    },
  },
  seo: {
    title: 'LankaHaul — Tipper & Lorry Hire in Sri Lanka | Online Booking',
    description: 'Book tippers (2.5–16 cube), lorries, flatbeds and container prime movers across Sri Lanka. Instant LKR quotes, same-day dispatch, WhatsApp tracking.',
    keywords: 'tipper hire sri lanka, lorry hire colombo, sand delivery, metal delivery, container transport sri lanka, lowbed hire',
  },
  sections: {
    order: ['hero', 'stats', 'services', 'logistics', 'fleet', 'promotions', 'trust', 'process', 'insights', 'areas', 'testimonials', 'faq', 'cta'],
    hidden: [],
  },
  features: { insights: true, promotions: true, tracking: true, languageSwitcher: true },
};
