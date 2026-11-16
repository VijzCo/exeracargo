import { useMemo, useState } from 'react';
import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { VehicleCard, typeLabel, Cta } from '../components/sections';
import { useReveal } from '../lib/hooks';
import type { VehicleType } from '../tenant/types';

export default function FleetPage() {
  const { tenant, t } = useTenant();
  const types = useMemo(() => Array.from(new Set(tenant.fleet.map((v) => v.type))), [tenant.fleet]);
  const [filter, setFilter] = useState<VehicleType | 'all'>('all');
  const list = filter === 'all' ? tenant.fleet : tenant.fleet.filter((v) => v.type === filter);
  const ref = useReveal<HTMLDivElement>([filter, list.length]);
  return (
    <div ref={ref}>
      <PageHeader eyebrow={tenant.name} title={t('fleet.title')} sub={t('fleet.sub')}>
        <div className="tabs" role="tablist" style={{ marginTop: 28 }}>
          <button role="tab" className="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>
            {t('fleet.all')} ({tenant.fleet.length})
          </button>
          {types.map((ty) => (
            <button key={ty} role="tab" className="tab" aria-selected={filter === ty} onClick={() => setFilter(ty)}>
              {typeLabel(ty, tenant.locale.country)}
            </button>
          ))}
        </div>
      </PageHeader>
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="container grid" style={{ ['--min' as string]: '270px' }}>
          {list.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      </section>
      <Cta />
    </div>
  );
}
