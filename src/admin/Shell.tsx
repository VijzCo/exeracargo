import { useEffect, useState, type ReactNode } from 'react';
import { safeHttpsUrl } from '../lib/url';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { dataMode } from '../lib/data';
import { isSuper, signOutSafe, useAdmin } from './AuthGate';
import { useDraft } from './content/draft';
import { useUi } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  superOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: 'chart', end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: 'calendar' },
  { to: '/admin/messages', label: 'Messages', icon: 'mail' },
  { to: '/admin/content', label: 'Site content', icon: 'palette' },
  { to: '/admin/sites', label: 'Sites', icon: 'globe', superOnly: true },
];

export default function Shell({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  const profile = useAdmin();
  const { dirty } = useDraft();
  const { confirm } = useUi();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);

  const items = NAV.filter((n) => !n.superOnly || isSuper(profile));
  const current = [...items].reverse().find((n) => (n.end ? loc.pathname === n.to || loc.pathname === `${n.to}/` : loc.pathname.startsWith(n.to)));

  const onSignOut = async () => {
    if (
      dirty &&
      !(await confirm({
        title: 'Sign out with unsaved changes?',
        body: 'Your draft edits to the site content will be lost.',
        confirmLabel: 'Sign out',
        danger: true,
      }))
    )
      return;
    signOutSafe();
  };

  return (
    <div className={`adm-shell${open ? ' nav-open' : ''}`}>
      <a href="#adm-main" className="adm-skip">
        Skip to content
      </a>
      <aside className="adm-side" aria-label="Admin navigation">
        <div className="adm-side-brand">
          {tenant.logoUrl ? (
            <img src={safeHttpsUrl(tenant.logoUrl)} alt="" className="adm-logo-img" />
          ) : (
            <span className="adm-logo-mark" aria-hidden>
              {(tenant.logoText || tenant.name).charAt(0)}
            </span>
          )}
          <div className="adm-side-name">
            <strong>{tenant.name}</strong>
            <span className="muted tiny mono">{tenant.id}</span>
          </div>
          <button type="button" className="icon-btn adm-side-close" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <nav className="adm-nav">
          {items.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `adm-nav-link${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.to === '/admin/content' && dirty ? <span className="adm-dot" title="Unsaved changes" aria-label="Unsaved changes" /> : null}
            </NavLink>
          ))}
          <a className="adm-nav-link" href={`/?site=${encodeURIComponent(tenant.id)}`} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={18} />
            <span>View site</span>
          </a>
        </nav>
        <div className="adm-side-foot muted tiny">HaulPro admin</div>
      </aside>
      <div className="adm-backdrop" onClick={() => setOpen(false)} aria-hidden />
      <div className="adm-main-wrap">
        <header className="adm-top">
          <button
            type="button"
            className="icon-btn adm-burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" size={20} />
          </button>
          <div className="adm-top-title">{current?.label ?? 'Admin'}</div>
          <div className="adm-top-right">
            {dirty ? (
              <NavLink to="/admin/content" className="badge adm-hide-xs" title="You have unsaved site changes">
                Unsaved
              </NavLink>
            ) : null}
            <span
              className={`badge ${dataMode === 'firebase' ? 'badge-accent' : 'badge-muted'}`}
              title={dataMode === 'firebase' ? 'Connected to Firebase' : 'Demo mode — data stored in this browser'}
            >
              <Icon name={dataMode === 'firebase' ? 'shield' : 'bolt'} size={12} />
              {dataMode === 'firebase' ? 'Firebase' : 'Demo'}
            </span>
            <span className="adm-user muted small" title={profile.email}>
              <Icon name="user" size={16} />
              <span className="adm-user-email">{profile.email}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onSignOut()} aria-label="Sign out">
              <Icon name="logout" size={16} />
              <span className="adm-hide-xs">Sign out</span>
            </button>
          </div>
        </header>
        <main id="adm-main" className="adm-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
