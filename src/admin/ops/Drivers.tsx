// Drivers: CRUD, phone + PIN logins (Firebase Auth via a secondary app — no Cloud Functions), compliance and stats.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { isValidPhone, normalisePhone } from '../../geo';
import { resetDriverPin } from '../../push/functions';
import { createDriverLogin, driverLoginEmail, indexDriver, opsMode, saveDriver, updateJob, deleteDriver } from '../../ops/store';
import type { Driver } from '../../ops/types';
import { isPlatformHost } from '../../tenant/resolve';
import { useTenant } from '../../tenant/TenantProvider';
import { waLink } from '../../lib/wa';
import { copyText, EmptyState, errMsg, Field, Modal, PageHeader, Toggle, useUi } from '../ui';
import { useDrivers, useJobs, useOpsUser, useToday, useVehicles } from './hooks';
import { ACTIVE, DONE, DRIVER_DOCS, randomPin, scheduledAt } from './lib';
import { DutyBadge, ExpiryBadge, HiredTag, LoadingRows } from './widgets';
import { OwnershipFields } from './OwnershipFields';
import './ops-admin.css';

interface Creds {
  name: string;
  phone: string;
  pin: string;
}

export function driverAppUrl(tenantId: string): string {
  return `${window.location.origin}/driver${isPlatformHost() ? `?site=${encodeURIComponent(tenantId)}` : ''}`;
}

function friendlyLoginError(e: unknown, email: string): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  if (code === 'auth/email-already-in-use')
    return `A login for this phone number already exists (${email}). Delete that user in Firebase Console → Authentication, then try again.`;
  if (code === 'auth/weak-password') return 'PIN rejected as too weak — use at least 6 digits.';
  if (code === 'auth/operation-not-allowed') return 'Enable the Email/Password sign-in provider in Firebase Console → Authentication.';
  if (code === 'auth/network-request-failed') return 'Network error — check the connection and try again.';
  return errMsg(e).replace(/^Firebase:\s*/, '');
}

export default function Drivers() {
  useOpsUser();
  const { today, tz } = useToday();
  const [params, setParams] = useSearchParams();
  const { data: drivers, loading } = useDrivers();
  const { data: jobs } = useJobs(62);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [creds, setCreds] = useState<Creds | null>(null);
  const open = params.get('open');
  const setOpen = (v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set('open', v);
    else next.delete('open');
    setParams(next, { replace: true });
  };

  const month = today.slice(0, 7);
  const stats = useMemo(() => {
    const m = new Map<string, { done: number; onTime: number; timed: number; km: number; failed: number }>();
    for (const j of jobs) {
      if (!j.driverId || j.scheduledDate.slice(0, 7) !== month) continue;
      const s = m.get(j.driverId) ?? { done: 0, onTime: 0, timed: 0, km: 0, failed: 0 };
      if (DONE.includes(j.status)) s.done++;
      if (j.status === 'failed') s.failed++;
      s.km += j.actualKm ?? 0;
      if (j.odoStart) {
        s.timed++;
        if (j.odoStart.at <= scheduledAt(j, tz) + 30 * 60_000) s.onTime++;
      }
      m.set(j.driverId, s);
    }
    return m;
  }, [jobs, month, tz]);

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const digits = n.replace(/\D/g, '');
    return drivers.filter((d) => (showInactive || d.active) && (showLink || !d.external) && (!n || d.name.toLowerCase().includes(n) || (digits.length >= 3 && d.phone.replace(/\D/g, '').includes(digits.replace(/^0/, '')))));
  }, [drivers, q, showInactive, showLink]);
  const selected = open && open !== 'new' ? drivers.find((d) => d.id === open) ?? null : null;

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Drivers"
        subtitle={loading ? 'Loading…' : `${drivers.filter((d) => d.active).length} active · ${drivers.filter((d) => d.active && d.status !== 'off_duty').length} on duty now`}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen('new')}>
            <Icon name="plus" size={16} /> Add driver
          </button>
        }
      />
      <div className="card ops-filters ops-filters-2">
        <label className="field ops-f-search">
          <span className="label">Search</span>
          <div className="adm-affix">
            <input className="input" type="search" placeholder="Name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="adm-affix-s" aria-hidden>
              <Icon name="search" size={16} />
            </span>
          </div>
        </label>
        <div className="ops-f-toggle">
          <Toggle checked={showInactive} onChange={setShowInactive} label="Show deactivated" />
        </div>
        <div className="ops-f-toggle">
          <Toggle checked={showLink} onChange={setShowLink} label="Show one-time link drivers" />
        </div>
      </div>

      {loading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="user" title={drivers.length ? 'No drivers match' : 'No drivers yet'}>
            {drivers.length ? 'Try another search.' : 'Add a driver to create their phone + PIN login for the driver app.'}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table adm-table-click">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Duty</th>
                <th className="adm-hide-md">Compliance</th>
                <th className="adm-num adm-hide-sm">Done (month)</th>
                <th className="adm-num adm-hide-md">On-time start</th>
                <th className="adm-num adm-hide-md">Km (month)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const s = stats.get(d.id);
                return (
                  <tr key={d.id} onClick={() => setOpen(d.id)}>
                    <td>
                      <button
                        type="button"
                        className="adm-link adm-row-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(d.id);
                        }}
                      >
                        {d.name}
                      </button>
                      <div className="muted tiny mono">
                        {d.phone}
                        {d.licenceCode ? ` · Code ${d.licenceCode}` : ''}
                      </div>
                      <HiredTag x={d} />
                      {d.external ? <span className="ops-chip ops-lvl-none">One-time link</span> : null}
                    </td>
                    <td>
                      <DutyBadge d={d} />
                    </td>
                    <td className="adm-hide-md">
                      <div className="ops-chips">
                        {DRIVER_DOCS.map((k) => (
                          <ExpiryBadge key={k.key} label={k.label} date={d[k.key]} today={today} hideOk />
                        ))}
                      </div>
                    </td>
                    <td className="adm-num adm-hide-sm">
                      {s?.done ?? 0}
                      {s?.failed ? <div className="tiny ops-text-err">{s.failed} failed</div> : null}
                    </td>
                    <td className="adm-num adm-hide-md">{s?.timed ? `${Math.round((s.onTime / s.timed) * 100)}%` : '—'}</td>
                    <td className="adm-num adm-hide-md">{s ? Math.round(s.km).toLocaleString() : 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open === 'new' || selected ? (
        <DriverDrawer
          key={selected?.id ?? 'new'}
          driver={selected}
          all={drivers}
          stats={selected ? stats.get(selected.id) : undefined}
          onClose={() => setOpen(null)}
          onCreated={(id, c) => {
            setOpen(id);
            setCreds(c);
          }}
        />
      ) : null}
      <CredsModal creds={creds} onClose={() => setCreds(null)} />
    </div>
  );
}

type Form = Omit<Driver, 'createdAt' | 'updatedAt'> & { createdAt?: number };

function DriverDrawer({
  driver,
  all,
  stats,
  onClose,
  onCreated,
}: {
  driver: Driver | null;
  all: Driver[];
  stats?: { done: number; onTime: number; timed: number; km: number; failed: number };
  onClose: () => void;
  onCreated: (id: string, c: Creds) => void;
}) {
  const { tenant, country } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast } = useUi();
  const { data: vehicles } = useVehicles();
  const { data: jobs } = useJobs(62);
  const isNew = !driver;
  const [f, setF] = useState<Form>(() => driver ?? { id: '', name: '', phone: '', status: 'off_duty', active: true, loginId: '' });
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [relogin, setRelogin] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const phoneE164 = normalisePhone(f.phone, country.code);
  const errs: Record<string, string> = {};
  if (!f.name.trim()) errs.name = 'Name is required.';
  if (!isValidPhone(f.phone, country.code, true)) errs.phone = `Enter a valid mobile number, e.g. ${country.phonePlaceholder}.`;
  else if (all.some((d) => d.id !== f.id && d.active && d.loginId === phoneE164)) errs.phone = 'Another active driver uses this number.';
  if (isNew && !/^\d{6,12}$/.test(pin)) errs.pin = 'PIN must be 6–12 digits.';
  if (f.ownership === 'hired' && !f.transporterId) errs.transporter = 'Pick the transporter.';
  const show = (k: string) => (tried ? errs[k] : undefined);

  const save = async () => {
    setTried(true);
    if (Object.keys(errs).length) return toast('Please fix the highlighted fields', 'err');
    setBusy(true);
    try {
      const base = { ...f, name: f.name.trim(), phone: phoneE164, email: f.email?.trim() || undefined };
      if (isNew) {
        const uid = await createDriverLogin(tenant.id, phoneE164, pin);
        await saveDriver(tenant.id, { ...base, id: uid, loginId: phoneE164 });
        await indexDriver(uid, tenant.id);
        toast(`${base.name} added — share the login now`);
        onCreated(uid, { name: base.name, phone: phoneE164, pin });
      } else {
        // phone is the login id: changing it here does not change the sign-in
        await saveDriver(tenant.id, { ...base, loginId: driver.loginId });
        toast(`${base.name} saved`);
      }
    } catch (e) {
      toast(friendlyLoginError(e, driverLoginEmail(phoneE164, tenant.id)), 'err');
    } finally {
      setBusy(false);
    }
  };

  /** New Auth user for the same driver (PIN reset). The profile moves to the new uid; the old record is removed. */
  const newLogin = async (newPin: string) => {
    if (!driver) return;
    setBusy(true);
    try {
      const phone = normalisePhone(driver.phone, country.code);
      // Preferred: Cloud Function sets the new PIN on the same login (keeps uid, chat and history)
      try {
        await resetDriverPin(tenant.id, driver.id, newPin);
        setRelogin(false);
        onCreated(driver.id, { name: driver.name, phone, pin: newPin });
        return;
      } catch (e) {
        if (!/not available yet/.test((e as Error).message)) throw e;
      }
      // Fallback (no Functions deployed): new login, profile moves to the new uid
      const uid = await createDriverLogin(tenant.id, phone, newPin);
      if (uid !== driver.id) {
        await saveDriver(tenant.id, { ...driver, id: uid, loginId: phone, createdAt: driver.createdAt });
        await indexDriver(uid, tenant.id);
        await deleteDriver(tenant.id, driver.id);
        for (const j of jobs.filter((x) => x.driverId === driver.id && ACTIVE.includes(x.status))) await updateJob(tenant.id, j.id, { driverId: uid }, user, 'Driver login replaced');
      }
      setRelogin(false);
      onCreated(uid, { name: driver.name, phone, pin: newPin });
    } catch (e) {
      toast(friendlyLoginError(e, driverLoginEmail(normalisePhone(driver.phone, country.code), tenant.id)), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={
        isNew ? (
          'Add driver'
        ) : (
          <span className="row" style={{ gap: 10 }}>
            {driver.name} <DutyBadge d={driver} />
          </span>
        )
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : isNew ? 'Create driver & login' : 'Save'}
          </button>
        </>
      }
    >
      <div className="stack">
        {!isNew ? (
          <>
            <div className="ops-kmrow ops-kmrow-4">
              <div className="ops-kmstat">
                <span className="tiny muted ops-upper">Done this month</span>
                <strong>{stats?.done ?? 0}</strong>
              </div>
              <div className="ops-kmstat">
                <span className="tiny muted ops-upper">On-time start</span>
                <strong>{stats?.timed ? `${Math.round((stats.onTime / stats.timed) * 100)}%` : '—'}</strong>
              </div>
              <div className="ops-kmstat">
                <span className="tiny muted ops-upper">Km driven</span>
                <strong>{Math.round(stats?.km ?? 0).toLocaleString()}</strong>
              </div>
              <div className={`ops-kmstat${stats?.failed ? ' ops-kmstat-warn' : ''}`}>
                <span className="tiny muted ops-upper">Failed</span>
                <strong>{stats?.failed ?? 0}</strong>
              </div>
            </div>
            <div className="ops-chips">
              {DRIVER_DOCS.map((k) => (
                <ExpiryBadge key={k.key} label={k.label} date={driver[k.key]} today={today} />
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <Link to={`/admin/chat?t=${encodeURIComponent(driver.id)}`} className="btn btn-ghost btn-sm">
                <Icon name="mail" size={16} /> Chat
              </Link>
              <Link to={`/admin/jobs?driver=${encodeURIComponent(driver.id)}&d=all`} className="btn btn-ghost btn-sm">
                <Icon name="layers" size={16} /> Jobs
              </Link>
            </div>
          </>
        ) : null}

        <div className="form-grid">
          <Field label="Full name *" error={show('name')}>
            <input className="input" value={f.name} maxLength={80} aria-invalid={!!show('name') || undefined} onChange={(e) => set('name', e.target.value)} data-autofocus />
          </Field>
          <Field label="Mobile *" error={show('phone')} hint={isNew ? 'Used to sign in to the driver app' : 'Sign-in stays on the original number'}>
            <input className="input" type="tel" inputMode="tel" value={f.phone} placeholder={country.phonePlaceholder} maxLength={24} aria-invalid={!!show('phone') || undefined} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email ?? ''} maxLength={120} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Licence code">
            <input className="input" value={f.licenceCode ?? ''} maxLength={8} placeholder={country.code === 'ZA' ? 'EC / C1 / C' : 'B / C / CE'} onChange={(e) => set('licenceCode', e.target.value.toUpperCase() || undefined)} />
          </Field>
          {DRIVER_DOCS.map((k) => (
            <Field key={k.key} label={`${k.label === 'PrDP' ? 'PrDP (professional permit)' : k.label} expiry`}>
              <input className="input" type="date" value={f[k.key] ?? ''} onChange={(e) => set(k.key, e.target.value || undefined)} />
            </Field>
          ))}
          <OwnershipFields value={f} onChange={(p) => setF((x) => ({ ...x, ...p }))} error={show('transporter')} />
          <Field label="Default vehicle">
            <select className="select" value={f.defaultVehicleId ?? ''} onChange={(e) => set('defaultVehicleId', e.target.value || undefined)}>
              <option value="">— None —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registration} · {v.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="field span-2">
            <Toggle checked={f.active} onChange={(v) => set('active', v)} label="Active" desc="Deactivated drivers can’t sign in to the driver app or be assigned." />
          </div>
        </div>

        {isNew ? (
          <div className="card adm-subcard stack" style={{ gap: 10 }}>
            <h3 className="adm-h3">Driver app login</h3>
            <Field label="PIN (6–12 digits) *" error={show('pin')} hint="You’ll see it once after saving — share it with the driver privately.">
              <div className="ops-pinrow">
                <input className="input mono" inputMode="numeric" autoComplete="off" value={pin} maxLength={12} aria-invalid={!!show('pin') || undefined} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPin(randomPin())}>
                  Generate
                </button>
              </div>
            </Field>
          </div>
        ) : (
          <div className="card adm-subcard stack" style={{ gap: 8 }}>
            <h3 className="adm-h3">Driver app login</h3>
            <dl className="adm-dl">
              <div className="adm-dl-row">
                <dt>Phone</dt>
                <dd className="mono">{driver.loginId}</dd>
              </div>
              {opsMode === 'firebase' ? (
                <div className="adm-dl-row">
                  <dt>Auth user</dt>
                  <dd className="mono small">{driverLoginEmail(driver.loginId, tenant.id)}</dd>
                </div>
              ) : null}
            </dl>
            <p className="hint">
              Forgotten PIN? This plan has no Cloud Functions, so PINs can’t be reset from here. {opsMode === 'firebase' ? 'Delete the Auth user above in Firebase Console → Authentication, then ' : ''}
              create a new login — the profile and active jobs move to it; chat history stays with the old record.
            </p>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRelogin(true)} disabled={busy || !driver.active}>
                Create new login
              </button>
            </div>
          </div>
        )}
      </div>
      <NewLoginModal open={relogin} busy={busy} onClose={() => setRelogin(false)} onSubmit={(p) => void newLogin(p)} />
    </Modal>
  );
}

function NewLoginModal({ open, busy, onClose, onSubmit }: { open: boolean; busy: boolean; onClose: () => void; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const ok = /^\d{6,12}$/.test(pin);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create new login"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!ok || busy} onClick={() => onSubmit(pin)}>
            {busy ? 'Creating…' : 'Create login'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 10 }}>
        <p className="muted small">{opsMode === 'firebase' ? 'Make sure the old Auth user was deleted in the Firebase console first, otherwise this fails.' : 'Demo mode: the new PIN replaces the old one.'}</p>
        <label className="field">
          <span className="label">New PIN (6–12 digits)</span>
          <div className="ops-pinrow">
            <input className="input mono" inputMode="numeric" value={pin} maxLength={12} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} data-autofocus />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPin(randomPin())}>
              Generate
            </button>
          </div>
        </label>
      </div>
    </Modal>
  );
}

function CredsModal({ creds, onClose }: { creds: Creds | null; onClose: () => void }) {
  const { tenant } = useTenant();
  const { toast } = useUi();
  if (!creds) return <Modal open={false} onClose={onClose} title="" />;
  const url = driverAppUrl(tenant.id);
  const text = `Hi ${creds.name.split(' ')[0]}, here is your ${tenant.name} driver app login.\n\nOpen: ${url}\nPhone: ${creds.phone}\nPIN: ${creds.pin}\n\nTip: add the page to your home screen. Keep your PIN private.`;
  return (
    <Modal
      open
      onClose={onClose}
      title="Driver login created"
      footer={
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <div className="alert alert-warn" role="status">
          <Icon name="shield" size={18} /> <span>The PIN is shown only once. Share it now — it can’t be viewed again.</span>
        </div>
        <dl className="adm-dl">
          <div className="adm-dl-row">
            <dt>Driver app</dt>
            <dd className="mono small">{url}</dd>
          </div>
          <div className="adm-dl-row">
            <dt>Phone</dt>
            <dd className="mono">{creds.phone}</dd>
          </div>
          <div className="adm-dl-row">
            <dt>PIN</dt>
            <dd className="mono ops-pincode">{creds.pin}</dd>
          </div>
        </dl>
        <div className="adm-actions-row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => toast((await copyText(text)) ? 'Login instructions copied' : 'Copy failed', 'info')}>
            <Icon name="copy" size={16} /> Copy instructions
          </button>
          <a className="btn btn-ghost btn-sm" href={waLink(creds.phone, text)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> Send on WhatsApp
          </a>
        </div>
      </div>
    </Modal>
  );
}
