// Lean operations reports: jobs + fuel for a date range, totals and CSV export.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import JobStatusPill from '../../ops/JobStatusPill';
import { FUEL_CAP, jobPrice, JOBS_CAP } from '../../ops/store';
import { JOB_STATUS_LABEL } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { downloadText, EmptyState, PageHeader, useUi } from '../ui';
import { useDrivers, useFinance, useFuel, useJobs, useOpsUser, useToday, useVehicles } from './hooks';
import { effectiveCost, VAT_ZA } from './cost';
import { HiredTag } from './widgets';
import { addDays, csv, DAY, DONE, fmtTs, ymdIn } from './lib';
import { LoadingRows } from './widgets';
import './ops-admin.css';

export default function Reports() {
  useOpsUser();
  const { tenant, fmtMoney } = useTenant();
  const { today, tz } = useToday();
  const { toast } = useUi();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const sinceDays = Math.min(730, Math.max(31, Math.ceil((Date.now() - Date.parse(`${from}T00:00:00Z`)) / DAY) + 2));
  const jobsQ = useJobs(sinceDays);
  const { data: fuelAll } = useFuel();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { data: finance } = useFinance();
  const { country } = useTenant();
  const vat = country.code === 'ZA' ? VAT_ZA : 0.18;
  const price = (j: (typeof jobs)[number]) => jobPrice(j, finance.get(j.id));
  const cost = (j: (typeof jobs)[number]) => effectiveCost(finance.get(j.id)?.cost, j)?.total;
  const vReg = (id?: string) => vehicles.find((v) => v.id === id)?.registration ?? '';
  const dName = (id?: string) => drivers.find((d) => d.id === id)?.name ?? '';

  const jobs = useMemo(() => jobsQ.data.filter((j) => j.scheduledDate >= from && j.scheduledDate <= to).sort((a, b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`)), [jobsQ.data, from, to]);
  const fuel = useMemo(() => fuelAll.filter((e) => {
    const d = ymdIn(tz, e.at);
    return d >= from && d <= to;
  }), [fuelAll, from, to, tz]);

  const t = useMemo(() => {
    const done = jobs.filter((j) => DONE.includes(j.status));
    const revenue = done.reduce((a, j) => a + (price(j) ?? 0), 0);
    const booked = jobs.filter((j) => j.status !== 'cancelled' && j.status !== 'failed').reduce((a, j) => a + (price(j) ?? 0), 0);
    const km = jobs.reduce((a, j) => a + (j.actualKm ?? 0), 0);
    const estKm = jobs.reduce((a, j) => a + (j.estimatedKm ?? 0), 0);
    const litres = fuel.reduce((a, e) => a + e.litres, 0);
    const spend = fuel.reduce((a, e) => a + e.amount, 0);
    return { done: done.length, failed: jobs.filter((j) => j.status === 'failed').length, cancelled: jobs.filter((j) => j.status === 'cancelled').length, revenue, booked, km, estKm, litres, spend, cpk: km > 0 ? spend / km : null, rpk: km > 0 ? revenue / km : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, fuel, finance]);

  /** Own vs hired split + spend per transporter (delivered jobs). */
  const split = useMemo(() => {
    const row = () => ({ jobs: 0, km: 0, revenue: 0, cost: 0, costed: 0 });
    const own = row();
    const hired = row();
    const per = new Map<string, { name: string; jobs: number; km: number; revenue: number; cost: number; missing: number }>();
    for (const j of jobs) {
      if (!DONE.includes(j.status)) continue;
      const r = j.ownership === 'hired' ? hired : own;
      const p = price(j) ?? 0;
      const c = cost(j);
      r.jobs++;
      r.km += j.actualKm ?? 0;
      r.revenue += p;
      if (c !== undefined) {
        r.cost += c;
        r.costed++;
      }
      if (j.ownership === 'hired') {
        const k = j.transporterId ?? '—';
        const e = per.get(k) ?? { name: j.transporterName ?? 'Unknown transporter', jobs: 0, km: 0, revenue: 0, cost: 0, missing: 0 };
        e.jobs++;
        e.km += j.actualKm ?? 0;
        e.revenue += p;
        if (c !== undefined) e.cost += c;
        else e.missing++;
        per.set(k, e);
      }
    }
    return { own, hired, per: [...per.entries()].sort((a, b) => b[1].cost - a[1].cost) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, finance]);
  const marginOf = (revenue: number, c: number) => Math.round((revenue / (1 + vat) - c) * 100) / 100;

  const preset = (p: 'month' | 'last' | '7' | '30') => {
    if (p === 'month') {
      setFrom(`${today.slice(0, 8)}01`);
      setTo(today);
    } else if (p === 'last') {
      const first = `${today.slice(0, 8)}01`;
      const end = addDays(first, -1);
      setFrom(`${end.slice(0, 8)}01`);
      setTo(end);
    } else {
      setFrom(addDays(today, p === '7' ? -6 : -29));
      setTo(today);
    }
  };

  const exportJobs = () => {
    if (!jobs.length) return toast('No jobs in this range', 'info');
    const rows = [
      ['Ref', 'Date', 'Time', 'Customer', 'Company', 'From', 'To', 'Stops', 'Vehicle', 'Driver', 'Ownership', 'Transporter', 'Status', `Price (${tenant.locale.currency})`, `Buy cost excl. VAT (${tenant.locale.currency})`, 'Est km', 'Actual km', 'ODO start', 'ODO start method', 'ODO end', 'ODO end method', 'Delivered at', 'POD recipient', 'Booking ref'],
      ...jobs.map((j) => [
        j.ref,
        j.scheduledDate,
        j.scheduledTime,
        j.customer.name,
        j.customer.company,
        j.pickup.place,
        j.dropoff.place,
        j.stops?.length ?? 2,
        j.vehicleReg ?? vReg(j.vehicleId),
        j.driverName ?? dName(j.driverId),
        j.ownership ?? 'own',
        j.transporterName,
        JOB_STATUS_LABEL[j.status],
        price(j),
        cost(j),
        j.estimatedKm,
        j.actualKm,
        j.odoStart?.km,
        j.odoStart?.method,
        j.odoEnd?.km,
        j.odoEnd?.method,
        j.pod ? new Date(j.pod.at).toISOString() : '',
        j.pod?.recipientName,
        j.bookingRef,
      ]),
    ];
    downloadText(`${tenant.id}-jobs-${from}_${to}.csv`, csv(rows), 'text/csv');
    toast(`Exported ${jobs.length} job${jobs.length === 1 ? '' : 's'}`);
  };
  const exportFuel = () => {
    if (!fuel.length) return toast('No fuel entries in this range', 'info');
    const rows = [
      ['Date', 'Vehicle', 'Driver', 'Litres', `Amount (${tenant.locale.currency})`, 'Price per L', 'ODO km', 'Station', 'Job'],
      ...fuel.map((e) => [new Date(e.at).toISOString(), vReg(e.vehicleId), dName(e.driverId), e.litres, e.amount, e.litres ? (e.amount / e.litres).toFixed(2) : '', e.odometerKm, e.station, e.jobId]),
    ];
    downloadText(`${tenant.id}-fuel-${from}_${to}.csv`, csv(rows), 'text/csv');
    toast(`Exported ${fuel.length} fuel entr${fuel.length === 1 ? 'y' : 'ies'}`);
  };

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Reports"
        subtitle={`${jobs.length} jobs · ${fuel.length} fuel entries · ${from} to ${to}`}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={exportFuel}>
              <Icon name="download" size={16} /> Fuel CSV
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={exportJobs}>
              <Icon name="download" size={16} /> Jobs CSV
            </button>
          </>
        }
      />
      <div className="card ops-filters ops-filters-rep">
        <label className="field">
          <span className="label">From</span>
          <input className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">To</span>
          <input className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <div className="ops-seg" role="group" aria-label="Quick ranges">
          <button type="button" className="ops-seg-btn" onClick={() => preset('month')}>
            This month
          </button>
          <button type="button" className="ops-seg-btn" onClick={() => preset('last')}>
            Last month
          </button>
          <button type="button" className="ops-seg-btn" onClick={() => preset('7')}>
            7 d
          </button>
          <button type="button" className="ops-seg-btn" onClick={() => preset('30')}>
            30 d
          </button>
        </div>
      </div>

      <div className="adm-kpis ops-kpis-6">
        <Stat label="Revenue (delivered)" value={fmtMoney(t.revenue)} sub={`${fmtMoney(t.booked)} booked`} />
        <Stat label="Jobs delivered" value={String(t.done)} sub={`${t.failed} failed · ${t.cancelled} cancelled`} />
        <Stat label="Km driven" value={Math.round(t.km).toLocaleString()} sub={`${Math.round(t.estKm).toLocaleString()} km estimated`} />
        <Stat label="Fuel" value={`${Math.round(t.litres).toLocaleString()} L`} sub={fmtMoney(t.spend)} />
        <Stat label="Fuel cost / km" value={t.cpk !== null ? fmtMoney(Math.round(t.cpk * 100) / 100) : '—'} sub="Fuel spend ÷ actual km" />
        <Stat label="Revenue / km" value={t.rpk !== null ? fmtMoney(Math.round(t.rpk * 100) / 100) : '—'} sub="Delivered revenue ÷ actual km" />
      </div>

      <div className="ops-rep-split">
        <section className="card ops-block">
          <h2 className="adm-h2">Own vs hired (delivered)</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th className="adm-num">Jobs</th>
                  <th className="adm-num">Km</th>
                  <th className="adm-num">Revenue</th>
                  <th className="adm-num">Buy cost</th>
                  <th className="adm-num">Margin</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Own fleet', split.own],
                    ['Hired', split.hired],
                  ] as const
                ).map(([label, r]) => (
                  <tr key={label}>
                    <td className="small">{label}</td>
                    <td className="adm-num">{r.jobs}</td>
                    <td className="adm-num">{Math.round(r.km).toLocaleString()}</td>
                    <td className="adm-num">{fmtMoney(r.revenue)}</td>
                    <td className="adm-num">{label === 'Hired' ? fmtMoney(r.cost) : '—'}</td>
                    <td className="adm-num">
                      {label === 'Hired' && r.jobs ? (
                        <>
                          {fmtMoney(marginOf(r.revenue, r.cost))}
                          {r.costed < r.jobs ? <div className="tiny ops-text-warn">{r.jobs - r.costed} without cost</div> : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted tiny">Own-fleet margin needs fuel, wages and maintenance — see fuel cost / km above. Hired margin = revenue excl. VAT − buy cost.</p>
        </section>
        <section className="card ops-block">
          <h2 className="adm-h2">Spend per transporter</h2>
          {split.per.length === 0 ? (
            <p className="muted small">No delivered hired jobs in this range.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Transporter</th>
                    <th className="adm-num">Jobs</th>
                    <th className="adm-num">Spend</th>
                    <th className="adm-num">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {split.per.map(([id, e]) => (
                    <tr key={id}>
                      <td className="small">
                        {id !== '—' ? (
                          <Link className="adm-link" to={`/admin/transporters?open=${encodeURIComponent(id)}`}>
                            {e.name}
                          </Link>
                        ) : (
                          e.name
                        )}
                        {e.missing ? <div className="tiny ops-text-warn">{e.missing} without cost</div> : null}
                      </td>
                      <td className="adm-num">{e.jobs}</td>
                      <td className="adm-num">{fmtMoney(Math.round(e.cost * 100) / 100)}</td>
                      <td className="adm-num">{fmtMoney(marginOf(e.revenue, e.cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {jobsQ.loading ? (
        <LoadingRows />
      ) : jobs.length === 0 ? (
        <div className="card">
          <EmptyState icon="chart" title="No jobs in this range">
            Pick another period.
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table ops-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Date</th>
                <th className="adm-hide-sm">Customer</th>
                <th className="adm-hide-md">Route</th>
                <th className="adm-hide-md">Vehicle · driver</th>
                <th>Status</th>
                <th className="adm-num">Price</th>
                <th className="adm-num adm-hide-sm">Km est / act</th>
                <th className="adm-hide-md">ODO</th>
                <th className="adm-hide-md">POD</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link className="adm-link mono" to={`/admin/jobs/${encodeURIComponent(j.id)}`}>
                      {j.ref}
                    </Link>
                  </td>
                  <td className="small">
                    {j.scheduledDate}
                    <div className="muted tiny">{j.scheduledTime}</div>
                  </td>
                  <td className="adm-hide-sm small">{j.customer.name}</td>
                  <td className="adm-hide-md small">
                    {j.pickup.place} → {j.dropoff.place}
                  </td>
                  <td className="adm-hide-md small">
                    {j.vehicleReg ?? '—'} <HiredTag x={j} short />
                    <div className="muted tiny">{j.driverName ?? '—'}</div>
                  </td>
                  <td>
                    <JobStatusPill status={j.status} />
                  </td>
                  <td className="adm-num">
                    {price(j) !== undefined ? fmtMoney(price(j)!) : '—'}
                    {cost(j) !== undefined ? <div className="muted tiny">buy {fmtMoney(cost(j)!)}</div> : null}
                  </td>
                  <td className="adm-num adm-hide-sm small">
                    {j.estimatedKm ?? '—'} / {j.actualKm ?? '—'}
                  </td>
                  <td className="adm-hide-md small mono">
                    {j.odoStart ? `${j.odoStart.km.toLocaleString()}${j.odoStart.method === 'ocr' ? ' ·OCR' : ''}` : '—'}
                    {j.odoEnd ? <div className="tiny">→ {j.odoEnd.km.toLocaleString()}{j.odoEnd.method === 'ocr' ? ' ·OCR' : ''}</div> : null}
                  </td>
                  <td className="adm-hide-md small">
                    {j.pod ? (
                      <>
                        {j.pod.recipientName}
                        <div className="muted tiny">{fmtTs(j.pod.at)}</div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted tiny" style={{ marginTop: 12 }}>
        Reports read up to the {JOBS_CAP.toLocaleString()} most recently updated jobs and {FUEL_CAP.toLocaleString()} fuel entries. Export CSV
        monthly for longer history.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card adm-kpi">
      <span className="muted small">{label}</span>
      <div className="adm-kpi-value">{value}</div>
      <div className="muted tiny">{sub}</div>
    </div>
  );
}
