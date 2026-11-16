import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { claimJobLink, getJobLink, opsMode, seedDemo } from '../ops/store';
import type { JobLink } from '../ops/types';
import { safeHttpsUrl } from '../lib/url';
import { Icon } from '../components/Icon';
import './driver.css';

const ANDROID_PACKAGE = 'com.exeracargo.driver';

type State = { s: 'loading' } | { s: 'missing' } | { s: 'error'; msg: string } | { s: 'ready'; link: JobLink };

function isNative(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/** intent:// URL — opens the Exera Cargo driver app when installed, otherwise stays on this page. */
function appIntentUrl(token: string): string {
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${window.location.host}/j/${token}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

function fmtUntil(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * /j/:token — one-time job link for an external (hired) driver.
 * No account: the phone signs in anonymously, claims the link and opens the driver app with only these jobs.
 */
export default function JobLinkPage() {
  const { token = '' } = useParams();
  const { tenant } = useTenant();
  const nav = useNavigate();
  const [st, setSt] = useState<State>({ s: 'loading' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const logo = safeHttpsUrl(tenant.logoUrl);
  const android = /Android/i.test(navigator.userAgent) && !isNative();

  useEffect(() => {
    document.documentElement.classList.add('drv-root');
    return () => document.documentElement.classList.remove('drv-root');
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      if (opsMode === 'demo') await seedDemo(tenant.id, tenant.locale.country).catch(() => undefined);
      const link = /^[a-z0-9]{20,64}$/.test(token) ? await getJobLink(token) : null;
      if (!live) return;
      if (!link) return setSt({ s: 'missing' });
      if (link.status === 'revoked')
        return setSt({
          s: 'error',
          msg: 'Dispatch cancelled this link. Ask them to send a new one if you still have the job.',
        });
      if (link.status === 'closed' || Date.now() > link.expiresAt)
        return setSt({
          s: 'error',
          msg: 'This link has ended. Ask dispatch to send a new one if you still have work to do.',
        });
      setSt({ s: 'ready', link });
    })().catch(
      () =>
        live &&
        setSt({
          s: 'error',
          msg: 'Could not open the link. Check your signal and try again.',
        })
    );
    return () => {
      live = false;
    };
  }, [token, tenant.id, tenant.locale.country]);

  const start = async () => {
    if (busy || !agree) return;
    setBusy(true);
    setErr(null);
    try {
      await claimJobLink(token);
      nav('/driver', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open the jobs. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="drv-app">
      <main className="drv-login drv-link">
        <div className="drv-login-brand">
          {logo ? <img src={logo} alt="" className="drv-logo-img" /> : <span className="drv-logo">{(tenant.logoText || tenant.name).charAt(0)}</span>}
          <div>
            <strong>{tenant.name}</strong>
            <span>Job link for drivers</span>
          </div>
        </div>

        {st.s === 'loading' && (
          <div className="drv-boot" style={{ minHeight: 240 }}>
            <div className="boot-spinner" aria-label="Loading" />
          </div>
        )}

        {(st.s === 'missing' || st.s === 'error') && (
          <div className="drv-link-msg" role="alert">
            <span className="drv-link-ic err" aria-hidden="true">
              <Icon name="x" size={28} />
            </span>
            <h1>{st.s === 'missing' ? 'Link not found' : 'Link not available'}</h1>
            <p>{st.s === 'missing' ? 'Check that you opened the full link from your message, or ask dispatch to send a new one.' : st.msg}</p>
            {tenant.contact.phone && (
              <a className="btn btn-ghost btn-block drv-btn" href={`tel:${tenant.contact.phone.replace(/[^\d+]/g, '')}`}>
                <Icon name="phone" size={18} /> Call dispatch
              </a>
            )}
          </div>
        )}

        {st.s === 'ready' && (
          <>
            <div className="drv-login-hero">
              <h1>Hi {st.link.driverName.split(/\s+/)[0]}</h1>
              <p>
                {tenant.name} has sent you {st.link.jobIds.length > 1 ? `a trip with ${st.link.jobIds.length} jobs` : 'a job'}. You don't need an account — open
                it below and update each step from your phone.
              </p>
            </div>

            <dl className="drv-summary drv-card">
              <div>
                <dt>Driver</dt>
                <dd>{st.link.driverName}</dd>
              </div>
              {st.link.vehicleReg && (
                <div>
                  <dt>Vehicle</dt>
                  <dd>{st.link.vehicleReg}</dd>
                </div>
              )}
              {st.link.transporterName && (
                <div>
                  <dt>Transporter</dt>
                  <dd>{st.link.transporterName}</dd>
                </div>
              )}
              <div>
                <dt>Jobs</dt>
                <dd>{st.link.jobIds.length}</dd>
              </div>
              <div>
                <dt>Link valid until</dt>
                <dd>{fmtUntil(st.link.expiresAt)}</dd>
              </div>
            </dl>

            {android && (
              <a className="btn btn-ghost btn-block drv-btn" href={appIntentUrl(token)}>
                <Icon name="download" size={18} /> Open in Exera Cargo app
              </a>
            )}

            <div className="drv-card drv-consent">
              <h2 className="drv-h">Before you start</h2>
              <ul>
                <li>While you are on these jobs, {tenant.name} can see your location so they can plan and tell the customer when you will arrive.</li>
                <li>Photos, signatures and odometer readings you take are sent to {tenant.name} as proof of the work.</li>
                <li>Access ends automatically when the link expires. Your information is used only for these jobs (POPIA).</li>
              </ul>
              <label className="checkbox drv-check">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to share my location and photos for these jobs</span>
              </label>
            </div>

            {err && (
              <p className="alert alert-err" role="alert">
                {err}
              </p>
            )}
            <button type="button" className="btn btn-primary btn-block drv-btn-xl" disabled={!agree || busy} onClick={() => void start()}>
              {busy ? 'Opening…' : 'Start'}
              {!busy && <Icon name="arrow" size={20} />}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
