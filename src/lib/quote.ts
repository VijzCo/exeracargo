// ─────────────────────────────────────────────────────────────
// Pure pricing + scheduling helpers for the booking flow.
// No React / Firebase imports — safe to unit test in isolation.
// ─────────────────────────────────────────────────────────────
import type {
  BookingSettings,
  Currency,
  FreightDetails,
  LogisticsSettings,
  Promotion,
  Quote,
  QuoteLine,
  ServiceLevel,
  Vehicle,
} from '../tenant/types';
import { todayIn } from './time';

export type HireMode = 'trip' | 'day';

export interface QuoteArgs {
  vehicle: Vehicle;
  distanceKm: number;
  trips: number;
  settings: BookingSettings;
  currency: Currency;
  promo?: Promotion | null;
  mode?: HireMode;
  days?: number;
}

const nonNeg = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
const pct = (n: number | undefined) => Math.min(100, nonNeg(n));
const whole = (n: number) => Math.round(n);

function finish(
  parts: { base: number; distance: number; returnLeg: number; addOns: number; border: number },
  lines: QuoteLine[],
  promo: Promotion | null | undefined,
  taxPct: number,
  currency: Currency,
): Quote {
  const subtotal = parts.base + parts.distance + parts.returnLeg + parts.addOns + parts.border;
  // promos discount transport only — never government/border pass-through costs
  const discount = whole(((subtotal - parts.border) * pct(promo?.discountPct)) / 100);
  const tax = whole(((subtotal - discount) * pct(taxPct)) / 100);
  const total = subtotal - discount + tax;
  const out = lines.filter((l) => l.amount !== 0);
  if (discount) out.push({ label: `Promo ${promo?.code ?? ''} (−${pct(promo?.discountPct)}%)`.trim(), amount: -discount });
  if (tax) out.push({ label: `VAT ${pct(taxPct)}%`, amount: tax });
  return { ...parts, subtotal, discount, tax, total, currency, lines: out };
}

/**
 * Vehicle hire quote (tippers, lorries, trucks).
 * - trip: per trip = baseFare + perKm·km (+ 50% perKm·km empty return if settings.roundTrip), × trips.
 * - day (only when vehicle.perDay is set): perDay × days.
 * Discount = promo % of subtotal; tax = taxPct % of (subtotal − discount). Whole currency units.
 */
export function computeQuote({ vehicle, distanceKm, trips, settings, currency, promo, mode = 'trip', days = 1 }: QuoteArgs): Quote {
  let base = 0;
  let distance = 0;
  let returnLeg = 0;
  const lines: QuoteLine[] = [];
  if (mode === 'day' && vehicle.perDay) {
    const d = Math.max(1, Math.floor(nonNeg(days)));
    base = whole(nonNeg(vehicle.perDay) * d);
    lines.push({ label: `Day hire × ${d}`, amount: base });
  } else {
    const n = Math.max(1, Math.floor(nonNeg(trips)));
    const km = nonNeg(distanceKm);
    base = whole(nonNeg(vehicle.baseFare) * n);
    distance = whole(nonNeg(vehicle.perKm) * km * n);
    returnLeg = settings.roundTrip ? whole(nonNeg(vehicle.perKm) * km * 0.5 * n) : 0;
    lines.push({ label: `Call-out × ${n}`, amount: base });
    lines.push({ label: `${Math.round(km)} km loaded × ${n}`, amount: distance });
    lines.push({ label: 'Empty return (50%)', amount: returnLeg });
  }
  const fuel = fuelSurcharge(distance + returnLeg, settings.fuelSurchargePct, lines);
  return finish({ base, distance, returnLeg, addOns: fuel, border: 0 }, lines, promo, settings.taxPct, currency);
}

/** Diesel-index surcharge on distance-driven charges; pushes its own line. */
function fuelSurcharge(distanceCharges: number, pctValue: number | undefined, lines: QuoteLine[]): number {
  const p = pct(pctValue);
  if (!p || distanceCharges <= 0) return 0;
  const amt = whole((distanceCharges * p) / 100);
  lines.push({ label: `Fuel surcharge ${p}%`, amount: amt });
  return amt;
}

// ── Freight ──────────────────────────────────────────────────

export interface FreightQuoteArgs {
  freight: FreightDetails;
  distanceKm: number;
  logistics: LogisticsSettings;
  taxPct: number;
  fuelSurchargePct?: number;
  currency: Currency;
  /** Required for ftl / removals (dedicated vehicle). */
  vehicle?: Vehicle | null;
  promo?: Promotion | null;
}

export const MAX_EST_WAIT_HRS = 24;

/** Hard limits — mirrored in firestore.rules. */
export const FREIGHT_LIMITS = { weightKg: 40000, dimCm: 1500, declaredValue: 100_000_000, packages: 500, pallets: 40, helpers: 10, quoteTotal: 50_000_000 } as const;

/** Volumetric kg for `packages` identical boxes of L×W×H cm. */
export function volumetricKg(f: Pick<FreightDetails, 'lengthCm' | 'widthCm' | 'heightCm' | 'packages'>, divisor: number): number {
  const v = nonNeg(f.lengthCm) * nonNeg(f.widthCm) * nonNeg(f.heightCm) * Math.max(1, Math.floor(nonNeg(f.packages)));
  return divisor > 0 ? v / divisor : 0;
}

/** Billable weight = max(actual, volumetric), rounded up to 0.5 kg. */
export function chargeableKg(f: FreightDetails, divisor: number): number {
  const kg = Math.max(nonNeg(f.weightKg), volumetricKg(f, divisor));
  return Math.ceil(kg * 2) / 2;
}

export interface FreightCheck {
  ok: boolean;
  errors: string[];
}

/** Business-rule validation before quoting / booking. */
export function validateFreight(f: FreightDetails, distanceKm: number, l: LogisticsSettings, hasVehicle: boolean): FreightCheck {
  const errors: string[] = [];
  const L = FREIGHT_LIMITS;
  if (f.weightKg > L.weightKg) errors.push(`Maximum ${L.weightKg.toLocaleString()} kg per booking — split the load or call us.`);
  if (Math.max(f.lengthCm, f.widthCm, f.heightCm) > L.dimCm) errors.push(`Maximum ${L.dimCm} cm per side.`);
  if (f.declaredValue > L.declaredValue) errors.push('Declared value is too high to book online — call our freight desk.');
  if (f.packages > L.packages || f.pallets > L.pallets || f.helpers > L.helpers) errors.push('Quantity is too high to book online — call us.');
  const svc = l.services.find((s) => s.id === f.service);
  if (!svc?.enabled) errors.push('This service is not available.');
  const lvl = l.levels[f.level];
  if (!lvl?.enabled) errors.push('This delivery speed is not available.');
  if (lvl?.maxKm && distanceKm > lvl.maxKm) errors.push(`${lvl.label} is only available up to ${lvl.maxKm} km.`);
  if (f.service === 'ltl') {
    if (f.pallets < 1 && f.weightKg <= 0) errors.push('Enter pallets or total weight.');
    if (f.pallets > l.ltl.maxPallets) errors.push(`Part-load is limited to ${l.ltl.maxPallets} pallets — book a full truck instead.`);
    if (f.pallets > 0 && f.weightKg > f.pallets * l.ltl.palletMaxKg) errors.push(`Max ${l.ltl.palletMaxKg} kg per pallet.`);
  }
  if (f.service === 'courier') {
    if (f.weightKg <= 0) errors.push('Enter the parcel weight.');
    if (chargeableKg(f, l.volumetricDivisor) > l.courier.maxKg) errors.push(`Courier is limited to ${l.courier.maxKg} kg — use part-load instead.`);
  }
  if ((f.service === 'ftl' || f.service === 'removals') && !hasVehicle) errors.push('Choose a vehicle.');
  if (f.crossBorder && !l.crossBorder.enabled) errors.push('Cross-border delivery is not available.');
  if (f.insured && nonNeg(f.declaredValue) <= 0) errors.push('Enter the declared value to insure the goods.');
  return { ok: errors.length === 0, errors };
}

/**
 * Freight quote. Line-haul by service:
 *  - ftl / removals: vehicle baseFare + perKm × km (one-way, dedicated vehicle)
 *  - ltl: baseFee + max(pallets × perPalletKm, chargeableKg × perKgKm) × km, floored at minCharge
 *  - courier: baseFee + perKg × chargeableKg + perKm × km, floored at minCharge
 * Service-level multiplier is applied to line-haul (shown as its own surcharge line).
 * Add-ons: insurance (% of declared value, min), tail-lift, helpers, after-hours.
 * Cross-border: documentation fee + border fee & estimated waiting (full for dedicated vehicles,
 * pro rata by pallet share for part-load, none for parcels); VAT zero-rated when configured.
 */
export function computeFreightQuote(a: FreightQuoteArgs): Quote {
  const { freight: f, logistics: l } = a;
  const km = nonNeg(a.distanceKm);
  const lines: QuoteLine[] = [];
  let base = 0;
  let distance = 0;

  if (f.service === 'ftl' || f.service === 'removals') {
    const v = a.vehicle;
    base = whole(nonNeg(v?.baseFare));
    distance = whole(nonNeg(v?.perKm) * km);
    lines.push({ label: `${v?.name ?? 'Vehicle'} — call-out`, amount: base });
    lines.push({ label: `${Math.round(km)} km line-haul`, amount: distance });
  } else if (f.service === 'ltl') {
    const kg = chargeableKg(f, l.volumetricDivisor);
    const byPallet = nonNeg(f.pallets) * nonNeg(l.ltl.perPalletKm) * km;
    const byKg = kg * nonNeg(l.ltl.perKgKm) * km;
    base = whole(nonNeg(l.ltl.baseFee));
    distance = whole(Math.max(byPallet, byKg));
    const floor = nonNeg(l.ltl.minCharge) - base - distance;
    if (floor > 0) distance += whole(floor);
    lines.push({ label: 'Part-load handling', amount: base });
    lines.push({
      label: byPallet >= byKg ? `${f.pallets} pallet(s) × ${Math.round(km)} km` : `${kg} kg chargeable × ${Math.round(km)} km`,
      amount: distance,
    });
  } else {
    const kg = chargeableKg(f, l.volumetricDivisor);
    base = whole(nonNeg(l.courier.baseFee));
    distance = whole(nonNeg(l.courier.perKg) * kg + nonNeg(l.courier.perKm) * km);
    const floor = nonNeg(l.courier.minCharge) - base - distance;
    if (floor > 0) distance += whole(floor);
    lines.push({ label: 'Collection & handling', amount: base });
    lines.push({ label: `${kg} kg chargeable, ${Math.round(km)} km`, amount: distance });
  }

  let addOns = fuelSurcharge(distance, a.fuelSurchargePct, lines);
  const lvl = l.levels[f.level as ServiceLevel];
  const mult = lvl?.enabled ? nonNeg(lvl.multiplier) || 1 : 1;
  if (mult !== 1) {
    const s = whole((base + distance) * (mult - 1));
    addOns += s;
    lines.push({ label: `${lvl.label} (${mult}×)`, amount: s });
  }
  if (f.insured && nonNeg(f.declaredValue) > 0) {
    const ins = whole(Math.max(nonNeg(l.addOns.insuranceMin), (nonNeg(f.declaredValue) * pct(l.addOns.insurancePct)) / 100));
    addOns += ins;
    lines.push({ label: `Goods-in-transit cover (${pct(l.addOns.insurancePct)}%)`, amount: ins });
  }
  if (f.tailLift) {
    addOns += whole(nonNeg(l.addOns.tailLift));
    lines.push({ label: 'Tail-lift', amount: whole(nonNeg(l.addOns.tailLift)) });
  }
  const helpers = Math.max(0, Math.floor(nonNeg(f.helpers)));
  if (helpers) {
    const h = whole(helpers * nonNeg(l.addOns.helperPerPerson));
    addOns += h;
    lines.push({ label: `Loading helpers × ${helpers}`, amount: h });
  }
  if (f.afterHours) {
    addOns += whole(nonNeg(l.addOns.afterHours));
    lines.push({ label: 'After-hours / weekend', amount: whole(nonNeg(l.addOns.afterHours)) });
  }

  let border = 0;
  if (f.crossBorder) {
    // Dedicated vehicles carry the full border cost. Consolidated part-loads share the truck's
    // border fee and waiting pro rata by pallet space; parcels only pay documentation.
    const share =
      f.service === 'ltl'
        ? Math.min(1, Math.max(1, nonNeg(f.pallets)) / Math.max(1, nonNeg(l.ltl.maxPallets)))
        : f.service === 'courier'
          ? 0
          : 1;
    const fees = whole(nonNeg(l.crossBorder.borderFee) * share + nonNeg(l.crossBorder.docsFee));
    lines.push({ label: `Border & documentation (${f.crossBorder.borderPostName})${share < 1 && share > 0 ? ' — shared truck' : ''}`, amount: fees });
    // estimate at most one day of waiting up front; longer delays are reconciled on delivery
    const hrs = Math.min(MAX_EST_WAIT_HRS, nonNeg(f.crossBorder.delayHrs));
    const wait = whole(hrs * nonNeg(l.crossBorder.waitingPerHour) * share);
    if (wait) lines.push({ label: `Est. border waiting ${hrs} h${share < 1 ? ' (shared)' : ''} — final on delivery`, amount: wait });
    border = fees + wait;
  }
  const taxPct = f.crossBorder && l.crossBorder.zeroRateVat ? 0 : a.taxPct;
  return finish({ base, distance, returnLeg: 0, addOns, border }, lines, a.promo, taxPct, a.currency);
}

/** Local yyyy-mm-dd for a Date. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Active promotion matching `code` (case-insensitive) whose validUntil (inclusive) has not passed. */
export function findPromo(
  promos: Promotion[] | undefined,
  code: string,
  today: Date = new Date(),
  timeZone = 'Asia/Colombo',
): Promotion | null {
  const c = (code || '').trim().toUpperCase();
  if (!c || !promos?.length) return null;
  const todayISO = todayIn(timeZone, today);
  return (
    promos.find((p) => {
      if (!p.active || !p.code || p.code.trim().toUpperCase() !== c) return false;
      if (p.validUntil && p.validUntil.slice(0, 10) < todayISO) return false;
      return true;
    }) ?? null
  );
}

const toMin = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/** Day of week (0=Sun…6=Sat) for a yyyy-mm-dd string, timezone-independent. */
export function weekdayOf(dateISO: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO || '');
  if (!m) return NaN;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
}

/** Does this load type have restrictions that apply on this date at all? */
export function hasRestrictionsOn(settings: BookingSettings, loadType: string, dateISO: string): boolean {
  const rw = settings.restrictedWindows;
  if (!rw || !rw.windows?.length) return false;
  const lt = (loadType || '').trim().toLowerCase();
  if (!lt || !rw.loadTypes?.some((x) => x.trim().toLowerCase() === lt)) return false;
  if (rw.weekdaysOnly) {
    const wd = weekdayOf(dateISO);
    if (!(wd >= 1 && wd <= 5)) return false;
  }
  return true;
}

/** True when `timeHHmm` falls inside a blocked window [start, end) for this load type/date. */
export function isRestrictedSlot(settings: BookingSettings, loadType: string, dateISO: string, timeHHmm: string): boolean {
  if (!hasRestrictionsOn(settings, loadType, dateISO)) return false;
  const t = toMin(timeHHmm);
  if (Number.isNaN(t)) return false;
  return settings.restrictedWindows.windows.some((w) => {
    // tolerate legacy tuple form ['HH:mm','HH:mm'] from older exports
    const [a, b] = Array.isArray(w) ? (w as unknown as [string, string]) : [w.start, w.end];
    const s = toMin(a);
    const e = toMin(b);
    return !Number.isNaN(s) && !Number.isNaN(e) && t >= s && t < e;
  });
}

/** 30-minute slots from `from` to `to` inclusive (HH:mm). */
export function timeSlots(from = '05:00', to = '21:00', stepMin = 30): string[] {
  const out: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += stepMin) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  return out;
}
