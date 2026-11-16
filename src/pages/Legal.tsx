// Public legal pages: /legal/terms, /legal/privacy, /legal/booking-terms
import { Link, useParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { DRAFT_NOTE, LEGAL_DOCS, legalDoc } from '../legal/docs';
import { LegalText } from '../legal/LegalText';
import NotFound from './NotFound';
import '../legal/legal.css';

const PUBLIC = Object.values(LEGAL_DOCS).filter((d) => d.slug);

export default function LegalPage() {
  const { slug } = useParams();
  const { tenant } = useTenant();
  const base = PUBLIC.find((d) => d.slug === slug);
  if (!base) return <NotFound />;
  const d = legalDoc(base.id, tenant);
  return (
    <section className="section" style={{ paddingTop: 'calc(var(--header-h) + 48px)' }}>
      <div className="container legal-page">
        <nav className="legal-nav" aria-label="Legal documents">
          {PUBLIC.map((x) => (
            <Link key={x.id} to={`/legal/${x.slug}`} aria-current={x.id === d.id ? 'page' : undefined} className={x.id === d.id ? '' : 'muted'}>
              {x.short}
            </Link>
          ))}
        </nav>
        <h1 className="h2">{d.title}</h1>
        <p className="small muted">
          {tenant.legal?.legalName || tenant.name} · Version {d.version}
        </p>
        <span className="legal-draft">{DRAFT_NOTE}</span>
        <LegalText body={d.body} />
      </div>
    </section>
  );
}
