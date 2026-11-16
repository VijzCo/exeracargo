import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { ServicesGrid, Process, Areas, Cta } from '../components/sections';
import { useReveal } from '../lib/hooks';

export default function ServicesPage() {
  const { tenant, t } = useTenant();
  const ref = useReveal<HTMLDivElement>([tenant.id]);
  return (
    <div ref={ref}>
      <PageHeader eyebrow={tenant.name} title={t('services.title')} sub={t('home.servicesSub')} />
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="container">
          <ServicesGrid />
        </div>
      </section>
      <Process />
      <Areas />
      <Cta />
    </div>
  );
}
