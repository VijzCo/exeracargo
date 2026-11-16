import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { Icon } from './Icon';
import { useCountUp } from '../lib/hooks';
import { telLink, waLink } from '../lib/wa';
import { cssUrl } from '../lib/url';
import PlacePicker from './PlacePicker';
import { todayIn } from '../lib/time';
import type { Insight, Promotion, SectionKey, Vehicle } from '../tenant/types';
import { CROSS_BORDER_NAMES, getPlaces, type Place } from '../geo';

const HeroScene = lazy(() => import('../three/HeroScene'));
const VehicleViewer = lazy(() => import('../three/VehicleViewer'));

export function SectionHead({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="section-head reveal">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="h2">{title}</h2>
        {sub && (
          <p className="lead" style={{ marginTop: 12 }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function capacityLabel(v: Vehicle) {
  return v.capacityUnit === 'cube' ? `${v.capacity} cube` : v.capacityUnit === 'ton' ? `${v.capacity} t` : `${v.capacity} ft`;
}

const TYPE_LABEL: Record<Vehicle['type'], string> = {
  tipper: 'Tipper',
  lorry: 'Lorry',
  flatbed: 'Flatbed',
  lowbed: 'Lowbed',
  'prime-mover': 'Prime mover',
  container: 'Container',
  van: 'Mini lorry',
  bakkie: 'Bakkie',
  tautliner: 'Tautliner',
  superlink: 'Superlink',
  reefer: 'Reefer',
};
/** South African trade names differ from Sri Lankan ones. */
const TYPE_LABEL_ZA: Partial<Record<Vehicle['type'], string>> = { lorry: 'Truck', flatbed: 'Flatdeck', van: 'Panel van' };
export const typeLabel = (t: Vehicle['type'], country?: string) => (country === 'ZA' && TYPE_LABEL_ZA[t]) || TYPE_LABEL[t] || t;

// ── HERO ─────────────────────────────────────────────────────

export function Hero() {
  const { tenant, t } = useTenant();
  const nav = useNavigate();
  const fleet = tenant.fleet.filter((v) => v.available);
  const [vehicle, setVehicle] = useState(fleet[0]?.id ?? '');
  const hubs = getPlaces(tenant.locale.country, { regions: tenant.serviceAreas }).filter((p) => p.kind === 'metro' || p.kind === 'city');
  const [from, setFrom] = useState(hubs[0]?.id ?? '');
  const [to, setTo] = useState(hubs[1]?.id ?? hubs[0]?.id ?? '');
  const th = tenant.theme;

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams({ vehicle, from, to });
    nav(`/book?${q.toString()}`);
  };

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true">
        <div className="hero-glow" />
        <div className="hero-grid" />
        {th.hero3d !== 'none' && (
          <Suspense fallback={null}>
            <HeroScene variant={th.hero3d} primary={th.primary} accent={th.accent} mode={th.mode} className="hero-canvas" />
          </Suspense>
        )}
        <div className="hero-fade" />
      </div>
      <div className="container hero-inner">
        <div className="hero-copy">
          <div className="eyebrow hero-in" style={{ animationDelay: '0.05s' }}>
            {tenant.hero.eyebrow}
          </div>
          <h1 className="h1 hero-title hero-in" style={{ animationDelay: '0.12s' }}>
            {tenant.hero.title}
          </h1>
          <p className="lead hero-in" style={{ marginTop: 20, animationDelay: '0.2s' }}>
            {tenant.hero.subtitle}
          </p>
          <div className="row hero-in" style={{ marginTop: 32, animationDelay: '0.28s' }}>
            <Link to="/book" className="btn btn-primary btn-lg">
              {tenant.hero.ctaPrimary} <Icon name="arrow" size={18} />
            </Link>
            {tenant.contact.phone && (
              <a href={telLink(tenant.contact.phone)} className="btn btn-ghost btn-lg">
                <Icon name="phone" size={18} /> {tenant.contact.phone}
              </a>
            )}
          </div>
          <ul className="hero-badges hero-in" style={{ animationDelay: '0.36s' }}>
            {tenant.hero.badges.map((b) => (
              <li key={b}>
                <Icon name="check" size={16} /> {b}
              </li>
            ))}
          </ul>
        </div>

        {tenant.booking.enabled && fleet.length > 0 && (
          <form className="quick-quote glass hero-in" style={{ animationDelay: '0.3s' }} onSubmit={go} aria-label="Quick quote">
            <div className="qq-head">
              <strong>{tenant.hero.ctaSecondary}</strong>
              <span className="badge badge-accent">
                <Icon name="bolt" size={14} /> 60 sec
              </span>
            </div>
            <label className="field">
              <span className="label">Vehicle</span>
              <select className="select" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                {fleet.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} · {capacityLabel(v)}
                  </option>
                ))}
              </select>
            </label>
            <div className="qq-route">
              <PlacePicker id="qq-from" label="From" country={tenant.locale.country} regions={tenant.serviceAreas} value={from} onChange={(p) => setFrom(p?.id ?? '')} />
              <PlacePicker id="qq-to" label="To" country={tenant.locale.country} regions={tenant.serviceAreas} value={to} onChange={(p) => setTo(p?.id ?? '')} />
            </div>
            <QuickEstimate vehicleId={vehicle} fromId={from} toId={to} />
            <button className="btn btn-primary qq-submit" type="submit">
              {t('nav.book')} <Icon name="arrow" size={18} />
            </button>
          </form>
        )}
      </div>
      <div className="scroll-cue" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

/** Lightweight inline estimate; real quote logic lives in lib/quote + src/geo. */
const QuickEstimate = lazy(() => import('./QuickEstimate'));

// ── STATS ────────────────────────────────────────────────────

function Stat({ value, suffix, label }: { value: number; suffix?: string; label: string }) {
  const { ref, val } = useCountUp(value);
  return (
    <div className="stat reveal">
      <div className="stat-value">
        <span ref={ref}>{val.toLocaleString('en-LK')}</span>
        {suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function Stats() {
  const { tenant } = useTenant();
  return (
    <section className="section-tight stats-band">
      <div className="container stats-grid">
        {tenant.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
    </section>
  );
}

// ── SERVICES ─────────────────────────────────────────────────

export function ServicesGrid({ limit }: { limit?: number }) {
  const { tenant, t, fmtMoney } = useTenant();
  const list = limit ? tenant.services.slice(0, limit) : tenant.services;
  return (
    <div className="grid" style={{ ['--min' as string]: '250px' }}>
      {list.map((s, i) => (
        <Link
          key={s.id}
          to={s.href || `/book?service=${s.id}`}
          className="card card-hover service-card reveal"
          style={{ transitionDelay: `${(i % 4) * 60}ms` }}
        >
          <span className="service-icon">
            <Icon name={s.icon} size={26} />
          </span>
          <h3 className="h3">{s.title}</h3>
          <p className="muted small">{s.description}</p>
          <div className="spread service-foot">
            {s.priceFrom ? (
              <span className="small">
                <span className="muted">{t('common.from')} </span>
                <strong>{fmtMoney(s.priceFrom)}</strong>
                {s.unit && <span className="muted"> {s.unit}</span>}
              </span>
            ) : (
              <span className="small muted">Custom quote</span>
            )}
            <Icon name="arrow" size={18} className="service-arrow" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export function Services() {
  const { t } = useTenant();
  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow={t('nav.services')}
          title={t('home.servicesTitle')}
          sub={t('home.servicesSub')}
          action={
            <Link to="/services" className="btn btn-ghost">
              {t('common.viewAll')} <Icon name="arrow" size={16} />
            </Link>
          }
        />
        <ServicesGrid limit={8} />
      </div>
    </section>
  );
}

// ── FLEET ────────────────────────────────────────────────────

export function VehicleCard({ v, viewer = true }: { v: Vehicle; viewer?: boolean }) {
  const { tenant, t, fmtMoney } = useTenant();
  const th = tenant.theme;
  return (
    <article className="card vehicle-card card-hover reveal">
      <div className="vehicle-stage">
        {viewer ? (
          <Suspense fallback={<div className="vehicle-ph" />}>
            <VehicleViewer type={v.type} primary={th.primary} accent={th.accent} mode={th.mode} height={190} />
          </Suspense>
        ) : (
          <div className="vehicle-ph">
            <Icon name="truck" size={48} />
          </div>
        )}
        <span className={`badge ${v.available ? 'badge-accent' : 'badge-muted'} vehicle-status`}>
          {v.available ? t('common.available') : t('common.unavailable')}
        </span>
      </div>
      <div className="stack" style={{ ['--gap' as string]: '10px' }}>
        <div className="spread">
          <span className="tiny muted vehicle-type">{typeLabel(v.type, tenant.locale.country)}</span>
          <span className="badge">{capacityLabel(v)}</span>
        </div>
        <h3 className="h3">{v.name}</h3>
        <ul className="vehicle-features">
          {v.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="vehicle-prices">
          <div>
            <span className="tiny muted">{t('common.callout')}</span>
            <strong>{fmtMoney(v.baseFare)}</strong>
          </div>
          <div>
            <span className="tiny muted">per km</span>
            <strong>{fmtMoney(v.perKm)}</strong>
          </div>
          {v.perDay ? (
            <div>
              <span className="tiny muted">per day</span>
              <strong>{fmtMoney(v.perDay)}</strong>
            </div>
          ) : null}
        </div>
        <Link
          to={`/book?vehicle=${v.id}`}
          className={`btn ${v.available ? 'btn-primary' : 'btn-ghost'} btn-block`}
          aria-disabled={!v.available}
          onClick={(e) => !v.available && e.preventDefault()}
        >
          {t('common.bookThis')}
        </Link>
      </div>
    </article>
  );
}

export function FleetPreview() {
  const { tenant, t } = useTenant();
  const picks = pickVariety(tenant.fleet, 4);
  return (
    <section className="section fleet-band">
      <div className="container">
        <SectionHead
          eyebrow={t('nav.fleet')}
          title={t('home.fleetTitle')}
          sub={t('home.fleetSub')}
          action={
            <Link to="/fleet" className="btn btn-ghost">
              {t('common.viewAll')} ({tenant.fleet.length}) <Icon name="arrow" size={16} />
            </Link>
          }
        />
        <div className="grid" style={{ ['--min' as string]: '260px' }}>
          {picks.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One of each type first, then fill. */
function pickVariety(fleet: Vehicle[], n: number): Vehicle[] {
  const seen = new Set<string>();
  const first: Vehicle[] = [];
  const rest: Vehicle[] = [];
  for (const v of fleet) {
    if (!seen.has(v.type)) {
      seen.add(v.type);
      first.push(v);
    } else rest.push(v);
  }
  return [...first, ...rest].slice(0, n);
}

// ── PROMOTIONS ───────────────────────────────────────────────

export function activePromos(promos: Promotion[], timeZone = 'Africa/Johannesburg'): Promotion[] {
  const today = todayIn(timeZone);
  return promos.filter((p) => p.active && (!p.validUntil || p.validUntil.slice(0, 10) >= today));
}

export function PromoCard({ p, featured }: { p: Promotion; featured?: boolean }) {
  const { t } = useTenant();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!p.code) return;
    try {
      await navigator.clipboard.writeText(p.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <article className={`promo-card reveal ${featured ? 'featured' : ''}`}>
      <div className="promo-shine" aria-hidden="true" />
      <div className="spread">
        {p.badge && <span className="badge">{p.badge}</span>}
        {p.discountPct ? <span className="promo-pct">−{p.discountPct}%</span> : null}
      </div>
      <h3 className="h3" style={{ marginTop: 14 }}>
        {p.title}
      </h3>
      <p className="muted small" style={{ marginTop: 8 }}>
        {p.description}
      </p>
      <div className="spread promo-foot">
        {p.code ? (
          <button type="button" className="promo-code" onClick={copy} aria-label={`Copy code ${p.code}`}>
            <span className="mono">{p.code}</span>
            <Icon name={copied ? 'check' : 'copy'} size={15} />
          </button>
        ) : (
          <span />
        )}
        <Link to={`/book${p.code ? `?promo=${encodeURIComponent(p.code)}` : ''}`} className="btn btn-primary btn-sm">
          {t('common.useCode')}
        </Link>
      </div>
      {p.validUntil && (
        <p className="tiny muted" style={{ marginTop: 10 }}>
          {t('common.validUntil')} {new Date(p.validUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </article>
  );
}

export function Promotions() {
  const { tenant, t, country } = useTenant();
  const list = activePromos(tenant.promotions, country.timeZone);
  if (!tenant.features.promotions || list.length === 0) return null;
  return (
    <section className="section promo-band">
      <div className="container">
        <SectionHead
          eyebrow={t('nav.promotions')}
          title={t('home.promoTitle')}
          action={
            <Link to="/offers" className="btn btn-ghost">
              {t('common.viewAll')} <Icon name="arrow" size={16} />
            </Link>
          }
        />
        <div className="grid" style={{ ['--min' as string]: '280px' }}>
          {list.slice(0, 3).map((p, i) => (
            <PromoCard key={p.id} p={p} featured={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PROCESS ──────────────────────────────────────────────────

export function Process() {
  const { t } = useTenant();
  const steps = [
    { icon: 'truck', title: t('home.step1'), d: t('home.step1d') },
    { icon: 'calendar', title: t('home.step2'), d: t('home.step2d') },
    { icon: 'gps', title: t('home.step3'), d: t('home.step3d') },
  ];
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="3 steps" title={t('home.processTitle')} />
        <ol className="process">
          {steps.map((s, i) => (
            <li key={s.title} className="card process-step reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="process-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="service-icon">
                <Icon name={s.icon} size={24} />
              </span>
              <h3 className="h3">{s.title}</h3>
              <p className="muted small">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── INSIGHTS ─────────────────────────────────────────────────

export function InsightCard({ a }: { a: Insight }) {
  const { t } = useTenant();
  return (
    <Link to={`/insights/${a.slug}`} className="card card-hover insight-card reveal">
      <div className={`insight-cover cat-${a.category.toLowerCase()}`} style={cssUrl(a.coverUrl) ? { backgroundImage: cssUrl(a.coverUrl) } : undefined}>
        {!cssUrl(a.coverUrl) && <InsightArt category={a.category} />}
        <span className="badge insight-cat">{a.category}</span>
      </div>
      <div className="stack" style={{ ['--gap' as string]: '10px', padding: '18px 4px 4px' }}>
        <span className="tiny muted">
          {new Date(a.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {a.readMins} {t('common.minRead')}
        </span>
        <h3 className="h3">{a.title}</h3>
        <p className="muted small">{a.excerpt}</p>
        <span className="small insight-more">
          {t('common.readMore')} <Icon name="arrow" size={15} />
        </span>
      </div>
    </Link>
  );
}

/** Generated cover art per category — no stock imagery needed. */
export function InsightArt({ category }: { category: Insight['category'] }) {
  const bars = category === 'Market' || category === 'Pricing';
  return (
    <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" className="insight-art" aria-hidden="true">
      <defs>
        <linearGradient id={`g-${category}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect width="400" height="220" fill={`url(#g-${category})`} />
      {bars ? (
        [40, 90, 70, 130, 110, 160].map((h, i) => (
          <rect key={i} x={40 + i * 55} y={200 - h} width="32" height={h} rx="6" fill="var(--text)" opacity={0.12 + i * 0.05} />
        ))
      ) : (
        <>
          <path d="M0 170 Q100 120 200 160 T400 140 V220 H0Z" fill="var(--text)" opacity="0.12" />
          <path d="M0 190 Q120 150 230 185 T400 175 V220 H0Z" fill="var(--text)" opacity="0.18" />
          <circle cx="320" cy="60" r="28" fill="var(--text)" opacity="0.15" />
        </>
      )}
    </svg>
  );
}

export function Insights() {
  const { tenant, t } = useTenant();
  if (!tenant.features.insights || tenant.insights.length === 0) return null;
  const list = [...tenant.insights].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  return (
    <section className="section">
      <div className="container">
        <SectionHead
          eyebrow={t('nav.insights')}
          title={t('home.insightsTitle')}
          action={
            <Link to="/insights" className="btn btn-ghost">
              {t('common.viewAll')} <Icon name="arrow" size={16} />
            </Link>
          }
        />
        <div className="grid" style={{ ['--min' as string]: '300px' }}>
          {list.map((a) => (
            <InsightCard key={a.id} a={a} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── AREAS ────────────────────────────────────────────────────

export function Areas() {
  const { tenant, t, country } = useTenant();
  const towns = getPlaces(country.code, { regions: tenant.serviceAreas });
  const cross = tenant.logistics?.enabled && tenant.logistics.crossBorder?.enabled ? tenant.logistics.crossBorder.countries : [];
  const abroad = cross.length ? getPlaces(country.code, { regions: ['__none__'], crossBorder: cross }) : [];
  const plural = country.regionLabel === 'Province' ? 'provinces' : 'districts';
  return (
    <section className="section areas-band">
      <div className="container grid-2" style={{ alignItems: 'center' }}>
        <div className="reveal">
          <div className="eyebrow">
            {tenant.serviceAreas.length} {plural} · {towns.length} towns{abroad.length ? ` · ${cross.length} countries` : ''}
          </div>
          <h2 className="h2">{t('home.areasTitle')}</h2>
          <p className="lead" style={{ marginTop: 12 }}>
            Book town-to-town anywhere we operate in {country.name}
            {abroad.length ? `, plus cross-border to ${cross.map((c) => CROSS_BORDER_NAMES[c]).join(', ')}` : ''}.
          </p>
          <div className="area-chips">
            {tenant.serviceAreas.map((a) => (
              <span key={a} className="area-chip">
                <Icon name="pin" size={13} /> {a}
              </span>
            ))}
            {cross.map((c) => (
              <span key={c} className="area-chip area-chip-x">
                <Icon name="globe" size={13} /> {CROSS_BORDER_NAMES[c]}
              </span>
            ))}
          </div>
        </div>
        <CoverageMap towns={towns} abroad={abroad} />
      </div>
    </section>
  );
}

/** Dot map projected from real town coordinates — the dots draw the country's shape. */
function CoverageMap({ towns, abroad: abroadAll }: { towns: Place[]; abroad: Place[] }) {
  if (towns.length < 3) return null;
  // frame the home country; show only neighbour towns close to it (keeps the map legible)
  const hl = towns.map((p) => p.lat);
  const hg = towns.map((p) => p.lng);
  const M = 2.5;
  const box = { minLat: Math.min(...hl) - M, maxLat: Math.max(...hl) + M, minLng: Math.min(...hg) - M, maxLng: Math.max(...hg) + M };
  const abroad = abroadAll.filter((p) => p.lat >= box.minLat && p.lat <= box.maxLat && p.lng >= box.minLng && p.lng <= box.maxLng);
  const all = [...towns, ...abroad];
  const minLat = Math.min(...all.map((p) => p.lat));
  const maxLat = Math.max(...all.map((p) => p.lat));
  const minLng = Math.min(...all.map((p) => p.lng));
  const maxLng = Math.max(...all.map((p) => p.lng));
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const w = (maxLng - minLng) * Math.cos(midLat) || 1;
  const h = maxLat - minLat || 1;
  const W = 460;
  const H = Math.min(560, Math.max(260, (W * h) / w));
  const pad = 22;
  const x = (lng: number) => pad + ((lng - minLng) * Math.cos(midLat) * (W - 2 * pad)) / w;
  const y = (lat: number) => pad + ((maxLat - lat) * (H - 2 * pad)) / h;
  const hubs = towns.filter((p) => p.kind === 'metro').slice(0, 8);
  // drop labels that would collide with an earlier one
  const labels: Place[] = [];
  for (const p of hubs) if (!labels.some((q) => Math.abs(x(q.lng) - x(p.lng)) < 70 && Math.abs(y(q.lat) - y(p.lat)) < 14)) labels.push(p);
  return (
    <figure className="coverage reveal" aria-label={`Coverage map: ${towns.length} towns`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <title>{`${towns.length} bookable towns${abroad.length ? ` and ${abroad.length} nearby cross-border destinations` : ''}`}</title>
        {hubs.map((hb, i) =>
          hubs.slice(i + 1).map((hb2) => (
            <line key={hb.id + hb2.id} x1={x(hb.lng)} y1={y(hb.lat)} x2={x(hb2.lng)} y2={y(hb2.lat)} className="cov-lane" />
          )),
        )}
        {abroad.map((p) => (
          <circle key={p.id} cx={x(p.lng)} cy={y(p.lat)} r={3} className="cov-dot cov-x">
            <title>{`${p.name}, ${p.region} (cross-border)`}</title>
          </circle>
        ))}
        {towns.map((p) => (
          <circle key={p.id} cx={x(p.lng)} cy={y(p.lat)} r={p.kind === 'metro' ? 5.5 : p.kind === 'city' || p.kind === 'port' ? 3.8 : 2.6} className={`cov-dot k-${p.kind}`}>
            <title>{`${p.name}, ${p.region}`}</title>
          </circle>
        ))}
        {labels.map((p) => (
          <text key={p.id} x={x(p.lng) + (x(p.lng) > W - 110 ? -8 : 8)} y={y(p.lat) + 4} textAnchor={x(p.lng) > W - 110 ? 'end' : 'start'} className="cov-label">
            {p.name}
          </text>
        ))}
      </svg>
      <figcaption className="tiny muted">
        <span className="cov-key" /> towns we serve {abroad.length > 0 && (<><span className="cov-key cov-key-x" /> cross-border</>)}
      </figcaption>
    </figure>
  );
}

// ── LOGISTICS ────────────────────────────────────────────────

const FREIGHT_ICON: Record<string, string> = { ftl: 'freight', ltl: 'pallet', courier: 'parcel', removals: 'moving' };

export function LogisticsSection() {
  const { tenant, t, fmtMoney } = useTenant();
  const l = tenant.logistics;
  if (!l?.enabled) return null;
  const services = l.services.filter((s) => s.enabled);
  const levels = (['economy', 'express', 'sameday'] as const).filter((k) => l.levels[k]?.enabled);
  return (
    <section className="section logistics-band">
      <div className="container">
        <SectionHead
          eyebrow={t('nav.logistics')}
          title={t('home.logisticsTitle')}
          sub={t('home.logisticsSub')}
          action={
            <Link to="/logistics" className="btn btn-ghost">
              {t('common.learnMore')} <Icon name="arrow" size={16} />
            </Link>
          }
        />
        <div className="grid" style={{ ['--min' as string]: '240px' }}>
          {services.map((s, i) => (
            <Link key={s.id} to={`/book?mode=freight&service=${s.id}`} className="card card-hover service-card reveal" style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="service-icon">
                <Icon name={FREIGHT_ICON[s.id] ?? 'freight'} size={26} />
              </span>
              <h3 className="h3">{s.title}</h3>
              <p className="muted small">{s.description}</p>
              <div className="spread service-foot">
                <span className="small">
                  {s.id === 'ltl' && (
                    <>
                      <span className="muted">{t('common.from')} </span>
                      <strong>{fmtMoney(l.ltl.minCharge)}</strong>
                    </>
                  )}
                  {s.id === 'courier' && (
                    <>
                      <span className="muted">{t('common.from')} </span>
                      <strong>{fmtMoney(l.courier.minCharge)}</strong>
                    </>
                  )}
                  {(s.id === 'ftl' || s.id === 'removals') && <span className="muted">Dedicated vehicle</span>}
                </span>
                <Icon name="arrow" size={18} className="service-arrow" />
              </div>
            </Link>
          ))}
        </div>
        <div className="levels reveal">
          {levels.map((k) => (
            <div key={k} className="level">
              <Icon name={k === 'sameday' ? 'bolt' : k === 'express' ? 'clock' : 'truck'} size={20} />
              <div>
                <strong>{l.levels[k].label}</strong>
                <span className="tiny muted" style={{ display: 'block' }}>
                  {l.levels[k].eta}
                  {l.levels[k].maxKm ? ` · up to ${l.levels[k].maxKm} km` : ''}
                </span>
              </div>
            </div>
          ))}
          {l.crossBorder.enabled && l.crossBorder.countries.length > 0 && (
            <div className="level">
              <Icon name="globe" size={20} />
              <div>
                <strong>Cross-border</strong>
                <span className="tiny muted" style={{ display: 'block' }}>
                  {l.crossBorder.countries.map((c) => CROSS_BORDER_NAMES[c]).join(' · ')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── TRUST ────────────────────────────────────────────────────

export function Trust() {
  const { tenant, t } = useTenant();
  if (!tenant.credentials?.length) return null;
  return (
    <section className="section-tight">
      <div className="container">
        <div className="trust-band reveal">
          <h2 className="h3 trust-title">{t('home.trustTitle')}</h2>
          <ul className="trust-list">
            {tenant.credentials.map((c) => (
              <li key={c.title}>
                <span className="trust-icon">
                  <Icon name={c.icon} size={20} />
                </span>
                <span>
                  <strong>{c.title}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {c.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── TESTIMONIALS ─────────────────────────────────────────────

export function Testimonials() {
  const { tenant, t } = useTenant();
  if (tenant.testimonials.length === 0) return null;
  return (
    <section className="section">
      <div className="container">
        <SectionHead eyebrow="Reviews" title={t('home.testimonialsTitle')} />
        <div className="grid" style={{ ['--min' as string]: '290px' }}>
          {tenant.testimonials.map((r, i) => (
            <figure key={r.name + i} className="card testimonial reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="stars" aria-label={`${r.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, k) => (
                  <Icon key={k} name="star" size={16} className={k < r.rating ? 'on' : ''} />
                ))}
              </div>
              <blockquote>“{r.quote}”</blockquote>
              <figcaption>
                <span className="avatar">{r.name.charAt(0)}</span>
                <span>
                  <strong>{r.name}</strong>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    {r.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FAQ ──────────────────────────────────────────────────────

export function Faq() {
  const { tenant, t } = useTenant();
  if (tenant.faqs.length === 0) return null;
  return (
    <section className="section">
      <div className="container faq-wrap">
        <SectionHead eyebrow="FAQ" title={t('home.faqTitle')} />
        <div className="faq reveal">
          {tenant.faqs.map((f, i) => (
            <details key={f.q} open={i === 0}>
              <summary>
                {f.q}
                <Icon name="plus" size={18} />
              </summary>
              <p className="muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA ──────────────────────────────────────────────────────

export function Cta() {
  const { tenant, t } = useTenant();
  return (
    <section className="section-tight">
      <div className="container">
        <div className="cta-band reveal">
          <div>
            <h2 className="h2">{t('home.ctaTitle')}</h2>
            <p className="lead" style={{ marginTop: 10 }}>
              {t('home.ctaSub')}
            </p>
          </div>
          <div className="row">
            <Link to="/book" className="btn btn-primary btn-lg">
              {t('nav.book')} <Icon name="arrow" size={18} />
            </Link>
            {tenant.contact.whatsapp && (
              <a className="btn btn-ghost btn-lg" href={waLink(tenant.contact.whatsapp, `Hi ${tenant.name}, I need a vehicle today.`)} target="_blank" rel="noreferrer">
                <Icon name="whatsapp" size={18} /> WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export const SECTION_COMPONENTS: Record<SectionKey, () => JSX.Element | null> = {
  hero: Hero,
  stats: Stats,
  services: Services,
  fleet: FleetPreview,
  promotions: Promotions,
  process: Process,
  insights: Insights,
  areas: Areas,
  testimonials: Testimonials,
  faq: Faq,
  trust: Trust,
  logistics: LogisticsSection,
  cta: Cta,
};
