// Buy-cost panel for hired jobs: transporter + rate line (or manual), qty, extras, deductions → total + margin.
import { Icon } from '../../components/Icon';
import { RATE_BASIS_LABEL, type BuyCost, type CostAdj, type RateBasis, type Transporter } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { Field } from '../ui';
import { buildCost, computeBuyCost, defaultQty, pickRate, VAT_ZA } from './cost';

export interface CostDraft {
  enabled: boolean;
  transporterId: string;
  rateId: string; // '' = manual
  basis: RateBasis;
  rate: string;
  qty: string;
  qtyFromOdo: boolean;
  minCharge: string;
  extras: CostAdj[];
  deductions: CostAdj[];
  note: string;
}

export function draftFromCost(c: BuyCost | undefined, fallbackTransporterId?: string): CostDraft {
  return {
    enabled: !!c || !!fallbackTransporterId,
    transporterId: c?.transporterId ?? fallbackTransporterId ?? '',
    rateId: '',
    basis: c?.basis ?? 'trip',
    rate: c ? String(c.rate) : '',
    qty: c ? String(c.qty) : '1',
    qtyFromOdo: !!c?.qtyFromOdo,
    minCharge: c?.minCharge ? String(c.minCharge) : '',
    extras: c?.extras.map((x) => ({ ...x })) ?? [],
    deductions: c?.deductions.map((x) => ({ ...x })) ?? [],
    note: c?.note ?? '',
  };
}

/** Draft → BuyCost (undefined when disabled or incomplete). */
export function costFromDraft(d: CostDraft, transporters: Transporter[], job: { actualKm?: number; estimatedKm?: number }): BuyCost | undefined {
  if (!d.enabled) return undefined;
  const t = transporters.find((x) => x.id === d.transporterId);
  if (!t || !(Number(d.rate) > 0)) return undefined;
  return buildCost(
    t,
    { basis: d.basis, rate: Number(d.rate), qty: Number(d.qty) || 0, qtyFromOdo: d.qtyFromOdo, minCharge: Number(d.minCharge) || undefined, extras: d.extras, deductions: d.deductions, note: d.note },
    job,
  );
}

/** Draft with a transporter's rate line applied (best match for the truck type when no line is given). */
export function withRateLine(d: CostDraft, t: Transporter, job: { actualKm?: number; estimatedKm?: number }, vehicleType?: string, rateId?: string): CostDraft {
  const line = rateId ? t.rates.find((r) => r.id === rateId) : pickRate(t, vehicleType);
  if (!line) return { ...d, enabled: true, transporterId: t.id, rateId: '' };
  return {
    ...d,
    enabled: true,
    transporterId: t.id,
    rateId: line.id,
    basis: line.basis,
    rate: String(line.amount),
    minCharge: line.minCharge ? String(line.minCharge) : '',
    qty: String(defaultQty(line.basis, job) || 1),
    qtyFromOdo: line.basis === 'km',
  };
}

export function costDraftError(d: CostDraft): string | undefined {
  if (!d.enabled) return undefined;
  if (!d.transporterId) return 'Pick the transporter.';
  if (!(Number(d.rate) > 0)) return 'Enter the rate.';
  if (d.basis !== 'trip' && d.basis !== 'load' && !d.qtyFromOdo && !(Number(d.qty) > 0)) return 'Enter the quantity.';
  return undefined;
}

const BASES = Object.keys(RATE_BASIS_LABEL) as RateBasis[];
const UNIT: Record<RateBasis, string> = { trip: 'trips', km: 'km', day: 'days', hour: 'hours', ton: 'tons', load: 'loads' };

export function CostPanel({
  d,
  onChange,
  transporters,
  vehicleType,
  job,
  sellPrice,
  locked,
  error,
}: {
  d: CostDraft;
  onChange: (d: CostDraft) => void;
  transporters: Transporter[];
  vehicleType?: string;
  job: { actualKm?: number; estimatedKm?: number };
  sellPrice?: number;
  locked?: string;
  error?: string;
}) {
  const { fmtMoney, country } = useTenant();
  const set = (p: Partial<CostDraft>) => onChange({ ...d, ...p });
  const t = transporters.find((x) => x.id === d.transporterId);
  const qty = d.basis === 'km' && d.qtyFromOdo ? defaultQty('km', job) : Number(d.qty) || 0;
  const named = (l: CostAdj[]) => l.filter((x) => x.label.trim());
  const calc = computeBuyCost({ basis: d.basis, rate: Number(d.rate) || 0, qty, minCharge: Number(d.minCharge) || 0, extras: named(d.extras), deductions: named(d.deductions) });
  const vatRate = country.code === 'ZA' ? VAT_ZA : 0.18;
  const sellEx = sellPrice !== undefined ? Math.round((sellPrice / (1 + vatRate)) * 100) / 100 : undefined;
  const mg = sellEx !== undefined ? Math.round((sellEx - calc.total) * 100) / 100 : undefined;

  const applyRate = (tr: Transporter | undefined, rateId: string) => {
    if (!tr) return set({ transporterId: '', rateId: '' });
    if (!rateId) return set({ transporterId: tr.id, rateId: '' });
    onChange(withRateLine(d, tr, job, vehicleType, rateId));
  };

  const adjList = (k: 'extras' | 'deductions', label: string, ph: string) => (
    <div className="stack" style={{ gap: 6 }}>
      <span className="label">{label}</span>
      {d[k].map((x, i) => (
        <div key={i} className="ops-adj">
          <input className="input" value={x.label} maxLength={60} placeholder={ph} disabled={!!locked} onChange={(e) => set({ [k]: d[k].map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) } as Partial<CostDraft>)} aria-label={`${label} ${i + 1} description`} />
          <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={x.amount || ''} disabled={!!locked} onChange={(e) => set({ [k]: d[k].map((y, j) => (j === i ? { ...y, amount: Math.max(0, Number(e.target.value) || 0) } : y)) } as Partial<CostDraft>)} aria-label={`${label} ${i + 1} amount`} />
          <button type="button" className="icon-btn" aria-label="Remove" disabled={!!locked} onClick={() => set({ [k]: d[k].filter((_, j) => j !== i) } as Partial<CostDraft>)}>
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!!locked} onClick={() => set({ [k]: [...d[k], { label: '', amount: 0 }] } as Partial<CostDraft>)}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>
    </div>
  );

  if (!d.enabled)
    return (
      <div className="stack" style={{ gap: 8 }}>
        <p className="muted small">Own truck — no subcontractor cost. Switch on when this job is done by a hired truck.</p>
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ enabled: true })}>
            <Icon name="plus" size={14} /> Add buy cost (hired)
          </button>
        </div>
      </div>
    );

  return (
    <div className="stack" style={{ gap: 12 }}>
      {locked ? <div className="alert alert-info small">{locked}</div> : null}
      {error ? <div className="alert alert-err small">{error}</div> : null}
      <div className="form-grid">
        <Field label="Transporter *">
          <select
            className="select"
            value={d.transporterId}
            disabled={!!locked}
            onChange={(e) => {
              const tr = transporters.find((x) => x.id === e.target.value);
              // start from the best matching rate line for this truck type
              applyRate(tr, tr ? pickRate(tr, vehicleType)?.id ?? '' : '');
            }}
          >
            <option value="">— Choose —</option>
            {transporters
              .filter((x) => x.active || x.id === d.transporterId)
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Rate line" hint={t && !t.rates.length ? 'No rate card — enter manually' : undefined}>
          <select className="select" value={d.rateId} disabled={!t || !!locked} onChange={(e) => applyRate(t, e.target.value)}>
            <option value="">Manual</option>
            {t?.rates.map((r) => (
              <option key={r.id} value={r.id}>
                {fmtMoney(r.amount)} {RATE_BASIS_LABEL[r.basis]}
                {r.vehicleType ? ` · ${r.vehicleType}` : ''}
                {r.note ? ` · ${r.note}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Basis">
          <select className="select" value={d.basis} disabled={!!locked} onChange={(e) => set({ basis: e.target.value as RateBasis, rateId: '', qtyFromOdo: e.target.value === 'km' ? d.qtyFromOdo : false })}>
            {BASES.map((b) => (
              <option key={b} value={b}>
                {RATE_BASIS_LABEL[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rate (excl. VAT) *">
          <div className="adm-affix">
            <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={d.rate} disabled={!!locked} onChange={(e) => set({ rate: e.target.value, rateId: '' })} />
            <span className="adm-affix-s">{country.currencySymbol}</span>
          </div>
        </Field>
        <Field label={`Quantity (${UNIT[d.basis]})`} hint={d.basis === 'km' ? (d.qtyFromOdo ? `Follows actual km from the ODO (${job.actualKm ?? `est. ${job.estimatedKm ?? 0}`})` : 'Fixed km') : undefined}>
          <input className="input" type="number" inputMode="decimal" min={0} step="0.1" value={d.basis === 'km' && d.qtyFromOdo ? String(qty) : d.qty} disabled={!!locked || (d.basis === 'km' && d.qtyFromOdo)} onChange={(e) => set({ qty: e.target.value })} />
        </Field>
        <Field label="Minimum charge">
          <div className="adm-affix">
            <input className="input" type="number" inputMode="decimal" min={0} value={d.minCharge} disabled={!!locked} onChange={(e) => set({ minCharge: e.target.value })} />
            <span className="adm-affix-s">{country.currencySymbol}</span>
          </div>
        </Field>
        {d.basis === 'km' ? (
          <label className="row small span-2" style={{ gap: 8 }}>
            <input type="checkbox" checked={d.qtyFromOdo} disabled={!!locked} onChange={(e) => set({ qtyFromOdo: e.target.checked })} /> Use actual km from the trip’s ODO readings
          </label>
        ) : null}
      </div>
      <div className="ops-adj-grid">
        {adjList('extras', 'Extras (+)', 'Waiting time, tolls…')}
        {adjList('deductions', 'Deductions (−)', 'Fuel advance, damage…')}
      </div>
      <div className="ops-costsum">
        <div>
          <span className="muted small">Base</span>
          <strong>{fmtMoney(calc.base)}</strong>
        </div>
        <div>
          <span className="muted small">+ Extras</span>
          <strong>{fmtMoney(calc.extras)}</strong>
        </div>
        <div>
          <span className="muted small">− Deductions</span>
          <strong>{fmtMoney(calc.deductions)}</strong>
        </div>
        <div>
          <span className="muted small">Buy cost{t?.vatRegistered ? ' (excl. VAT)' : ''}</span>
          <strong>{fmtMoney(calc.total)}</strong>
          {t?.vatRegistered ? <span className="tiny muted">+ VAT {fmtMoney(Math.round(calc.total * vatRate * 100) / 100)}</span> : null}
        </div>
        <div className={mg !== undefined && mg < 0 ? 'ops-neg' : ''}>
          <span className="muted small">Margin</span>
          <strong>{mg !== undefined ? fmtMoney(mg) : '—'}</strong>
          <span className="tiny muted">{sellEx !== undefined ? `${sellEx > 0 ? Math.round(((mg ?? 0) / sellEx) * 1000) / 10 : 0}% of ${fmtMoney(sellEx)} excl. VAT` : 'Set the price'}</span>
        </div>
      </div>
      <Field label="Cost note">
        <input className="input" value={d.note} maxLength={200} disabled={!!locked} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      {!locked ? (
        <div>
          <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => set({ enabled: false })}>
            Remove buy cost
          </button>
        </div>
      ) : null}
    </div>
  );
}

