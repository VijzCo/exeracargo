import type { CountryCode, LogisticsSettings, FreightService } from '../types';

const SERVICES: FreightService[] = [
  { id: 'ftl', title: 'Full truckload (FTL)', description: 'A dedicated truck for your load — door to door, no transfers.', enabled: true },
  { id: 'ltl', title: 'Part-load (pallets)', description: 'Pay only for the pallets you ship. Consolidated on scheduled lanes.', enabled: true },
  { id: 'courier', title: 'Courier & parcels', description: 'Boxes and parcels collected and delivered — economy, express or same-day.', enabled: true },
  { id: 'removals', title: 'Home & office removals', description: 'Covered trucks with a loading crew, blankets and straps.', enabled: true },
];

/**
 * Indicative default rates per market. ZA rates are calibrated to 2026 benchmarks
 * (FTL R18.70–22.10/km operator cost; courier R90–200 economy ≤25 kg; LTL R350–900/pallet JHB–DBN).
 * Every tenant should review them in Admin → Site content → Logistics.
 */
export function logisticsDefaults(country: CountryCode): LogisticsSettings {
  if (country === 'ZA') {
    return {
      enabled: true,
      services: SERVICES.map((s) => ({ ...s })),
      ltl: { baseFee: 250, perPalletKm: 1.1, perKgKm: 0.0016, minCharge: 450, maxPallets: 12, palletMaxKg: 1000 },
      courier: { baseFee: 69, perKg: 3.5, perKm: 0.12, minCharge: 95, maxKg: 70 },
      volumetricDivisor: 5000,
      levels: {
        economy: { enabled: true, multiplier: 1, label: 'Economy', eta: '2–4 working days' },
        express: { enabled: true, multiplier: 1.4, label: 'Express', eta: 'Next working day' },
        sameday: { enabled: true, multiplier: 1.9, label: 'Same-day', eta: 'Within 6 hours', maxKm: 80 },
      },
      addOns: { insurancePct: 0.6, insuranceMin: 150, tailLift: 450, helperPerPerson: 450, afterHours: 650 },
      crossBorder: {
        enabled: true,
        countries: ['LS', 'SZ', 'BW', 'NA', 'ZW', 'MZ'],
        borderFee: 1850,
        docsFee: 1250,
        waitingPerHour: 650,
        zeroRateVat: true,
        note: 'Exports are zero-rated for VAT with valid proof of export. Border waiting is estimated from typical delays and finalised on delivery.',
      },
      ftlTypes: ['bakkie', 'lorry', 'tautliner', 'superlink', 'flatbed', 'reefer', 'container', 'prime-mover', 'lowbed'],
      removalsTypes: ['bakkie', 'lorry', 'van'],
    };
  }
  return {
    enabled: true,
    services: SERVICES.map((s) => ({ ...s })),
    ltl: { baseFee: 2500, perPalletKm: 85, perKgKm: 0.12, minCharge: 6500, maxPallets: 10, palletMaxKg: 1000 },
    courier: { baseFee: 450, perKg: 120, perKm: 6, minCharge: 750, maxKg: 50 },
    volumetricDivisor: 5000,
    levels: {
      economy: { enabled: true, multiplier: 1, label: 'Economy', eta: '1–3 days' },
      express: { enabled: true, multiplier: 1.35, label: 'Express', eta: 'Next day' },
      sameday: { enabled: true, multiplier: 1.8, label: 'Same-day', eta: 'Within 6 hours', maxKm: 60 },
    },
    addOns: { insurancePct: 0.5, insuranceMin: 1500, tailLift: 3500, helperPerPerson: 3000, afterHours: 4000 },
    crossBorder: { enabled: false, countries: [], borderFee: 0, docsFee: 0, waitingPerHour: 0, zeroRateVat: false, note: '' },
    ftlTypes: ['lorry', 'flatbed', 'container', 'prime-mover', 'lowbed', 'van'],
    removalsTypes: ['lorry', 'van'],
  };
}
