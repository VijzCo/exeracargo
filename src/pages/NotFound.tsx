import { Link } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';

export default function NotFound() {
  const { t } = useTenant();
  return (
    <section className="section" style={{ paddingTop: 'calc(var(--header-h) + 80px)', minHeight: '70vh' }}>
      <div className="container stack" style={{ alignItems: 'flex-start' }}>
        <span className="eyebrow">404</span>
        <h1 className="h1">Wrong turn.</h1>
        <p className="lead">That page isn’t on our route map.</p>
        <div className="row" style={{ marginTop: 16 }}>
          <Link to="/" className="btn btn-primary">
            {t('nav.home')}
          </Link>
          <Link to="/book" className="btn btn-ghost">
            {t('nav.book')}
          </Link>
        </div>
      </div>
    </section>
  );
}
