import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { chargeableKg, computeFreightQuote, computeQuote, findPromo } from '../lib/quote';
import { CROSS_BORDER_NAMES, estimateRoadKm, findBorderPost, findPlace, type CrossBorderCode } from '../geo';
import { useTenant } from '../tenant/TenantProvider';
import { BOOKING_STATUSES, type Booking, type BookingStatus } from '../tenant/types';
import { listBookings, updateBookingStatus } from '../lib/data';
import { telLink } from '../lib/wa';
import { bookingsToCsv, customerWaLink, STATUS_LABEL, todayYmd } from './bookingUtils';
import { copyText, downloadText, EmptyState, errMsg, fmtDateTime, Modal, PageHeader, useLoader, useUi } from './ui';

const PAGE = 50;
type Filter = BookingStatus | 'all';

export default function Bookings() {
  const { tenant, fmtMoney } = useTenant();
  const { toast } = useUi();
  const [params, setParams] = useSearchParams();
  const { data, setData, loading, error, reload } = useLoader(() => listBookings(tenant.id), [tenant.id]);
  const all = data ?? [];

  const statusParam = params.get('status');
  const status: Filter =
    statusParam && (BOOKING_STATUSES as string[]).includes(statusParam) ? (statusParam as BookingStatus) : 'all';
  const kindParam = params.get('kind');
  const kind: 'all' | 'vehicle' | 'freight' | 'rfq' = kindParam === 'vehicle' || kindParam === 'freight' || kindParam === 'rfq' ? kindParam : 'all';
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const openId = params.get('open');

  useEffect(() => setLimit(PAGE), [status, q, from, to]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of BOOKING_STATUSES) c[s] = 0;
    for (const b of all) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [all]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    return all.filter((b) => {
      if (status !== 'all' && b.status !== status) return false;
      if (kind === 'vehicle' && b.kind === 'freight') return false;
      if (kind === 'freight' && b.kind !== 'freight') return false;
      if (kind === 'rfq' && !b.rfq) return false;
      if (from && b.date < from) return false;
      if (to && b.date > to) return false;
      if (!needle) return true;
      if (b.ref.toLowerCase().includes(needle)) return true;
      if ((b.customer.name || '').toLowerCase().includes(needle)) return true;
      if (digits.length >= 3) {
        const p = (b.customer.phone || '').replace(/\D/g, '');
        // match local (07…) and international (947…) forms
        if (p.includes(digits) || p.includes(digits.replace(/^0/, '')) ) return true;
      }
      if ((b.pickup.place + ' ' + b.dropoff.place).toLowerCase().includes(needle)) return true;
      if ((b.customer.company || '').toLowerCase().includes(needle) || (b.customer.poNumber || '').toLowerCase().includes(needle)) return true;
      return false;
    });
  }, [all, status, kind, q, from, to]);

  const selected = openId ? all.find((b) => b.id === openId) ?? null : null;

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const chooseStatus = (s: Filter) => setParam('status', s === 'all' ? null : s);

  const exportCsv = () => {
    if (!rows.length) return toast('Nothing to export for these filters', 'info');
    downloadText(`${tenant.id}-bookings-${todayYmd()}.csv`, bookingsToCsv(rows), 'text/csv');
    toast(`Exported ${rows.length} booking${rows.length === 1 ? '' : 's'}`);
  };

  const onSaved = (b: Booking) => setData((list) => (list ?? []).map((x) => (x.id === b.id ? b : x)));
  const hasFilters = status !== 'all' || kind !== 'all' || q || from || to;
  const kindCount = (k: typeof kind) =>
    k === 'all' ? all.length : k === 'rfq' ? all.filter((b) => b.rfq).length : all.filter((b) => (b.kind ?? 'vehicle') === k).length;

  return (
    <div className="stack adm-page">
      <PageHeader
        title="Bookings"
        subtitle={loading ? 'Loading…' : `${rows.length} of ${all.length} shown`}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()} disabled={loading}>
              <Icon name="clock" size={16} /> Refresh
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv} disabled={loading}>
              <Icon name="download" size={16} /> Export CSV
            </button>
          </>
        }
      />

      <div className="adm-scroll-x">
        <div className="tabs" role="tablist" aria-label="Filter by type" style={{ marginBottom: 8 }}>
          {(['all', 'vehicle', 'freight', 'rfq'] as const).map((k) => (
            <button key={k} type="button" role="tab" className="tab" aria-selected={kind === k} onClick={() => setParam('kind', k === 'all' ? null : k)}>
              {k === 'all' ? 'All types' : k === 'vehicle' ? 'Vehicle hire' : k === 'freight' ? 'Freight' : 'RFQ'} <span className="adm-count">{kindCount(k)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="adm-scroll-x">
        <div className="tabs" role="tablist" aria-label="Filter by status">
          {(['all', ...BOOKING_STATUSES] as Filter[]).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              className="tab"
              aria-selected={status === s}
              onClick={() => chooseStatus(s)}
            >
              {s === 'all' ? 'All' : STATUS_LABEL[s]} <span className="adm-count">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card adm-filters">
        <label className="field adm-filter-search">
          <span className="label">Search</span>
          <div className="adm-affix">
            <input
              className="input"
              type="search"
              placeholder="Ref, customer name or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <span className="adm-affix-s" aria-hidden>
              <Icon name="search" size={16} />
            </span>
          </div>
        </label>
        <label className="field">
          <span className="label">Job date from</span>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">to</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        {hasFilters ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm adm-filter-clear"
            onClick={() => {
              setQ('');
              setFrom('');
              setTo('');
              chooseStatus('all');
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Couldn’t load bookings: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="stack" style={{ gap: 8 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 52 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title={all.length ? 'No bookings match' : 'No bookings yet'}>
            {all.length ? 'Try a different status, search term or date range.' : 'Bookings made on the public site will show up here.'}
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table adm-table-click">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Customer</th>
                  <th className="adm-hide-sm">Job date</th>
                  <th className="adm-hide-md">Route</th>
                  <th className="adm-hide-md">Vehicle</th>
                  <th>Status</th>
                  <th className="adm-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((b) => (
                  <tr key={b.id} onClick={() => setParam('open', b.id)}>
                    <td>
                      <button
                        type="button"
                        className="adm-link mono adm-row-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setParam('open', b.id);
                        }}
                      >
                        {b.ref}
                      </button>
                      <div className="muted tiny">{fmtDateTime(b.createdAt)}</div>
                    </td>
                    <td>
                      {b.customer.name}
                      <div className="muted tiny">{b.customer.phone}</div>
                    </td>
                    <td className="adm-hide-sm small">
                      {b.date}
                      <div className="muted tiny">{b.time}</div>
                    </td>
                    <td className="adm-hide-md small">
                      {stopName(b.pickup)} → {stopName(b.dropoff)}
                      {b.kind === 'freight' && <span className="badge badge-accent" style={{ marginLeft: 6 }}>Freight</span>}
                      {b.rfq && <span className="badge" style={{ marginLeft: 6 }}>RFQ</span>}
                      <div className="muted tiny">
                        {b.distanceKm} km · {b.trips} trip{b.trips === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="adm-hide-md small">
                      {b.vehicleName}
                      <div className="muted tiny">{b.loadType}</div>
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
          {rows.length > limit ? (
            <div className="row" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLimit((l) => l + PAGE)}>
                Show more ({rows.length - limit} remaining)
              </button>
            </div>
          ) : null}
        </>
      )}

      <BookingDrawer booking={selected} onClose={() => setParam('open', null)} onSaved={onSaved} />
    </div>
  );
}

function BookingDrawer({
  booking,
  onClose,
  onSaved,
}: {
  booking: Booking | null;
  onClose: () => void;
  onSaved: (b: Booking) => void;
}) {
  const { tenant, fmtMoney } = useTenant();
  const { toast, confirm } = useUi();
  const [status, setStatus] = useState<BookingStatus>('pending');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setNote(booking.adminNote ?? '');
    }
  }, [booking]);

  if (!booking) return <Modal open={false} onClose={onClose} title="" />;
  const b = booking;
  const changed = status !== b.status || note !== (b.adminNote ?? '');

  const save = async () => {
    if (status === 'cancelled' && b.status !== 'cancelled') {
      const ok = await confirm({
        title: `Cancel booking ${b.ref}?`,
        body: 'The customer’s tracking page will show this booking as cancelled.',
        confirmLabel: 'Cancel booking',
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await updateBookingStatus(tenant.id, b, status, note.trim());
      onSaved({ ...b, status, adminNote: note.trim(), updatedAt: Date.now() });
      toast(`${b.ref} updated to ${STATUS_LABEL[status]}`);
    } catch (e) {
      toast(`Update failed: ${errMsg(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  const q = b.quote;
  return (
    <Modal
      open
      variant="drawer"
      onClose={onClose}
      title={
        <span className="row" style={{ gap: 10 }}>
          <span className="mono">{b.ref}</span>
          <span className={`status status-${b.status}`}>{STATUS_LABEL[b.status]}</span>
        </span>
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={busy || !changed}>
            {busy ? 'Saving…' : 'Save update'}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="adm-actions-row">
          <a className="btn btn-ghost btn-sm" href={telLink(b.customer.phone)}>
            <Icon name="phone" size={16} /> Call
          </a>
          <a className="btn btn-ghost btn-sm" href={customerWaLink(tenant, b, status, note)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> WhatsApp
          </a>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={async () => toast((await copyText(b.ref)) ? `Copied ${b.ref}` : 'Copy failed', 'info')}
          >
            <Icon name="copy" size={16} /> Copy ref
          </button>
        </div>

        <div className="card adm-subcard stack" style={{ gap: 12 }}>
          <h3 className="adm-h3">Dispatcher update</h3>
          <label className="field">
            <span className="label">Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus)}>
              {BOOKING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Dispatcher note</span>
            <textarea
              maxLength={1000}
              className="textarea"
              rows={3}
              value={note}
              placeholder="e.g. Driver Sunil, WP LB-4521, ETA 9:30"
              onChange={(e) => setNote(e.target.value)}
            />
            <span className="hint">Shown to the customer on the tracking page and included in the WhatsApp message.</span>
          </label>
        </div>

        <dl className="adm-dl">
          <Dt k="Customer" v={b.customer.name} />
          <Dt k="Phone" v={b.customer.phone} />
          {b.customer.email ? <Dt k="Email" v={<a className="adm-link" href={`mailto:${b.customer.email}`}>{b.customer.email}</a>} /> : null}
          {b.customer.company ? <Dt k="Company" v={b.customer.company} /> : null}
          <Dt k="Job date" v={`${b.date} at ${b.time}`} />
          <Dt k="Vehicle" v={b.vehicleName} />
          <Dt k="Load type" v={b.loadType} />
          <Dt k="Pickup" v={`${b.pickup.address}, ${stopName(b.pickup)}${b.pickup.region ? ` (${b.pickup.region})` : ''}`} />
          <Dt k="Drop-off" v={`${b.dropoff.address}, ${stopName(b.dropoff)}${b.dropoff.region ? ` (${b.dropoff.region})` : ''}`} />
          {b.recipient ? <Dt k="Recipient" v={`${b.recipient.name} · ${b.recipient.phone}`} /> : null}
          {b.customer.vatNo ? <Dt k="VAT no." v={b.customer.vatNo} /> : null}
          {b.customer.poNumber ? <Dt k="PO / ref" v={b.customer.poNumber} /> : null}
          {b.freight ? <FreightDt b={b} /> : null}
          {b.rfq ? <Dt k="Quote" v={<span className="badge">Firm quote requested (RFQ)</span>} /> : null}
          <Dt k="Distance" v={`${b.distanceKm} km · ${b.trips} trip${b.trips === 1 ? '' : 's'}`} />
          {b.promoCode ? <Dt k="Promo" v={<span className="badge">{b.promoCode}</span>} /> : null}
          {b.notes ? <Dt k="Customer notes" v={b.notes} /> : null}
          <Dt k="Language" v={b.lang?.toUpperCase()} />
          <Dt k="Created" v={fmtDateTime(b.createdAt)} />
          <Dt k="Last update" v={fmtDateTime(b.updatedAt)} />
        </dl>

        {q ? (
          <div className="card adm-subcard">
            <h3 className="adm-h3" style={{ marginBottom: 8 }}>
              Quote
            </h3>
            <QuoteCheck booking={b} />
            <table className="adm-quote">
              <tbody>
                <tr>
                  <td>Base / loading</td>
                  <td>{fmtMoney(q.base)}</td>
                </tr>
                <tr>
                  <td>Distance</td>
                  <td>{fmtMoney(q.distance)}</td>
                </tr>
                {q.returnLeg ? (
                  <tr>
                    <td>Return leg</td>
                    <td>{fmtMoney(q.returnLeg)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td>Subtotal</td>
                  <td>{fmtMoney(q.subtotal)}</td>
                </tr>
                {q.discount ? (
                  <tr>
                    <td>Discount</td>
                    <td>−{fmtMoney(q.discount)}</td>
                  </tr>
                ) : null}
                {q.tax ? (
                  <tr>
                    <td>Tax</td>
                    <td>{fmtMoney(q.tax)}</td>
                  </tr>
                ) : null}
                <tr className="adm-quote-total">
                  <td>Total</td>
                  <td>{fmtMoney(q.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function Dt({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="adm-dl-row">
      <dt>{k}</dt>
      <dd>{v || '—'}</dd>
    </div>
  );
}

/** Re-prices the booking at current rates. Customer quotes are computed client-side, so flag tampering or stale rates. */
function QuoteCheck({ booking: b }: { booking: Booking }) {
  const { tenant, fmtMoney, country } = useTenant();
  const vehicle = tenant.fleet.find((v) => v.id === b.vehicleId);
  const promoAt = b.promoCode ? findPromo(tenant.promotions, b.promoCode, new Date(b.createdAt), country.timeZone) : null;
  if (b.kind === 'freight' && b.freight && b.quote) {
    // never trust client-supplied routing facts: derive cross-border + delay from the stored place and post
    const dest = findPlace(b.dropoff.placeId);
    const abroad = !!dest && dest.country !== tenant.locale.country;
    const post = findBorderPost(b.freight.crossBorder?.borderPostId);
    const freight = {
      ...b.freight,
      crossBorder: abroad
        ? { country: dest!.country as CrossBorderCode, borderPostId: post?.id ?? '', borderPostName: post?.name ?? 'border', delayHrs: post?.typicalDelayHrs ?? 0 }
        : undefined,
    };
    const issues: string[] = [];
    if ((b.freight.service === 'ftl' || b.freight.service === 'removals') && !vehicle) issues.push('No vehicle on a dedicated-vehicle booking.');
    if (!!b.freight.crossBorder !== abroad) issues.push('Cross-border flag does not match the delivery town.');
    const est = estimateRoadKm(tenant.locale.country, b.pickup.placeId, b.dropoff.placeId, post?.id);
    if (est && b.distanceKm < est * 0.75) issues.push(`Distance ${b.distanceKm} km is well below our estimate (~${est} km).`);
    const exp = computeFreightQuote({
      freight,
      distanceKm: b.distanceKm,
      logistics: tenant.logistics,
      taxPct: tenant.booking.taxPct,
      fuelSurchargePct: tenant.booking.fuelSurchargePct,
      currency: tenant.locale.currency,
      vehicle: vehicle ?? null,
      promo: promoAt,
    });
    if (Math.abs(exp.total - b.quote.total) > 1) issues.unshift(`Submitted total ${fmtMoney(b.quote.total)} differs from current rates (${fmtMoney(exp.total)}).`);
    if (!issues.length) return null;
    return (
      <div className="alert alert-warn" role="status" style={{ marginBottom: 10 }}>
        <span>
          {issues.join(' ')} Confirm the price with the customer before dispatch.
        </span>
      </div>
    );
  }
  if (!vehicle || !b.quote) return null;
  const dayHire = /^Day hire: (\d+) day/.exec(b.notes ?? '');
  const expected = computeQuote({
    vehicle,
    distanceKm: b.distanceKm,
    trips: dayHire ? 1 : b.trips,
    settings: tenant.booking,
    currency: tenant.locale.currency,
    promo: promoAt,
    mode: dayHire && vehicle.perDay ? 'day' : 'trip',
    days: dayHire ? Number(dayHire[1]) : 1,
  });
  if (Math.abs(expected.total - b.quote.total) <= 1) return null;
  return (
    <div className="alert alert-warn" role="status" style={{ marginBottom: 10 }}>
      <span>
        Submitted total {fmtMoney(b.quote.total)} differs from current rates ({fmtMoney(expected.total)}). Confirm the price with the
        customer before dispatch.
      </span>
    </div>
  );
}

/** Consignment details for freight bookings. */
function FreightDt({ b }: { b: Booking }) {
  const { tenant, fmtMoney } = useTenant();
  const f = b.freight!;
  const svc = tenant.logistics?.services.find((s) => s.id === f.service)?.title ?? f.service;
  const lvl = tenant.logistics?.levels[f.level]?.label ?? f.level;
  const kg = chargeableKg(f, tenant.logistics?.volumetricDivisor ?? 5000);
  const extras = [f.tailLift && 'tail-lift', f.helpers ? `${f.helpers} helper(s)` : '', f.afterHours && 'after-hours', f.hazardous && 'HAZCHEM'].filter(Boolean).join(' · ');
  return (
    <>
      <Dt k="Service" v={`${svc} · ${lvl}`} />
      <Dt
        k="Goods"
        v={`${f.description}${f.pallets ? ` · ${f.pallets} pallet(s)` : ''}${f.packages && f.service === 'courier' ? ` · ${f.packages} parcel(s)` : ''}${f.weightKg ? ` · ${f.weightKg} kg` : ''}${f.lengthCm ? ` · ${f.lengthCm}×${f.widthCm}×${f.heightCm} cm` : ''} · billed ${kg} kg`}
      />
      {f.insured ? <Dt k="Insured value" v={fmtMoney(f.declaredValue)} /> : null}
      {extras ? <Dt k="Extras" v={extras} /> : null}
      {f.crossBorder ? <Dt k="Cross-border" v={`${CROSS_BORDER_NAMES[f.crossBorder.country]} via ${f.crossBorder.borderPostName} (~${f.crossBorder.delayHrs} h typical)`} /> : null}
    </>
  );
}

/** Town name, tolerating bookings saved before town-level stops (district only). */
function stopName(s: Booking['pickup'] & { district?: string }): string {
  return s.place || s.district || '—';
}
