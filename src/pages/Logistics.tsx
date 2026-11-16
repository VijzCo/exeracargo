import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { LogisticsSection, Trust, Cta } from '../components/sections';
import { Icon } from '../components/Icon';
import { useReveal } from '../lib/hooks';
import { computeFreightQuote } from '../lib/quote';
import { BORDER_POSTS_ALL, borderPostsFor, CROSS_BORDER_NAMES, estimateRoadKm, getPlaces, type CrossBorderCode, type Place } from '../geo';
import type { FreightDetails } from '../tenant/types';

const SACU: CrossBorderCode[] = ['LS', 'SZ', 'BW', 'NA'];

const PALLET: FreightDetails = {
  service: 'ltl',
  level: 'economy',
  packages: 1,
  pallets: 1,
  weightKg: 500,
  lengthCm: 120,
  widthCm: 100,
  heightCm: 120,
  description: 'General cargo',
  declaredValue: 0,
  insured: false,
  hazardous: false,
  tailLift: false,
  helpers: 0,
  afterHours: false,
};

const HUB_KINDS = new Set(['metro', 'port', 'city']);

export default function LogisticsPage() {
  const { tenant, t, country, fmtMoney } = useTenant();
  const l = tenant.logistics;
  const ref = useReveal<HTMLDivElement>([tenant.id]);

  /** Popular lanes priced live from the tenant's own rates: 1 pallet (500 kg), economy. */
  const lanes = useMemo(() => {
    if (!l?.enabled) return [];
    const hubs = getPlaces(country.code, { regions: tenant.serviceAreas }).filter((p) => HUB_KINDS.has(p.kind));
    hubs.sort((a, b) => (a.kind === 'metro' ? 0 : 1) - (b.kind === 'metro' ? 0 : 1));
    const origin = hubs[0];
    if (!origin) return [];
    const dests: Place[] = hubs.slice(1, 6);
    if (l.crossBorder.enabled) {
      for (const c of l.crossBorder.countries.slice(0, 3)) {
        const town = getPlaces(country.code, { regions: ['__none__'], crossBorder: [c] })[0];
        if (town) dests.push(town);
      }
    }
    return dests.map((d) => {
      const km = estimateRoadKm(country.code, origin.id, d.id) ?? 0;
      const cross = d.country !== country.code;
      const post = cross ? borderPostsFor(country.code, d.country as CrossBorderCode, origin)[0] : undefined;
      const q = computeFreightQuote({
        freight: cross
          ? { ...PALLET, crossBorder: { country: d.country as CrossBorderCode, borderPostId: post?.id ?? '', borderPostName: post?.name ?? 'border', delayHrs: post?.typicalDelayHrs ?? 0 } }
          : PALLET,
        distanceKm: km,
        logistics: l,
        taxPct: tenant.booking.taxPct,
        fuelSurchargePct: tenant.booking.fuelSurchargePct,
        currency: tenant.locale.currency,
      });
      return { from: origin, to: d, km, total: q.total, cross };
    });
  }, [l, country.code, tenant.serviceAreas, tenant.booking.taxPct, tenant.booking.fuelSurchargePct, tenant.locale.currency]);

  const posts = useMemo(
    () => (l?.crossBorder.enabled ? BORDER_POSTS_ALL.filter((b) => b.from === country.code && l.crossBorder.countries.includes(b.to)) : []),
    [l, country.code],
  );

  if (!l?.enabled) {
    return (
      <div>
        <PageHeader eyebrow={tenant.name} title={t('logistics.title')} sub="Freight bookings aren’t available on this site yet — call us for a quote." />
        <Cta />
      </div>
    );
  }

  return (
    <div ref={ref}>
      <PageHeader eyebrow={tenant.name} title={t('logistics.title')} sub={t('logistics.sub')}>
        <div className="row" style={{ marginTop: 26 }}>
          <Link to="/book?mode=freight" className="btn btn-primary btn-lg">
            {t('logistics.quote')} <Icon name="arrow" size={18} />
          </Link>
          <Link to="/track" className="btn btn-ghost btn-lg">
            <Icon name="gps" size={18} /> {t('nav.track')}
          </Link>
        </div>
      </PageHeader>

      <LogisticsSection />

      {lanes.length > 0 && (
        <section className="section-tight">
          <div className="container">
            <div className="section-head reveal">
              <div>
                <div className="eyebrow">Live prices</div>
                <h2 className="h2">Popular lanes</h2>
                <p className="lead" style={{ marginTop: 10 }}>
                  One pallet (500 kg), economy, all-in incl. fuel{tenant.booking.taxPct ? ` and ${tenant.booking.taxPct}% ${country.taxLabel}` : ''}. Calculated from today’s rates.
                </p>
              </div>
            </div>
            <div className="lanes">
              {lanes.map((ln) => (
                <Link
                  key={ln.to.id}
                  to={`/book?mode=freight&service=ltl&from=${ln.from.id}&to=${ln.to.id}`}
                  className="lane card-hover reveal"
                >
                  <span>
                    <span className="lane-route">
                      {ln.from.name} → {ln.to.name}
                    </span>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      ~{ln.km} km{ln.cross ? ` · ${ln.to.region} · incl. border fees` : ''}
                    </span>
                  </span>
                  <span className="lane-price">{fmtMoney(ln.total)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head reveal">
              <div>
                <div className="eyebrow">SADC</div>
                <h2 className="h2">{t('logistics.crossTitle')}</h2>
                <p className="lead" style={{ marginTop: 10 }}>
                  {t('logistics.crossSub')}
                </p>
              </div>
            </div>
            <div className="table-wrap reveal">
              <table className="table">
                <thead>
                  <tr>
                    <th>Border post</th>
                    <th>Into</th>
                    <th>Hours</th>
                    <th>Typical truck delay</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.name}</strong>
                      </td>
                      <td>{CROSS_BORDER_NAMES[b.to]}</td>
                      <td>{b.hours}</td>
                      <td>~{b.typicalDelayHrs} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="docs-grid" style={{ marginTop: 24 }}>
              <div className="card reveal">
                <h3 className="h3">
                  SACU — {l.crossBorder.countries.filter((c) => SACU.includes(c)).map((c) => CROSS_BORDER_NAMES[c]).join(', ') || 'Lesotho, Eswatini, Botswana, Namibia'}
                </h3>
                <ul className="small">
                  <li>Commercial invoice & packing list</li>
                  <li>Customs declaration (SAD500) & proof of export</li>
                  <li>Carrier’s cross-border road transport permit</li>
                  <li>Consignee name, address & phone</li>
                </ul>
              </div>
              <div className="card reveal">
                <h3 className="h3">Zimbabwe, Mozambique, Zambia</h3>
                <ul className="small">
                  <li>Everything in the SACU list</li>
                  <li>Clearing agent at destination</li>
                  <li>Transit bond / guarantee</li>
                  <li>Allow extra time — longer border delays are common</li>
                </ul>
              </div>
            </div>
            {l.crossBorder.note && (
              <p className="small muted" style={{ marginTop: 16 }}>
                {l.crossBorder.note}
              </p>
            )}
          </div>
        </section>
      )}

      <Trust />
      <Cta />
    </div>
  );
}
