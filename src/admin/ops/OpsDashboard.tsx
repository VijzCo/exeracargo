// Dashboard widgets: today's operations KPIs + compliance & maintenance alerts (realtime).
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { useDrivers, useJobs, useNow, useOpsUser, useToday, useVehicles } from './hooks';
import { complianceAlerts, DONE, isOverdue, ON_ROAD, ymdIn } from './lib';
import './ops-admin.css';

export default function OpsDashboard() {
  useOpsUser();
  const { today, tz } = useToday();
  const now = useNow(60_000);
  const jobsQ = useJobs(7);
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const loading = jobsQ.loading;

  const k = useMemo(() => {
    let scheduled = 0;
    let road = 0;
    let delivered = 0;
    let problems = 0;
    let unassigned = 0;
    for (const j of jobsQ.data) {
      if (j.scheduledDate === today && j.status !== 'cancelled') scheduled++;
      if (ON_ROAD.includes(j.status)) road++;
      if (DONE.includes(j.status) && ymdIn(tz, j.updatedAt) === today) delivered++;
      if ((j.status === 'failed' && ymdIn(tz, j.updatedAt) === today) || ((j.status === 'assigned' || j.status === 'accepted') && isOverdue(j, tz, now))) problems++;
      if (j.status === 'draft' && j.scheduledDate <= today) unassigned++;
    }
    return { scheduled, road, delivered, problems, unassigned };
  }, [jobsQ.data, today, tz, now]);

  const alerts = useMemo(() => complianceAlerts(vehicles, drivers, today), [vehicles, drivers, today]);

  return (
    <>
      <div className="spread ops-dash-head">
        <h2 className="adm-h2">Operations today</h2>
        <Link to="/admin/dispatch" className="adm-link small">
          Open dispatch →
        </Link>
      </div>
      <div className="adm-kpis">
        <OpsKpi icon="calendar" label="Jobs scheduled" value={k.scheduled} sub={k.unassigned ? `${k.unassigned} still unassigned` : 'All assigned'} tone={k.unassigned ? 'warn' : undefined} loading={loading} to="/admin/dispatch?d=today" />
        <OpsKpi icon="freight" label="On the road" value={k.road} sub="Trip started, not delivered" loading={loading} to="/admin/map" />
        <OpsKpi icon="check" label="Delivered" value={k.delivered} sub="Delivered or completed today" loading={loading} to="/admin/jobs?d=today&status=completed" />
        <OpsKpi icon="clock" label="Failed / overdue" value={k.problems} sub="Needs dispatcher attention" tone={k.problems ? 'err' : undefined} loading={loading} to="/admin/dispatch" />
      </div>
      <section className="card stack">
        <div className="spread">
          <h2 className="adm-h2">Compliance & maintenance</h2>
          <span className="muted small">{alerts.length ? `${alerts.filter((a) => a.level === 'err').length} expired/overdue · ${alerts.filter((a) => a.level === 'warn').length} due soon` : 'Nothing due in the next 30 days'}</span>
        </div>
        {alerts.length === 0 ? (
          <p className="muted small">
            <Icon name="check" size={14} /> Vehicle licence discs, roadworthy, insurance, permits, services and driver licences / PrDPs are all in date.
          </p>
        ) : (
          <ul className="ops-alerts">
            {alerts.slice(0, 12).map((a, i) => (
              <li key={`${a.to}-${i}`}>
                <Link to={a.to} className={`ops-alert ops-alert-${a.level}`}>
                  <span className={`ops-chip ops-lvl-${a.level}`}>{a.level === 'err' ? 'Overdue' : 'Due soon'}</span>
                  <span className="ops-alert-text">
                    <strong>{a.who}</strong>
                    <span className="small">{a.text}</span>
                  </span>
                  <Icon name="arrow" size={14} />
                </Link>
              </li>
            ))}
            {alerts.length > 12 ? <li className="muted small">+{alerts.length - 12} more — see Vehicles and Drivers.</li> : null}
          </ul>
        )}
      </section>
    </>
  );
}

function OpsKpi({ icon, label, value, sub, loading, tone, to }: { icon: string; label: string; value: number; sub: string; loading: boolean; tone?: 'warn' | 'err'; to: string }) {
  return (
    <Link to={to} className={`card adm-kpi card-hover${tone ? ` adm-kpi-warn ops-kpi-${tone}` : ''}`}>
      <div className="adm-kpi-head">
        <span className="adm-kpi-icon" aria-hidden>
          <Icon name={icon} size={18} />
        </span>
        <span className="muted small">{label}</span>
      </div>
      {loading ? <div className="skeleton" style={{ height: 34, width: '40%' }} /> : <div className="adm-kpi-value">{value}</div>}
      <div className="muted tiny">{sub}</div>
    </Link>
  );
}
