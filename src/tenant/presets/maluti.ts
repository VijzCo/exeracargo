import type { TenantConfig } from '../types';
import { deepMerge } from '../merge';
import { kopano } from './kopano';

/** Second ZA demo tenant — light theme, logistics/cross-border first (Free State ↔ Lesotho corridor). */
export const maluti: TenantConfig = deepMerge(kopano, {
  id: 'maluti',
  name: 'Maluti Freight Lines',
  tagline: 'Part-load, courier and full loads between Gauteng, Free State and Lesotho.',
  logoText: 'Maluti Freight',
  domains: ['maluti.web.app', 'maluti.firebaseapp.com'],
  theme: {
    mode: 'light',
    primary: '#0F6E5C',
    accent: '#E8692B',
    bg: '#F5F6F2',
    surface: '#FFFFFF',
    text: '#101A17',
    muted: '#5A6A65',
    radius: 10,
    font: 'Manrope',
    hero3d: 'truck',
  },
  contact: {
    phone: '+27 51 000 0000',
    whatsapp: '27510000000',
    email: 'desk@maluti.example',
    address: 'Hamilton Industrial, Bloemfontein, Free State',
    hours: 'Mon–Fri 07:00–18:00 · Sat 08:00–12:00',
    mapEmbedUrl: 'https://www.google.com/maps?q=Hamilton,+Bloemfontein&output=embed',
  },
  locale: { country: 'ZA', currency: 'ZAR', languages: ['en', 'af'], defaultLang: 'en' },
  hero: {
    eyebrow: 'Bloemfontein · Maseru · Ficksburg · Johannesburg',
    title: 'Freight into Lesotho, without the border guesswork.',
    subtitle:
      'Pallets, parcels and full loads on the N1 and N8 corridors. See the border post, the paperwork and the waiting estimate before you book — then track every step.',
    ctaPrimary: 'Ship now',
    ctaSecondary: 'Quote a shipment',
    badges: ['Maseru Bridge & Ficksburg daily', 'Docs checklist included', 'VAT zero-rated exports', 'WhatsApp tracking'],
  },
  stats: [
    { label: 'Lesotho runs / week', value: 18 },
    { label: 'Pallets moved / month', value: 2400, suffix: '+' },
    { label: 'Border posts', value: 4 },
    { label: 'On-time delivery', value: 96, suffix: '%' },
  ],
  serviceAreas: ['Free State', 'Gauteng', 'North West', 'Northern Cape', 'KwaZulu-Natal'],
  promotions: [
    { id: 'pallet', title: 'Second pallet half price', description: 'On part-load to Maseru, Maputsoe and Teyateyaneng.', code: 'PALLET50', discountPct: 15, validUntil: '2027-01-31', badge: 'Part-load', active: true },
  ],
  seo: {
    title: 'Maluti Freight Lines — Freight to Lesotho | Part-load, Courier & FTL',
    description: 'Cross-border freight from Gauteng and Free State to Maseru, Maputsoe and all of Lesotho. Instant ZAR quotes with border fees and paperwork checklist.',
    keywords: 'freight to lesotho, maseru transport, part load bloemfontein, courier lesotho, cross border trucking',
  },
  sections: {
    order: ['hero', 'logistics', 'stats', 'trust', 'services', 'fleet', 'process', 'promotions', 'insights', 'areas', 'faq', 'cta'],
    hidden: [],
  },
});
