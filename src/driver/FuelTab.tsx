import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { addFuel, putMedia, watchFuel } from '../ops/store';
import type { FleetUnit, FuelEntry, Job } from '../ops/types';
import OdoCapture from '../ops/OdoCapture';
import PhotoField, { type CapturedPhoto } from '../ops/PhotoField';
import { useTenant } from '../tenant/TenantProvider';
import { Icon } from '../components/Icon';
import { fmtKm, queued, useDriver } from './ctx';
import { Empty, Sheet } from './ui';

export default function FuelTab({ vehicles, activeJob }: { vehicles: FleetUnit[]; activeJob?: Job }) {
  const { tenantId, driver, user, notify } = useDriver();
  const { country, fmtMoney } = useTenant();
  const [entries, setEntries] = useState<FuelEntry[] | null>(null);
  const defaultVehicle = activeJob?.vehicleId ?? driver.defaultVehicleId ?? '';
  const [vehicleId, setVehicleId] = useState(defaultVehicle);
  const [litres, setLitres] = useState('');
  const [amount, setAmount] = useState('');
  const [odo, setOdo] = useState('');
  const [station, setStation] = useState('');
  const [receipt, setReceipt] = useState<CapturedPhoto[]>([]);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState(false);

  useEffect(() => watchFuel(tenantId, { driverId: driver.id }, setEntries), [tenantId, driver.id]);
  useEffect(() => {
    if (!vehicleId && defaultVehicle) setVehicleId(defaultVehicle);
  }, [defaultVehicle, vehicleId]);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const l = Number(litres.replace(',', '.'));
  const a = Number(amount.replace(',', '.'));
  const k = Number(odo.replace(',', '.'));
  const errs = {
    vehicle: !vehicleId ? 'Choose the vehicle' : null,
    litres: !(l > 0 && l <= 2000) ? 'Litres between 0 and 2000' : null,
    amount: !(a > 0) ? 'Enter the amount paid' : null,
    odo: !(k > 0) ? 'Enter the odometer' : vehicle && k < vehicle.odometerKm - 1 ? `Lower than the last reading (${fmtKm(vehicle.odometerKm)})` : null,
  };
  const valid = !errs.vehicle && !errs.litres && !errs.amount && !errs.odo;

  const economy = useMemo(() => lPer100(entries ?? []), [entries]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true);
    try {
      let receiptId: string | undefined;
      if (receipt[0])
        receiptId = await putMedia(tenantId, {
          kind: 'receipt',
          dataUrl: receipt[0].dataUrl,
          by: user.uid,
          at: Date.now(),
          w: receipt[0].w,
          h: receipt[0].h,
        });
      const r = await queued(
        addFuel(tenantId, {
          driverId: driver.id,
          vehicleId,
          jobId: activeJob?.vehicleId === vehicleId ? activeJob.id : undefined,
          litres: Math.round(l * 100) / 100,
          amount: Math.round(a * 100) / 100,
          odometerKm: k,
          station: station.trim() || undefined,
          receiptId,
          at: Date.now(),
        })
      );
      notify(r === 'queued' ? 'Saved — will sync when online' : 'Fuel entry saved', r === 'queued' ? 'warn' : 'ok');
      setLitres('');
      setAmount('');
      setOdo('');
      setStation('');
      setReceipt([]);
      setTouched(false);
      setForm(false);
    } catch (ex) {
      notify(ex instanceof Error ? ex.message : 'Could not save', 'err');
    } finally {
      setBusy(false);
    }
  };

  const price = l > 0 && a > 0 ? a / l : null;

  return (
    <div className="drv-page">
      {!form ? (
        <button type="button" className="btn btn-primary btn-block drv-btn-xl" onClick={() => setForm(true)}>
          <Icon name="plus" size={22} /> Add fuel slip
        </button>
      ) : (
        <form className="drv-card stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
          <div className="drv-spread">
            <h2 className="drv-h" style={{ margin: 0 }}>
              New fuel entry
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(false)}>
              Cancel
            </button>
          </div>
          <label className="field">
            <span className="label">Vehicle</span>
            <select className="select drv-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} aria-invalid={touched && !!errs.vehicle}>
              <option value="">Choose…</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration} — {v.name}
                </option>
              ))}
            </select>
          </label>
          <div className="drv-grid2">
            <label className="field">
              <span className="label">Litres</span>
              <input
                className="input drv-input"
                inputMode="decimal"
                value={litres}
                onChange={(e) => setLitres(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="e.g. 180"
                aria-invalid={touched && !!errs.litres}
              />
            </label>
            <label className="field">
              <span className="label">Amount ({country.currencySymbol})</span>
              <input
                className="input drv-input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="e.g. 4120"
                aria-invalid={touched && !!errs.amount}
              />
            </label>
          </div>
          {price && <span className="hint">≈ {fmtMoney(Math.round(price * 100) / 100)} per litre</span>}
          <div className="field">
            <span className="label" id="fuel-odo">
              Odometer (km)
            </span>
            <div className="drv-inline">
              <input
                className="input drv-input"
                inputMode="decimal"
                value={odo}
                onChange={(e) => setOdo(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder={vehicle ? String(Math.round(vehicle.odometerKm)) : 'km'}
                aria-labelledby="fuel-odo"
                aria-invalid={touched && !!errs.odo}
              />
              <button type="button" className="btn btn-ghost drv-btn" onClick={() => setScan(true)}>
                <Icon name="eye" size={18} /> Scan
              </button>
            </div>
          </div>
          <label className="field">
            <span className="label">Station (optional)</span>
            <input className="input drv-input" value={station} onChange={(e) => setStation(e.target.value.slice(0, 80))} placeholder="e.g. Engen Midrand" />
          </label>
          <PhotoField label="Receipt photo" value={receipt} onChange={setReceipt} max={1} maxSide={1280} quality={0.6} />
          {touched && !valid && (
            <p className="alert alert-warn" role="alert">
              {[errs.vehicle, errs.litres, errs.amount, errs.odo].filter(Boolean).join(' · ')}
            </p>
          )}
          <button className="btn btn-primary btn-block drv-btn-xl" disabled={busy}>
            {busy ? 'Saving…' : 'Save fuel entry'}
          </button>
        </form>
      )}

      <h2 className="drv-h drv-h-list">My recent fill-ups</h2>
      {entries === null ? (
        <div className="skeleton" style={{ height: 90 }} />
      ) : entries.length === 0 ? (
        <Empty icon="bolt" title="No fuel entries yet" text="Log every fill-up with the slip — it keeps the fleet's fuel records straight." />
      ) : (
        <ul className="drv-fuel-list">
          {entries.slice(0, 30).map((e) => {
            const v = vehicles.find((x) => x.id === e.vehicleId);
            const eco = economy.get(e.id);
            return (
              <li key={e.id} className="drv-fuel">
                <div className="drv-fuel-main">
                  <strong>{e.litres.toLocaleString()} L</strong>
                  <span>{fmtMoney(e.amount)}</span>
                </div>
                <div className="drv-fuel-meta">
                  <span>
                    {new Date(e.at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span>{v?.registration ?? e.vehicleId}</span>
                  <span>{fmtKm(e.odometerKm)}</span>
                  {e.station && <span>{e.station}</span>}
                </div>
                {eco && (
                  <span className="drv-eco" title={`${eco.km} km since previous fill-up`}>
                    {eco.l100.toFixed(1)} L/100 km
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {scan && (
        <Sheet title="Odometer" step="Fuel entry" onClose={() => setScan(false)}>
          <OdoCapture
            tenantId={tenantId}
            user={user}
            kind="fuel_odo"
            label="Odometer at fill-up"
            lastKnownKm={vehicle?.odometerKm}
            onCancel={() => setScan(false)}
            onDone={(r) => {
              setOdo(String(r.km));
              setScan(false);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

/** L/100 km for each entry vs the previous fill-up of the same vehicle (fill-to-full method). */
function lPer100(entries: FuelEntry[]): Map<string, { l100: number; km: number }> {
  const out = new Map<string, { l100: number; km: number }>();
  const byV = new Map<string, FuelEntry[]>();
  for (const e of entries) byV.set(e.vehicleId, [...(byV.get(e.vehicleId) ?? []), e]);
  for (const list of byV.values()) {
    const s = list.slice().sort((a, b) => a.odometerKm - b.odometerKm || a.at - b.at);
    for (let i = 1; i < s.length; i++) {
      const km = s[i].odometerKm - s[i - 1].odometerKm;
      if (km >= 10 && km < 5000) {
        const l100 = (s[i].litres / km) * 100;
        if (l100 > 1 && l100 < 150) out.set(s[i].id, { l100, km });
      }
    }
  }
  return out;
}
