// One-time job links for external (hired) drivers: send (one job or a trip), share, revoke.
import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { isValidPhone, normalisePhone } from '../../geo';
import { createJobLink, getJobLink, IN_PROGRESS, jobLinkUrl, revokeJobLink } from '../../ops/store';
import type { Job, JobLink } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { waLink } from '../../lib/wa';
import { copyText, errMsg, Field, Modal, useUi } from '../ui';
import { useOpsUser, useToday, useTransporters, useVehicles } from './hooks';
import { assignBlockers, fmtTs, transporterBlockers } from './lib';

export type LinkState = 'open' | 'claimed' | 'expired' | 'revoked' | 'closed';

export function linkState(l: Pick<NonNullable<Job['extLink']>, 'status' | 'expiresAt'>, now = Date.now()): LinkState {
  if (l.status === 'revoked' || l.status === 'closed') return l.status;
  if (now > l.expiresAt) return 'expired';
  return l.status;
}
const STATE_LABEL: Record<LinkState, string> = { open: 'Sent — not opened yet', claimed: 'Opened by driver', expired: 'Expired', revoked: 'Revoked', closed: 'Closed' };
const STATE_LVL: Record<LinkState, string> = { open: 'ops-lvl-warn', claimed: 'ops-lvl-ok', expired: 'ops-lvl-none', revoked: 'ops-lvl-err', closed: 'ops-lvl-none' };

export function LinkStateChip({ l }: { l: NonNullable<Job['extLink']> }) {
  const s = linkState(l);
  return <span className={`ops-chip ${STATE_LVL[s]}`}>{STATE_LABEL[s]}</span>;
}

export function linkMessage(tenantName: string, jobs: Job[], url: string, driverName: string): string {
  const first = jobs[0];
  const what = jobs.length > 1 ? `${jobs.length} jobs (${jobs.map((j) => j.ref).join(', ')})` : `job ${first.ref}: ${first.pickup.place} → ${first.dropoff.place}`;
  return `Hi ${driverName.split(' ')[0]}, ${tenantName} has ${what} for you on ${first.scheduledDate} at ${first.scheduledTime}. Open this link to see the pickup details and update the trip (no login needed): ${url}`;
}

/** Create a one-time link for one job or a trip of several. */
export function SendLinkModal({ jobs, onClose, onSent }: { jobs: Job[] | null; onClose: () => void; onSent?: (l: JobLink) => void }) {
  const { tenant, country } = useTenant();
  const user = useOpsUser();
  const { today } = useToday();
  const { toast } = useUi();
  const { data: vehicles } = useVehicles();
  const { data: transporters } = useTransporters();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [reg, setReg] = useState('');
  const [trId, setTrId] = useState('');
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<JobLink | null>(null);
  const [lastKey, setLastKey] = useState('');
  const key = jobs?.map((j) => j.id).join(',') ?? '';
  if (key !== lastKey) {
    setLastKey(key);
    setSent(null);
    setTried(false);
    const j = jobs?.[0];
    setName(j?.extLink?.driverName ?? '');
    setPhone(j?.extLink?.phone ?? '');
    setVehicleId(j?.vehicleId && vehicles.find((v) => v.id === j.vehicleId)?.ownership === 'hired' ? j.vehicleId : '');
    setReg('');
    setTrId(j?.transporterId ?? '');
  }
  if (!jobs) return <Modal open={false} onClose={onClose} title="" />;

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const transporter = transporters.find((t) => t.id === (vehicle?.transporterId ?? trId));
  const date = jobs[0].scheduledDate || today;
  const blockers = vehicle ? assignBlockers(vehicle, undefined, transporters, date) : transporter ? transporterBlockers(transporter.id, transporters, date, reg || 'hired truck') : [];
  const errs: Record<string, string> = {};
  if (name.trim().length < 2) errs.name = 'Driver name is required.';
  if (phone && !isValidPhone(phone, country.code, true)) errs.phone = 'Invalid mobile number.';
  if (!vehicle && !reg.trim()) errs.reg = 'Pick the hired truck or type its registration.';
  const busyJob = jobs.find((j) => IN_PROGRESS.includes(j.status) || j.status === 'completed' || j.status === 'cancelled');
  const show = (k: string) => (tried ? errs[k] : undefined);

  const send = async () => {
    setTried(true);
    if (Object.keys(errs).length || blockers.length || busyJob) return;
    setBusy(true);
    try {
      const l = await createJobLink(
        tenant.id,
        jobs,
        {
          driverName: name.trim(),
          phone: phone ? normalisePhone(phone, country.code) : undefined,
          vehicle: vehicle ?? null,
          vehicleReg: vehicle ? undefined : reg.trim().toUpperCase(),
          transporter: transporter ?? null,
          validHours: hours,
        },
        user,
      );
      setSent(l);
      onSent?.(l);
      toast('One-time link created');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  const url = sent ? jobLinkUrl(sent.token, tenant.id) : '';
  const msg = sent ? linkMessage(tenant.name, jobs, url, sent.driverName) : '';

  return (
    <Modal
      open
      onClose={onClose}
      title={sent ? 'Link ready — send it to the driver' : `One-time link · ${jobs.length > 1 ? `${jobs.length} jobs (trip)` : jobs[0].ref}`}
      footer={
        sent ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                toast((await copyText(url)) ? 'Link copied' : 'Copy failed', 'info');
              }}
            >
              <Icon name="copy" size={16} /> Copy link
            </button>
            <a className="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(sent.phone ?? '', msg)}>
              <Icon name="whatsapp" size={16} /> Send on WhatsApp
            </a>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !!busyJob || blockers.length > 0} onClick={() => void send()}>
              {busy ? 'Creating…' : 'Create link'}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <div className="stack" style={{ gap: 12 }}>
          <p className="small">
            {sent.driverName} opens the link on their phone — no account or app needed (it opens the Exera driver app when installed). The first phone to open it becomes the driver; the link expires {fmtTs(sent.expiresAt)}.
          </p>
          <input className="input mono" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="One-time link" />
          <details className="small">
            <summary>Message preview</summary>
            <p className="muted">{msg}</p>
          </details>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <p className="muted small">
            For hired drivers who don’t have a login. They get the same step-by-step app (ODO, pickup, POD) for {jobs.length > 1 ? 'these jobs' : 'this job'} only.
          </p>
          {busyJob ? <div className="alert alert-err small">{busyJob.ref} is already under way or closed — remove it from the selection.</div> : null}
          {jobs.length > 1 ? (
            <ol className="small ops-linkjobs">
              {jobs.map((j) => (
                <li key={j.id}>
                  <span className="mono">{j.ref}</span> · {j.scheduledDate} {j.scheduledTime} · {j.pickup.place} → {j.dropoff.place}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="form-grid">
            <Field label="Driver name *" error={show('name')}>
              <input className="input" value={name} maxLength={80} aria-invalid={!!show('name') || undefined} onChange={(e) => setName(e.target.value)} data-autofocus />
            </Field>
            <Field label="Driver mobile" error={show('phone')} hint="For the WhatsApp message">
              <input className="input" type="tel" inputMode="tel" value={phone} maxLength={24} placeholder={country.phonePlaceholder} aria-invalid={!!show('phone') || undefined} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Hired truck" error={show('reg')}>
              <select className="select" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">— Not in the system (type reg) —</option>
                {vehicles
                  .filter((v) => v.ownership === 'hired' && v.status !== 'inactive')
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration} · {v.name}
                      {v.transporterName ? ` (${v.transporterName})` : ''}
                    </option>
                  ))}
              </select>
            </Field>
            {!vehicle ? (
              <Field label="Registration *" error={show('reg')}>
                <input className="input mono" value={reg} maxLength={20} aria-invalid={!!show('reg') || undefined} onChange={(e) => setReg(e.target.value.toUpperCase())} />
              </Field>
            ) : null}
            <Field label="Transporter" hint={vehicle ? 'From the hired truck' : undefined}>
              <select className="select" value={vehicle?.transporterId ?? trId} disabled={!!vehicle} onChange={(e) => setTrId(e.target.value)}>
                <option value="">— None / private —</option>
                {transporters
                  .filter((t) => t.active || t.id === trId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Valid for" hint="At least until the day after the (last) job">
              <select className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>2 days</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </Field>
          </div>
          {blockers.length ? (
            <div className="alert alert-err small" role="alert">
              {blockers.join(' ')}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/** Link status + actions on the job page. */
export function LinkCard({ job, jobs }: { job: Job; jobs: Job[] }) {
  const { tenant } = useTenant();
  const user = useOpsUser();
  const { toast, confirm } = useUi();
  const [link, setLink] = useState<JobLink | null>(null);
  const l = job.extLink!;
  useEffect(() => {
    let live = true;
    void getJobLink(l.token)
      .then((x) => live && setLink(x))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [l.token, l.status]);
  const st = linkState(l);
  const url = jobLinkUrl(l.token, tenant.id);
  const group = jobs.filter((j) => j.extLink?.token === l.token);
  const all = group.length ? group : [job];
  const msg = linkMessage(tenant.name, all, url, l.driverName);

  const revoke = async () => {
    const ok = await confirm({
      title: 'Revoke this link?',
      body: `${l.driverName} loses access to ${all.length > 1 ? `${all.length} jobs` : 'the job'} immediately. Jobs that haven’t started go back to Unassigned. A trip already under way stays with them, but updates they haven’t synced yet (e.g. POD taken offline) may be lost — call the driver first.`,
      confirmLabel: 'Revoke link',
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeJobLink(tenant.id, { token: l.token, claimedBy: link?.claimedBy }, all, user);
      toast('Link revoked');
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  return (
    <section className="card ops-block">
      <div className="spread">
        <h2 className="adm-h2">One-time link</h2>
        <LinkStateChip l={l} />
      </div>
      <dl className="adm-dl">
        <div className="adm-dl-row">
          <dt>Driver</dt>
          <dd>
            {l.driverName}
            {l.phone ? <span className="muted"> · {l.phone}</span> : null}
          </dd>
        </div>
        {all.length > 1 ? (
          <div className="adm-dl-row">
            <dt>Covers</dt>
            <dd className="mono small">{all.map((j) => j.ref).join(', ')}</dd>
          </div>
        ) : null}
        <div className="adm-dl-row">
          <dt>Opened</dt>
          <dd>{link?.claimedAt ? fmtTs(link.claimedAt) : '—'}</dd>
        </div>
        <div className="adm-dl-row">
          <dt>Expires</dt>
          <dd>{fmtTs(l.expiresAt)}</dd>
        </div>
      </dl>
      {st === 'open' || st === 'claimed' ? (
        <div className="row ops-noprint" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => {
              toast((await copyText(url)) ? 'Link copied' : 'Copy failed', 'info');
            }}
          >
            <Icon name="copy" size={16} /> Copy
          </button>
          <a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={waLink(l.phone ?? '', msg)}>
            <Icon name="whatsapp" size={16} /> WhatsApp
          </a>
          <button type="button" className="btn btn-ghost btn-sm adm-danger-btn" onClick={() => void revoke()}>
            <Icon name="x" size={16} /> Revoke
          </button>
        </div>
      ) : null}
    </section>
  );
}
