import { useTenant } from '../tenant/TenantProvider';
import { driverSignOut } from '../ops/store';
import { PushPrompt } from '../push/PushPrompt';
import { pushSignOut } from '../push/usePush';
import type { FleetUnit } from '../ops/types';
import { Icon } from '../components/Icon';
import { daysUntil, fmtDate, isoToday, useDriver } from './ctx';

const APP_VERSION = '1.0.0';

export default function ProfileTab({ vehicles, share, onShare }: { vehicles: FleetUnit[]; share: boolean; onShare: (v: boolean) => void }) {
  const { driver, tenantId } = useDriver();
  const ext = !!driver.external;
  const { tenant, country } = useTenant();
  const today = isoToday(country.timeZone);
  const v = vehicles.find((x) => x.id === driver.defaultVehicleId);
  const docs: { label: string; date?: string }[] = [
    { label: 'Driving licence', date: driver.licenceExpiry },
    { label: 'PrDP', date: driver.prdpExpiry },
    { label: 'Medical certificate', date: driver.medicalExpiry },
  ];
  const initials = driver.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="drv-page">
      <section className="drv-card drv-profile">
        <span className="drv-avatar" aria-hidden="true">
          {initials}
        </span>
        <div>
          <h1 className="drv-title" style={{ margin: 0 }}>
            {driver.name}
          </h1>
          <span className="muted">{driver.phone}</span>
          <span className="drv-tags">
            {driver.licenceCode && <span className="badge">Code {driver.licenceCode}</span>}
            {(ext || driver.ownership === 'hired') && (
              <span className="badge">
                Hired
                {driver.transporterName ? ` · ${driver.transporterName}` : ''}
              </span>
            )}
            <span className="badge badge-muted">{tenant.name}</span>
          </span>
        </div>
      </section>

      {ext && (
        <section className="drv-card">
          <h2 className="drv-h">Job link</h2>
          <dl className="drv-summary">
            <div>
              <dt>Access ends</dt>
              <dd>
                {driver.expiresAt
                  ? new Date(driver.expiresAt).toLocaleString(undefined, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </dd>
            </div>
          </dl>
          <p className="small muted" style={{ margin: 0 }}>
            You only see the jobs {tenant.name} sent you. Keep this page open or come back through the same link on this phone.
          </p>
        </section>
      )}

      {!ext && (
        <section className="drv-card">
          <h2 className="drv-h">Documents</h2>
          <ul className="drv-docs">
            {docs.map((d) => {
              const n = daysUntil(d.date, today);
              const tone = n === null ? 'none' : n < 0 ? 'err' : n < 30 ? 'warn' : 'ok';
              return (
                <li key={d.label}>
                  <span>
                    <strong>{d.label}</strong>
                    <span className="small muted">{d.date ? `Expires ${fmtDate(d.date)}` : 'Not on file'}</span>
                  </span>
                  <span className={`drv-exp drv-exp-${tone}`}>
                    {n === null ? '—' : n < 0 ? 'Expired' : n === 0 ? 'Today' : n < 30 ? `${n} day${n === 1 ? '' : 's'}` : 'Valid'}
                  </span>
                </li>
              );
            })}
          </ul>
          {docs.some((d) => {
            const n = daysUntil(d.date, today);
            return n !== null && n < 30;
          }) && <p className="alert alert-warn small">Renew soon and send the new copy to dispatch — you can't be dispatched with expired documents.</p>}
        </section>
      )}

      <section className="drv-card">
        <h2 className="drv-h">Vehicle & app</h2>
        <dl className="drv-summary">
          {!ext && (
            <div>
              <dt>Default vehicle</dt>
              <dd>{v ? `${v.registration} · ${v.name}` : '—'}</dd>
            </div>
          )}
          <div>
            <dt>App version</dt>
            <dd>{APP_VERSION}</dd>
          </div>
        </dl>
        <label className="drv-toggle-row">
          <span>
            <strong>Share location while on duty</strong>
            <span className="small muted">Helps dispatch plan jobs and give customers ETAs.</span>
          </span>
          <input type="checkbox" className="drv-switch" checked={share} onChange={(e) => onShare(e.target.checked)} />
        </label>
      </section>

      <PushPrompt className="btn btn-block" alwaysShow />

      {!ext && (
        <button type="button" className="btn btn-danger btn-block drv-btn-xl" onClick={() => void pushSignOut(tenantId, driver.id).finally(() => void driverSignOut())}>
          <Icon name="logout" size={20} /> Sign out
        </button>
      )}
    </div>
  );
}
