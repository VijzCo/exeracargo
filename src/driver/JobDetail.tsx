import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { advanceJob, getMedia, watchJob, watchJobEvents, type AdvanceExtra } from '../ops/store';
import { currentPosition } from '../ops/image';
import { arrivalPin, driverPin, navUrl, stopTarget, TARGET_LABEL, wazeUrl } from '../ops/maps';
import { RouteLinks, RouteMap } from '../ops/RouteMap';
import { JOB_FLOW, JOB_STATUS_LABEL, type FleetUnit, type Job, type JobEvent, type JobStatus, type JobStop } from '../ops/types';
import JobStatusPill from '../ops/JobStatusPill';
import Chat from '../ops/Chat';
import { useTenant } from '../tenant/TenantProvider';
import { telLink } from '../lib/wa';
import { Icon } from '../components/Icon';
import { fmtDate, fmtKm, fmtTime, isoToday, queued, useDriver } from './ctx';
import { CloseTripSheet, FailSheet, LoadedSheet, PodSheet, StartTripSheet, StopFailSheet, type AdvanceFn } from './JobFlows';
import { Confirm, Empty, Sheet } from './ui';
import { currentStop, isMultiStop, ordered, patchStop, remainingAfter, statusAfterFailedStop, stopAction, stopLabel, tripJobs, tripPrev } from './stops';

type Flow = 'confirm' | 'start' | 'loaded' | 'pod' | 'close' | 'fail' | 'stopfail' | 'chat';

/** Uniform "next step" for single-leg and multi-stop jobs. */
interface Act {
  label: string;
  icon: string;
  flow: Flow;
  next?: JobStatus;
  confirm?: string;
  extra?: AdvanceExtra;
  /** Multi-stop: the stop this action is about. */
  stop?: JobStop;
}

const NEXT: Partial<Record<JobStatus, Act>> = {
  assigned: {
    next: 'accepted',
    label: 'Accept job',
    flow: 'confirm',
    confirm: 'Dispatch will see that you have accepted this job.',
    icon: 'check',
  },
  accepted: {
    next: 'started',
    label: 'Start trip',
    flow: 'start',
    icon: 'truck',
  },
  started: {
    next: 'at_pickup',
    label: 'Arrived at pickup',
    flow: 'confirm',
    confirm: 'Confirm you are at the pickup point.',
    icon: 'pin',
  },
  at_pickup: {
    next: 'loaded',
    label: 'Loaded / picked up',
    flow: 'loaded',
    icon: 'pallet',
  },
  loaded: {
    next: 'in_transit',
    label: 'Depart — in transit',
    flow: 'confirm',
    confirm: 'Leaving pickup now with the load.',
    icon: 'arrow',
  },
  in_transit: {
    next: 'at_delivery',
    label: 'Arrived at delivery',
    flow: 'confirm',
    confirm: 'Confirm you are at the delivery point.',
    icon: 'pin',
  },
  at_delivery: {
    next: 'delivered',
    label: 'Deliver (POD)',
    flow: 'pod',
    icon: 'contract',
  },
  delivered: {
    next: 'completed',
    label: 'Close trip',
    flow: 'close',
    icon: 'check',
  },
};
const CAN_FAIL: JobStatus[] = ['assigned', 'accepted', 'started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery'];
const SHORT: Record<string, string> = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  started: 'Started',
  at_pickup: 'Pickup',
  loaded: 'Loaded',
  in_transit: 'Transit',
  at_delivery: 'Drop',
  delivered: 'POD',
  completed: 'Closed',
};

export default function JobDetail({ jobs, vehicles }: { jobs: Job[] | null; vehicles: FleetUnit[] }) {
  const { id = '' } = useParams();
  const { tenantId, driver, user, notify } = useDriver();
  const { country } = useTenant();
  const [job, setJob] = useState<Job | null | undefined>(() => jobs?.find((j) => j.id === id));
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => watchJob(tenantId, id, setJob), [tenantId, id]);
  useEffect(() => watchJobEvents(tenantId, id, setEvents), [tenantId, id]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const advance: AdvanceFn = useCallback(
    async (next, extra) => {
      if (!job || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        const pos = await currentPosition(3000);
        const ll = pos ? { lat: pos.lat, lng: pos.lng } : {};
        // "Arrived": remember the exact spot for next time (never overwrites dispatch's pin)
        let pin: AdvanceExtra['pin'];
        if (next === 'at_pickup' || next === 'at_delivery') {
          const st = isMultiStop(job) ? currentStop(job) : undefined;
          const stopId = st ? st.id : next === 'at_pickup' ? 'p' : 'd';
          const target = st ?? (next === 'at_pickup' ? job.pickup : job.dropoff);
          const p = arrivalPin(target, job.pins?.[stopId], pos, user.uid);
          if (p) pin = { stopId, pin: p };
        }
        const x: AdvanceExtra = {
          ...extra,
          ...ll,
          pin,
          pod: extra.pod && { ...extra.pod, ...ll },
          odoStart: extra.odoStart && { ...extra.odoStart, ...ll },
          odoEnd: extra.odoEnd && { ...extra.odoEnd, ...ll },
        };
        const r = await queued(advanceJob(tenantId, job, next, user, x), 5000);
        notify(r === 'queued' ? 'Saved — will sync when online' : `Updated: ${JOB_STATUS_LABEL[next]}`, r === 'queued' ? 'warn' : 'ok');
        setFlow(null);
        return true;
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Update failed — try again', 'err');
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [job, tenantId, user, notify]
  );

  if (job === undefined)
    return (
      <div className="drv-page">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  if (job === null || job.driverId !== driver.id)
    return (
      <div className="drv-page">
        <Empty icon="truck" title="Job not available" text="It may have been reassigned or cancelled by dispatch." />
        <Link to="/driver" className="btn btn-ghost btn-block">
          Back to my jobs
        </Link>
      </div>
    );

  const idx = JOB_FLOW.indexOf(job.status as (typeof JOB_FLOW)[number]);
  const multi = isMultiStop(job);
  const action: Act | undefined = multi ? multiAct(job) : NEXT[job.status];
  const vehicle = vehicles.find((v) => v.id === job.vehicleId);
  const today = isoToday(country.timeZone);
  const towardsDrop = idx >= JOB_FLOW.indexOf('loaded');
  const final = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';
  const prev = job.status === 'accepted' ? tripPrev(jobs, job, today, country.timeZone) : null;
  const trip = job.tripId && jobs ? tripJobs(jobs, job.tripId) : [];
  const atStop = multi && action?.stop?.status === 'arrived' ? action.stop : undefined;

  // multi-stop: sheets call onAdvance('loaded' | 'delivered', …) — translate into the stop update + legal job status
  const stopAdvance: AdvanceFn = async (next, extra) => {
    const st = action?.stop;
    if (!multi || !st) return advance(next, extra);
    const now = Date.now();
    if (st.kind === 'pickup') {
      const stops = patchStop(job, st.id, {
        status: 'done',
        doneAt: now,
        photoIds: extra.photoIds,
        note: extra.note,
      });
      return advance('loaded', {
        ...extra,
        stops,
        note: `Loaded at ${st.place}${extra.note ? ` · ${extra.note}` : ''}`,
      });
    }
    const last = remainingAfter(job, st).length === 0;
    const stops = patchStop(job, st.id, {
      status: 'done',
      doneAt: now,
      pod: extra.pod,
      note: extra.pod?.note,
    });
    return advance(last ? 'delivered' : 'in_transit', {
      ...extra,
      stops,
      note: `${extra.note ?? 'Delivered'} · ${st.place}${last ? '' : ' — continuing to next stop'}`,
    });
  };

  const failStop = (reason: string, note: string) => {
    if (!atStop) return;
    const next = statusAfterFailedStop(job, atStop);
    const why = `${reason}${note ? `: ${note}` : ''}`;
    const stops = patchStop(job, atStop.id, {
      status: 'failed',
      doneAt: Date.now(),
      failReason: why.slice(0, 300),
    });
    const label = `${stopLabel(atStop)} at ${atStop.place} not completed — ${why}`;
    void advance(next, {
      stops,
      note: label.slice(0, 1000),
      ...(next === 'failed' ? { failReason: label.slice(0, 300) } : {}),
    });
  };
  const failOutcome = atStop
    ? statusAfterFailedStop(job, atStop) === 'in_transit' || statusAfterFailedStop(job, atStop) === 'loaded'
      ? 'continue'
      : statusAfterFailedStop(job, atStop) === 'delivered'
      ? 'finish'
      : 'fail'
    : 'continue';

  const primary = () => {
    if (!action || busy) return;
    setFlow(action.flow);
  };

  return (
    <div className="drv-page drv-detail">
      <section className="drv-card drv-head">
        <div className="drv-jobcard-top">
          <span className="drv-ref lg">{job.ref}</span>
          {job.priority !== 'normal' && <span className={`drv-prio drv-prio-${job.priority}`}>{job.priority === 'urgent' ? 'Urgent' : 'High'}</span>}
          <span className="drv-grow" />
          <JobStatusPill status={job.status} />
        </div>
        <h1 className="drv-title">{job.title}</h1>
        <div className="drv-jobcard-meta">
          <span>
            <Icon name="calendar" size={16} />
            {job.scheduledDate === today ? 'Today' : fmtDate(job.scheduledDate)} · {job.scheduledTime}
          </span>
          {job.vehicleReg && (
            <span>
              <Icon name="truck" size={16} />
              {job.vehicleReg}
            </span>
          )}
          {typeof job.estimatedKm === 'number' && <span>~{job.estimatedKm} km</span>}
        </div>
        {multi ? <StopsProgress stops={ordered(job.stops!)} /> : idx >= 0 && <Stepper idx={idx} />}
        {trip.length > 1 && (
          <p className="drv-tripnote">
            <Icon name="layers" size={16} /> Trip · job {trip.findIndex((t) => t.id === job.id) + 1} of {trip.length}
          </p>
        )}
      </section>

      {job.status === 'failed' && job.failReason && (
        <p className="alert alert-err">
          <Icon name="x" size={18} /> Failed: {job.failReason}
        </p>
      )}
      {job.status === 'cancelled' && <p className="alert alert-err">Dispatch cancelled this job.</p>}

      {job.instructions && (
        <section className="drv-instr" aria-label="Instructions">
          <Icon name="shield" size={20} />
          <p>{job.instructions}</p>
        </section>
      )}

      {multi ? (
        <section className="drv-card drv-stops" aria-label="Stops">
          <h2 className="drv-h">
            Stops <span className="muted small">({job.stops!.length})</span>
          </h2>
          <ol className="drv-stoplist">
            {ordered(job.stops!).map((st, i) => (
              <MultiStop key={st.id} job={job} n={i + 1} stop={st} current={!final && action?.stop?.id === st.id} />
            ))}
          </ol>
        </section>
      ) : (
        <section className="drv-card drv-route" aria-label="Route">
          <StopBlock job={job} stopId="p" label="Pickup" tone="a" stop={job.pickup} current={!towardsDrop && !final} />
          <div className="drv-route-sep" aria-hidden="true" />
          <StopBlock job={job} stopId="d" label="Delivery" tone="b" stop={job.dropoff} current={towardsDrop && !final} />
        </section>
      )}

      {!final ? <DriverRoute job={job} towardsDrop={towardsDrop} /> : null}

      <section className="drv-card">
        <h2 className="drv-h">Load & customer</h2>
        <dl className="drv-summary">
          <div>
            <dt>Cargo</dt>
            <dd>{job.cargo}</dd>
          </div>
          <div>
            <dt>Customer</dt>
            <dd>
              {job.customer.name}
              {job.customer.company && job.customer.company !== job.customer.name && <span className="muted small"> · {job.customer.company}</span>}
            </dd>
          </div>
        </dl>
        {job.customer.phone && (
          <a href={telLink(job.customer.phone)} className="btn btn-ghost btn-block drv-btn">
            <Icon name="phone" size={18} /> Call customer
          </a>
        )}
      </section>

      {(job.odoStart || job.odoEnd || job.pod) && (
        <section className="drv-card">
          <h2 className="drv-h">Trip record</h2>
          <dl className="drv-summary">
            {job.odoStart && (
              <div>
                <dt>Start ODO</dt>
                <dd>
                  {fmtKm(job.odoStart.km)} <span className="muted small">{job.odoStart.method === 'ocr' ? 'scanned' : 'entered'}</span>
                </dd>
              </div>
            )}
            {job.odoEnd && (
              <div>
                <dt>End ODO</dt>
                <dd>{fmtKm(job.odoEnd.km)}</dd>
              </div>
            )}
            {typeof job.actualKm === 'number' && (
              <div>
                <dt>Trip</dt>
                <dd>
                  <strong>{fmtKm(job.actualKm)}</strong>
                </dd>
              </div>
            )}
            {job.inspection && (
              <div>
                <dt>Inspection</dt>
                <dd className={job.inspection.allOk ? 'ok' : 'warn'}>
                  {job.inspection.allOk ? 'All OK' : `${job.inspection.items.filter((i) => !i.ok).length} issue(s)`}
                </dd>
              </div>
            )}
            {job.pod && (
              <div>
                <dt>Received by</dt>
                <dd>{job.pod.recipientName}</dd>
              </div>
            )}
          </dl>
          {job.pod?.signatureId && (
            <MediaImg tenantId={tenantId} id={job.pod.signatureId} alt={`Signature of ${job.pod.recipientName}`} className="drv-sig-thumb" />
          )}
        </section>
      )}

      {atStop && (
        <button type="button" className="btn btn-ghost btn-block drv-btn drv-btn-warn" onClick={() => setFlow('stopfail')}>
          <Icon name="x" size={18} /> Can't complete this {atStop.kind === 'pickup' ? 'pickup' : 'delivery'}
        </button>
      )}

      <div className="drv-row2">
        <button type="button" className="btn btn-ghost drv-btn" onClick={() => setFlow('chat')}>
          <Icon name="mail" size={18} /> Message dispatch
        </button>
        {CAN_FAIL.includes(job.status) ? (
          <button type="button" className="btn btn-ghost drv-btn drv-btn-warn" onClick={() => setFlow('fail')}>
            <Icon name="shield" size={18} /> Report problem
          </button>
        ) : (
          <Link to="/driver" className="btn btn-ghost drv-btn">
            All jobs
          </Link>
        )}
      </div>

      <section className="drv-card">
        <h2 className="drv-h">Timeline</h2>
        {events.length === 0 ? (
          <p className="muted small">No updates yet.</p>
        ) : (
          <ol className="drv-timeline">
            {events
              .slice()
              .reverse()
              .map((e) => (
                <li key={e.id} className={`tl-${e.status}`}>
                  <span className="drv-tl-dot" aria-hidden="true" />
                  <div>
                    <div className="drv-tl-head">
                      <strong>{e.status === 'note' ? 'Note' : e.status === 'reassigned' ? 'Reassigned' : JOB_STATUS_LABEL[e.status]}</strong>
                      <time>
                        {new Date(e.at).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        {fmtTime(e.at)}
                      </time>
                    </div>
                    <span className="small muted">
                      {e.byName}
                      {e.role === 'ops' ? ' · dispatch' : ''}
                      {typeof e.lat === 'number' ? ' · 📍' : ''}
                    </span>
                    {e.note && <p className="drv-tl-note">{e.note}</p>}
                  </div>
                </li>
              ))}
          </ol>
        )}
      </section>

      {action && (
        <div className="drv-actionbar">
          <button type="button" className="btn btn-primary btn-block drv-btn-xl drv-primary" onClick={primary} disabled={busy} aria-describedby="drv-next-hint">
            <Icon name={action.icon} size={22} />
            {busy ? 'Saving…' : action.label}
          </button>
          <span id="drv-next-hint" className="sr-only">
            Current status {JOB_STATUS_LABEL[job.status]}.
          </span>
        </div>
      )}

      {flow === 'confirm' && action && (
        <Confirm
          title={`${action.label}?`}
          body={<p>{action.confirm}</p>}
          confirmLabel={action.label}
          busy={busy}
          onCancel={() => setFlow(null)}
          onConfirm={() => action.next && void advance(action.next, action.extra ?? {})}
        />
      )}
      {flow === 'start' && (
        <StartTripSheet tenantId={tenantId} user={user} job={job} vehicle={vehicle} prev={prev} busy={busy} onAdvance={advance} onClose={() => setFlow(null)} />
      )}
      {flow === 'loaded' && (
        <LoadedSheet
          tenantId={tenantId}
          user={user}
          job={job}
          stop={multi ? action?.stop : undefined}
          busy={busy}
          onAdvance={stopAdvance}
          onClose={() => setFlow(null)}
        />
      )}
      {flow === 'pod' && (
        <PodSheet
          tenantId={tenantId}
          user={user}
          job={job}
          stop={multi ? action?.stop : undefined}
          busy={busy}
          onAdvance={stopAdvance}
          onClose={() => setFlow(null)}
        />
      )}
      {flow === 'stopfail' && atStop && <StopFailSheet stop={atStop} outcome={failOutcome} busy={busy} onFail={failStop} onClose={() => setFlow(null)} />}
      {flow === 'close' && <CloseTripSheet tenantId={tenantId} user={user} job={job} busy={busy} onAdvance={advance} onClose={() => setFlow(null)} />}
      {flow === 'fail' && <FailSheet job={job} busy={busy} onAdvance={advance} onClose={() => setFlow(null)} />}
      {flow === 'chat' && (
        <Sheet title="Dispatch chat" step={`About ${job.ref}`} onClose={() => setFlow(null)}>
          <div className="drv-chat-fill">
            <Chat tenantId={tenantId} threadId={driver.id} user={user} jobContext={{ id: job.id, ref: job.ref }} height="100%" />
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Next step of a multi-stop job. */
function multiAct(job: Job): Act | undefined {
  if (job.status === 'assigned' || job.status === 'accepted') return NEXT[job.status];
  const a = stopAction(job);
  if (!a) return undefined;
  switch (a.kind) {
    case 'arrive':
      return {
        label: `Arrived at ${a.stop.kind === 'pickup' ? 'pickup' : 'delivery'} · ${a.stop.place}`,
        icon: 'pin',
        flow: 'confirm',
        confirm: `Confirm you are at ${a.stop.address}, ${a.stop.place}.`,
        next: a.next,
        stop: a.stop,
        extra: {
          stops: patchStop(job, a.stop.id, {
            status: 'arrived',
            arrivedAt: Date.now(),
          }),
          note: `Arrived at ${a.stop.place}`,
        },
      };
    case 'depart':
      return {
        label: `Drive to stop ${a.stop.seq + 1} · ${a.stop.place}`,
        icon: 'arrow',
        flow: 'confirm',
        confirm: `Leaving now for ${a.stop.kind === 'pickup' ? 'the pickup' : 'the delivery'} at ${a.stop.place}.`,
        next: 'in_transit',
        stop: a.stop,
        extra: { note: `En route to ${a.stop.place}` },
      };
    case 'load':
      return {
        label: `Loaded at ${a.stop.place}`,
        icon: 'pallet',
        flow: 'loaded',
        stop: a.stop,
      };
    case 'deliver':
      return {
        label: `Deliver at ${a.stop.place} (POD)`,
        icon: 'contract',
        flow: 'pod',
        stop: a.stop,
      };
    case 'close':
      return NEXT.delivered;
    default:
      return undefined;
  }
}

function StopsProgress({ stops }: { stops: JobStop[] }) {
  const done = stops.filter((s) => s.status === 'done' || s.status === 'failed').length;
  return (
    <div className="drv-stepper">
      <ol aria-label={`Stops: ${done} of ${stops.length} done`}>
        {stops.map((s) => (
          <li key={s.id} className={s.status === 'done' ? 'done' : s.status === 'failed' ? 'fail' : s.status === 'arrived' ? 'cur' : ''} />
        ))}
      </ol>
      <div className="drv-stepper-txt" aria-hidden="true">
        <span>
          <strong>
            {done}/{stops.length}
          </strong>{' '}
          stops done
        </span>
        <span className="muted">
          {stops.filter((s) => s.kind === 'pickup').length} pickup · {stops.filter((s) => s.kind === 'delivery').length} drop
        </span>
      </div>
    </div>
  );
}

const STOP_STATE: Record<JobStop['status'], string> = {
  pending: 'To do',
  arrived: 'On site',
  done: 'Done',
  failed: 'Not done',
};

function MultiStop({ job, n, stop, current }: { job: Job; n: number; stop: JobStop; current: boolean }) {
  const [open, setOpen] = useState(current);
  useEffect(() => setOpen(current), [current]);
  const finished = stop.status === 'done' || stop.status === 'failed';
  return (
    <li className={`drv-mstop ${stop.kind} st-${stop.status} ${current ? 'cur' : ''}`}>
      <button type="button" className="drv-mstop-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className={`drv-stop-pin ${stop.kind === 'pickup' ? 'a' : 'b'}`} aria-hidden="true">
          {n}
        </span>
        <span className="drv-mstop-main">
          <span className="drv-eyebrow">
            {stopLabel(stop)}
            {stop.window ? ` · ${stop.window}` : ''}
          </span>
          <strong className="drv-stop-town">{stop.place}</strong>
          {stop.cargo && <span className="small muted">{stop.cargo}</span>}
        </span>
        <span className={`drv-mstop-state s-${stop.status}`}>
          {stop.status === 'done' && stop.doneAt ? `Done ${fmtTime(stop.doneAt)}` : current && stop.status === 'pending' ? 'Next' : STOP_STATE[stop.status]}
        </span>
      </button>
      {open && (
        <div className="drv-mstop-body">
          <span className="drv-stop-addr">
            {stop.address}
            {stop.region ? ` · ${stop.region}` : ''}
          </span>
          {stop.reference && <span className="small">Ref: {stop.reference}</span>}
          {stop.instructions && (
            <p className="drv-instr sm">
              <Icon name="shield" size={16} />
              {stop.instructions}
            </p>
          )}
          {stop.pod && <span className="small ok">Received by {stop.pod.recipientName}</span>}
          {stop.failReason && <span className="small warn">Not done: {stop.failReason}</span>}
          {(stop.contact || stop.phone) && (
            <div className="drv-stop-contact">
              <span>
                <Icon name="user" size={16} /> {stop.contact ?? 'Contact'}
              </span>
              {stop.phone && (
                <a href={telLink(stop.phone)} className="drv-call" aria-label={`Call ${stop.contact ?? 'stop contact'} ${stop.phone}`}>
                  <Icon name="phone" size={18} /> Call
                </a>
              )}
            </div>
          )}
          {!finished && <NavButtons job={job} stopId={stop.id} stop={stop} label={`${stopLabel(stop)} ${n}`} />}
        </div>
      )}
    </li>
  );
}

function NavButtons({ job, stopId, stop, label }: { job: Job; stopId: string; stop: Job['pickup']; label: string }) {
  const t = stopTarget(stop, driverPin(job, stopId));
  return (
    <>
      <div className="drv-nav">
        <a href={navUrl(t.q)} target="_blank" rel="noreferrer" className="btn drv-btn drv-nav-btn" aria-label={`Navigate to ${label} with Google Maps`}>
          <Icon name="gps" size={18} /> Google Maps
        </a>
        <a href={wazeUrl(t)} target="_blank" rel="noreferrer" className="btn drv-btn drv-nav-btn" aria-label={`Navigate to ${label} with Waze`}>
          <Icon name="external" size={18} /> Waze
        </a>
      </div>
      <span className="small muted drv-nav-target">
        <Icon name="pin" size={12} /> {t.kind === 'town' ? 'Town centre only — call the contact for directions' : TARGET_LABEL[t.kind]}
      </span>
    </>
  );
}

function Stepper({ idx }: { idx: number }) {
  const next = JOB_FLOW[idx + 1];
  return (
    <div className="drv-stepper">
      <ol aria-label={`Progress: step ${idx + 1} of ${JOB_FLOW.length}`}>
        {JOB_FLOW.map((s, i) => (
          <li key={s} className={i < idx ? 'done' : i === idx ? 'cur' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span className="sr-only">
              {JOB_STATUS_LABEL[s]}
              {i < idx ? ' (done)' : i === idx ? ' (current)' : ''}
            </span>
          </li>
        ))}
      </ol>
      <div className="drv-stepper-txt" aria-hidden="true">
        <span>
          Step {idx + 1}/{JOB_FLOW.length} · <strong>{SHORT[JOB_FLOW[idx]]}</strong>
        </span>
        {next && <span className="muted">Next: {SHORT[next]}</span>}
      </div>
    </div>
  );
}

function StopBlock({ job, stopId, label, tone, stop, current }: { job: Job; stopId: string; label: string; tone: 'a' | 'b'; stop: Job['pickup']; current: boolean }) {
  return (
    <div className={`drv-stop ${current ? 'cur' : ''}`}>
      <div className="drv-stop-head">
        <span className={`drv-stop-pin ${tone}`} aria-hidden="true">
          {tone === 'a' ? 'A' : 'B'}
        </span>
        <span className="drv-eyebrow">{label}</span>
        {current && <span className="drv-now">Next stop</span>}
      </div>
      <strong className="drv-stop-town">{stop.place}</strong>
      <span className="drv-stop-addr">
        {stop.address}
        {stop.region ? ` · ${stop.region}` : ''}
      </span>
      {(stop.contact || stop.phone) && (
        <div className="drv-stop-contact">
          <span>
            <Icon name="user" size={16} /> {stop.contact ?? 'Contact'}
          </span>
          {stop.phone && (
            <a href={telLink(stop.phone)} className="drv-call" aria-label={`Call ${stop.contact ?? label} ${stop.phone}`}>
              <Icon name="phone" size={18} /> Call
            </a>
          )}
        </div>
      )}
      <NavButtons job={job} stopId={stopId} stop={stop} label={label.toLowerCase()} />
    </div>
  );
}

function MediaImg({ tenantId, id, alt, className }: { tenantId: string; id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getMedia(tenantId, id).then((m) => live && setSrc(m?.dataUrl ?? null));
    return () => {
      live = false;
    };
  }, [tenantId, id]);
  return src ? <img src={src} alt={alt} className={className} /> : null;
}

/** Whole route: remaining stops from the phone's current location + the drawn road route. */
function DriverRoute({ job, towardsDrop }: { job: Job; towardsDrop: boolean }) {
  const all = isMultiStop(job)
    ? ordered(job.stops!).map((s) => ({ id: s.id, s, left: s.status === 'pending' || s.status === 'arrived' }))
    : [
        { id: 'p', s: job.pickup as Job['pickup'], left: !towardsDrop },
        { id: 'd', s: job.dropoff as Job['pickup'], left: true },
      ];
  const pts = (rows: typeof all) => rows.map((r) => stopTarget(r.s, driverPin(job, r.id)).q);
  const remaining = all.filter((r) => r.left);
  if (!remaining.length) return null;
  return (
    <section className="drv-card" aria-label="Route">
      <h2 className="drv-h">
        Route <span className="muted small">({remaining.length} stop{remaining.length === 1 ? '' : 's'} left)</span>
      </h2>
      <div className="stack" style={{ gap: 8 }}>
        <RouteLinks points={pts(remaining)} fromCurrent btnClass="btn drv-btn btn-block" label={remaining.length > 1 ? 'Navigate all remaining stops' : 'Navigate'} />
        <RouteMap points={pts(all)} btnClass="btn btn-ghost btn-block" />
      </div>
    </section>
  );
}
