import { useMemo, useState } from 'react';
import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { InsightCard } from '../components/sections';
import { useReveal } from '../lib/hooks';
import type { Insight } from '../tenant/types';

export default function InsightsPage() {
  const { tenant, t } = useTenant();
  const sorted = useMemo(() => [...tenant.insights].sort((a, b) => b.date.localeCompare(a.date)), [tenant.insights]);
  const cats = useMemo(() => Array.from(new Set(sorted.map((a) => a.category))), [sorted]);
  const [cat, setCat] = useState<Insight['category'] | 'all'>('all');
  const list = cat === 'all' ? sorted : sorted.filter((a) => a.category === cat);
  const ref = useReveal<HTMLDivElement>([cat]);
  return (
    <div ref={ref}>
      <PageHeader eyebrow={tenant.name} title={t('insights.title')} sub={t('insights.sub')}>
        <div className="tabs" role="tablist" style={{ marginTop: 28 }}>
          <button role="tab" className="tab" aria-selected={cat === 'all'} onClick={() => setCat('all')}>
            {t('fleet.all')}
          </button>
          {cats.map((c) => (
            <button key={c} role="tab" className="tab" aria-selected={cat === c} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
      </PageHeader>
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="container grid" style={{ ['--min' as string]: '300px' }}>
          {list.map((a) => (
            <InsightCard key={a.id} a={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
