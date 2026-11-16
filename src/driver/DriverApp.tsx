import { lazy, Suspense } from 'react';
import { isNative } from '../native/platform';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useTenant } from '../tenant/TenantProvider';
import { DEMO_DRIVER, driverSignIn, driverSignOut, onDriverAuth, opsMode, seedDemo } from '../ops/store';
import type { Driver, OpsUser } from '../ops/types';
import { isValidPhone, normalisePhone } from '../geo';
import { safeHttpsUrl } from '../lib/url';
import { Icon } from '../components/Icon';
import { DriverProvider, useOnline, useToasts } from './ctx';
import { mountDriverPwa } from './pwa';
import Shell from './Shell';
import './driver.css';

type Auth = { state: 'loading' } | { state: 'out' } | { state: 'in'; driver: Driver };

/** Driver PWA: own full-screen mobile shell at /driver/*. */
const UpdateBanner = lazy(() => import('../native/UpdateBanner').then((m) => ({ default: m.UpdateBanner })));

export default function DriverApp() {
  const native = isNative();
  const { tenant } = useTenant();
  const [auth, setAuth] = useState<Auth>({ state: 'loading' });
  const [seeded, setSeeded] = useState(opsMode !== 'demo');
  const [inactive, setInactive] = useState(false);
  const pending = useRef(false);
  const online = useOnline();
  const { toasts, push } = useToasts();
  const [live, setLive] = useState('');
  const [now, setNow] = useState(Date.now);
  // external (one-time link) drivers: re-check expiry every minute
  useEffect(() => {
    if (auth.state !== 'in' || !auth.driver.external) return;
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, [auth]);
  const linkEnded = auth.state === 'in' && !!auth.driver.external && (auth.driver.expiresAt ?? 0) <= now;

  useEffect(() => mountDriverPwa(), []);
  useEffect(() => {
    document.documentElement.classList.add('drv-root');
    return () => document.documentElement.classList.remove('drv-root');
  }, []);

  useEffect(() => {
    if (opsMode !== 'demo') return;
    void seedDemo(tenant.id, tenant.locale.country).finally(() => setSeeded(true));
  }, [tenant.id, tenant.locale.country]);

  useEffect(() => {
    if (!seeded) return;
    return onDriverAuth(tenant.id, (d) => {
      if (d) {
        pending.current = false;
        setInactive(false);
        setAuth({ state: 'in', driver: d });
      } else setAuth({ state: 'out' });
    });
  }, [tenant.id, seeded]);

  // signed in to Firebase Auth but no active driver profile for this tenant
  useEffect(() => {
    if (auth.state !== 'out' || !pending.current) return;
    const t = window.setTimeout(
      () => {
        if (!pending.current) return;
        pending.current = false;
        setInactive(true);
        void driverSignOut();
      },
      opsMode === 'demo' ? 300 : 6000
    );
    return () => window.clearTimeout(t);
  }, [auth]);

  const user = useMemo<OpsUser | null>(
    () =>
      auth.state === 'in'
        ? {
            uid: auth.driver.id,
            name: auth.driver.name,
            role: 'driver',
            tenantId: tenant.id,
          }
        : null,
    [auth, tenant.id]
  );

  const notify = useMemo(
    () =>
      (msg: string, tone: 'ok' | 'warn' | 'err' = 'ok') => {
        push(msg, tone);
        setLive(msg);
      },
    [push]
  );

  return (
    <div className="drv-app">
      {native ? (
        <Suspense fallback={null}>
          <UpdateBanner />
        </Suspense>
      ) : null}
      <p className="sr-only" aria-live="polite" role="status">
        {live}
      </p>
      {auth.state === 'loading' && (
        <div className="drv-boot">
          <div className="boot-spinner" aria-label="Loading" />
        </div>
      )}
      {auth.state === 'out' && (
        <Login
          inactive={inactive}
          onAttempt={(on) => {
            pending.current = on;
            if (on) setInactive(false);
          }}
        />
      )}
      {linkEnded && <LinkEnded />}
      {auth.state === 'in' && user && !linkEnded && (
        <DriverProvider
          value={{
            tenantId: tenant.id,
            driver: auth.driver,
            user,
            online,
            notify,
          }}
        >
          <Shell />
        </DriverProvider>
      )}
      <div className="drv-toasts" aria-hidden="true">
        {toasts.map((t) => (
          <div key={t.id} className={`drv-toast drv-toast-${t.tone}`}>
            <Icon name={t.tone === 'ok' ? 'check' : t.tone === 'warn' ? 'clock' : 'x'} size={18} />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login({ inactive, onAttempt }: { inactive: boolean; onAttempt: (pending: boolean) => void }) {
  const { tenant, country } = useTenant();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logo = safeHttpsUrl(tenant.logoUrl);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr(null);
    if (!isValidPhone(phone, country.code, true)) return setErr(`Enter your mobile number, e.g. ${country.phonePlaceholder}.`);
    if (!/^\d{6,12}$/.test(pin)) return setErr('Your PIN is 6 to 12 digits.');
    setBusy(true);
    try {
      onAttempt(true);
      await driverSignIn(tenant.id, normalisePhone(phone, country.code), pin);
    } catch (ex) {
      onAttempt(false);
      setErr(ex instanceof Error ? ex.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="drv-login">
      <div className="drv-login-brand">
        {logo ? <img src={logo} alt="" className="drv-logo-img" /> : <span className="drv-logo">{(tenant.logoText || tenant.name).charAt(0)}</span>}
        <div>
          <strong>{tenant.name}</strong>
          <span>Driver app</span>
        </div>
      </div>
      <div className="drv-login-hero">
        <h1>Sign in to your jobs</h1>
        <p>Use the mobile number and PIN your dispatcher gave you.</p>
        {!isNative() && /android/i.test(navigator.userAgent) && opsMode === 'firebase' ? (
          <p>
            <a className="btn btn-ghost btn-sm" href="/app-update/exera-cargo-driver.apk" download>
              Get the Android app
            </a>
          </p>
        ) : null}
      </div>
      <form className="drv-login-form" onSubmit={submit} noValidate>
        <label className="field">
          <span className="label">Mobile number</span>
          <input
            className="input drv-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={country.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="label">PIN</span>
          <div className="drv-pin">
            <input
              className="input drv-input drv-pin-input"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              pattern="\d*"
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
              required
            />
            <button
              type="button"
              className="drv-pin-eye"
              onClick={() => setShowPin((s) => !s)}
              aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              aria-pressed={showPin}
            >
              <Icon name="eye" size={20} />
            </button>
          </div>
        </label>
        {(err || inactive) && (
          <p className="alert alert-err" role="alert">
            {err ?? `Your account isn't active for ${tenant.name}. Please contact dispatch.`}
          </p>
        )}
        <button className="btn btn-primary btn-block drv-btn-xl" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {opsMode === 'demo' && (
          <p className="drv-demo-hint">
            <Icon name="bolt" size={16} /> Demo: {DEMO_DRIVER.phone} / {DEMO_DRIVER.pin}
          </p>
        )}
      </form>
      <p className="drv-login-foot">Forgot your PIN? Ask your dispatcher to reset it.</p>
    </main>
  );
}

/** External driver whose one-time link has expired. */
function LinkEnded() {
  const { tenant } = useTenant();
  return (
    <main className="drv-login drv-link">
      <div className="drv-link-msg" role="alert">
        <span className="drv-link-ic" aria-hidden="true">
          <Icon name="check" size={28} />
        </span>
        <h1>This link has ended</h1>
        <p>Thank you for driving for {tenant.name}. Your access to these jobs has closed. If you still have work to do, ask dispatch to send you a new link.</p>
        {tenant.contact.phone && (
          <a className="btn btn-ghost btn-block drv-btn" href={`tel:${tenant.contact.phone.replace(/[^\d+]/g, '')}`}>
            <Icon name="phone" size={18} /> Call dispatch
          </a>
        )}
      </div>
    </main>
  );
}
