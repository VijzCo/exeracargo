// Dispatch board (kanban) + table view of jobs. Realtime via watchJobs.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import JobStatusPill from '../../ops/JobStatusPill';
import { assignJob, jobPrice, migrateJobPrices } from '../../ops/store';
import { JOB_STATUS_LABEL, type Job, type JobStatus } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { EmptyState, errMsg, Modal, PageHeader, useUi } from '../ui';
import { useDrivers, useFinance, useJobs, useNow, useOpsUser, useToday, useVehicles } from './hooks';
import { addDays, DONE, isOverdue, jobMatches, ON_ROAD, timeAgo, ymdIn } from './lib';
import { AssignFields, HiredTag, LoadingRows, PriorityTag, TripTag, useAssignBlockers } from './widgets';
import { CancelModal, DuplicateModal, ImportModal, TripModal } from './Bulk';
import { SendLinkModal } from './ExtLink';
import './ops-admin.css';

type DateF = 'today' | 'tomorrow' | 'week' | 'all';
type ColKey = 'unassigned' | 'assigned' | 'road' | 'done' | 'problems';
const COLS: { key: ColKey; label: string; hint: string }[] = [
  { key: 'unassigned', label: 'Unassigned', hint: 'Draft jobs waiting for a vehicle and driver' },
  { key: 'assigned', label: 'Assigned', hint: 'Assigned or accepted — waiting for the driver to start' },
  { key: 'road', label: 'On the road', hint: 'Trip started, not yet delivered' },
  { key: 'done', label: 'Delivered', hint: 'Delivered or completed today (or in the selected period)' },
  { key: 'problems', label: 'Problems', hint: 'Failed, or more than 30 min past the scheduled time without starting' },
];
type StatusF = 'all' | 'open' | JobStatus;

export default function Dispatch({ view }: { view: 'board' | 'table' }) {
  const { tenant, fmtMoney } = useTenant();
  const { today, tz } = useToday();
  const now = useNow(30_000);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const jobsQ = useJobs(view === 'table' ? 90 : 30);
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const jobs = jobsQ.data;
  const { data: finance, loading: finLoading } = useFinance();
  // one-off: legacy jobs kept the price on the job doc (readable by drivers) → move it to finance
  const migrated = useRef(false);
  useEffect(() => {
    if (migrated.current || jobsQ.loading || finLoading || !jobs?.some((j) => typeof j.price === 'number')) return;
    migrated.current = true;
    void migrateJobPrices(tenant.id, jobs, [...finance.values()]).catch((e) => console.warn('[ops] price migration', e));
  }, [jobs, finance, jobsQ.loading, finLoading, tenant.id]);
  const [assigning, setAssigning] = useState<Job | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [bulk, setBulk] = useState<null | 'trip' | 'link' | 'dup' | 'cancel'>(null);
  const [importOpen, setImportOpen] = useState(false);
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const pickedJobs = useMemo(() => jobs.filter((j) => picked.has(j.id)), [jobs, picked]);
  const clearPick = () => setPicked(new Set());
  const openPick = pickedJobs.filter((j) => ['draft', 'assigned', 'accepted'].includes(j.status));

  const dateF = (['today', 'tomorrow', 'week', 'all'].includes(params.get('d') ?? '') ? params.get('d') : view === 'table' ? 'all' : 'today') as DateF;
  const driverF = params.get('driver') ?? '';
  const vehicleF = params.get('vehicle') ?? '';
  const statusF = (params.get('status') ?? 'all') as StatusF;
  const q = params.get('q') ?? '';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const range = useMemo((): [string, string] | null => {
    if (dateF === 'today') return [today, today];
    if (dateF === 'tomorrow') return [addDays(today, 1), addDays(today, 1)];
    if (dateF === 'week') return [today, addDays(today, 6)];
    return null;
  }, [dateF, today]);
  const inRange = (j: Job) => !range || (j.scheduledDate >= range[0] && j.scheduledDate <= range[1]);

  const filtered = useMemo(
    () => jobs.filter((j) => (!driverF || j.driverId === driverF) && (!vehicleF || j.vehicleId === vehicleF) && jobMatches(j, q)),
    [jobs, driverF, vehicleF, q],
  );

  const cols = useMemo(() => {
    const c: Record<ColKey, Job[]> = { unassigned: [], assigned: [], road: [], done: [], problems: [] };
    for (const j of filtered) {
      const overdue = (j.status === 'assigned' || j.status === 'accepted') && isOverdue(j, tz, now);
      if (j.status === 'failed') {
        if (inRange(j) || now - j.updatedAt < 2 * 86_400_000) c.problems.push(j);
      } else if (overdue) c.problems.push(j);
      else if (j.status === 'draft') {
        if (inRange(j) || j.scheduledDate < today) c.unassigned.push(j);
      } else if (j.status === 'assigned' || j.status === 'accepted') {
        if (inRange(j)) c.assigned.push(j);
      } else if (ON_ROAD.includes(j.status)) c.road.push(j);
      else if (DONE.includes(j.status)) {
        if (ymdIn(tz, j.updatedAt) === today || (dateF !== 'today' && inRange(j))) c.done.push(j);
      }
    }
    c.done.sort((a, b) => b.updatedAt - a.updatedAt);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, range, today, tz, now, dateF]);

  const tableRows = useMemo(
    () =>
      filtered.filter((j) => {
        if (statusF === 'open' ? ['completed', 'cancelled', 'failed'].includes(j.status) : statusF !== 'all' && j.status !== statusF) return false;
        return inRange(j) || ON_ROAD.includes(j.status);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, statusF, range],
  );

  const hasFilters = !!(driverF || vehicleF || q || (view === 'table' && statusF !== 'all'));
  const total = Object.values(cols).reduce((a, l) => a + l.length, 0);

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title={view === 'board' ? 'Dispatch' : 'Jobs'}
        subtitle={
          jobsQ.loading
            ? 'Loading…'
            : view === 'board'
              ? `${total} job${total === 1 ? '' : 's'} on the board · ${cols.road.length} on the road${cols.problems.length ? ` · ${cols.problems.length} need attention` : ''}`
              : `${tableRows.length} job${tableRows.length === 1 ? '' : 's'}`
        }
        actions={
          <>
            <div className="ops-seg" role="group" aria-label="View">
              <button type="button" className="ops-seg-btn" aria-pressed={view === 'board'} onClick={() => nav(`/admin/dispatch${params.toString() ? `?${params}` : ''}`)}>
                <Icon name="layers" size={16} /> Board
              </button>
              <button type="button" className="ops-seg-btn" aria-pressed={view === 'table'} onClick={() => nav(`/admin/jobs${params.toString() ? `?${params}` : ''}`)}>
                <Icon name="menu" size={16} /> Table
              </button>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImportOpen(true)}>
              <Icon name="upload" size={16} /> Import CSV
            </button>
            <Link to="/admin/jobs/new" className="btn btn-primary btn-sm">
              <Icon name="plus" size={16} /> New job
            </Link>
          </>
        }
      />

      <div className="card ops-filters">
        <div className="ops-seg-field">
        <span className="label" id="ops-date-l">Scheduled</span>
        <div className="ops-seg ops-seg-date" role="group" aria-labelledby="ops-date-l">
          {(['today', 'tomorrow', 'week', 'all'] as DateF[]).map((d) => (
            <button key={d} type="button" className="ops-seg-btn" aria-pressed={dateF === d} onClick={() => setParam('d', d)}>
              {d === 'today' ? 'Today' : d === 'tomorrow' ? 'Tomorrow' : d === 'week' ? '7 days' : 'All'}
            </button>
          ))}
        </div>
        </div>
        <label className="field ops-f-search">
          <span className="label">Search</span>
          <div className="adm-affix">
            <input className="input" type="search" placeholder="Ref, customer, town, reg…" value={q} onChange={(e) => setParam('q', e.target.value)} />
            <span className="adm-affix-s" aria-hidden>
              <Icon name="search" size={16} />
            </span>
          </div>
        </label>
        <label className="field">
          <span className="label">Driver</span>
          <select className="select" value={driverF} onChange={(e) => setParam('driver', e.target.value)}>
            <option value="">All drivers</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Vehicle</span>
          <select className="select" value={vehicleF} onChange={(e) => setParam('vehicle', e.target.value)}>
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration}
              </option>
            ))}
          </select>
        </label>
        {view === 'table' ? (
          <label className="field">
            <span className="label">Status</span>
            <select className="select" value={statusF} onChange={(e) => setParam('status', e.target.value === 'all' ? '' : e.target.value)}>
              <option value="all">All statuses</option>
              <option value="open">Open (not closed)</option>
              {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
                <option key={s} value={s}>
                  {JOB_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {hasFilters ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm ops-f-clear"
            onClick={() => {
              const next = new URLSearchParams();
              if (params.get('d')) next.set('d', params.get('d')!);
              setParams(next, { replace: true });
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {jobsQ.error ? (
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Couldn’t load jobs: {jobsQ.error}
        </div>
      ) : null}

      {picked.size ? (
        <div className="card ops-bulkbar" role="toolbar" aria-label="Bulk actions">
          <strong className="small">{picked.size} selected</strong>
          <button type="button" className="btn btn-primary btn-sm" disabled={!openPick.length || openPick.length !== pickedJobs.length} title={openPick.length !== pickedJobs.length ? 'Only jobs that haven’t started can be grouped' : undefined} onClick={() => setBulk('trip')}>
            <Icon name="truck" size={16} /> Assign together (trip)
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={!openPick.length || openPick.length !== pickedJobs.length} onClick={() => setBulk('link')}>
            <Icon name="external" size={16} /> Send as one link
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBulk('dup')}>
            <Icon name="copy" size={16} /> Duplicate…
          </button>
          <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => setBulk('cancel')}>
            <Icon name="x" size={16} /> Cancel…
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearPick} style={{ marginLeft: 'auto' }}>
            Clear
          </button>
        </div>
      ) : null}

      {jobsQ.loading ? (
        <LoadingRows n={5} />
      ) : view === 'board' ? (
        <div className="ops-board" role="list" aria-label="Dispatch board">
          {COLS.map((c) => (
            <section key={c.key} className={`ops-col ops-col-${c.key}`} role="listitem" aria-labelledby={`col-${c.key}`}>
              <header className="ops-col-head" title={c.hint}>
                <h2 id={`col-${c.key}`}>{c.label}</h2>
                <span className="ops-col-n" aria-label={`${cols[c.key].length} jobs`}>
                  {cols[c.key].length}
                </span>
              </header>
              <div className="ops-col-body">
                {cols[c.key].length === 0 ? (
                  <p className="ops-col-empty">{c.key === 'problems' ? 'All clear' : c.key === 'unassigned' ? 'Nothing to assign' : 'No jobs'}</p>
                ) : (
                  cols[c.key].map((j) => (
                    <JobCard key={j.id} job={j} now={now} tz={tz} picked={picked.has(j.id)} onPick={() => toggle(j.id)} onAssign={c.key === 'unassigned' || (c.key === 'problems' && !j.driverId) ? () => setAssigning(j) : undefined} />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      ) : tableRows.length === 0 ? (
        <div className="card">
          <EmptyState icon="layers" title={jobs.length ? 'No jobs match' : 'No jobs yet'}>
            {jobs.length ? 'Try a different date, status or search.' : <Link className="adm-link" to="/admin/jobs/new">Create the first job</Link>}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table adm-table-click ops-table">
            <thead>
              <tr>
                <th className="ops-pickcol">
                  <input
                    type="checkbox"
                    aria-label="Select all jobs in the list"
                    checked={tableRows.length > 0 && tableRows.every((j) => picked.has(j.id))}
                    onChange={(e) => setPicked(e.target.checked ? new Set(tableRows.map((j) => j.id)) : new Set())}
                  />
                </th>
                <th>Ref</th>
                <th>Scheduled</th>
                <th className="adm-hide-sm">Customer</th>
                <th className="adm-hide-md">Route</th>
                <th className="adm-hide-sm">Vehicle · driver</th>
                <th>Status</th>
                <th className="adm-num adm-hide-md">Price</th>
                <th className="adm-hide-md">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((j) => {
                const late = (j.status === 'assigned' || j.status === 'accepted' || j.status === 'draft') && isOverdue(j, tz, now);
                return (
                  <tr key={j.id} onClick={() => nav(`/admin/jobs/${encodeURIComponent(j.id)}`)} className={picked.has(j.id) ? 'ops-picked' : undefined}>
                    <td className="ops-pickcol" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Select ${j.ref}`} checked={picked.has(j.id)} onChange={() => toggle(j.id)} />
                    </td>
                    <td>
                      <Link className="adm-link mono" to={`/admin/jobs/${encodeURIComponent(j.id)}`} onClick={(e) => e.stopPropagation()}>
                        {j.ref}
                      </Link>{' '}
                      <PriorityTag p={j.priority} /> <TripTag j={j} /> <HiredTag x={j} short />
                      <div className="muted tiny ops-ellip">{j.title}</div>
                    </td>
                    <td className="small">
                      {j.scheduledDate}
                      <div className="muted tiny">
                        {j.scheduledTime}
                        {late ? <span className="ops-late"> · late</span> : null}
                      </div>
                    </td>
                    <td className="adm-hide-sm small">
                      {j.customer.name}
                      {j.customer.company ? <div className="muted tiny">{j.customer.company}</div> : null}
                    </td>
                    <td className="adm-hide-md small">
                      {j.pickup.place} → {j.dropoff.place}
                      {j.estimatedKm || j.stops?.length ? (
                        <div className="muted tiny">
                          {j.stops?.length ? `${j.stops.length} stops` : ''}
                          {j.stops?.length && j.estimatedKm ? ' · ' : ''}
                          {j.estimatedKm ? `~${j.estimatedKm} km` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="adm-hide-sm small">
                      {j.vehicleReg ?? <span className="muted">—</span>}
                      <div className="muted tiny">{j.driverName ?? 'No driver'}</div>
                    </td>
                    <td>
                      <JobStatusPill status={j.status} />
                    </td>
                    <td className="adm-num adm-hide-md">{(() => {
                      const p = jobPrice(j, finance.get(j.id));
                      return p ? fmtMoney(p) : '—';
                    })()}</td>
                    <td className="adm-hide-md muted small">{timeAgo(j.lastEventAt ?? j.updatedAt, now)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <QuickAssign job={assigning} onClose={() => setAssigning(null)} jobs={jobs} tenantId={tenant.id} />
      <TripModal jobs={bulk === 'trip' ? pickedJobs : null} all={jobs} onClose={() => setBulk(null)} onDone={clearPick} />
      <SendLinkModal jobs={bulk === 'link' ? pickedJobs : null} onClose={() => setBulk(null)} onSent={clearPick} />
      <DuplicateModal jobs={bulk === 'dup' ? pickedJobs : null} finance={finance} onClose={() => setBulk(null)} />
      <CancelModal jobs={bulk === 'cancel' ? pickedJobs : null} onClose={() => setBulk(null)} onDone={clearPick} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function JobCard({ job: j, now, tz, onAssign, picked, onPick }: { job: Job; now: number; tz: string; onAssign?: () => void; picked: boolean; onPick: () => void }) {
  const late = (j.status === 'draft' || j.status === 'assigned' || j.status === 'accepted') && isOverdue(j, tz, now);
  return (
    <article className={`ops-card ops-card-${j.priority}${late ? ' ops-card-late' : ''}${picked ? ' ops-picked' : ''}`} style={{ '--prio': j.priority === 'urgent' ? 'var(--err)' : j.priority === 'high' ? 'var(--warn)' : 'var(--line-strong)' } as CSSProperties}>
      <div className="ops-card-top">
        <input type="checkbox" className="ops-card-pick" aria-label={`Select ${j.ref}`} checked={picked} onChange={onPick} />
        <span className="mono ops-card-ref">{j.ref}</span>
        <PriorityTag p={j.priority} />
        <span className={`ops-card-time${late ? ' ops-late' : ''}`}>
          <Icon name="clock" size={13} /> {j.scheduledTime}
          {j.scheduledDate !== ymdIn(tz, now) ? ` · ${shortDate(j.scheduledDate)}` : ''}
        </span>
      </div>
      <Link to={`/admin/jobs/${encodeURIComponent(j.id)}`} className="ops-card-title ops-stretch">
        {j.title || `${j.pickup.place} → ${j.dropoff.place}`}
      </Link>
      <div className="ops-card-route small">
        <Icon name="pin" size={13} /> {j.pickup.place || '—'} <span aria-hidden>→</span> {j.dropoff.place || '—'}
        {j.stops && j.stops.length > 2 ? <span className="muted ops-nowrap">· {j.stops.length} stops</span> : null}
      </div>
      {j.tripId || j.ownership === 'hired' || j.extLink ? (
        <div className="ops-chips">
          <TripTag j={j} />
          <HiredTag x={j} short />
          {j.extLink && j.extLink.status !== 'revoked' ? <span className="ops-chip ops-lvl-none">Link</span> : null}
        </div>
      ) : null}
      <div className="ops-card-meta tiny">
        {j.driverId ? (
          <span>
            <Icon name="user" size={12} /> {j.driverName} · {j.vehicleReg ?? 'no vehicle'}
          </span>
        ) : j.vehicleReg ? (
          <span>
            <Icon name="truck" size={12} /> {j.vehicleReg} · no driver
          </span>
        ) : (
          <span className="muted">Not assigned</span>
        )}
      </div>
      <div className="ops-card-foot">
        <JobStatusPill status={j.status} />
        <span className="muted tiny" title={new Date(j.lastEventAt ?? j.updatedAt).toLocaleString()}>
          {timeAgo(j.lastEventAt ?? j.updatedAt, now)}
        </span>
        {onAssign ? (
          <button type="button" className="btn btn-primary btn-sm ops-card-assign" onClick={onAssign} aria-label={`Assign ${j.ref}`}>
            Assign
          </button>
        ) : null}
      </div>
      {j.status === 'failed' && j.failReason ? <div className="ops-card-fail tiny">{j.failReason}</div> : null}
    </article>
  );
}

export function QuickAssign({ job, onClose, jobs, tenantId }: { job: Job | null; onClose: () => void; jobs: Job[]; tenantId: string }) {
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast } = useUi();
  const [sel, setSel] = useState({ vehicleId: '', driverId: '' });
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  const blockers = useAssignBlockers(vehicles.find((v) => v.id === sel.vehicleId), drivers.find((d) => d.id === sel.driverId), job?.scheduledDate ?? today);
  if (job && job.id !== lastId) {
    setLastId(job.id);
    setSel({ vehicleId: job.vehicleId ?? '', driverId: job.driverId ?? '' });
  }
  if (!job) return <Modal open={false} onClose={onClose} title="" />;
  const vehicle = vehicles.find((v) => v.id === sel.vehicleId);
  const driver = drivers.find((d) => d.id === sel.driverId);
  const changed = sel.vehicleId !== (job.vehicleId ?? '') || sel.driverId !== (job.driverId ?? '');

  const save = async () => {
    if (!vehicle && !driver) return;
    setBusy(true);
    try {
      await assignJob(tenantId, job, { vehicle, driver }, user);
      toast(vehicle && driver ? `${job.ref} assigned to ${driver.name} · ${vehicle.registration}` : `${job.ref} updated`);
      onClose();
    } catch (e) {
      toast(`Assign failed: ${errMsg(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <>
          {job.driverId ? 'Reassign' : 'Assign'} <span className="mono">{job.ref}</span>
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !changed || (!vehicle && !driver) || blockers.length > 0} onClick={() => void save()}>
            {busy ? 'Assigning…' : vehicle && driver ? 'Assign & notify driver' : 'Save'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <div className="ops-qa-sum small">
          <strong>{job.title}</strong>
          <div className="muted">
            {job.scheduledDate} {job.scheduledTime} · {job.pickup.place} → {job.dropoff.place}
          </div>
        </div>
        <AssignFields job={job} jobs={jobs} vehicles={vehicles} drivers={drivers} vehicleId={sel.vehicleId} driverId={sel.driverId} onChange={setSel} today={today} />
        {vehicle && driver ? <p className="hint">The driver gets a chat message and the job appears in their app.</p> : <p className="hint">Pick both a vehicle and a driver to dispatch the job.</p>}
      </div>
    </Modal>
  );
}

function shortDate(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
