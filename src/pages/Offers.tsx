import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { activePromos, PromoCard, Cta } from '../components/sections';
import { useReveal } from '../lib/hooks';
import { Icon } from '../components/Icon';

export default function OffersPage() {
  const { tenant, t, country } = useTenant();
  const list = activePromos(tenant.promotions, country.timeZone);
  const ref = useReveal<HTMLDivElement>([list.length]);
  return (
    <div ref={ref}>
      <PageHeader eyebrow={tenant.name} title={t('promos.title')} sub={t('promos.sub')} />
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="container">
          {list.length ? (
            <div className="grid" style={{ ['--min' as string]: '300px' }}>
              {list.map((p, i) => (
                <PromoCard key={p.id} p={p} featured={i === 0} />
              ))}
            </div>
          ) : (
            <div className="card empty">
              <Icon name="tag" size={32} />
              <p className="muted">No offers running right now — check back soon.</p>
            </div>
          )}
          <div className="highlights">
            {tenant.hero.badges.map((b) => (
              <div key={b} className="highlight reveal">
                <Icon name="shield" size={22} />
                <span>{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Cta />
    </div>
  );
}
