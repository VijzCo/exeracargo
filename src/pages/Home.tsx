import { useTenant } from '../tenant/TenantProvider';
import { SECTION_COMPONENTS } from '../components/sections';
import { useReveal } from '../lib/hooks';

export default function Home() {
  const { tenant } = useTenant();
  const order = tenant.sections.order.filter((s) => !tenant.sections.hidden.includes(s) && SECTION_COMPONENTS[s]);
  const ref = useReveal<HTMLDivElement>([order.join(','), tenant.id]);
  return (
    <div ref={ref} className="home">
      {order.map((key) => {
        const C = SECTION_COMPONENTS[key];
        return <C key={key} />;
      })}
    </div>
  );
}
