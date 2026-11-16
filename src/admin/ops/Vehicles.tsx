// Fleet units (actual trucks by registration): CRUD, compliance badges, per-vehicle history.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import JobStatusPill from '../../ops/JobStatusPill';
import { deleteVehicle, newId, saveVehicle } from '../../ops/store';
import type { FleetUnit, VehicleStatus } from '../../ops/types';
import type { VehicleType } from '../../tenant/types';
import { useTenant } from '../../tenant/TenantProvider';
import { EmptyState, errMsg, Field, Modal, PageHeader, useUi } from '../ui';
import { useFuel, useJobs, useOpsUser, useToday, useVehicles } from './hooks';
import { ACTIVE, fmtTs, VEHICLE_DOCS } from './lib';
import { ExpiryBadge, HiredTag, LoadingRows, ServiceBadge, VEHICLE_STATUS_LABEL, VehicleStatusBadge } from './widgets';
import { OwnershipFields } from './OwnershipFields';
import './ops-admin.css';

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'tipper', label: 'Tipper' },
  { value: 'lorry', label: 'Lorry / rigid' },
  { value: 'bakkie', label: 'Bakkie / pickup' },
  { value: 'van', label: 'Panel van' },
  { value: 'tautliner', label: 'Tautliner' },
  { value: 'superlink', label: 'Superlink' },
  { value: 'flatbed', label: 'Flatbed' },
  { value: 'reefer', label: 'Reefer (refrigerated)' },
  { value: 'lowbed', label: 'Lowbed' },
  { value: 'prime-mover', label: 'Prime mover' },
  { value: 'container', label: 'Container carrier' },
];
const typeLabel = (t: VehicleType) => VEHICLE_TYPES.find((x) => x.value === t)?.label ?? t;

export default function Vehicles() {
  useOpsUser();
  const { today } = useToday();
  const [params, setParams] = useSearchParams();
  const { data: vehicles, loading } = useVehicles();
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState<VehicleStatus | 'all'>('all');
  const [ownF, setOwnF] = useState<'all' | 'own' | 'hired'>('all');
  const open = params.get('open');
  const setOpen = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('open', v);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return vehicles.filter((v) => (statusF === 'all' || v.status === statusF) && (ownF === 'all' || (v.ownership ?? 'own') === ownF) && (!n || [v.registration, v.name, v.make, v.model, v.trackerId, v.transporterName].filter(Boolean).some((s) => String(s).toLowerCase().includes(n))));
  }, [vehicles, q, statusF, ownF]);
  const selected = open && open !== 'new' ? vehicles.find((v) => v.id === open) ?? null : null;

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Vehicles"
        subtitle={loading ? 'Loading…' : `${vehicles.length} unit${vehicles.length === 1 ? '' : 's'} · ${vehicles.filter((v) => v.status === 'available').length} available`}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('new')}>
            <Icon name="plus" size={16} /> Add vehicle
          </button>
        }
      />
      <div className="card ops-filters ops-filters-2">
        <label className="field ops-f-search">
          <span className="label">Search</span>
          <div className="adm-affix">
            <input className="input" type="search" placeholder="Registration, name, make…" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="adm-affix-s" aria-hidden>
              <Icon name="search" size={16} />
            </span>
          </div>
        </label>
        <label className="field">
          <span className="label">Status</span>
          <select className="select" value={statusF} onChange={(e) => setStatusF(e.target.value as VehicleStatus | 'all')}>
            <option value="all">All</option>
            {(Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[]).map((s) => (
              <option key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Ownership</span>
          <select className="select" value={ownF} onChange={(e) => setOwnF(e.target.value as 'all' | 'own' | 'hired')}>
            <option value="all">Own + hired</option>
            <option value="own">Own fleet</option>
            <option value="hired">Hired</option>
          </select>
        </label>
      </div>

      {loading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="truck" title={vehicles.length ? 'No vehicles match' : 'No vehicles yet'}>
            {vehicles.length ? 'Try another search.' : 'Add your trucks by registration to dispatch jobs and track compliance.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table adm-table-click">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th className="adm-hide-sm">Type</th>
                <th>Status</th>
                <th className="adm-num adm-hide-sm">Odometer</th>
                <th className="adm-hide-md">Compliance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} onClick={() => setOpen(v.id)}>
                  <td>
                    <button
                      type="button"
                      className="adm-link mono adm-row-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpen(v.id);
                      }}
                    >
                      {v.registration}
                    </button>
                    <div className="muted tiny">{v.name}</div>
                    <HiredTag x={v} />
                  </td>
                  <td className="adm-hide-sm small">
                    {typeLabel(v.type)}
                    {v.capacity ? <div className="muted tiny">{v.capacity}</div> : null}
                  </td>
                  <td>
                    <VehicleStatusBadge s={v.status} />
                  </td>
                  <td className="adm-num adm-hide-sm mono small">{(v.odometerKm ?? 0).toLocaleString()} km</td>
                  <td className="adm-hide-md">
                    <div className="ops-chips">
                      <ServiceBadge v={v} />
                      {VEHICLE_DOCS.map((d) => (
                        <ExpiryBadge key={d.key} label={d.label} date={v[d.key]} today={today} hideOk />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open === 'new' || selected ? <VehicleDrawer key={selected?.id ?? 'new'} vehicle={selected} all={vehicles} onClose={() => setOpen(null)} onCreated={(id) => setOpen(id)} /> : null}
    </div>
  );
}

type Form = Omit<FleetUnit, 'createdAt' | 'updatedAt'> & { createdAt?: number };

function blank(): Form {
  return { id: '', registration: '', name: '', type: 'tipper', status: 'available', odometerKm: 0 };
}

function VehicleDrawer({ vehicle, all, onClose, onCreated }: { vehicle: FleetUnit | null; all: FleetUnit[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { tenant } = useTenant();
  const { today } = useToday();
  const { toast, confirm } = useUi();
  const { data: jobs } = useJobs(365);
  const [f, setF] = useState<Form>(() => (vehicle ? { ...vehicle } : blank()));
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const isNew = !vehicle;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const reg = f.registration.trim().toUpperCase();
  const dup = all.some((v) => v.id !== f.id && v.registration.replace(/\W/g, '').toUpperCase() === reg.replace(/\W/g, ''));
  const errs: Record<string, string> = {};
  if (!reg) errs.registration = 'Registration is required.';
  else if (dup) errs.registration = 'Another vehicle has this registration.';
  if (!f.name.trim()) errs.name = 'Give it a friendly name.';
  if (f.year !== undefined && (f.year < 1960 || f.year > new Date().getFullYear() + 1)) errs.year = 'Check the year.';
  const show = (k: string) => (tried ? errs[k] : undefined);

  if (f.ownership === 'hired' && !f.transporterId) errs.transporter = 'Pick the transporter.';
  const save = async () => {
    setTried(true);
    if (Object.keys(errs).length) return toast(errs.transporter ?? 'Please fix the highlighted fields', 'err');
    setBusy(true);
    try {
      const id = f.id || newId();
      await saveVehicle(tenant.id, { ...f, id, registration: reg, name: f.name.trim(), notes: f.notes?.trim() || undefined });
      toast(`${reg} saved`);
      if (isNew) onCreated(id);
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!vehicle) return;
    const busyJob = jobs.find((j) => j.vehicleId === vehicle.id && ACTIVE.includes(j.status));
    if (busyJob) return toast(`${vehicle.registration} is on active job ${busyJob.ref} — reassign it first.`, 'err');
    if (!(await confirm({ title: `Delete ${vehicle.registration}?`, body: 'Past jobs keep the registration. Consider setting the status to Inactive instead.', confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteVehicle(tenant.id, vehicle.id);
      toast(`${vehicle.registration} deleted`);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const numOpt = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)));

  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={
        isNew ? (
          'Add vehicle'
        ) : (
          <span className="row" style={{ gap: 10 }}>
            <span className="mono">{vehicle.registration}</span> <VehicleStatusBadge s={vehicle.status} />
          </span>
        )
      }
      footer={
        tab === 'details' ? (
          <>
            {!isNew ? (
              <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => void remove()} style={{ marginRight: 'auto' }}>
                <Icon name="trash" size={16} /> Delete
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
              {busy ? 'Saving…' : isNew ? 'Add vehicle' : 'Save'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      {!isNew ? (
        <div className="tabs ops-tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'details'} onClick={() => setTab('details')}>
            Details
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>
            History
          </button>
        </div>
      ) : null}
      {tab === 'history' && vehicle ? (
        <VehicleHistory v={vehicle} />
      ) : (
        <div className="stack">
          {!isNew ? (
            <div className="ops-chips">
              <ServiceBadge v={vehicle} />
              {VEHICLE_DOCS.map((d) => (
                <ExpiryBadge key={d.key} label={d.label} date={vehicle[d.key]} today={today} />
              ))}
            </div>
          ) : null}
          <div className="form-grid">
            <Field label="Registration *" error={show('registration')}>
              <input className="input mono" value={f.registration} maxLength={20} placeholder={tenant.locale.country === 'ZA' ? 'GP 123-456' : 'WP LB-1234'} aria-invalid={!!show('registration') || undefined} onChange={(e) => set('registration', e.target.value.toUpperCase())} data-autofocus />
            </Field>
            <Field label="Name *" error={show('name')}>
              <input className="input" value={f.name} maxLength={60} placeholder="Tipper 10m³ #3" aria-invalid={!!show('name') || undefined} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Type">
              <select className="select" value={f.type} onChange={(e) => set('type', e.target.value as VehicleType)}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className="select" value={f.status} onChange={(e) => set('status', e.target.value as VehicleStatus)}>
                {(Object.keys(VEHICLE_STATUS_LABEL) as VehicleStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {VEHICLE_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <OwnershipFields value={f} onChange={(p) => setF((x) => ({ ...x, ...p }))} error={show('transporter')} />
            <Field label="Public fleet listing" hint="Links the unit to a rate card on the website" span>
              <select className="select" value={f.fleetId ?? ''} onChange={(e) => set('fleetId', e.target.value || undefined)}>
                <option value="">— None —</option>
                {tenant.fleet.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Make">
              <input className="input" value={f.make ?? ''} maxLength={40} onChange={(e) => set('make', e.target.value || undefined)} />
            </Field>
            <Field label="Model">
              <input className="input" value={f.model ?? ''} maxLength={40} onChange={(e) => set('model', e.target.value || undefined)} />
            </Field>
            <Field label="Year" error={show('year')}>
              <input className="input" type="number" inputMode="numeric" value={f.year ?? ''} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Capacity">
              <input className="input" value={f.capacity ?? ''} maxLength={30} placeholder="10 m³ / 34 t" onChange={(e) => set('capacity', e.target.value || undefined)} />
            </Field>
            <Field label="Odometer" hint="Updated automatically from trip ODO readings">
              <div className="adm-affix">
                <input className="input" type="number" inputMode="numeric" min={0} value={f.odometerKm} onChange={(e) => set('odometerKm', Math.max(0, Number(e.target.value) || 0))} />
                <span className="adm-affix-s">km</span>
              </div>
            </Field>
            <Field label="Tracker / telematics ID">
              <input className="input mono" value={f.trackerId ?? ''} maxLength={40} onChange={(e) => set('trackerId', e.target.value || undefined)} />
            </Field>
            <Field label="Service interval">
              <div className="adm-affix">
                <input className="input" type="number" inputMode="numeric" min={0} value={f.serviceIntervalKm ?? ''} onChange={(e) => set('serviceIntervalKm', numOpt(e.target.value))} />
                <span className="adm-affix-s">km</span>
              </div>
            </Field>
            <Field label="Last service at">
              <div className="adm-affix">
                <input className="input" type="number" inputMode="numeric" min={0} value={f.lastServiceKm ?? ''} onChange={(e) => set('lastServiceKm', numOpt(e.target.value))} />
                <span className="adm-affix-s">km</span>
              </div>
            </Field>
            {VEHICLE_DOCS.map((d) => (
              <Field key={d.key} label={`${d.label} expiry`}>
                <input className="input" type="date" value={f[d.key] ?? ''} onChange={(e) => set(d.key, e.target.value || undefined)} />
              </Field>
            ))}
            <Field label="Notes" span>
              <textarea className="textarea" rows={3} maxLength={1000} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

function VehicleHistory({ v }: { v: FleetUnit }) {
  const { fmtMoney } = useTenant();
  const { data: allJobs, loading } = useJobs(365);
  const { data: fuel } = useFuel({ vehicleId: v.id });
  const jobs = useMemo(() => allJobs.filter((j) => j.vehicleId === v.id).sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)), [allJobs, v.id]);
  const stats = useMemo(() => {
    const km = jobs.reduce((a, j) => a + (j.actualKm ?? 0), 0);
    const litres = fuel.reduce((a, e) => a + e.litres, 0);
    const spend = fuel.reduce((a, e) => a + e.amount, 0);
    const byOdo = [...fuel].filter((e) => e.odometerKm > 0).sort((a, b) => a.odometerKm - b.odometerKm);
    let per100: number | null = null;
    if (byOdo.length >= 2) {
      const dist = byOdo[byOdo.length - 1].odometerKm - byOdo[0].odometerKm;
      const l = byOdo.slice(1).reduce((a, e) => a + e.litres, 0);
      if (dist > 0) per100 = (l / dist) * 100;
    }
    return { km, litres, spend, per100 };
  }, [jobs, fuel]);

  return (
    <div className="stack">
      <div className="ops-kmrow ops-kmrow-4">
        <div className="ops-kmstat">
          <span className="tiny muted ops-upper">Jobs</span>
          <strong>{jobs.length}</strong>
        </div>
        <div className="ops-kmstat">
          <span className="tiny muted ops-upper">Km driven</span>
          <strong>{Math.round(stats.km).toLocaleString()}</strong>
        </div>
        <div className="ops-kmstat">
          <span className="tiny muted ops-upper">Fuel</span>
          <strong>{Math.round(stats.litres).toLocaleString()} L</strong>
          <span className="tiny">{fmtMoney(stats.spend)}</span>
        </div>
        <div className="ops-kmstat">
          <span className="tiny muted ops-upper">Avg L/100 km</span>
          <strong>{stats.per100 !== null ? stats.per100.toFixed(1) : '—'}</strong>
        </div>
      </div>
      <h3 className="adm-h3">Jobs (last 12 months)</h3>
      {loading ? (
        <LoadingRows n={3} h={40} />
      ) : jobs.length === 0 ? (
        <p className="muted small">No jobs yet.</p>
      ) : (
        <ul className="ops-hist">
          {jobs.slice(0, 50).map((j) => (
            <li key={j.id}>
              <Link to={`/admin/jobs/${encodeURIComponent(j.id)}`} className="adm-link mono small">
                {j.ref}
              </Link>
              <span className="small ops-ellip">
                {j.scheduledDate} · {j.pickup.place} → {j.dropoff.place}
              </span>
              <span className="tiny muted">{j.actualKm !== undefined ? `${j.actualKm} km` : j.estimatedKm ? `~${j.estimatedKm} km` : ''}</span>
              <JobStatusPill status={j.status} />
            </li>
          ))}
        </ul>
      )}
      <h3 className="adm-h3">Fuel log</h3>
      {fuel.length === 0 ? (
        <p className="muted small">No fuel entries — drivers log fill-ups in the driver app.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="adm-num">Litres</th>
                <th className="adm-num">Amount</th>
                <th className="adm-num">ODO</th>
                <th className="adm-hide-sm">Station</th>
              </tr>
            </thead>
            <tbody>
              {fuel.slice(0, 50).map((e) => (
                <tr key={e.id}>
                  <td className="small">{fmtTs(e.at)}</td>
                  <td className="adm-num">{e.litres.toFixed(1)}</td>
                  <td className="adm-num">{fmtMoney(e.amount)}</td>
                  <td className="adm-num mono small">{e.odometerKm.toLocaleString()}</td>
                  <td className="adm-hide-sm small">{e.station ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
