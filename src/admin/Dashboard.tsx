import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { BOOKING_STATUSES, type Booking } from '../tenant/types';
import { dataMode, listBookings, listMessages } from '../lib/data';
import { STATUS_LABEL, todayYmd, ymd } from './bookingUtils';
import { EmptyState, fmtDateTime, PageHeader, useLoader } from './ui';
import OpsDashboard from './ops/OpsDashboard';

const DAY = 86_400_000;

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function startOfWeek() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return startOfDay(new Date(d.getTime() - dow * DAY));
}

export default function Dashboard() {
  const { tenant, fmtMoney } = useTenant();
  const { data, loading, error, reload } = useLoader(
    async () => {
      const [b, m] = await Promise.all([listBookings(tenant.id), listMessages(tenant.id).catch(() => [])]);
      return { bookings: b, messages: m.length };
    },
    [tenant.id],
  );
  const bookings: Booking[] = data?.bookings ?? [];

  const kpi = useMemo(() => {
    const today = startOfDay();
    const week = startOfWeek();
    const month = todayYmd().slice(0, 7);
    let tCount = 0;
    let wCount = 0;
    let pending = 0;
    let revenue = 0;
    let jobsToday = 0;
    const byStatus = Object.fromEntries(BOOKING_STATUSES.map((s) => [s, 0])) as Record<(typeof BOOKING_STATUSES)[number], number>;
    for (const b of bookings) {
      if (b.createdAt >= today) tCount++;
      if (b.createdAt >= week) wCount++;
      if (b.status === 'pending') pending++;
      if (b.date === todayYmd() && b.status !== 'cancelled') jobsToday++;
      if (b.status !== 'cancelled' && (b.date || '').slice(0, 7) === month) revenue += b.quote?.total ?? 0;
      if (b.status in byStatus) byStatus[b.status]++;
    }
    // last 14 days, by created date
    const days: { label: string; key: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today - i * DAY);
      days.push({ key: ymd(d), label: d.toLocaleDateString('en-LK', { day: 'numeric', month: 'short' }), n: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.key, i]));
    for (const b of bookings) {
      const i = idx.get(ymd(new Date(b.createdAt)));
      if (i !== undefined) days[i].n++;
    }
    return { tCount, wCount, pending, revenue, jobsToday, byStatus, days };
  }, [bookings]);

  const recent = bookings.slice(0, 8);
  const total = bookings.length;
  const maxDay = Math.max(1, ...kpi.days.map((d) => d.n));

  return (
    <div className="stack adm-page">
      <PageHeader
        title="Dashboard"
        subtitle={`Overview for ${tenant.name}`}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()} disabled={loading}>
            <Icon name="clock" size={16} /> Refresh
          </button>
        }
      />
      <SetupChecklist />
      <OpsDashboard />
      <div className="spread ops-dash-head">
        <h2 className="adm-h2">Website bookings</h2>
        <Link to="/admin/bookings" className="adm-link small">
          All bookings →
        </Link>
      </div>
      {error ? (
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Couldn’t load bookings: {error}
        </div>
      ) : null}

      <div className="adm-kpis">
        <Kpi icon="calendar" label="New bookings today" value={kpi.tCount} sub={`${kpi.jobsToday} job${kpi.jobsToday === 1 ? '' : 's'} scheduled today`} loading={loading} />
        <Kpi icon="chart" label="This week" value={kpi.wCount} sub="Since Monday" loading={loading} />
        <Kpi icon="clock" label="Pending" value={kpi.pending} sub="Awaiting confirmation" loading={loading} tone={kpi.pending ? 'warn' : undefined} to="/admin/bookings?status=pending" />
        <Kpi icon="tag" label="Revenue estimate" value={fmtMoney(kpi.revenue)} sub="Non-cancelled jobs this month" loading={loading} />
      </div>

      <div className="adm-dash-grid">
        <section className="card stack">
          <div className="spread">
            <h2 className="adm-h2">Bookings · last 14 days</h2>
            <span className="muted small">{kpi.days.reduce((a, d) => a + d.n, 0)} total</span>
          </div>
          {loading ? (
            <div className="skeleton" style={{ height: 160 }} />
          ) : (
            <svg
              className="adm-chart"
              viewBox="0 0 280 120"
              role="img"
              aria-label={`Bookings per day: ${kpi.days.map((d) => `${d.label} ${d.n}`).join(', ')}`}
              preserveAspectRatio="none"
            >
              {[0.25, 0.5, 0.75].map((f) => (
                <line key={f} x1="0" x2="280" y1={100 - f * 90} y2={100 - f * 90} className="adm-chart-grid" />
              ))}
              {kpi.days.map((d, i) => {
                const h = (d.n / maxDay) * 90;
                return (
                  <g key={d.key}>
                    <rect x={i * 20 + 3} y={100 - h} width={14} height={Math.max(h, d.n ? 2 : 0.5)} rx={3} className="adm-chart-bar">
                      <title>{`${d.label}: ${d.n}`}</title>
                    </rect>
                    {i % 2 === 1 ? (
                      <text x={i * 20 + 10} y={114} className="adm-chart-label" textAnchor="middle">
                        {d.label.split(' ')[0]}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          )}
        </section>

        <section className="card stack">
          <div className="spread">
            <h2 className="adm-h2">Status breakdown</h2>
            <span className="muted small">{total} bookings</span>
          </div>
          <ul className="adm-bars">
            {BOOKING_STATUSES.map((s) => {
              const n = kpi.byStatus[s];
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <li key={s}>
                  <Link to={`/admin/bookings?status=${s}`} className="adm-bar-row">
                    <span className={`status status-${s}`}>{STATUS_LABEL[s]}</span>
                    <span className="adm-bar-track" aria-hidden>
                      <span className={`adm-bar-fill status-${s}`} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="adm-bar-n small">
                      {loading ? '…' : n} <span className="muted">({pct}%)</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="adm-dash-grid adm-dash-grid-b">
        <section className="card stack">
          <div className="spread">
            <h2 className="adm-h2">Latest bookings</h2>
            <Link to="/admin/bookings" className="adm-link small">
              View all →
            </Link>
          </div>
          {loading ? (
            <div className="stack" style={{ gap: 8 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: 44 }} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState icon="calendar" title="No bookings yet">
              New online bookings will appear here. <Link className="adm-link" to="/book" target="_blank">Try the booking form</Link>.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Customer</th>
                    <th className="adm-hide-sm">Job</th>
                    <th>Status</th>
                    <th className="adm-num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link className="adm-link mono" to={`/admin/bookings?open=${encodeURIComponent(b.id)}`}>
                          {b.ref}
                        </Link>
                        <div className="muted tiny">{fmtDateTime(b.createdAt)}</div>
                      </td>
                      <td>
                        {b.customer.name}
                        <div className="muted tiny">{b.vehicleName}</div>
                      </td>
                      <td className="adm-hide-sm small">
                        {b.date} {b.time}
                        <div className="muted tiny">
                          {b.pickup.place || (b.pickup as { district?: string }).district} → {b.dropoff.place || (b.dropoff as { district?: string }).district}
                        </div>
                      </td>
                      <td>
                        <span className={`status status-${b.status}`}>{STATUS_LABEL[b.status]}</span>
                      </td>
                      <td className="adm-num">{fmtMoney(b.quote?.total ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card stack">
          <h2 className="adm-h2">Quick links</h2>
          <div className="adm-quick">
            <Link to="/admin/bookings?status=pending" className="adm-quick-item">
              <Icon name="clock" /> <span>Review pending</span>
            </Link>
            <Link to="/admin/messages" className="adm-quick-item">
              <Icon name="mail" /> <span>Messages{data ? ` (${data.messages})` : ''}</span>
            </Link>
            <Link to="/admin/content/brand" className="adm-quick-item">
              <Icon name="palette" /> <span>Brand & theme</span>
            </Link>
            <Link to="/admin/content/fleet" className="adm-quick-item">
              <Icon name="truck" /> <span>Fleet & rates</span>
            </Link>
            <Link to="/admin/content/promotions" className="adm-quick-item">
              <Icon name="tag" /> <span>Promotions</span>
            </Link>
            <a href={`/?site=${encodeURIComponent(tenant.id)}`} target="_blank" rel="noopener noreferrer" className="adm-quick-item">
              <Icon name="external" /> <span>Open public site</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  loading,
  tone,
  to,
}: {
  icon: string;
  label: string;
  value: number | string;
  sub: string;
  loading: boolean;
  tone?: 'warn';
  to?: string;
}) {
  const inner = (
    <>
      <div className="adm-kpi-head">
        <span className="adm-kpi-icon" aria-hidden>
          <Icon name={icon} size={18} />
        </span>
        <span className="muted small">{label}</span>
      </div>
      {loading ? <div className="skeleton" style={{ height: 34, width: '60%' }} /> : <div className="adm-kpi-value">{value}</div>}
      <div className="muted tiny">{sub}</div>
    </>
  );
  const cls = `card adm-kpi${tone ? ` adm-kpi-${tone}` : ''}`;
  return to ? (
    <Link to={to} className={`${cls} card-hover`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Go-live checks: a tenant must be published before Firestore rules accept public bookings. */
function SetupChecklist() {
  const { tenant } = useTenant();
  const items = [
    { ok: dataMode === 'demo' || !!tenant.updatedAt, text: 'Publish the site once (Site content → Save & publish) — bookings and messages are rejected until then.' },
    { ok: !!tenant.contact.phone, text: 'Add a hotline number (Site content → Contact & social).' },
    { ok: !!tenant.contact.whatsapp, text: 'Add a WhatsApp number for click-to-chat and booking confirmations.' },
    { ok: tenant.fleet.some((v) => v.available), text: 'List at least one available vehicle with your real rates (Site content → Fleet).' },
  ].filter((i) => !i.ok);
  if (!items.length) return null;
  return (
    <div className="alert alert-warn" role="status">
      <Icon name="shield" size={18} />
      <div>
        <strong>Finish setting up {tenant.name}</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {items.map((i) => (
            <li key={i.text}>
              <Link to="/admin/content" className="adm-link">
                {i.text}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
