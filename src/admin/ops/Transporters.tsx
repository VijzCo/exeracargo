// Transporters (subcontractors): company, compliance documents, mixed rate cards, scorecard.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { isValidPhone, normalisePhone } from '../../geo';
import JobStatusPill from '../../ops/JobStatusPill';
import { deleteTransporter, newId, saveTransporter } from '../../ops/store';
import { RATE_BASIS_LABEL, type RateBasis, type RateLine, type Transporter } from '../../ops/types';
import type { VehicleType } from '../../tenant/types';
import { useTenant } from '../../tenant/TenantProvider';
import { EmptyState, errMsg, Field, Modal, PageHeader, Toggle, useUi } from '../ui';
import { effectiveCost } from './cost';
import { useDrivers, useFinance, useJobs, useOpsUser, useToday, useTransporters, useVehicles } from './hooks';
import { ACTIVE, DONE, scheduledAt, TRANSPORTER_DOCS } from './lib';
import { ExpiryBadge, LoadingRows } from './widgets';
import { VEHICLE_TYPES } from './Vehicles';
import './ops-admin.css';

export interface Score {
  jobs: number;
  done: number;
  failed: number;
  onTime: number;
  timed: number;
  spend: number;
  km: number;
}

/** Scorecard per transporter over the loaded jobs (on-time = trip started ≤ 30 min after schedule). */
export function useTransporterScores(days = 90): Map<string, Score> {
  const { data: jobs } = useJobs(days);
  const { data: fin } = useFinance();
  const { tz } = useToday();
  return useMemo(() => {
    const m = new Map<string, Score>();
    for (const j of jobs) {
      if (!j.transporterId) continue;
      const s = m.get(j.transporterId) ?? { jobs: 0, done: 0, failed: 0, onTime: 0, timed: 0, spend: 0, km: 0 };
      s.jobs++;
      if (DONE.includes(j.status)) s.done++;
      if (j.status === 'failed') s.failed++;
      if (j.odoStart) {
        s.timed++;
        if (j.odoStart.at <= scheduledAt(j, tz) + 30 * 60_000) s.onTime++;
      }
      s.km += j.actualKm ?? 0;
      const c = effectiveCost(fin.get(j.id)?.cost, j);
      if (c && DONE.includes(j.status)) s.spend += c.total;
      m.set(j.transporterId, s);
    }
    return m;
  }, [jobs, fin, tz]);
}

export default function Transporters() {
  useOpsUser();
  const { today } = useToday();
  const { fmtMoney } = useTenant();
  const [params, setParams] = useSearchParams();
  const { data: transporters, loading } = useTransporters();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const scores = useTransporterScores(90);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const open = params.get('open');
  const setOpen = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('open', v);
    else next.delete('open');
    setParams(next, { replace: true });
  };
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return transporters.filter((t) => (showInactive || t.active) && (!n || [t.name, t.contactName, t.phone, t.vatNo, t.regNo].filter(Boolean).some((s) => String(s).toLowerCase().includes(n))));
  }, [transporters, q, showInactive]);
  const selected = open && open !== 'new' ? transporters.find((t) => t.id === open) ?? null : null;

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Transporters"
        subtitle={loading ? 'Loading…' : `${transporters.filter((t) => t.active).length} active subcontractors · hired trucks and drivers are linked to them`}
        actions={
          <>
            <Link to="/admin/settlements" className="btn btn-ghost btn-sm">
              <Icon name="tag" size={16} /> Settlements
            </Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('new')}>
              <Icon name="plus" size={16} /> Add transporter
            </button>
          </>
        }
      />
      <div className="card ops-filters ops-filters-2">
        <label className="field ops-f-search">
          <span className="label">Search</span>
          <div className="adm-affix">
            <input className="input" type="search" placeholder="Name, contact, VAT…" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="adm-affix-s" aria-hidden>
              <Icon name="search" size={16} />
            </span>
          </div>
        </label>
        <div className="ops-f-toggle">
          <Toggle checked={showInactive} onChange={setShowInactive} label="Show inactive" />
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="truck" title={transporters.length ? 'No transporters match' : 'No transporters yet'}>
            {transporters.length ? 'Try another search.' : 'Add the companies you hire trucks and drivers from — with their rate card and GIT insurance.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table adm-table-click">
            <thead>
              <tr>
                <th>Transporter</th>
                <th className="adm-hide-sm">Fleet</th>
                <th className="adm-hide-md">Rates</th>
                <th>Compliance</th>
                <th className="adm-num adm-hide-sm">Jobs (90 d)</th>
                <th className="adm-num adm-hide-md">On time</th>
                <th className="adm-num adm-hide-md">Spend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const s = scores.get(t.id);
                const nV = vehicles.filter((v) => v.transporterId === t.id).length;
                const nD = drivers.filter((d) => d.transporterId === t.id && !d.external).length;
                return (
                  <tr key={t.id} onClick={() => setOpen(t.id)}>
                    <td>
                      <button
                        type="button"
                        className="adm-link adm-row-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(t.id);
                        }}
                      >
                        {t.name}
                      </button>
                      {!t.active ? <span className="ops-chip ops-lvl-none">Inactive</span> : null}
                      <div className="muted tiny">
                        {t.contactName} · {t.phone}
                      </div>
                    </td>
                    <td className="adm-hide-sm small">
                      {nV} truck{nV === 1 ? '' : 's'} · {nD} driver{nD === 1 ? '' : 's'}
                    </td>
                    <td className="adm-hide-md small">
                      {t.rates.length ? t.rates.map((r) => `${fmtMoney(r.amount)} ${RATE_BASIS_LABEL[r.basis]}`).slice(0, 2).join(' · ') : <span className="muted">No rates</span>}
                      {t.rates.length > 2 ? <span className="muted"> +{t.rates.length - 2}</span> : null}
                    </td>
                    <td>
                      <div className="ops-chips">
                        {TRANSPORTER_DOCS.map((d) => (
                          <ExpiryBadge key={d.key} label={d.label} date={t[d.key]} today={today} hideOk={d.key !== 'gitInsuranceExpiry'} />
                        ))}
                      </div>
                    </td>
                    <td className="adm-num adm-hide-sm">
                      {s?.done ?? 0}
                      {s?.failed ? <div className="tiny ops-text-err">{s.failed} failed</div> : null}
                    </td>
                    <td className="adm-num adm-hide-md">{s && s.timed ? `${Math.round((s.onTime / s.timed) * 100)}%` : '—'}</td>
                    <td className="adm-num adm-hide-md">{s?.spend ? fmtMoney(Math.round(s.spend)) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open === 'new' || selected ? <TransporterDrawer key={selected?.id ?? 'new'} transporter={selected} onClose={() => setOpen(null)} onCreated={(id) => setOpen(id)} /> : null}
    </div>
  );
}

type Form = Omit<Transporter, 'createdAt' | 'updatedAt'> & { createdAt?: number };

const blank = (): Form => ({ id: '', name: '', contactName: '', phone: '', rates: [], active: true, vatRegistered: false, paymentTermsDays: 30 });
const BASES = Object.keys(RATE_BASIS_LABEL) as RateBasis[];

function TransporterDrawer({ transporter, onClose, onCreated }: { transporter: Transporter | null; onClose: () => void; onCreated: (id: string) => void }) {
  const { tenant, country, fmtMoney } = useTenant();
  const { today } = useToday();
  const { toast, confirm } = useUi();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { data: jobs } = useJobs(365);
  const scores = useTransporterScores(90);
  const [f, setF] = useState<Form>(() => (transporter ? { ...transporter, rates: transporter.rates.map((r) => ({ ...r })) } : blank()));
  const [tab, setTab] = useState<'details' | 'rates' | 'score'>('details');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const isNew = !transporter;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setRate = (i: number, patch: Partial<RateLine>) => setF((p) => ({ ...p, rates: p.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = 'Company name is required.';
  if (!f.contactName.trim()) errs.contactName = 'Contact person is required.';
  if (!f.phone.trim()) errs.phone = 'Phone is required.';
  else if (!isValidPhone(f.phone, country.code, true)) errs.phone = `Enter a valid number, e.g. ${country.phonePlaceholder}.`;
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errs.email = 'Invalid e-mail.';
  f.rates.forEach((r, i) => {
    if (!(r.amount > 0)) errs[`rate${i}`] = 'Amount must be more than 0.';
  });
  const show = (k: string) => (tried ? errs[k] : undefined);

  const save = async () => {
    setTried(true);
    if (Object.keys(errs).length) {
      if (Object.keys(errs).some((k) => k.startsWith('rate'))) setTab('rates');
      else setTab('details');
      return toast('Please fix the highlighted fields', 'err');
    }
    setBusy(true);
    try {
      const id = f.id || newId();
      await saveTransporter(tenant.id, {
        ...f,
        id,
        name: f.name.trim(),
        contactName: f.contactName.trim(),
        phone: normalisePhone(f.phone, country.code),
        email: f.email?.trim() || undefined,
        notes: f.notes?.trim() || undefined,
        bank: f.bank && (f.bank.bank || f.bank.accountNo) ? f.bank : undefined,
        rates: f.rates.map((r) => ({ ...r, note: r.note?.trim() || undefined, minCharge: r.minCharge || undefined })),
      });
      toast(`${f.name.trim()} saved`);
      if (isNew) onCreated(id);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!transporter) return;
    const linked = vehicles.filter((v) => v.transporterId === transporter.id).length + drivers.filter((d) => d.transporterId === transporter.id && !d.external).length;
    const open = jobs.find((j) => j.transporterId === transporter.id && ACTIVE.includes(j.status));
    if (open) return toast(`${transporter.name} has open job ${open.ref} — finish or reassign it first.`, 'err');
    const ok = await confirm({
      title: `Delete ${transporter.name}?`,
      body: linked ? `${linked} hired truck(s)/driver(s) still point to this transporter. Prefer switching it to inactive.` : 'Past jobs and settlements keep the name. Prefer switching it to inactive.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransporter(tenant.id, transporter.id);
      toast(`${transporter.name} deleted`);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const s = transporter ? scores.get(transporter.id) : undefined;
  const tJobs = transporter ? jobs.filter((j) => j.transporterId === transporter.id).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)) : [];
  const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)));

  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={isNew ? 'Add transporter' : transporter.name}
      footer={
        <>
          {!isNew ? (
            <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => void remove()} style={{ marginRight: 'auto' }}>
              <Icon name="trash" size={16} /> Delete
            </button>
          ) : null}
          {!isNew && transporter ? (
            <Link className="btn btn-ghost btn-sm" to={`/admin/legal/transporter?transporter=${encodeURIComponent(transporter.id)}`}>
              <Icon name="contract" size={16} /> Agreement
            </Link>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          {tab !== 'score' ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : isNew ? 'Add transporter' : 'Save'}
            </button>
          ) : null}
        </>
      }
    >
      <div className="tabs ops-tabs" role="tablist">
        <button type="button" role="tab" className="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>
          Company & compliance
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === 'rates'} onClick={() => setTab('rates')}>
          Rate card ({f.rates.length})
        </button>
        {!isNew ? (
          <button type="button" role="tab" className="tab" aria-selected={tab === 'score'} onClick={() => setTab('score')}>
            Scorecard
          </button>
        ) : null}
      </div>

      {tab === 'details' ? (
        <div className="stack">
          {!isNew ? (
            <div className="ops-chips">
              {TRANSPORTER_DOCS.map((d) => (
                <ExpiryBadge key={d.key} label={d.label} date={transporter[d.key]} today={today} />
              ))}
            </div>
          ) : null}
          <div className="form-grid">
            <Field label="Company name *" error={show('name')}>
              <input className="input" value={f.name} maxLength={120} aria-invalid={!!show('name') || undefined} onChange={(e) => set('name', e.target.value)} data-autofocus />
            </Field>
            <Field label="Contact person *" error={show('contactName')}>
              <input className="input" value={f.contactName} maxLength={80} aria-invalid={!!show('contactName') || undefined} onChange={(e) => set('contactName', e.target.value)} />
            </Field>
            <Field label="Phone *" error={show('phone')}>
              <input className="input" type="tel" inputMode="tel" value={f.phone} maxLength={24} placeholder={country.phonePlaceholder} aria-invalid={!!show('phone') || undefined} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="E-mail" error={show('email')}>
              <input className="input" type="email" value={f.email ?? ''} maxLength={120} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Company reg. no.">
              <input className="input mono" value={f.regNo ?? ''} maxLength={40} onChange={(e) => set('regNo', e.target.value || undefined)} />
            </Field>
            <Field label="VAT no.">
              <input className="input mono" value={f.vatNo ?? ''} maxLength={30} onChange={(e) => set('vatNo', e.target.value || undefined)} />
            </Field>
            <div className="field span-2">
              <Toggle checked={!!f.vatRegistered} onChange={(v) => set('vatRegistered', v)} label="VAT registered" desc="Adds VAT to their settlement statements." />
            </div>
            <Field label="Payment terms">
              <div className="adm-affix">
                <input className="input" type="number" inputMode="numeric" min={0} max={180} value={f.paymentTermsDays ?? ''} onChange={(e) => set('paymentTermsDays', num(e.target.value))} />
                <span className="adm-affix-s">days</span>
              </div>
            </Field>
            <Field label="GIT insurance expiry *" hint="Expired or missing goods-in-transit cover blocks dispatch">
              <input className="input" type="date" value={f.gitInsuranceExpiry ?? ''} onChange={(e) => set('gitInsuranceExpiry', e.target.value || undefined)} />
            </Field>
            <Field label="GIT cover">
              <div className="adm-affix">
                <input className="input" type="number" inputMode="numeric" min={0} value={f.gitCover ?? ''} onChange={(e) => set('gitCover', num(e.target.value))} />
                <span className="adm-affix-s">{country.currencySymbol}</span>
              </div>
            </Field>
            <Field label="Tax clearance expiry">
              <input className="input" type="date" value={f.taxClearanceExpiry ?? ''} onChange={(e) => set('taxClearanceExpiry', e.target.value || undefined)} />
            </Field>
            <Field label="B-BBEE level">
              <select className="select" value={f.bbbeeLevel ?? ''} onChange={(e) => set('bbbeeLevel', e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    Level {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="B-BBEE certificate expiry">
              <input className="input" type="date" value={f.bbbeeExpiry ?? ''} onChange={(e) => set('bbbeeExpiry', e.target.value || undefined)} />
            </Field>
          </div>
          <h3 className="adm-h3">Bank details</h3>
          <div className="form-grid">
            <Field label="Bank">
              <input className="input" value={f.bank?.bank ?? ''} maxLength={60} onChange={(e) => set('bank', { accountName: '', accountNo: '', ...f.bank, bank: e.target.value })} />
            </Field>
            <Field label="Account name">
              <input className="input" value={f.bank?.accountName ?? ''} maxLength={80} onChange={(e) => set('bank', { bank: '', accountNo: '', ...f.bank, accountName: e.target.value })} />
            </Field>
            <Field label="Account no.">
              <input className="input mono" value={f.bank?.accountNo ?? ''} maxLength={30} inputMode="numeric" onChange={(e) => set('bank', { bank: '', accountName: '', ...f.bank, accountNo: e.target.value })} />
            </Field>
            <Field label="Branch code">
              <input className="input mono" value={f.bank?.branchCode ?? ''} maxLength={12} inputMode="numeric" onChange={(e) => set('bank', { bank: '', accountName: '', accountNo: '', ...f.bank, branchCode: e.target.value || undefined })} />
            </Field>
            <div className="field span-2">
              <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Active" desc="Inactive transporters’ trucks and drivers can’t be dispatched." />
            </div>
            <Field label="Notes" span>
              <textarea className="textarea" rows={3} maxLength={1000} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
      ) : tab === 'rates' ? (
        <div className="stack">
          <p className="muted small">Add one line per way you pay this transporter — per trip, km, day, hour, ton or load. Lines can be specific to a vehicle type. The job’s buy cost starts from the best matching line.</p>
          {f.rates.length === 0 ? <p className="muted small">No rates yet.</p> : null}
          {f.rates.map((r, i) => (
            <fieldset key={r.id} className="ops-stop ops-rate">
              <legend className="small">Rate {i + 1}</legend>
              <div className="form-grid ops-rate-grid">
                <Field label="Basis">
                  <select className="select" value={r.basis} onChange={(e) => setRate(i, { basis: e.target.value as RateBasis })}>
                    {BASES.map((b) => (
                      <option key={b} value={b}>
                        {RATE_BASIS_LABEL[b]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Amount (excl. VAT) *" error={show(`rate${i}`)}>
                  <div className="adm-affix">
                    <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={r.amount || ''} aria-invalid={!!show(`rate${i}`) || undefined} onChange={(e) => setRate(i, { amount: Math.max(0, Number(e.target.value) || 0) })} />
                    <span className="adm-affix-s">{country.currencySymbol}</span>
                  </div>
                </Field>
                <Field label="Vehicle type">
                  <select className="select" value={r.vehicleType ?? ''} onChange={(e) => setRate(i, { vehicleType: (e.target.value || undefined) as VehicleType | undefined })}>
                    <option value="">Any</option>
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Minimum charge">
                  <div className="adm-affix">
                    <input className="input" type="number" inputMode="decimal" min={0} value={r.minCharge ?? ''} onChange={(e) => setRate(i, { minCharge: num(e.target.value) })} />
                    <span className="adm-affix-s">{country.currencySymbol}</span>
                  </div>
                </Field>
                <Field label="Note / lane" span>
                  <input className="input" value={r.note ?? ''} maxLength={120} placeholder="JHB–DBN, fuel incl., 10 h day…" onChange={(e) => setRate(i, { note: e.target.value })} />
                </Field>
              </div>
              <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => setF((p) => ({ ...p, rates: p.rates.filter((_, j) => j !== i) }))}>
                <Icon name="trash" size={14} /> Remove
              </button>
            </fieldset>
          ))}
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((p) => ({ ...p, rates: [...p.rates, { id: newId(), basis: 'trip', amount: 0 }] }))}>
              <Icon name="plus" size={16} /> Add rate line
            </button>
          </div>
        </div>
      ) : transporter ? (
        <div className="stack">
          <div className="ops-kmrow ops-kmrow-4">
            <div className="ops-kmstat">
              <span className="tiny muted ops-upper">Jobs done (90 d)</span>
              <strong>{s?.done ?? 0}</strong>
              <span className="tiny">{s?.jobs ?? 0} assigned</span>
            </div>
            <div className="ops-kmstat">
              <span className="tiny muted ops-upper">On time</span>
              <strong>{s && s.timed ? `${Math.round((s.onTime / s.timed) * 100)}%` : '—'}</strong>
              <span className="tiny">start ≤ 30 min late</span>
            </div>
            <div className={`ops-kmstat${s?.failed ? ' ops-kmstat-warn' : ''}`}>
              <span className="tiny muted ops-upper">Failed</span>
              <strong>{s?.failed ?? 0}</strong>
            </div>
            <div className="ops-kmstat">
              <span className="tiny muted ops-upper">Spend</span>
              <strong>{fmtMoney(Math.round(s?.spend ?? 0))}</strong>
              <span className="tiny">{Math.round(s?.km ?? 0).toLocaleString()} km</span>
            </div>
          </div>
          <h3 className="adm-h3">Trucks & drivers</h3>
          <ul className="ops-hist">
            {vehicles
              .filter((v) => v.transporterId === transporter.id)
              .map((v) => (
                <li key={v.id}>
                  <Link className="adm-link mono small" to={`/admin/vehicles?open=${encodeURIComponent(v.id)}`}>
                    {v.registration}
                  </Link>
                  <span className="small ops-ellip">{v.name}</span>
                </li>
              ))}
            {drivers
              .filter((d) => d.transporterId === transporter.id && !d.external)
              .map((d) => (
                <li key={d.id}>
                  <Link className="adm-link small" to={`/admin/drivers?open=${encodeURIComponent(d.id)}`}>
                    {d.name}
                  </Link>
                  <span className="small muted">{d.phone}</span>
                </li>
              ))}
          </ul>
          <h3 className="adm-h3">Recent jobs</h3>
          {tJobs.length === 0 ? (
            <p className="muted small">No jobs yet.</p>
          ) : (
            <ul className="ops-hist">
              {tJobs.slice(0, 40).map((j) => (
                <li key={j.id}>
                  <Link to={`/admin/jobs/${encodeURIComponent(j.id)}`} className="adm-link mono small">
                    {j.ref}
                  </Link>
                  <span className="small ops-ellip">
                    {j.scheduledDate} · {j.pickup.place} → {j.dropoff.place}
                  </span>
                  <JobStatusPill status={j.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
