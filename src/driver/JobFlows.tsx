import { useState } from 'react';
import { putMedia, type AdvanceExtra } from '../ops/store';
import OdoCapture from '../ops/OdoCapture';
import PhotoField, { type CapturedPhoto } from '../ops/PhotoField';
import SignaturePad from '../ops/SignaturePad';
import {
  DEFAULT_INSPECTION,
  type FleetUnit,
  type Inspection,
  type Job,
  type JobStop,
  type MediaKind,
  type OdoReading,
  type OpsUser,
  type Pod,
} from '../ops/types';
import { Icon } from '../components/Icon';
import { fmtKm } from './ctx';
import { Sheet } from './ui';
import type { TripPrev } from './stops';

export type AdvanceFn = (next: Job['status'], extra: AdvanceExtra) => Promise<boolean>;

async function uploadAll(t: string, user: OpsUser, jobId: string, kind: MediaKind, photos: CapturedPhoto[]): Promise<string[]> {
  const ids: string[] = [];
  for (const p of photos)
    ids.push(
      await putMedia(t, {
        kind,
        jobId,
        dataUrl: p.dataUrl,
        by: user.uid,
        at: Date.now(),
        w: p.w,
        h: p.h,
      })
    );
  return ids;
}

// ── Start trip: inspection → ODO → review ───────────────────

type Answer = { ok: boolean | null; note: string };

export function StartTripSheet({
  tenantId,
  user,
  job,
  vehicle,
  prev,
  busy,
  onAdvance,
  onClose,
}: {
  tenantId: string;
  user: OpsUser;
  job: Job;
  vehicle?: FleetUnit;
  /** Earlier job of the same trip: skip today's inspection, offer its end reading. */
  prev?: TripPrev | null;
  busy: boolean;
  onAdvance: AdvanceFn;
  onClose: () => void;
}) {
  const skipInspect = !!prev?.inspectedRef;
  const [step, setStep] = useState<'inspect' | 'odo' | 'review'>(skipInspect ? 'odo' : 'inspect');
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => Object.fromEntries(DEFAULT_INSPECTION.map((i) => [i.key, { ok: null, note: '' }])));
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [safe, setSafe] = useState(false);
  const [odo, setOdo] = useState<OdoReading | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const issues = DEFAULT_INSPECTION.filter((i) => answers[i.key].ok === false);
  const unanswered = DEFAULT_INSPECTION.filter((i) => answers[i.key].ok === null).length;
  const missingNotes = issues.some((i) => !answers[i.key].note.trim());
  const inspectOk = unanswered === 0 && !missingNotes && (issues.length === 0 || safe);
  const set = (k: string, a: Partial<Answer>) => setAnswers((s) => ({ ...s, [k]: { ...s[k], ...a } }));

  const start = async () => {
    if (!odo) return;
    setErr(null);
    setUploading(true);
    try {
      if (skipInspect) {
        await onAdvance('started', {
          odoStart: odo,
          note: `Pre-trip inspection done earlier today (${prev!.inspectedRef}) · same trip`,
        });
        return;
      }
      const photoIds = photos.length ? await uploadAll(tenantId, user, job.id, 'inspection', photos) : undefined;
      const inspection: Inspection = {
        at: Date.now(),
        allOk: issues.length === 0,
        photoIds,
        items: DEFAULT_INSPECTION.map((i) => ({
          key: i.key,
          label: i.label,
          ok: answers[i.key].ok === true,
          note: answers[i.key].note.trim() || undefined,
        })),
      };
      const note = issues.length
        ? `Pre-trip issues: ${issues.map((i) => `${i.label} — ${answers[i.key].note.trim()}`).join('; ')}. Driver confirmed safe to drive.`
        : 'Pre-trip inspection: all OK';
      await onAdvance('started', { inspection, odoStart: odo, note });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the trip');
    } finally {
      setUploading(false);
    }
  };

  const total = skipInspect ? 2 : 3;
  const stepNo = (step === 'inspect' ? 1 : step === 'odo' ? 2 : 3) - (skipInspect ? 1 : 0);
  const prevKm = prev?.odoEnd?.km;
  return (
    <Sheet
      title={step === 'inspect' ? 'Pre-trip inspection' : step === 'odo' ? 'Start odometer' : 'Ready to go'}
      step={`${job.tripId ? 'Next job in trip' : 'Start trip'} · step ${stepNo} of ${total}`}
      onClose={onClose}
      locked={busy || uploading}
      footer={
        step === 'inspect' ? (
          <button type="button" className="btn btn-primary btn-block drv-btn-xl" disabled={!inspectOk} onClick={() => setStep('odo')}>
            {unanswered
              ? `${unanswered} item${unanswered > 1 ? 's' : ''} left`
              : missingNotes
              ? 'Describe each issue'
              : issues.length && !safe
              ? 'Confirm safe to drive'
              : 'Next: odometer'}
            {inspectOk && <Icon name="arrow" size={20} />}
          </button>
        ) : step === 'review' ? (
          <div className="drv-row2">
            <button type="button" className="btn btn-ghost drv-btn" onClick={() => setStep('odo')} disabled={busy || uploading}>
              Back
            </button>
            <button type="button" className="btn btn-primary drv-btn" onClick={() => void start()} disabled={busy || uploading}>
              {busy || uploading ? 'Starting…' : 'Start trip'}
            </button>
          </div>
        ) : undefined
      }
    >
      {step === 'inspect' && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="drv-spread">
            <p className="muted small" style={{ margin: 0 }}>
              Walk around {job.vehicleReg ?? 'the vehicle'} and check each item.
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAnswers((s) => Object.fromEntries(Object.entries(s).map(([k, a]) => [k, a.ok === null ? { ...a, ok: true } : a])))}
            >
              <Icon name="check" size={16} /> All OK
            </button>
          </div>
          <ul className="drv-checklist">
            {DEFAULT_INSPECTION.map((i) => {
              const a = answers[i.key];
              return (
                <li key={i.key} className={a.ok === false ? 'issue' : a.ok ? 'ok' : ''}>
                  <span className="drv-check-label" id={`ins-${i.key}`}>
                    {i.label}
                  </span>
                  <div className="drv-okissue" role="radiogroup" aria-labelledby={`ins-${i.key}`}>
                    <button type="button" role="radio" aria-checked={a.ok === true} className="ok" onClick={() => set(i.key, { ok: true })}>
                      <Icon name="check" size={18} /> OK
                    </button>
                    <button type="button" role="radio" aria-checked={a.ok === false} className="bad" onClick={() => set(i.key, { ok: false })}>
                      <Icon name="x" size={18} /> Issue
                    </button>
                  </div>
                  {a.ok === false && (
                    <textarea
                      className="textarea drv-note"
                      placeholder="What's wrong?"
                      value={a.note}
                      onChange={(e) => set(i.key, { note: e.target.value.slice(0, 300) })}
                      aria-label={`Issue with ${i.label}`}
                      aria-invalid={!a.note.trim()}
                      autoFocus
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {issues.length > 0 && (
            <div className="alert alert-warn" role="alert">
              <div className="stack" style={{ gap: 10 }}>
                <strong>
                  {issues.length} issue{issues.length > 1 ? 's' : ''} reported — dispatch will see them.
                </strong>
                <span>Only start if the vehicle is safe. If not, close this and message dispatch.</span>
                <label className="checkbox drv-check">
                  <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
                  <span>The vehicle is safe to drive</span>
                </label>
              </div>
            </div>
          )}
          <PhotoField
            label="Photos (optional)"
            value={photos}
            onChange={setPhotos}
            max={2}
            maxSide={1024}
            quality={0.62}
            hint="Add a photo of any damage or issue."
          />
        </div>
      )}
      {step === 'odo' && (
        <div className="stack" style={{ gap: 14 }}>
          {skipInspect && (
            <p className="alert alert-ok small" style={{ margin: 0 }}>
              <Icon name="check" size={16} /> Pre-trip inspection already done today on {prev!.inspectedRef}.
            </p>
          )}
          {typeof prevKm === 'number' && (
            <button
              type="button"
              className="drv-prefill"
              onClick={() => {
                setOdo({ km: prevKm, at: Date.now(), method: 'manual' });
                setStep('review');
              }}
            >
              <span>
                <strong>Use {fmtKm(prevKm)}</strong>
                <span className="small muted">End reading of {prev!.ref} — same truck, same trip</span>
              </span>
              <Icon name="arrow" size={20} />
            </button>
          )}
          <OdoCapture
            tenantId={tenantId}
            user={user}
            kind="odo_start"
            jobId={job.id}
            lastKnownKm={prevKm ?? vehicle?.odometerKm}
            onCancel={skipInspect ? onClose : () => setStep('inspect')}
            onDone={(r) => {
              setOdo(r);
              setStep('review');
            }}
          />
        </div>
      )}
      {step === 'review' && odo && (
        <div className="stack" style={{ gap: 14 }}>
          <dl className="drv-summary">
            <div>
              <dt>Inspection</dt>
              <dd className={issues.length ? 'warn' : 'ok'}>
                {skipInspect ? `Done today (${prev!.inspectedRef})` : issues.length ? `${issues.length} issue(s), safe to drive` : 'All OK'}
              </dd>
            </div>
            <div>
              <dt>Start odometer</dt>
              <dd>
                {fmtKm(odo.km)} <span className="muted small">({odo.method === 'ocr' ? `scanned, ${odo.ocrConfidence}%` : 'entered'})</span>
              </dd>
            </div>
            <div>
              <dt>Vehicle</dt>
              <dd>{job.vehicleReg ?? '—'}</dd>
            </div>
            <div>
              <dt>First stop</dt>
              <dd>
                {(job.stops?.length ? [...job.stops].sort((a, b) => a.seq - b.seq)[0] : job.pickup).address},{' '}
                {(job.stops?.length ? [...job.stops].sort((a, b) => a.seq - b.seq)[0] : job.pickup).place}
              </dd>
            </div>
          </dl>
          <p className="hint">Your location is attached to this update.</p>
          {err && (
            <p className="alert alert-err" role="alert">
              {err}
            </p>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── Loaded ───────────────────────────────────────────────────

export function LoadedSheet({
  tenantId,
  user,
  job,
  stop,
  busy,
  onAdvance,
  onClose,
}: {
  tenantId: string;
  user: OpsUser;
  job: Job;
  /** Multi-stop: the pickup being completed. */
  stop?: JobStop;
  busy: boolean;
  onAdvance: AdvanceFn;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [up, setUp] = useState(false);
  const go = async () => {
    setErr(null);
    setUp(true);
    try {
      const ids = await uploadAll(tenantId, user, job.id, 'load', photos);
      const parts = [note.trim(), ids.length ? `${ids.length} load photo${ids.length > 1 ? 's' : ''} attached` : ''].filter(Boolean);
      await onAdvance('loaded', {
        note: parts.join(' · ') || undefined,
        photoIds: ids.length ? ids : undefined,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setUp(false);
    }
  };
  return (
    <Sheet
      title="Loaded / picked up"
      step={stop ? `${job.ref} · ${stop.place}` : job.ref}
      onClose={onClose}
      locked={busy || up}
      footer={
        <button type="button" className="btn btn-primary btn-block drv-btn-xl" onClick={() => void go()} disabled={busy || up}>
          {busy || up ? 'Saving…' : 'Confirm loaded'}
        </button>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          {stop?.cargo ? 'Collect' : 'Cargo'}: <strong className="drv-text">{stop?.cargo || job.cargo}</strong>
          {stop?.reference && <span className="small"> · Ref {stop.reference}</span>}
        </p>
        <PhotoField
          label="Load photos (optional)"
          value={photos}
          onChange={setPhotos}
          max={3}
          maxSide={1024}
          quality={0.62}
          hint="Show the load on the truck / tipper body."
        />
        <label className="field">
          <span className="label">Note (optional)</span>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="e.g. weighbridge ticket 44821, 10.2 t"
          />
        </label>
        {err && (
          <p className="alert alert-err" role="alert">
            {err}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ── Proof of delivery ────────────────────────────────────────

export function PodSheet({
  tenantId,
  user,
  job,
  stop,
  busy,
  onAdvance,
  onClose,
}: {
  tenantId: string;
  user: OpsUser;
  job: Job;
  /** Multi-stop: the delivery being completed. */
  stop?: JobStop;
  busy: boolean;
  onAdvance: AdvanceFn;
  onClose: () => void;
}) {
  const [name, setName] = useState((stop ? stop.contact : job.dropoff.contact) ?? '');
  const [sig, setSig] = useState<string | null>(null);
  const [noSig, setNoSig] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [up, setUp] = useState(false);
  const [touched, setTouched] = useState(false);

  const missing = [!name.trim() && 'recipient name', !sig && !noSig && 'signature', !photos.length && 'at least 1 photo'].filter(Boolean) as string[];

  const go = async () => {
    setTouched(true);
    if (missing.length) return;
    setErr(null);
    setUp(true);
    try {
      const signatureId =
        sig && !noSig
          ? await putMedia(tenantId, {
              kind: 'signature',
              jobId: job.id,
              dataUrl: sig,
              by: user.uid,
              at: Date.now(),
            })
          : undefined;
      const photoIds = await uploadAll(tenantId, user, job.id, 'pod_photo', photos);
      const n = [noSig ? 'Recipient did not sign' : '', note.trim()].filter(Boolean).join(' · ');
      const pod: Pod = {
        recipientName: name.trim(),
        signatureId,
        photoIds,
        note: n || undefined,
        at: Date.now(),
      };
      await onAdvance('delivered', {
        pod,
        note: `Delivered to ${pod.recipientName}${n ? ` — ${n}` : ''}`,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the POD');
    } finally {
      setUp(false);
    }
  };

  return (
    <Sheet
      title="Proof of delivery"
      step={`${job.ref} · ${(stop ?? job.dropoff).place}`}
      onClose={onClose}
      locked={busy || up}
      footer={
        <button type="button" className="btn btn-primary btn-block drv-btn-xl" onClick={() => void go()} disabled={busy || up}>
          {busy || up ? 'Saving POD…' : 'Confirm delivery'}
        </button>
      }
    >
      <div className="stack" style={{ gap: 18 }}>
        {stop && (stop.cargo || stop.reference) && (
          <p className="muted" style={{ margin: 0 }}>
            {stop.cargo && (
              <>
                Drop: <strong className="drv-text">{stop.cargo}</strong>
              </>
            )}
            {stop.reference && <span className="small"> · Ref {stop.reference}</span>}
          </p>
        )}
        <label className="field">
          <span className="label">Received by (name) *</span>
          <input
            className="input drv-input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            autoComplete="off"
            placeholder="Full name of the person receiving"
            aria-invalid={touched && !name.trim()}
          />
        </label>
        {!noSig && <SignaturePad onChange={setSig} label="Recipient signature *" />}
        <label className="checkbox drv-check">
          <input type="checkbox" checked={noSig} onChange={(e) => setNoSig(e.target.checked)} />
          <span>Recipient could not / would not sign</span>
        </label>
        <PhotoField
          label="Delivery photos *"
          value={photos}
          onChange={setPhotos}
          max={3}
          maxSide={1024}
          quality={0.62}
          hint="Show the goods at the drop-off point."
        />
        <label className="field">
          <span className="label">Note (optional)</span>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            placeholder="e.g. offloaded at gate B, 1 bag torn"
          />
        </label>
        {touched && missing.length > 0 && (
          <p className="alert alert-warn" role="alert">
            Still needed: {missing.join(', ')}.
          </p>
        )}
        {err && (
          <p className="alert alert-err" role="alert">
            {err}
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ── Close trip (end ODO) ─────────────────────────────────────

export function CloseTripSheet({
  tenantId,
  user,
  job,
  busy,
  onAdvance,
  onClose,
}: {
  tenantId: string;
  user: OpsUser;
  job: Job;
  busy: boolean;
  onAdvance: AdvanceFn;
  onClose: () => void;
}) {
  const [odo, setOdo] = useState<OdoReading | null>(null);
  const [ack, setAck] = useState(false);
  const start = job.odoStart?.km;
  const trip = odo && typeof start === 'number' ? Math.round((odo.km - start) * 10) / 10 : null;
  const est = job.estimatedKm;
  const odd = trip !== null && typeof est === 'number' && est > 0 && (trip > est * 3 || trip < est * 0.3);
  return (
    <Sheet
      title={odo ? 'Close trip' : 'End odometer'}
      step={`${job.ref} · ${odo ? 'step 2 of 2' : 'step 1 of 2'}`}
      onClose={onClose}
      locked={busy}
      footer={
        odo ? (
          <div className="drv-row2">
            <button type="button" className="btn btn-ghost drv-btn" onClick={() => setOdo(null)} disabled={busy}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary drv-btn"
              disabled={busy || (odd && !ack)}
              onClick={() =>
                void onAdvance('completed', {
                  odoEnd: odo,
                  note: trip !== null ? `Trip ${trip} km` : undefined,
                })
              }
            >
              {busy ? 'Closing…' : 'Close trip'}
            </button>
          </div>
        ) : undefined
      }
    >
      {!odo ? (
        <OdoCapture tenantId={tenantId} user={user} kind="odo_end" jobId={job.id} minKm={start} lastKnownKm={start} onDone={setOdo} />
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          <div className="drv-tripkm">
            <span className="small muted">Trip distance</span>
            <strong>{trip !== null ? fmtKm(trip) : '—'}</strong>
            {typeof est === 'number' && <span className="small muted">Planned ≈ {fmtKm(est)}</span>}
          </div>
          <dl className="drv-summary">
            <div>
              <dt>Start</dt>
              <dd>{typeof start === 'number' ? fmtKm(start) : '—'}</dd>
            </div>
            <div>
              <dt>End</dt>
              <dd>{fmtKm(odo.km)}</dd>
            </div>
          </dl>
          {odd && (
            <div className="alert alert-warn" role="alert">
              <div className="stack" style={{ gap: 8 }}>
                <span>This trip is {trip! > est! ? 'much longer' : 'much shorter'} than planned. Check both readings — dispatch will review it.</span>
                <label className="checkbox drv-check">
                  <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                  <span>The readings are correct</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

// ── Problem / failed ─────────────────────────────────────────

const REASONS = ['Customer not available', 'Access denied', 'Breakdown', 'Accident', 'Load refused', 'Other'];

export function FailSheet({ job, busy, onAdvance, onClose }: { job: Job; busy: boolean; onAdvance: AdvanceFn; onClose: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sure, setSure] = useState(false);
  const needNote = reason === 'Other' || reason === 'Accident';
  const ok = !!reason && (!needNote || note.trim().length >= 3);
  return (
    <Sheet
      title="Report a problem"
      step={job.ref}
      onClose={onClose}
      locked={busy}
      footer={
        sure ? (
          <div className="drv-row2">
            <button type="button" className="btn btn-ghost drv-btn" onClick={() => setSure(false)} disabled={busy}>
              No, go back
            </button>
            <button
              type="button"
              className="btn btn-danger drv-btn"
              disabled={busy}
              onClick={() =>
                void onAdvance('failed', {
                  failReason: `${reason}${note.trim() ? `: ${note.trim()}` : ''}`,
                  note: note.trim() || reason || undefined,
                })
              }
            >
              {busy ? 'Saving…' : 'Yes, mark failed'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-danger btn-block drv-btn-xl" disabled={!ok} onClick={() => setSure(true)}>
            Mark job as failed
          </button>
        )
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}>
          The job stops here and dispatch is alerted. For a delay only, send a chat message instead.
        </p>
        <div className="drv-reasons" role="radiogroup" aria-label="Reason">
          {REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className="drv-reason" onClick={() => (setReason(r), setSure(false))}>
              <span className="drv-radio" aria-hidden="true" />
              {r}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="label">What happened?{needNote ? ' *' : ''}</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} placeholder="Short description for dispatch" />
        </label>
        {sure && (
          <p className="alert alert-err" role="alert">
            Mark {job.ref} as failed? This can't be undone from the app.
          </p>
        )}
      </div>
    </Sheet>
  );
}

// ── Stop could not be completed (multi-stop) ─────────────────

const STOP_REASONS: Record<JobStop['kind'], string[]> = {
  pickup: ['Goods not ready', 'Site closed', 'No access', 'Load refused / unsafe', 'Other'],
  delivery: ['Receiver not available', 'Site closed', 'No access', 'Goods refused', 'Wrong address', 'Other'],
};

export function StopFailSheet({
  stop,
  outcome,
  busy,
  onFail,
  onClose,
}: {
  stop: JobStop;
  /** What happens to the job: continue to the next stop, finish, or fail the whole job. */
  outcome: 'continue' | 'finish' | 'fail';
  busy: boolean;
  onFail: (reason: string, note: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const needNote = reason === 'Other';
  const ok = !!reason && (!needNote || note.trim().length >= 3);
  const kind = stop.kind === 'pickup' ? 'pickup' : 'delivery';
  return (
    <Sheet
      title={`Can't complete this ${kind}`}
      step={stop.place}
      onClose={onClose}
      locked={busy}
      footer={
        <button
          type="button"
          className={`btn ${outcome === 'fail' ? 'btn-danger' : 'btn-primary'} btn-block drv-btn-xl`}
          disabled={!ok || busy}
          onClick={() => onFail(reason!, note.trim())}
        >
          {busy ? 'Saving…' : outcome === 'continue' ? 'Skip — go to next stop' : outcome === 'finish' ? 'Skip — finish deliveries' : 'Mark job as failed'}
        </button>
      }
    >
      <div className="stack" style={{ gap: 14 }}>
        <p className="muted" style={{ margin: 0 }}>
          {outcome === 'continue'
            ? 'This stop is marked as not done and dispatch is alerted. You continue with the next stop.'
            : outcome === 'finish'
            ? 'This was the last stop. It is marked as not done and you can close the trip.'
            : 'No delivery on this job could be completed, so the whole job is marked as failed.'}
        </p>
        <div className="drv-reasons" role="radiogroup" aria-label="Reason">
          {STOP_REASONS[stop.kind].map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className="drv-reason" onClick={() => setReason(r)}>
              <span className="drv-radio" aria-hidden="true" />
              {r}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="label">What happened?{needNote ? ' *' : ''}</span>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value.slice(0, 280))} placeholder="Short description for dispatch" />
        </label>
      </div>
    </Sheet>
  );
}
