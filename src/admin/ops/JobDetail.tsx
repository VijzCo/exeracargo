// Job detail: live status, progress, audit trail, ODO/inspection/POD evidence, chat and ops actions.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import Chat from '../../ops/Chat';
import JobStatusPill from '../../ops/JobStatusPill';
import { advanceJob, deleteJob, IN_PROGRESS, jobPrice, leaveTrip, unassignJob, watchJob, watchJobEvents, watchJobFinance } from '../../ops/store';
import { JOB_FLOW, JOB_STATUS_LABEL, RATE_BASIS_LABEL, type Job, type JobEvent, type JobFinance, type JobStatus, type JobStop, type OdoReading } from '../../ops/types';
import { isPlatformHost } from '../../tenant/resolve';
import { useTenant } from '../../tenant/TenantProvider';
import { telLink, waLink } from '../../lib/wa';
import { copyText, EmptyState, errMsg, Modal, Spinner, useUi } from '../ui';
import { QuickAssign } from './Dispatch';
import { useJobs, useNow, useOpsUser } from './hooks';
import { fmtTs, forAdvance, isOverdue, mapsLink, timeAgo } from './lib';
import { HiredTag, MediaThumb, PriorityTag, PRIORITY_LABEL, TripTag } from './widgets';
import { effectiveCost, margin, VAT_ZA } from './cost';
import { LinkCard, SendLinkModal } from './ExtLink';
import { RouteLinks, RouteMap } from '../../ops/RouteMap';
import { jobRoutePoints, StopLocation } from './StopLocation';
import './ops-admin.css';

const ALL_STATUSES = Object.keys(JOB_STATUS_LABEL) as JobStatus[];

export default function JobDetail() {
  const { id = '' } = useParams();
  const { tenant } = useTenant();
  useOpsUser(); // seeds demo data
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [events, setEvents] = useState<JobEvent[]>([]);
  useEffect(() => watchJob(tenant.id, id, setJob), [tenant.id, id]);
  useEffect(() => watchJobEvents(tenant.id, id, setEvents), [tenant.id, id]);

  if (job === undefined)
    return (
      <div className="adm-center adm-center-inline">
        <Spinner />
      </div>
    );
  if (!job)
    return (
      <div className="stack adm-page">
        <div className="card">
          <EmptyState icon="layers" title="Job not found">
            It may have been deleted. <Link to="/admin/dispatch" className="adm-link">Back to dispatch</Link>
          </EmptyState>
        </div>
      </div>
    );
  return <Detail job={job} events={events} />;
}

function Detail({ job: j, events }: { job: Job; events: JobEvent[] }) {
  const { tenant, fmtMoney, country } = useTenant();
  const user = useOpsUser();
  const nav = useNavigate();
  const now = useNow(30_000);
  const { toast, confirm } = useUi();
  const { data: jobs } = useJobs();
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [fin, setFin] = useState<JobFinance | null>(null);
  useEffect(() => watchJobFinance(tenant.id, j.id, setFin), [tenant.id, j.id]);
  const price = jobPrice(j, fin);
  const linkDriver = !!j.extLink && j.extLink.status !== 'revoked';
  const inProgress = IN_PROGRESS.includes(j.status);
  const tripJobs = j.tripId ? jobs.filter((x) => x.tripId === j.tripId).sort((a, b) => (a.tripSeq ?? 0) - (b.tripSeq ?? 0)) : [];
  const unassign = async (what: { vehicle?: boolean; driver?: boolean }) => {
    const ok = await confirm({
      title: what.vehicle && what.driver ? `Unassign ${j.ref}?` : what.vehicle ? `Remove ${j.vehicleReg} from ${j.ref}?` : `Remove ${j.driverName} from ${j.ref}?`,
      body: 'The job goes back to Unassigned on the board. The driver no longer sees it in the app.',
      confirmLabel: 'Unassign',
      danger: true,
    });
    if (!ok) return;
    try {
      await unassignJob(tenant.id, j, what, user);
      toast(`${j.ref} unassigned`);
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const closed = ['completed', 'cancelled', 'failed'].includes(j.status);
  const late = ['draft', 'assigned', 'accepted'].includes(j.status) && isOverdue(j, country.timeZone, now);
  const trackUrl = j.bookingRef ? `${window.location.origin}/track?ref=${encodeURIComponent(j.bookingRef)}${isPlatformHost() ? `&site=${encodeURIComponent(tenant.id)}` : ''}` : '';
  const kmDiff = j.actualKm !== undefined && j.estimatedKm ? Math.round(((j.actualKm - j.estimatedKm) / j.estimatedKm) * 100) : null;

  const remove = async () => {
    const ok = await confirm({
      title: `Delete job ${j.ref}?`,
      body: j.status === 'draft' ? 'The draft is removed permanently.' : 'This removes the job and its record from the board. Prefer “Change status → Cancelled” to keep the audit trail.',
      confirmLabel: 'Delete job',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteJob(tenant.id, j.id);
      toast(`${j.ref} deleted`);
      nav('/admin/dispatch', { replace: true });
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  const share = async () => {
    if ((await copyText(trackUrl)) === true) toast('Tracking link copied', 'info');
    else toast('Copy failed', 'err');
  };

  return (
    <div className="stack adm-page ops-page ops-detail">
      <div className="ops-detail-head">
        <div className="ops-detail-title">
          <Link to="/admin/dispatch" className="adm-link small ops-noprint">
            ← Dispatch
          </Link>
          <h1 className="adm-h1">
            <span className="mono">{j.ref}</span> <JobStatusPill status={j.status} /> <PriorityTag p={j.priority} /> <HiredTag x={j} /> <TripTag j={j} />
            {late ? <span className="ops-chip ops-lvl-err">Late start</span> : null}
          </h1>
          <p className="muted">{j.title}</p>
        </div>
        <div className="ops-detail-actions ops-noprint">
          <Link className="btn btn-ghost btn-sm" to={`/admin/jobs/${encodeURIComponent(j.id)}/edit`}>
            <Icon name="settings" size={16} /> Edit
          </Link>
          {!closed && !inProgress && !linkDriver ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssignOpen(true)}>
              <Icon name="user" size={16} /> {j.driverId ? 'Reassign' : 'Assign'}
            </button>
          ) : null}
          {!closed && !inProgress && (!j.extLink || j.extLink.status === 'revoked') ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinkOpen(true)}>
              <Icon name="external" size={16} /> One-time link
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatusOpen(true)}>
            <Icon name="check" size={16} /> Change status
          </button>
          <Link className="btn btn-ghost btn-sm" to={`/admin/jobs/new?from=${encodeURIComponent(j.id)}`}>
            <Icon name="copy" size={16} /> Duplicate
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            <Icon name="download" size={16} /> Print
          </button>
          {trackUrl ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void share()}>
                <Icon name="external" size={16} /> Tracking link
              </button>
              <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(j.customer.phone, `Hi ${j.customer.name}, track your ${tenant.name} job ${j.bookingRef} here: ${trackUrl}`)}>
                <Icon name="whatsapp" size={16} /> Send to customer
              </a>
            </>
          ) : null}
          <button type="button" className="icon-btn adm-danger-btn" aria-label="Delete job" title="Delete job" onClick={() => void remove()}>
            <Icon name="trash" size={16} />
          </button>
        </div>
      </div>

      <Stepper status={j.status} events={events} />
      {j.status === 'failed' && j.failReason ? (
        <div className="alert alert-err" role="status">
          <Icon name="x" size={18} /> <span>Failed: {j.failReason}</span>
        </div>
      ) : null}

      <div className="ops-detail-grid">
        <div className="stack">
          <section className="card ops-block">
            <h2 className="adm-h2">{j.stops?.length ? `Route · ${j.stops.length} stops` : 'Route'}</h2>
            {j.stops?.length ? (
              <MultiStops job={j} stops={j.stops} />
            ) : (
              <div className="ops-route">
                <StopView job={j} id="p" label="Pickup" kind="pickup" s={j.pickup} />
                <StopView job={j} id="d" label="Delivery" kind="dropoff" s={j.dropoff} />
              </div>
            )}
            {(() => {
              const pts = jobRoutePoints(j, j.stops?.length ? [...j.stops].sort((a, b) => a.seq - b.seq).map((x) => ({ id: x.id, s: x })) : [{ id: 'p', s: j.pickup }, { id: 'd', s: j.dropoff }]);
              return (
                <div className="ops-noprint">
                  <div className="ops-routebar">
                    <RouteLinks points={pts} />
                  </div>
                  <RouteMap points={pts} />
                </div>
              );
            })()}
            <dl className="adm-dl">
              <Row k="Scheduled" v={`${j.scheduledDate} at ${j.scheduledTime}`} />
              <Row k="Cargo" v={j.cargo} />
              {j.instructions ? <Row k="Driver notes" v={j.instructions} /> : null}
              <Row k="Type" v={j.kind === 'freight' ? 'Freight consignment' : 'Vehicle hire'} />
              <Row k="Priority" v={PRIORITY_LABEL[j.priority]} />
            </dl>
          </section>

          <section className="card ops-block">
            <h2 className="adm-h2">Customer & price</h2>
            <dl className="adm-dl">
              <Row k="Customer" v={j.customer.name} />
              {j.customer.company ? <Row k="Company" v={j.customer.company} /> : null}
              <Row
                k="Phone"
                v={
                  <span className="row" style={{ gap: 10 }}>
                    <a className="adm-link" href={telLink(j.customer.phone)}>
                      {j.customer.phone}
                    </a>
                    <a className="adm-link small ops-noprint" target="_blank" rel="noopener noreferrer" href={waLink(j.customer.phone, `Hi ${j.customer.name}, regarding job ${j.ref}: `)}>
                      WhatsApp
                    </a>
                  </span>
                }
              />
              <Row k="Price" v={price !== undefined ? fmtMoney(price) : '—'} />
              {j.bookingRef ? <Row k="Website booking" v={<Link className="adm-link mono" to={`/admin/bookings?open=${encodeURIComponent(j.bookingRef)}`}>{j.bookingRef}</Link>} /> : null}
            </dl>
          </section>

          <FinanceCard job={j} fin={fin} />

          <section className="card ops-block">
            <h2 className="adm-h2">Odometer & distance</h2>
            <div className="ops-kmrow">
              <KmStat label="Estimated" value={j.estimatedKm !== undefined ? `${j.estimatedKm} km` : '—'} />
              <KmStat label="Actual" value={j.actualKm !== undefined ? `${j.actualKm} km` : '—'} tone={kmDiff !== null && Math.abs(kmDiff) > 25 ? 'warn' : undefined} sub={kmDiff !== null ? `${kmDiff > 0 ? '+' : ''}${kmDiff}% vs estimate` : undefined} />
            </div>
            <div className="ops-odo-grid">
              <Odo label="Start ODO" r={j.odoStart} />
              <Odo label="End ODO" r={j.odoEnd} />
            </div>
          </section>

          <section className="card ops-block">
            <h2 className="adm-h2">Pre-trip inspection</h2>
            {j.inspection ? (
              <>
                <p className={`small ${j.inspection.allOk ? '' : 'ops-text-err'}`}>
                  {j.inspection.allOk ? 'All checks passed' : `${j.inspection.items.filter((i) => !i.ok).length} issue(s) flagged`} · {fmtTs(j.inspection.at)}
                </p>
                <ul className="ops-insp">
                  {j.inspection.items.map((i) => (
                    <li key={i.key} className={i.ok ? 'ok' : 'bad'}>
                      <Icon name={i.ok ? 'check' : 'x'} size={14} />
                      <span>
                        {i.label}
                        {i.note ? <span className="muted"> — {i.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {j.inspection.photoIds?.length ? (
                  <div className="ops-thumbs">
                    {j.inspection.photoIds.map((p, i) => (
                      <MediaThumb key={p} id={p} alt={`Inspection photo ${i + 1}`} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted small">Captured by the driver when the trip starts.</p>
            )}
          </section>

          <section className="card ops-block">
            <h2 className="adm-h2">Proof of delivery</h2>
            {j.pod ? (
              <>
                <dl className="adm-dl">
                  <Row k="Received by" v={j.pod.recipientName} />
                  <Row k="At" v={fmtTs(j.pod.at)} />
                  {j.pod.lat !== undefined && j.pod.lng !== undefined ? <Row k="Location" v={<MapA lat={j.pod.lat} lng={j.pod.lng} />} /> : null}
                  {j.pod.note ? <Row k="Note" v={j.pod.note} /> : null}
                </dl>
                <div className="ops-thumbs">
                  {j.pod.signatureId ? (
                    <div className="ops-sig">
                      <MediaThumb id={j.pod.signatureId} alt="Recipient signature" size={180} />
                      <span className="tiny muted">Signature</span>
                    </div>
                  ) : null}
                  {j.pod.photoIds.map((p, i) => (
                    <MediaThumb key={p} id={p} alt={`Delivery photo ${i + 1}`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="muted small">Recipient name, signature and photos appear here once delivered.</p>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card ops-block">
            <h2 className="adm-h2">Vehicle & driver</h2>
            {j.driverId || j.vehicleId ? (
              <>
                <dl className="adm-dl">
                  <Row k="Vehicle" v={j.vehicleId ? <Link className="adm-link" to={`/admin/vehicles?open=${encodeURIComponent(j.vehicleId)}`}>{j.vehicleReg}</Link> : j.vehicleReg ?? '—'} />
                  <Row k="Driver" v={j.driverId && !j.driverId.startsWith('link:') ? <Link className="adm-link" to={`/admin/drivers?open=${encodeURIComponent(j.driverId)}`}>{j.driverName}</Link> : j.driverName ?? '—'} />
                  {j.ownership === 'hired' ? <Row k="Transporter" v={j.transporterId ? <Link className="adm-link" to={`/admin/transporters?open=${encodeURIComponent(j.transporterId)}`}>{j.transporterName ?? 'Transporter'}</Link> : j.transporterName ?? 'Hired'} /> : null}
                  <Row k="Last update" v={`${timeAgo(j.lastEventAt ?? j.updatedAt, now)} · ${fmtTs(j.lastEventAt ?? j.updatedAt)}`} />
                </dl>
                {!closed && !inProgress && !j.extLink ? (
                  <div className="row ops-noprint" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                    {j.vehicleId ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void unassign({ vehicle: true })}>
                        Remove vehicle
                      </button>
                    ) : null}
                    {j.driverId ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void unassign({ driver: true })}>
                        Remove driver
                      </button>
                    ) : null}
                    {j.vehicleId && j.driverId ? (
                      <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => void unassign({ vehicle: true, driver: true })}>
                        Unassign both
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                <p className="muted small">Not assigned yet.</p>
                <div className="ops-noprint">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setAssignOpen(true)}>
                    Assign vehicle & driver
                  </button>
                </div>
              </div>
            )}
          </section>

          {j.extLink ? <LinkCard job={j} jobs={jobs} /> : null}

          {tripJobs.length > 1 ? (
            <section className="card ops-block">
              <div className="spread">
                <h2 className="adm-h2">Trip {j.tripId}</h2>
                {!inProgress && !closed ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm ops-noprint"
                    onClick={async () => {
                      await leaveTrip(tenant.id, j);
                      toast(`${j.ref} removed from the trip`);
                    }}
                  >
                    Remove from trip
                  </button>
                ) : null}
              </div>
              <ol className="ops-hist">
                {tripJobs.map((t) => (
                  <li key={t.id}>
                    <Link to={`/admin/jobs/${encodeURIComponent(t.id)}`} className={`adm-link mono small${t.id === j.id ? ' ops-current' : ''}`}>
                      {(t.tripSeq ?? 0) + 1}. {t.ref}
                    </Link>
                    <span className="small ops-ellip">
                      {t.pickup.place} → {t.dropoff.place}
                    </span>
                    <JobStatusPill status={t.status} />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {j.driverId && !j.driverId.startsWith('link:') ? (
            <section className="card ops-block ops-noprint">
              <div className="spread">
                <h2 className="adm-h2">Chat with {j.driverName?.split(' ')[0] ?? 'driver'}</h2>
                <Link to={`/admin/chat?t=${encodeURIComponent(j.driverId)}`} className="adm-link small">
                  Open inbox →
                </Link>
              </div>
              <Chat tenantId={tenant.id} threadId={j.driverId} user={user} driverName={j.driverName} jobContext={{ id: j.id, ref: j.ref }} height={380} />
            </section>
          ) : null}

          <section className="card ops-block">
            <h2 className="adm-h2">Timeline</h2>
            {events.length === 0 ? (
              <p className="muted small">No events yet.</p>
            ) : (
              <ol className="ops-timeline">
                {[...events].reverse().map((e) => (
                  <li key={e.id} className={`ops-tl ops-tl-${e.status}`}>
                    <span className="ops-tl-dot" aria-hidden />
                    <div>
                      <div className="ops-tl-head">
                        <strong>{e.status === 'note' ? 'Note' : e.status === 'reassigned' ? 'Reassigned' : JOB_STATUS_LABEL[e.status as JobStatus] ?? e.status}</strong>
                        <time className="muted tiny" dateTime={new Date(e.at).toISOString()}>
                          {fmtTs(e.at)}
                        </time>
                      </div>
                      <div className="muted tiny">
                        {e.byName} · {e.role === 'driver' ? 'Driver' : 'Dispatch'}
                        {e.lat !== undefined && e.lng !== undefined ? (
                          <>
                            {' · '}
                            <MapA lat={e.lat} lng={e.lng} />
                          </>
                        ) : null}
                      </div>
                      {e.note ? <div className="small ops-tl-note">{e.note}</div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <QuickAssign job={assignOpen ? j : null} onClose={() => setAssignOpen(false)} jobs={jobs} tenantId={tenant.id} />
      <SendLinkModal jobs={linkOpen ? [j] : null} onClose={() => setLinkOpen(false)} />
      <StatusModal open={statusOpen} job={j} onClose={() => setStatusOpen(false)} />
    </div>
  );
}

function Stepper({ status, events }: { status: JobStatus; events: JobEvent[] }) {
  const idx = JOB_FLOW.indexOf(status as (typeof JOB_FLOW)[number]);
  const at = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.status, e.at);
    return m;
  }, [events]);
  const bad = status === 'cancelled' || status === 'failed';
  return (
    <ol className={`ops-stepper${bad ? ' ops-stepper-bad' : ''}`} aria-label="Job progress">
      {JOB_FLOW.map((s, i) => {
        const state = idx >= i ? (idx === i ? 'current' : 'done') : 'todo';
        const t = at.get(s);
        return (
          <li key={s} className={`ops-step ops-step-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="ops-step-dot" aria-hidden>
              {state === 'done' ? <Icon name="check" size={12} /> : i + 1}
            </span>
            <span className="ops-step-label">{JOB_STATUS_LABEL[s]}</span>
            {t ? <span className="ops-step-time">{new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function StopView({ job, id, label, kind, s }: { job: Job; id: string; label: string; kind: 'pickup' | 'dropoff'; s: Job['pickup'] }) {
  return (
    <div className="ops-routestop">
      <span className={`ops-stop-dot ${kind}`} aria-hidden />
      <div>
        <div className="tiny muted ops-upper">{label}</div>
        <strong>
          {s.place}
          {s.region ? <span className="muted small"> · {s.region}</span> : null}
        </strong>
        {s.address ? <div className="small">{s.address}</div> : null}
        {s.contact || s.phone ? (
          <div className="small muted">
            {s.contact}
            {s.contact && s.phone ? ' · ' : ''}
            {s.phone ? (
              <a className="adm-link" href={telLink(s.phone)}>
                {s.phone}
              </a>
            ) : null}
          </div>
        ) : null}
        <StopLocation job={job} stopId={id} s={s} />
      </div>
    </div>
  );
}

const STOP_STATUS: Record<JobStop['status'], { label: string; lvl: string }> = {
  pending: { label: 'To do', lvl: 'ops-lvl-none' },
  arrived: { label: 'Driver on site', lvl: 'ops-lvl-warn' },
  done: { label: 'Done', lvl: 'ops-lvl-ok' },
  failed: { label: 'Failed', lvl: 'ops-lvl-err' },
};

function MultiStops({ job, stops }: { job: Job; stops: JobStop[] }) {
  return (
    <ol className="ops-mstops">
      {[...stops]
        .sort((a, b) => a.seq - b.seq)
        .map((s, i) => (
          <li key={s.id} className={`ops-mstop ops-mstop-${s.status}`}>
            <span className={`ops-stop-dot ${s.kind === 'pickup' ? 'pickup' : 'dropoff'}`} aria-hidden />
            <div className="stack" style={{ gap: 4 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="tiny muted ops-upper">
                  {i + 1}. {s.kind === 'pickup' ? 'Pickup' : 'Delivery'}
                </span>
                <span className={`ops-chip ${STOP_STATUS[s.status].lvl}`}>{STOP_STATUS[s.status].label}</span>
                {s.window ? <span className="tiny muted">⏱ {s.window}</span> : null}
              </div>
              <strong>
                {s.place}
                {s.region ? <span className="muted small"> · {s.region}</span> : null}
              </strong>
              {s.address ? <div className="small">{s.address}</div> : null}
              {s.cargo || s.reference ? (
                <div className="small">
                  {s.cargo}
                  {s.cargo && s.reference ? ' · ' : ''}
                  {s.reference ? <span className="mono">{s.reference}</span> : null}
                </div>
              ) : null}
              {s.contact || s.phone ? (
                <div className="small muted">
                  {s.contact}
                  {s.contact && s.phone ? ' · ' : ''}
                  {s.phone ? (
                    <a className="adm-link" href={telLink(s.phone)}>
                      {s.phone}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {s.instructions ? <div className="small muted">“{s.instructions}”</div> : null}
              <StopLocation job={job} stopId={s.id} s={s} />
              {s.arrivedAt || s.doneAt ? (
                <div className="tiny muted">
                  {s.arrivedAt ? `Arrived ${fmtTs(s.arrivedAt)}` : ''}
                  {s.arrivedAt && s.doneAt ? ' · ' : ''}
                  {s.doneAt ? `Done ${fmtTs(s.doneAt)}` : ''}
                </div>
              ) : null}
              {s.failReason ? <div className="small ops-text-err">Failed: {s.failReason}</div> : null}
              {s.note ? <div className="small">Driver: {s.note}</div> : null}
              {s.pod ? (
                <div className="small">
                  Received by <strong>{s.pod.recipientName}</strong> · {fmtTs(s.pod.at)}
                </div>
              ) : null}
              {s.photoIds?.length || s.pod?.signatureId || s.pod?.photoIds.length ? (
                <div className="ops-thumbs">
                  {s.pod?.signatureId ? <MediaThumb id={s.pod.signatureId} alt={`Signature at stop ${i + 1}`} size={120} /> : null}
                  {s.pod?.photoIds.map((p, k) => <MediaThumb key={p} id={p} alt={`Delivery photo ${k + 1} at stop ${i + 1}`} size={80} />)}
                  {s.photoIds?.map((p, k) => <MediaThumb key={p} id={p} alt={`Photo ${k + 1} at stop ${i + 1}`} size={80} />)}
                </div>
              ) : null}
            </div>
          </li>
        ))}
    </ol>
  );
}

function FinanceCard({ job: j, fin }: { job: Job; fin: JobFinance | null }) {
  const { fmtMoney, country } = useTenant();
  const vat = country.code === 'ZA' ? VAT_ZA : 0.18;
  const price = jobPrice(j, fin);
  const cost = effectiveCost(fin?.cost, j);
  const m = margin(fin, j, vat);
  return (
    <section className="card ops-block">
      <div className="spread">
        <h2 className="adm-h2">Finance</h2>
        <Link className="adm-link small ops-noprint" to={`/admin/jobs/${encodeURIComponent(j.id)}/edit`}>
          Edit
        </Link>
      </div>
      <dl className="adm-dl">
        <Row k="Sell price" v={price !== undefined ? `${fmtMoney(price)} incl. VAT` : '—'} />
        {cost ? (
          <>
            <Row k="Buy cost" v={`${fmtMoney(cost.total)} · ${cost.transporterName}`} />
            <Row k="Basis" v={`${fmtMoney(cost.rate)} ${RATE_BASIS_LABEL[cost.basis]} × ${cost.qty}${cost.qtyFromOdo ? (j.actualKm !== undefined ? ' (actual km)' : ' (estimated km)') : ''}${cost.minCharge ? ` · min ${fmtMoney(cost.minCharge)}` : ''}`} />
            {cost.extras.length ? <Row k="Extras" v={cost.extras.map((x) => `${x.label} ${fmtMoney(x.amount)}`).join(' · ')} /> : null}
            {cost.deductions.length ? <Row k="Deductions" v={cost.deductions.map((x) => `${x.label} −${fmtMoney(x.amount)}`).join(' · ')} /> : null}
          </>
        ) : (
          <Row k="Buy cost" v={j.ownership === 'hired' ? <span className="ops-text-warn">Not set — add it before settlement</span> : 'Own truck'} />
        )}
        {m ? <Row k="Margin" v={<span className={m.margin < 0 ? 'ops-text-err' : ''}>{`${fmtMoney(m.margin)} (${m.pct}% of ${fmtMoney(m.sellEx)} excl. VAT)`}</span>} /> : null}
        {fin?.settlementId ? <Row k="Settlement" v={<Link className="adm-link mono" to={`/admin/settlements?open=${encodeURIComponent(fin.settlementId)}`}>{fin.settlementId}</Link>} /> : null}
      </dl>
    </section>
  );
}

function Odo({ label, r }: { label: string; r?: OdoReading }) {
  if (!r)
    return (
      <div className="ops-odo ops-odo-empty">
        <div className="tiny muted ops-upper">{label}</div>
        <div className="muted small">Not captured</div>
      </div>
    );
  const mismatch = r.ocrKm !== undefined && Math.abs(r.ocrKm - r.km) >= 1;
  return (
    <div className="ops-odo">
      <div className="tiny muted ops-upper">{label}</div>
      <div className="ops-odo-km mono">{r.km.toLocaleString()} km</div>
      <div className="row" style={{ gap: 6 }}>
        <span className={`ops-chip ${r.method === 'ocr' ? 'ops-lvl-ok' : 'ops-lvl-none'}`}>{r.method === 'ocr' ? 'Read by OCR' : 'Typed by driver'}</span>
        {r.ocrConfidence !== undefined ? <span className={`ops-chip ${r.ocrConfidence < 60 ? 'ops-lvl-warn' : 'ops-lvl-none'}`}>OCR {Math.round(r.ocrConfidence)}%</span> : null}
      </div>
      {mismatch ? <div className="tiny ops-text-warn">OCR read {r.ocrKm?.toLocaleString()} km — driver corrected it.</div> : null}
      <div className="tiny muted">
        {fmtTs(r.at)}
        {r.lat !== undefined && r.lng !== undefined ? (
          <>
            {' · '}
            <MapA lat={r.lat} lng={r.lng} />
          </>
        ) : null}
      </div>
      {r.photoId ? <MediaThumb id={r.photoId} alt={`${label} photo`} size={120} /> : null}
    </div>
  );
}

function KmStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div className={`ops-kmstat${tone ? ` ops-kmstat-${tone}` : ''}`}>
      <span className="tiny muted ops-upper">{label}</span>
      <strong>{value}</strong>
      {sub ? <span className="tiny">{sub}</span> : null}
    </div>
  );
}

function MapA({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a className="adm-link ops-maplink" href={mapsLink(lat, lng)} target="_blank" rel="noopener noreferrer">
      <Icon name="pin" size={11} /> map
    </a>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="adm-dl-row">
      <dt>{k}</dt>
      <dd>{v || '—'}</dd>
    </div>
  );
}

function StatusModal({ open, job, onClose }: { open: boolean; job: Job; onClose: () => void }) {
  const { tenant } = useTenant();
  const user = useOpsUser();
  const { toast } = useUi();
  const [next, setNext] = useState<JobStatus>(job.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setNext(job.status);
      setReason('');
    }
  }, [open, job.status]);
  const backwards = JOB_FLOW.indexOf(next as (typeof JOB_FLOW)[number]) < JOB_FLOW.indexOf(job.status as (typeof JOB_FLOW)[number]);
  const needsReason = next === 'cancelled' || next === 'failed' || backwards || next === 'draft';
  const needsCrew = JOB_FLOW.includes(next as (typeof JOB_FLOW)[number]) && (!job.driverId || !job.vehicleId);

  const save = async () => {
    setBusy(true);
    try {
      await advanceJob(tenant.id, forAdvance(job), next, user, {
        note: `Status set by dispatch${reason.trim() ? `: ${reason.trim()}` : ''}`,
        failReason: next === 'failed' ? reason.trim() : undefined,
      });
      toast(`${job.ref} → ${JOB_STATUS_LABEL[next]}`);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Change status of ${job.ref}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn-sm ${next === 'cancelled' || next === 'failed' ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy || next === job.status || (needsReason && reason.trim().length < 3) || needsCrew}
            onClick={() => void save()}
          >
            {busy ? 'Saving…' : `Set to ${JOB_STATUS_LABEL[next]}`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted small">
          Normally the driver moves the job forward in the app. Use this to correct a status, cancel a job or record a failed delivery. Every change is logged in the timeline
          {job.bookingRef ? ' and the customer’s tracking page updates' : ''}.
        </p>
        <label className="field">
          <span className="label">New status</span>
          <select className="select" value={next} onChange={(e) => setNext(e.target.value as JobStatus)} data-autofocus>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABEL[s]}
                {s === job.status ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Reason {needsReason ? '*' : '(optional)'}</span>
          <textarea className="textarea" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={next === 'cancelled' ? 'e.g. Customer cancelled — site not ready' : next === 'failed' ? 'e.g. Nobody on site to receive' : 'Shown in the audit timeline'} />
          {needsReason ? <span className="hint">Required for cancellations, failures and moving a job backwards.</span> : null}
        </label>
        {needsCrew ? <div className="alert alert-warn">Assign a vehicle and driver before moving the job into the driver workflow.</div> : null}
      </div>
    </Modal>
  );
}
