import { useTenant } from '../tenant/TenantProvider';
import { computeQuote } from '../lib/quote';
import { estimateRoadKm } from '../geo';

/** Live per-trip estimate for the homepage quick-quote (town to town). */
export default function QuickEstimate({ vehicleId, fromId, toId }: { vehicleId: string; fromId: string; toId: string }) {
  const { tenant, fmtMoney, country } = useTenant();
  const vehicle = tenant.fleet.find((v) => v.id === vehicleId);
  const km = fromId && toId ? estimateRoadKm(country.code, fromId, toId) : null;
  if (!vehicle || km === null) {
    return (
      <div className="qq-estimate" aria-live="polite">
        <span className="small muted">Choose both towns for an instant price.</span>
      </div>
    );
  }
  const q = computeQuote({ vehicle, distanceKm: km, trips: 1, settings: tenant.booking, currency: tenant.locale.currency });
  return (
    <div className="qq-estimate" aria-live="polite">
      <div>
        <span className="tiny muted">Estimated · ~{km} km</span>
        <strong className="qq-total">{fmtMoney(q.total)}</strong>
      </div>
      <span className="tiny muted" style={{ textAlign: 'right' }}>
        {tenant.booking.taxPct ? `incl. ${tenant.booking.taxPct}% ${country.taxLabel}` : 'all-in'}
        <br />
        per trip
      </span>
    </div>
  );
}
