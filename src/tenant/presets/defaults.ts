import type { TenantConfig } from '../types';
import { SL_DISTRICTS } from './lankahaul';
import { logisticsDefaults } from './logistics';

/**
 * Neutral structural defaults. Stored tenant docs are merged over THIS (never over another
 * tenant's preset), so no brand content, phone numbers or maps can leak between tenants,
 * and fields a tenant clears stay cleared.
 */
export const TENANT_DEFAULTS: TenantConfig = {
  id: '',
  name: '',
  tagline: '',
  logoText: '',
  domains: [],
  theme: {
    mode: 'dark',
    primary: '#F5A524',
    accent: '#2DD4BF',
    bg: '#0B0F14',
    surface: '#141B23',
    text: '#EEF2F6',
    muted: '#93A1B1',
    radius: 14,
    font: 'Inter',
    hero3d: 'tipper',
  },
  contact: { phone: '', whatsapp: '', email: '', address: '', hours: '' },
  social: {},
  locale: { country: 'LK', currency: 'LKR', languages: ['en', 'si', 'ta'], defaultLang: 'en' },
  hero: { eyebrow: '', title: '', subtitle: '', ctaPrimary: 'Book a vehicle', ctaSecondary: 'Get instant quote', badges: [] },
  stats: [],
  services: [],
  fleet: [],
  serviceAreas: SL_DISTRICTS,
  logistics: logisticsDefaults('LK'),
  credentials: [],
  promotions: [],
  insights: [],
  testimonials: [],
  faqs: [],
  booking: {
    enabled: true,
    minNoticeHours: 3,
    loadTypes: ['Sand', 'Metal / aggregate', 'Soil / gravel', 'Debris', 'Household goods', 'Pallets / cartons', 'Container', 'Machinery', 'Other'],
    taxPct: 18,
    depositPct: 0,
    paymentNote: 'Final price is confirmed by our dispatcher before dispatch.',
    whatsappConfirm: true,
    roundTrip: true,
    fuelSurchargePct: 0,
    notices: [],
    restrictedWindows: {
      loadTypes: ['Sand', 'Metal / aggregate', 'Soil / gravel'],
      weekdaysOnly: true,
      windows: [
        { start: '06:30', end: '07:45' },
        { start: '11:30', end: '14:30' },
      ],
    },
  },
  seo: { title: '', description: '', keywords: '' },
  sections: {
    order: ['hero', 'stats', 'services', 'logistics', 'fleet', 'promotions', 'trust', 'story', 'process', 'insights', 'areas', 'testimonials', 'faq', 'cta'],
    hidden: [],
  },
  features: { insights: true, promotions: true, tracking: true, languageSwitcher: true },
};
