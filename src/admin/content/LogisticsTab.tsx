import { useMemo } from 'react';
import type { FreightDetails, FreightKind, LogisticsSettings, ServiceLevel, VehicleType } from '../../tenant/types';
import { computeFreightQuote } from '../../lib/quote';
import { countryInfo, CROSS_BORDER_NAMES, type CrossBorderCode } from '../../geo';
import { moneyFormatter, VEHICLE_TYPES } from '../market';
import { AreaField, NumField, Section, TextField, Toggle } from '../ui';
import type { TabProps } from './draft';

const LEVELS: ServiceLevel[] = ['economy', 'express', 'sameday'];
const KINDS: Record<FreightKind, string> = { ftl: 'Full truckload', ltl: 'Part-load (pallets)', courier: 'Courier & parcels', removals: 'Removals' };

const SAMPLE: FreightDetails = {
  service: 'ltl',
  level: 'economy',
  packages: 1,
  pallets: 1,
  weightKg: 300,
  lengthCm: 120,
  widthCm: 100,
  heightCm: 100,
  description: 'Sample',
  declaredValue: 0,
  insured: false,
  hazardous: false,
  tailLift: false,
  helpers: 0,
  afterHours: false,
};

export default function LogisticsTab({ draft, update }: TabProps) {
  const l = draft.logistics;
  const ci = countryInfo(draft.locale.country);
  const money = moneyFormatter(ci);
  const sym = ci.currencySymbol;
  const set = (patch: Partial<LogisticsSettings>) => update((d) => ({ ...d, logistics: { ...d.logistics, ...patch } }));
  const setNested = <K extends 'ltl' | 'courier' | 'addOns' | 'crossBorder'>(k: K, patch: Partial<LogisticsSettings[K]>) =>
    update((d) => ({ ...d, logistics: { ...d.logistics, [k]: { ...d.logistics[k], ...patch } } }));
  const setLevel = (k: ServiceLevel, patch: Partial<LogisticsSettings['levels'][ServiceLevel]>) =>
    update((d) => ({ ...d, logistics: { ...d.logistics, levels: { ...d.logistics.levels, [k]: { ...d.logistics.levels[k], ...patch } } } }));
  const toggleType = (k: 'ftlTypes' | 'removalsTypes', t: VehicleType, on: boolean) =>
    set({ [k]: on ? [...new Set([...(l[k] ?? []), t])] : (l[k] ?? []).filter((x) => x !== t) } as Partial<LogisticsSettings>);

  /** Live examples so the owner sees what customers will pay. */
  const examples = useMemo(() => {
    const common = { logistics: l, taxPct: draft.booking.taxPct, fuelSurchargePct: draft.booking.fuelSurchargePct, currency: draft.locale.currency };
    const ftlVehicle = draft.fleet.find((v) => v.available && l.ftlTypes.includes(v.type));
    const out: { label: string; total: number | null }[] = [
      { label: '1 pallet · 300 km · economy', total: computeFreightQuote({ ...common, freight: SAMPLE, distanceKm: 300 }).total },
      {
        label: '5 kg parcel · 50 km · express',
        total: computeFreightQuote({ ...common, freight: { ...SAMPLE, service: 'courier', level: 'express', pallets: 0, weightKg: 5, lengthCm: 30, widthCm: 30, heightCm: 20 }, distanceKm: 50 }).total,
      },
      {
        label: `FTL ${ftlVehicle?.name ?? '(no eligible vehicle)'} · 600 km`,
        total: ftlVehicle ? computeFreightQuote({ ...common, freight: { ...SAMPLE, service: 'ftl' }, vehicle: ftlVehicle, distanceKm: 600 }).total : null,
      },
    ];
    if (l.crossBorder.enabled && l.crossBorder.countries.length)
      out.push({
        label: `4 pallets · 420 km · into ${CROSS_BORDER_NAMES[l.crossBorder.countries[0]]} (3 h border)`,
        total: computeFreightQuote({
          ...common,
          freight: { ...SAMPLE, pallets: 4, weightKg: 1600, crossBorder: { country: l.crossBorder.countries[0], borderPostId: 'x', borderPostName: 'border', delayHrs: 3 } },
          distanceKm: 420,
        }).total,
      });
    return out;
  }, [l, draft.booking.taxPct, draft.booking.fuelSurchargePct, draft.locale.currency, draft.fleet]);

  return (
    <>
      <Section title="Logistics" desc="Freight booking: full truckload, part-load, courier and removals — with instant all-in quotes.">
        <Toggle checked={l.enabled} onChange={(v) => set({ enabled: v })} label="Offer freight booking" desc="Adds “Ship freight” to the booking page, a Logistics page and homepage section." />
      </Section>

      <Section title="Example quotes" desc={`Live from the rates below, incl. ${draft.booking.fuelSurchargePct}% fuel surcharge and ${draft.booking.taxPct}% VAT.`}>
        <ul className="adm-examples">
          {examples.map((e) => (
            <li key={e.label}>
              <span>{e.label}</span>
              <strong>{e.total === null ? '—' : money(e.total)}</strong>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Services">
        <div className="stack">
          {l.services.map((s, i) => (
            <div key={s.id} className="adm-card-row">
              <Toggle
                checked={s.enabled}
                onChange={(v) => set({ services: l.services.map((x, j) => (j === i ? { ...x, enabled: v } : x)) })}
                label={KINDS[s.id]}
              />
              <div className="form-grid">
                <TextField label="Title" value={s.title} maxLength={60} onChange={(v) => set({ services: l.services.map((x, j) => (j === i ? { ...x, title: v } : x)) })} />
                <TextField label="Description" value={s.description} maxLength={160} onChange={(v) => set({ services: l.services.map((x, j) => (j === i ? { ...x, description: v } : x)) })} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Part-load (pallets) rates" desc="Price = handling + max(pallets × rate/pallet/km, chargeable kg × rate/kg/km) × km, floored at the minimum.">
        <div className="form-grid">
          <NumField label="Handling fee" suffix={sym} min={0} value={l.ltl.baseFee} onChange={(v) => setNested('ltl', { baseFee: v ?? 0 })} />
          <NumField label="Per pallet per km" suffix={sym} min={0} step={0.01} value={l.ltl.perPalletKm} onChange={(v) => setNested('ltl', { perPalletKm: v ?? 0 })} />
          <NumField label="Per kg per km" suffix={sym} min={0} step={0.0001} value={l.ltl.perKgKm} onChange={(v) => setNested('ltl', { perKgKm: v ?? 0 })} />
          <NumField label="Minimum charge" suffix={sym} min={0} value={l.ltl.minCharge} onChange={(v) => setNested('ltl', { minCharge: v ?? 0 })} />
          <NumField label="Max pallets per booking" min={1} max={40} value={l.ltl.maxPallets} onChange={(v) => setNested('ltl', { maxPallets: Math.min(40, Math.max(1, v ?? 1)) })} />
          <NumField label="Max kg per pallet" min={100} value={l.ltl.palletMaxKg} onChange={(v) => setNested('ltl', { palletMaxKg: v ?? 1000 })} />
        </div>
      </Section>

      <Section title="Courier rates" desc="Price = handling + per kg × chargeable kg + per km × km, floored at the minimum.">
        <div className="form-grid">
          <NumField label="Handling fee" suffix={sym} min={0} value={l.courier.baseFee} onChange={(v) => setNested('courier', { baseFee: v ?? 0 })} />
          <NumField label="Per kg" suffix={sym} min={0} step={0.1} value={l.courier.perKg} onChange={(v) => setNested('courier', { perKg: v ?? 0 })} />
          <NumField label="Per km" suffix={sym} min={0} step={0.01} value={l.courier.perKm} onChange={(v) => setNested('courier', { perKm: v ?? 0 })} />
          <NumField label="Minimum charge" suffix={sym} min={0} value={l.courier.minCharge} onChange={(v) => setNested('courier', { minCharge: v ?? 0 })} />
          <NumField label="Max kg per shipment" min={1} value={l.courier.maxKg} onChange={(v) => setNested('courier', { maxKg: v ?? 30 })} />
          <NumField label="Volumetric divisor" suffix="cm³/kg" min={1000} hint="5000 is the road/courier standard" value={l.volumetricDivisor} onChange={(v) => set({ volumetricDivisor: v ?? 5000 })} />
        </div>
      </Section>

      <Section title="Delivery speeds" desc="Multiplier applies to handling + line-haul.">
        <div className="stack">
          {LEVELS.map((k) => (
            <div key={k} className="adm-card-row">
              <Toggle checked={l.levels[k].enabled} onChange={(v) => setLevel(k, { enabled: v })} label={l.levels[k].label || k} />
              <div className="form-grid">
                <TextField label="Label" value={l.levels[k].label} maxLength={30} onChange={(v) => setLevel(k, { label: v })} />
                <TextField label="ETA text" value={l.levels[k].eta} maxLength={40} onChange={(v) => setLevel(k, { eta: v })} />
                <NumField label="Multiplier" min={0.5} max={5} step={0.05} value={l.levels[k].multiplier} onChange={(v) => setLevel(k, { multiplier: v ?? 1 })} />
                <NumField label="Max distance" suffix="km" optional min={0} hint="Blank = no limit" value={l.levels[k].maxKm} onChange={(v) => setLevel(k, { maxKm: v || undefined })} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Add-ons">
        <div className="form-grid">
          <NumField label="Insurance top-up" suffix="% of value" min={0} max={10} step={0.05} value={l.addOns.insurancePct} onChange={(v) => setNested('addOns', { insurancePct: v ?? 0 })} />
          <NumField label="Insurance minimum" suffix={sym} min={0} value={l.addOns.insuranceMin} onChange={(v) => setNested('addOns', { insuranceMin: v ?? 0 })} />
          <NumField label="Tail-lift" suffix={sym} min={0} value={l.addOns.tailLift} onChange={(v) => setNested('addOns', { tailLift: v ?? 0 })} />
          <NumField label="Helper (per person)" suffix={sym} min={0} value={l.addOns.helperPerPerson} onChange={(v) => setNested('addOns', { helperPerPerson: v ?? 0 })} />
          <NumField label="After-hours / weekend" suffix={sym} min={0} value={l.addOns.afterHours} onChange={(v) => setNested('addOns', { afterHours: v ?? 0 })} />
        </div>
      </Section>

      <Section title="Cross-border" desc={ci.code === 'ZA' ? 'Road freight from South Africa into SADC.' : 'Cross-border road freight is only available for South Africa sites.'}>
        <div className="stack">
          <Toggle
            checked={l.crossBorder.enabled && ci.code === 'ZA'}
            onChange={(v) => setNested('crossBorder', { enabled: v && ci.code === 'ZA' })}
            label="Offer cross-border delivery"
            desc="Destination towns in the selected countries appear in the delivery picker, with border post, docs checklist and fees."
          />
          {ci.code === 'ZA' && (
            <>
              <fieldset className="adm-fieldset adm-districts">
                <legend className="label">Countries</legend>
                {(Object.keys(CROSS_BORDER_NAMES) as CrossBorderCode[]).map((c) => (
                  <label key={c} className="checkbox adm-district">
                    <input
                      type="checkbox"
                      checked={l.crossBorder.countries.includes(c)}
                      onChange={(e) =>
                        setNested('crossBorder', {
                          countries: e.target.checked ? [...l.crossBorder.countries, c] : l.crossBorder.countries.filter((x) => x !== c),
                        })
                      }
                    />
                    {CROSS_BORDER_NAMES[c]}
                  </label>
                ))}
              </fieldset>
              <div className="form-grid">
                <NumField label="Border fee (per truck)" suffix={sym} min={0} hint="Shared pro rata on part-loads" value={l.crossBorder.borderFee} onChange={(v) => setNested('crossBorder', { borderFee: v ?? 0 })} />
                <NumField label="Documentation fee" suffix={sym} min={0} value={l.crossBorder.docsFee} onChange={(v) => setNested('crossBorder', { docsFee: v ?? 0 })} />
                <NumField label="Border waiting per hour" suffix={sym} min={0} hint="× the post's typical delay" value={l.crossBorder.waitingPerHour} onChange={(v) => setNested('crossBorder', { waitingPerHour: v ?? 0 })} />
              </div>
              <Toggle checked={l.crossBorder.zeroRateVat} onChange={(v) => setNested('crossBorder', { zeroRateVat: v })} label="Zero-rate VAT on exports" desc="Requires proof of export." />
              <AreaField label="Note shown to customers" rows={2} value={l.crossBorder.note} onChange={(v) => setNested('crossBorder', { note: v })} />
            </>
          )}
        </div>
      </Section>

      <Section title="Vehicles offered" desc="Which fleet types customers can choose for full truckload and removals.">
        <div className="grid-2">
          {(['ftlTypes', 'removalsTypes'] as const).map((k) => (
            <fieldset key={k} className="adm-fieldset">
              <legend className="label">{k === 'ftlTypes' ? 'Full truckload' : 'Removals'}</legend>
              {VEHICLE_TYPES.map((t) => (
                <label key={t.value} className="checkbox adm-district">
                  <input type="checkbox" checked={(l[k] ?? []).includes(t.value)} onChange={(e) => toggleType(k, t.value, e.target.checked)} />
                  {t.label}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      </Section>
    </>
  );
}
