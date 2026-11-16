import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { driverSignOut, setDriverStatus, watchJobs, watchThread, watchVehicles } from '../ops/store';
import type { FleetUnit, Job } from '../ops/types';
import { safeHttpsUrl } from '../lib/url';
import { Icon } from '../components/Icon';
import { queued, useDriver } from './ctx';
import { pushSignOut, usePushRegistration } from '../push/usePush';
import { getSharePref, setSharePref, useLiveLocation, type LocState } from './useLiveLocation';
import JobsTab from './JobsTab';
import JobDetail from './JobDetail';
import ChatTab from './ChatTab';
import FuelTab from './FuelTab';
import ProfileTab from './ProfileTab';
import { Sheet } from './ui';

export const ACTIVE: Job['status'][] = ['started', 'at_pickup', 'loaded', 'in_transit', 'at_delivery', 'delivered'];

export default function Shell() {
  const { tenant } = useTenant();
  const { tenantId, driver, online, notify } = useDriver();
  usePushRegistration({ tenantId, uid: driver.id, role: 'driver' });
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsErr, setJobsErr] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<FleetUnit[]>([]);
  const [unread, setUnread] = useState(0);
  const [menu, setMenu] = useState(false);
  const [share, setShare] = useState(getSharePref);
  const [locInfo, setLocInfo] = useState(false);
  const [dutyBusy, setDutyBusy] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      watchJobs(
        tenantId,
        { driverId: driver.id, sinceDays: 14 },
        (j) => {
          setJobs(j);
          setJobsErr(null);
        },
        (e) => setJobsErr(e.message)
      ),
    [tenantId, driver.id]
  );
  useEffect(() => watchVehicles(tenantId, setVehicles), [tenantId]);
  useEffect(() => watchThread(tenantId, driver.id, (th) => setUnread(th?.unreadDriver ?? 0)), [tenantId, driver.id]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  const activeJob = useMemo(() => jobs?.find((j) => ACTIVE.includes(j.status)), [jobs]);
  const { state: locState } = useLiveLocation(tenantId, driver, activeJob?.id, share);

  const inJob = /\/driver\/job\//.test(loc.pathname);
  const ext = !!driver.external;
  const logo = safeHttpsUrl(tenant.logoUrl);

  const toggleDuty = async () => {
    if (dutyBusy || driver.status === 'on_job') return;
    const next = driver.status === 'off_duty' ? 'available' : 'off_duty';
    setDutyBusy(true);
    const r = await queued(setDriverStatus(tenantId, driver.id, next)).catch(() => 'err' as const);
    setDutyBusy(false);
    if (r === 'err') notify('Could not change your status', 'err');
    else
      notify(
        r === 'queued' ? 'Saved — will sync when online' : next === 'available' ? 'You are available for jobs' : 'You are off duty',
        r === 'queued' ? 'warn' : 'ok'
      );
  };

  return (
    <div className={`drv-shell ${inJob ? 'drv-shell-detail' : ''}`}>
      <header className="drv-top">
        {inJob ? (
          <button type="button" className="drv-iconbtn" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/driver'))} aria-label="Back to jobs">
            <Icon name="arrow" size={22} style={{ transform: 'rotate(180deg)' }} />
          </button>
        ) : logo ? (
          <img src={logo} alt="" className="drv-logo-img sm" />
        ) : (
          <span className="drv-logo sm" aria-hidden="true">
            {(tenant.logoText || tenant.name).charAt(0)}
          </span>
        )}
        <div className="drv-top-title">
          <strong>{inJob ? 'Job details' : tenant.name}</strong>
          <span>
            {driver.name}
            {driver.ownership === 'hired' || ext ? ' · Hired' : ''}
          </span>
        </div>
        <button
          type="button"
          className={`drv-duty drv-duty-${driver.status}`}
          onClick={() => void toggleDuty()}
          disabled={dutyBusy || driver.status === 'on_job'}
          role="switch"
          aria-checked={driver.status !== 'off_duty'}
          aria-label={`Duty status: ${driver.status === 'on_job' ? 'On a job' : driver.status === 'available' ? 'Available' : 'Off duty'}. Tap to change.`}
        >
          <span className="drv-duty-dot" />
          {driver.status === 'on_job' ? 'On job' : driver.status === 'available' ? 'Available' : 'Off duty'}
        </button>
        <div className="drv-menu" ref={menuRef}>
          <button type="button" className="drv-iconbtn" aria-label="Menu" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}>
            <Icon name="menu" size={22} />
          </button>
          {menu && (
            <div className="drv-menu-pop" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  nav('/driver/profile');
                }}
              >
                <Icon name="user" size={18} /> My profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  setLocInfo(true);
                }}
              >
                <Icon name="gps" size={18} /> Location sharing
              </button>
              {!ext && (
                <button type="button" role="menuitem" className="danger" onClick={() => void pushSignOut(tenantId, driver.id).finally(() => void driverSignOut())}>
                  <Icon name="logout" size={18} /> Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {!online && (
        <div className="drv-offline" role="status">
          <Icon name="bolt" size={16} /> You're offline — updates are saved on the phone and sync when you're back online.
        </div>
      )}
      {ext && !inJob && (
        <div className="drv-extstrip" role="note">
          <Icon name="truck" size={16} />
          <span>
            Hired{driver.transporterName ? ` · ${driver.transporterName}` : ''} · link ends{' '}
            {driver.expiresAt
              ? new Date(driver.expiresAt).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'soon'}
          </span>
        </div>
      )}
      <LocationStrip state={locState} onInfo={() => setLocInfo(true)} />

      <main className="drv-main" id="drv-main">
        <Routes>
          <Route index element={<JobsTab jobs={jobs} error={jobsErr} />} />
          <Route path="job/:id" element={<JobDetail jobs={jobs} vehicles={vehicles} />} />
          <Route path="chat" element={<ChatTab />} />
          {!ext && <Route path="fuel" element={<FuelTab vehicles={vehicles} activeJob={activeJob} />} />}
          <Route path="profile" element={<ProfileTab vehicles={vehicles} share={share} onShare={(v) => (setShare(v), setSharePref(v))} />} />
          <Route path="*" element={<JobsTab jobs={jobs} error={jobsErr} />} />
        </Routes>
      </main>

      {!inJob && (
        <nav className={`drv-tabs ${ext ? 'drv-tabs-3' : ''}`} aria-label="Driver app">
          <NavLink to="/driver" end className="drv-tab">
            <Icon name="truck" size={24} />
            <span>Jobs</span>
          </NavLink>
          <NavLink to="/driver/chat" className="drv-tab">
            <span className="drv-tab-ic">
              <Icon name="mail" size={24} />
              {unread > 0 && (
                <span className="drv-badge" aria-label={`${unread} unread`}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </span>
            <span>Chat</span>
          </NavLink>
          {!ext && (
            <NavLink to="/driver/fuel" className="drv-tab">
              <Icon name="bolt" size={24} />
              <span>Fuel</span>
            </NavLink>
          )}
          <NavLink to="/driver/profile" className="drv-tab">
            <Icon name="user" size={24} />
            <span>Profile</span>
          </NavLink>
        </nav>
      )}

      {locInfo && (
        <Sheet title="Location sharing" onClose={() => setLocInfo(false)}>
          <div className="stack" style={{ gap: 14 }}>
            <p>
              While you're <strong>on duty</strong> and this app is open, {tenant.name} dispatch can see where your truck is. It helps them plan jobs, send the
              nearest truck and tell customers when you'll arrive.
            </p>
            <p className="muted">Sharing stops automatically when you go off duty or close the app. Your location is never shown to customers.</p>
            <label className="drv-toggle-row">
              <span>
                <strong>Share my location</strong>
                <span className="small muted">{LOC_TEXT[locState]}</span>
              </span>
              <input
                type="checkbox"
                className="drv-switch"
                checked={share}
                onChange={(e) => {
                  setShare(e.target.checked);
                  setSharePref(e.target.checked);
                }}
              />
            </label>
            {locState === 'denied' && (
              <p className="alert alert-warn">Location permission is blocked. Allow location for this site in your browser settings.</p>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

const LOC_TEXT: Record<LocState, string> = {
  off: 'Off duty — not sharing',
  paused: 'Paused by you',
  waiting: 'Waiting for GPS…',
  sharing: 'Sharing with dispatch',
  denied: 'Permission blocked',
  unavailable: 'GPS not available',
};

function LocationStrip({ state, onInfo }: { state: LocState; onInfo: () => void }) {
  if (state === 'off') return null;
  return (
    <button type="button" className={`drv-locstrip drv-loc-${state}`} onClick={onInfo} aria-label={`Location: ${LOC_TEXT[state]}. Tap for details.`}>
      <span className="drv-loc-dot" aria-hidden="true" />
      <span>{state === 'sharing' ? 'Sharing location with dispatch' : LOC_TEXT[state]}</span>
      <span className="drv-loc-why">Why?</span>
    </button>
  );
}
