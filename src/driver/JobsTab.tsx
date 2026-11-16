import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import JobStatusPill from '../ops/JobStatusPill';
import { JOB_FLOW, type Job } from '../ops/types';
import { Icon } from '../components/Icon';
import { fmtDate, isoToday } from './ctx';
import { Empty } from './ui';
import { DONE, isMultiStop, tripJobs } from './stops';

type Seg = 'today' | 'upcoming' | 'done';
/** A list row: one job, or a trip (several jobs dispatched together). */
type Item = { kind: 'job'; job: Job; key: string } | { kind: 'trip'; jobs: Job[]; key: string };

const startKey = (j: Job) => `${j.scheduledDate}${j.scheduledTime}`;
const live = (j: Job) => j.status !== 'assigned' && j.status !== 'accepted' && !DONE.includes(j.status);

export default function JobsTab({ jobs, error }: { jobs: Job[] | null; error: string | null }) {
  const { country } = useTenant();
  const today = isoToday(country.timeZone);
  const groups = useMemo(() => {
    const g: Record<Seg, Item[]> = { today: [], upcoming: [], done: [] };
    const all = (jobs ?? []).filter((j) => j.status !== 'draft');
    const seen = new Set<string>();
    for (const j of all) {
      if (j.tripId) {
        if (seen.has(j.tripId)) continue;
        seen.add(j.tripId);
        const t = tripJobs(all, j.tripId);
        if (t.length > 1) {
          const open = t.filter((x) => !DONE.includes(x.status));
          const item: Item = { kind: 'trip', jobs: t, key: `trip-${j.tripId}` };
          if (!open.length) g.done.push(item);
          else if (open.some((x) => x.scheduledDate <= today || live(x))) g.today.push(item);
          else g.upcoming.push(item);
          continue;
        }
      }
      const item: Item = { kind: 'job', job: j, key: j.id };
      if (DONE.includes(j.status)) g.done.push(item);
      else if (j.scheduledDate <= today || j.status !== 'assigned') g.today.push(item);
      else g.upcoming.push(item);
    }
    const first = (i: Item) => (i.kind === 'job' ? i.job : i.jobs.find((x) => !DONE.includes(x.status)) ?? i.jobs[0]);
    const isLive = (i: Item) => (i.kind === 'job' ? live(i.job) : i.jobs.some(live));
    // in-progress first, then by schedule
    g.today.sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || startKey(first(a)).localeCompare(startKey(first(b))));
    g.upcoming.sort((a, b) => startKey(first(a)).localeCompare(startKey(first(b))));
    const upd = (i: Item) => (i.kind === 'job' ? i.job.updatedAt : Math.max(...i.jobs.map((x) => x.updatedAt)));
    g.done.sort((a, b) => upd(b) - upd(a));
    return g;
  }, [jobs, today]);
  const [seg, setSeg] = useState<Seg>('today');
  // nothing today but work coming up (e.g. a link for tomorrow) → open Upcoming once
  const autoSeg = useRef(false);
  useEffect(() => {
    if (autoSeg.current || !jobs?.length) return;
    autoSeg.current = true;
    if (!groups.today.length && groups.upcoming.length) setSeg('upcoming');
  }, [jobs, groups]);

  return (
    <div className="drv-page">
      <div className="drv-seg" role="tablist" aria-label="Job list">
        {(['today', 'upcoming', 'done'] as Seg[]).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={seg === s} className="drv-seg-btn" onClick={() => setSeg(s)}>
            {s === 'today' ? 'Today' : s === 'upcoming' ? 'Upcoming' : 'Done'}
            <span className="drv-seg-n">{groups[s].length}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="alert alert-err" role="alert">
          Could not load jobs: {error}
        </p>
      )}
      {jobs === null ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="skeleton" style={{ height: 150 }} />
          <div className="skeleton" style={{ height: 150 }} />
        </div>
      ) : groups[seg].length === 0 ? (
        <Empty
          icon={seg === 'done' ? 'check' : 'truck'}
          title={seg === 'today' ? 'No jobs for today' : seg === 'upcoming' ? 'Nothing scheduled yet' : 'No finished jobs yet'}
          text={seg === 'today' ? 'New jobs from dispatch appear here automatically.' : undefined}
        />
      ) : (
        <ul className="drv-joblist" role="tabpanel">
          {groups[seg].map((it) => (
            <li key={it.key}>{it.kind === 'job' ? <JobCard job={it.job} today={today} /> : <TripCard jobs={it.jobs} today={today} />}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job, today }: { job: Job; today: string }) {
  const idx = JOB_FLOW.indexOf(job.status as (typeof JOB_FLOW)[number]);
  const live = idx > 0 && idx < JOB_FLOW.length - 1;
  const late = job.status === 'assigned' && job.scheduledDate < today;
  return (
    <Link to={`/driver/job/${encodeURIComponent(job.id)}`} className={`drv-jobcard ${live ? 'live' : ''} prio-b-${job.priority}`}>
      <div className="drv-jobcard-top">
        <span className="drv-ref">{job.ref}</span>
        {job.priority !== 'normal' && <span className={`drv-prio drv-prio-${job.priority}`}>{job.priority === 'urgent' ? 'Urgent' : 'High'}</span>}
        <span className="drv-grow" />
        <JobStatusPill status={job.status} />
      </div>
      <div className="drv-route-mini">
        <div>
          <span className="drv-rm-dot a" aria-hidden="true" />
          <strong>{job.pickup.place}</strong>
        </div>
        {isMultiStop(job) && job.stops!.length > 2 ? (
          <span className="drv-rm-more" aria-label={`${job.stops!.length - 2} more stops`}>
            +{job.stops!.length - 2}
          </span>
        ) : (
          <span className="drv-rm-line" aria-hidden="true" />
        )}
        <div>
          <span className="drv-rm-dot b" aria-hidden="true" />
          <strong>{job.dropoff.place}</strong>
        </div>
      </div>
      <p className="drv-jobcard-cargo">{job.cargo}</p>
      <div className="drv-jobcard-meta">
        <span className={late ? 'drv-late' : ''}>
          <Icon name="clock" size={16} />
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
      {live && (
        <div className="drv-mini-progress" aria-label={`Step ${idx + 1} of ${JOB_FLOW.length}`}>
          <span style={{ width: `${((idx + 1) / JOB_FLOW.length) * 100}%` }} />
        </div>
      )}
    </Link>
  );
}

function TripCard({ jobs, today }: { jobs: Job[]; today: string }) {
  const next = jobs.find((j) => !DONE.includes(j.status));
  const done = jobs.filter((j) => DONE.includes(j.status)).length;
  const first = jobs[0];
  const isLive = jobs.some(live);
  return (
    <div className={`drv-jobcard drv-trip ${isLive ? 'live' : ''}`}>
      <div className="drv-jobcard-top">
        <span className="drv-trip-tag">
          <Icon name="layers" size={16} /> Trip · {jobs.length} jobs
        </span>
        <span className="drv-grow" />
        <span className="small muted">
          {done}/{jobs.length} done
        </span>
      </div>
      <div className="drv-jobcard-meta">
        <span>
          <Icon name="clock" size={16} />
          {first.scheduledDate === today ? 'Today' : fmtDate(first.scheduledDate)} · {first.scheduledTime}
        </span>
        {first.vehicleReg && (
          <span>
            <Icon name="truck" size={16} />
            {first.vehicleReg}
          </span>
        )}
      </div>
      <ol className="drv-trip-jobs">
        {jobs.map((j, i) => (
          <li key={j.id} className={j === next ? 'next' : DONE.includes(j.status) ? 'done' : ''}>
            <Link
              to={`/driver/job/${encodeURIComponent(j.id)}`}
              aria-label={`Job ${i + 1}: ${j.ref}, ${j.pickup.place} to ${j.dropoff.place}${j === next ? ', next to do' : ''}`}
            >
              <span className="drv-trip-n" aria-hidden="true">
                {DONE.includes(j.status) ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span className="drv-trip-main">
                <strong>
                  {j.pickup.place} → {j.dropoff.place}
                </strong>
                <span className="small muted">
                  {j.ref} · {j.cargo}
                </span>
              </span>
              {j === next ? <span className="drv-now">Next</span> : <JobStatusPill status={j.status} />}
            </Link>
          </li>
        ))}
      </ol>
      {jobs.length > 0 && (
        <div className="drv-mini-progress" aria-hidden="true">
          <span style={{ width: `${(done / jobs.length) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
