// Pure buy-cost / margin maths for hired (subcontracted) jobs. No React.
import type { BuyCost, CostAdj, Job, JobFinance, RateBasis, RateLine, Transporter } from '../../ops/types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export interface CostInput {
  basis: RateBasis;
  rate: number;
  qty: number;
  minCharge?: number;
  extras: CostAdj[];
  deductions: CostAdj[];
}

/** max(rate × qty, minCharge) + extras − deductions, never below 0 (excl. VAT). */
export function computeBuyCost(c: CostInput): { base: number; extras: number; deductions: number; total: number } {
  const qty = c.basis === 'trip' || c.basis === 'load' ? pos(c.qty) || 1 : pos(c.qty);
  const base = r2(Math.max(pos(c.rate) * qty, pos(c.minCharge ?? 0)));
  const extras = r2(c.extras.reduce((a, x) => a + pos(x.amount), 0));
  const deductions = r2(c.deductions.reduce((a, x) => a + pos(x.amount), 0));
  return { base, extras, deductions, total: r2(Math.max(0, base + extras - deductions)) };
}

/** Units for a basis from the job (km from ODO when known, else estimate; days from 1). */
export function defaultQty(basis: RateBasis, job: Pick<Job, 'actualKm' | 'estimatedKm'>): number {
  if (basis === 'km') return job.actualKm ?? job.estimatedKm ?? 0;
  return 1;
}

/** Best rate line for a vehicle type (exact type first, then a generic line of the same basis). */
export function pickRate(t: Transporter, vehicleType?: string, basis?: RateBasis): RateLine | undefined {
  const lines = basis ? t.rates.filter((r) => r.basis === basis) : t.rates;
  return lines.find((r) => r.vehicleType && r.vehicleType === vehicleType) ?? lines.find((r) => !r.vehicleType) ?? lines[0];
}

/** Build a BuyCost; when qtyFromOdo and the job has actual km, qty follows it. */
export function buildCost(t: Pick<Transporter, 'id' | 'name' | 'vatRegistered'>, c: CostInput & { qtyFromOdo?: boolean; note?: string }, job?: Pick<Job, 'actualKm' | 'estimatedKm'>): BuyCost {
  const qty = c.basis === 'km' && c.qtyFromOdo && job ? defaultQty('km', job) : c.qty;
  const keep = (l: CostAdj[]) => l.filter((x) => x.label.trim() && pos(x.amount)).map((x) => ({ label: x.label.trim(), amount: r2(pos(x.amount)) }));
  const extras = keep(c.extras);
  const deductions = keep(c.deductions);
  // total from the same (cleaned) lines that are stored
  const { total } = computeBuyCost({ ...c, qty, extras, deductions });
  return {
    transporterId: t.id,
    transporterName: t.name,
    basis: c.basis,
    rate: r2(pos(c.rate)),
    qty: r2(pos(qty)),
    qtyFromOdo: c.basis === 'km' ? !!c.qtyFromOdo : undefined,
    minCharge: c.minCharge ? r2(pos(c.minCharge)) : undefined,
    extras,
    deductions,
    total,
    vatRate: t.vatRegistered ? VAT_ZA : undefined,
    note: c.note?.trim() || undefined,
  };
}

export const VAT_ZA = 0.15;

/** Cost as it stands now (re-computed when it follows the ODO). */
export function effectiveCost(cost: BuyCost | undefined, job: Pick<Job, 'actualKm' | 'estimatedKm'>): BuyCost | undefined {
  if (!cost) return undefined;
  if (cost.basis !== 'km' || !cost.qtyFromOdo || job.actualKm === undefined) return cost;
  const qty = job.actualKm;
  return { ...cost, qty, total: computeBuyCost({ ...cost, qty }).total };
}

/** Margin on a job: sell price excl. VAT − buy cost excl. VAT. Null when either side is missing. */
export function margin(fin: JobFinance | null | undefined, job: Pick<Job, 'price' | 'actualKm' | 'estimatedKm'>, vatRate = VAT_ZA): { sellEx: number; buy: number; margin: number; pct: number } | null {
  const price = fin?.price ?? job.price;
  const cost = effectiveCost(fin?.cost, job);
  if (price === undefined || !cost) return null;
  const sellEx = r2(price / (1 + vatRate));
  const m = r2(sellEx - cost.total);
  return { sellEx, buy: cost.total, margin: m, pct: sellEx > 0 ? Math.round((m / sellEx) * 1000) / 10 : 0 };
}
