import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import { Icon } from './Icon';
import { LANG_LABELS, type StringKey } from '../i18n/strings';
import { telLink, waLink } from '../lib/wa';
import { useScrolled } from '../lib/hooks';
import { dataMode } from '../lib/data';
import { safeHttpsUrl } from '../lib/url';

export function Logo() {
  const { tenant } = useTenant();
  const logo = safeHttpsUrl(tenant.logoUrl);
  if (logo) return <img src={logo} alt={tenant.name} className="logo-img" />;
  const text = tenant.logoText || tenant.name;
  return (
    <span className="logo">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="30" height="30">
          <rect width="32" height="32" rx="9" fill="var(--primary)" />
          <path d="M6 20h12v-8H9l-3 4zM18 14h4l4 3v3h-8z" fill="var(--on-primary)" />
          <circle cx="11" cy="22" r="2.4" fill="var(--on-primary)" />
          <circle cx="22" cy="22" r="2.4" fill="var(--on-primary)" />
        </svg>
      </span>
      <span className="logo-text">{text}</span>
    </span>
  );
}

export default function Layout() {
  const { tenant, t, lang, setLang } = useTenant();
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [loc.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const links: { to: string; key: StringKey; show: boolean }[] = [
    { to: '/fleet', key: 'nav.fleet', show: true },
    { to: '/services', key: 'nav.services', show: true },
    { to: '/logistics', key: 'nav.logistics', show: !!tenant.logistics?.enabled },
    { to: '/offers', key: 'nav.promotions', show: tenant.features.promotions },
    { to: '/insights', key: 'nav.insights', show: tenant.features.insights },
    { to: '/track', key: 'nav.track', show: tenant.features.tracking },
    { to: '/contact', key: 'nav.contact', show: true },
  ];
  const isHome = loc.pathname === '/';

  return (
    <div className="site">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className={`site-header ${scrolled || !isHome || open ? 'solid' : ''}`}>
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label={`${tenant.name} home`}>
            <Logo />
          </Link>
          <nav className="nav-desktop" aria-label="Main">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  {t(l.key)}
                </NavLink>
              ))}
          </nav>
          <div className="header-actions">
            {tenant.features.languageSwitcher && tenant.locale.languages.length > 1 && (
              <div className="lang-switch" role="group" aria-label="Language">
                {tenant.locale.languages.map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}>
                    {LANG_LABELS[l]}
                  </button>
                ))}
              </div>
            )}
            {tenant.contact.phone && (
              <a className="btn btn-ghost btn-sm hide-sm" href={telLink(tenant.contact.phone)}>
                <Icon name="phone" size={16} /> {tenant.contact.phone}
              </a>
            )}
            <Link to="/book" className="btn btn-primary btn-sm">
              {t('nav.book')}
            </Link>
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
        <div className={`mobile-nav ${open ? 'open' : ''}`} hidden={!open}>
          <nav className="container stack" aria-label="Mobile">
            <NavLink to="/" end className="m-link">
              {t('nav.home')}
            </NavLink>
            {links
              .filter((l) => l.show)
              .map((l) => (
                <NavLink key={l.to} to={l.to} className="m-link">
                  {t(l.key)}
                </NavLink>
              ))}
            <div className="row" style={{ marginTop: 12 }}>
              {tenant.contact.phone && (
                <a className="btn btn-ghost" href={telLink(tenant.contact.phone)}>
                  <Icon name="phone" size={18} /> {t('common.call')}
                </a>
              )}
              {tenant.contact.whatsapp && (
                <a className="btn btn-ghost" href={waLink(tenant.contact.whatsapp, `Hi ${tenant.name}, I need a vehicle.`)} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" size={18} /> WhatsApp
                </a>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main id="main">
        <Outlet />
      </main>

      <Footer />

      {tenant.contact.whatsapp && (
      <a
        className="wa-fab"
        href={waLink(tenant.contact.whatsapp, `Hi ${tenant.name}, I'd like a quote for a vehicle.`)}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <path
            fill="currentColor"
            d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.2 1.4 3.5c.2.2 2.4 3.6 5.8 5 2.1.9 3 1 4 .8.7-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"
          />
        </svg>
      </a>
      )}
    </div>
  );
}

function Footer() {
  const { tenant, t } = useTenant();
  const year = new Date().getFullYear();
  const socials = Object.entries(tenant.social ?? {})
    .map(([k, v]) => [k, safeHttpsUrl(v as string | undefined)] as const)
    .filter((e): e is readonly [string, string] => !!e[1]);
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="stack" style={{ ['--gap' as string]: '14px' }}>
          <Logo />
          <p className="muted small" style={{ maxWidth: 320 }}>
            {tenant.tagline}
          </p>
          {socials.length > 0 && (
            <div className="row" style={{ ['--gap' as string]: '8px' }}>
              {socials.map(([k, v]) => (
                <a key={k} href={v} target="_blank" rel="noreferrer" className="icon-btn" aria-label={k}>
                  <Icon name={k} size={18} />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4 className="footer-h">{t('nav.services')}</h4>
          <ul className="footer-list">
            {tenant.services.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link to={`/book?service=${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="footer-h">{tenant.name}</h4>
          <ul className="footer-list">
            <li>
              <Link to="/fleet">{t('nav.fleet')}</Link>
            </li>
            {tenant.features.promotions && (
              <li>
                <Link to="/offers">{t('nav.promotions')}</Link>
              </li>
            )}
            {tenant.features.insights && (
              <li>
                <Link to="/insights">{t('nav.insights')}</Link>
              </li>
            )}
            {tenant.features.tracking && (
              <li>
                <Link to="/track">{t('nav.track')}</Link>
              </li>
            )}
            <li>
              <Link to="/contact">{t('nav.contact')}</Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="footer-h">{t('nav.contact')}</h4>
          <ul className="footer-list contact-list">
            {tenant.contact.phone && (
              <li>
                <Icon name="phone" size={16} />
                <a href={telLink(tenant.contact.phone)}>{tenant.contact.phone}</a>
              </li>
            )}
            {tenant.contact.email && (
              <li>
                <Icon name="mail" size={16} />
                <a href={`mailto:${tenant.contact.email}`}>{tenant.contact.email}</a>
              </li>
            )}
            {tenant.contact.address && (
              <li>
                <Icon name="pin" size={16} />
                <span>{tenant.contact.address}</span>
              </li>
            )}
            {tenant.contact.hours && (
              <li>
                <Icon name="clock" size={16} />
                <span>{tenant.contact.hours}</span>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span className="tiny muted">
          © {year} {tenant.name}. {t('footer.rights')}
        </span>
        <span className="tiny muted row" style={{ ['--gap' as string]: '14px' }}>
          {dataMode === 'demo' && <span className="badge badge-muted">Demo mode</span>}
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/booking-terms">Booking terms</Link>
          <Link to="/admin">{t('footer.admin')}</Link>
        </span>
      </div>
    </footer>
  );
}
