import type { ComponentType } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { fmtDateTime, useUi } from '../ui';
import { useDraft, type TabProps } from './draft';
import BrandTab from './BrandTab';
import HeroTab from './HeroTab';
import LayoutTab from './LayoutTab';
import FleetTab from './FleetTab';
import { FaqsTab, InsightsTab, PromotionsTab, ServicesTab, TestimonialsTab } from './CollectionTabs';
import { AreasTab, ContactTab } from './ContactTab';
import BookingTab from './BookingTab';
import SeoTab from './SeoTab';
import AdvancedTab from './AdvancedTab';
import MarketTab from './MarketTab';
import LogisticsTab from './LogisticsTab';
import TrustTab from './TrustTab';
import LegalTab from './LegalTab';

interface TabDef {
  key: string;
  label: string;
  icon: string;
  C: ComponentType<TabProps>;
}

export const CONTENT_TABS: TabDef[] = [
  { key: 'market', label: 'Market', icon: 'globe', C: MarketTab },
  { key: 'brand', label: 'Brand & theme', icon: 'palette', C: BrandTab },
  { key: 'hero', label: 'Hero & stats', icon: 'star', C: HeroTab },
  { key: 'layout', label: 'Homepage layout', icon: 'layers', C: LayoutTab },
  { key: 'fleet', label: 'Fleet', icon: 'truck', C: FleetTab },
  { key: 'logistics', label: 'Logistics', icon: 'pallet', C: LogisticsTab },
  { key: 'services', label: 'Services', icon: 'machinery', C: ServicesTab },
  { key: 'promotions', label: 'Promotions', icon: 'tag', C: PromotionsTab },
  { key: 'insights', label: 'Insights', icon: 'chart', C: InsightsTab },
  { key: 'testimonials', label: 'Testimonials', icon: 'user', C: TestimonialsTab },
  { key: 'faqs', label: 'FAQs', icon: 'search', C: FaqsTab },
  { key: 'trust', label: 'Trust badges', icon: 'shield', C: TrustTab },
  { key: 'legal', label: 'Legal & story', icon: 'contract', C: LegalTab },
  { key: 'contact', label: 'Contact & social', icon: 'phone', C: ContactTab },
  { key: 'areas', label: 'Service areas', icon: 'pin', C: AreasTab },
  { key: 'booking', label: 'Booking settings', icon: 'calendar', C: BookingTab },
  { key: 'seo', label: 'SEO', icon: 'search', C: SeoTab },
  { key: 'advanced', label: 'Advanced', icon: 'settings', C: AdvancedTab },
];

export default function ContentEditor() {
  const { tab = 'brand' } = useParams();
  const { draft, update, dirty, saving, save, discard, saved } = useDraft();
  const { confirm } = useUi();
  const def = CONTENT_TABS.find((t) => t.key === tab);
  if (!def) return <Navigate to="/admin/content" replace />;
  const Tab = def.C;

  const onDiscard = async () => {
    const ok = await confirm({
      title: 'Discard unsaved changes?',
      body: 'All edits since the last publish will be reverted.',
      confirmLabel: 'Discard',
      danger: true,
    });
    if (ok) discard();
  };

  return (
    <div className="adm-page adm-editor">
      <div className="adm-editor-bar">
        <div className="adm-editor-bar-title">
          <h1 className="adm-h1">Site content</h1>
          <span className="muted tiny">
            {dirty ? (
              <span className="adm-unsaved">
                <span className="adm-dot" aria-hidden /> Unsaved changes · previewing live
              </span>
            ) : (
              <>Published {saved.updatedAt ? fmtDateTime(saved.updatedAt) : '(bundled preset)'}</>
            )}
          </span>
        </div>
        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" disabled={!dirty || saving} onClick={() => void onDiscard()}>
            Discard
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={() => void save()}>
            <Icon name="upload" size={16} /> {saving ? 'Publishing…' : 'Save & publish'}
          </button>
        </div>
      </div>

      <div className="adm-editor-body">
        <nav className="adm-subnav" aria-label="Content sections">
          {CONTENT_TABS.map((t) => (
            <NavLink
              key={t.key}
              to={`/admin/content/${t.key}`}
              className={() => `adm-subnav-link${t.key === def.key ? ' active' : ''}`}
              aria-current={t.key === def.key ? 'page' : undefined}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="adm-editor-panel stack">
          <Tab draft={draft} update={update} />
        </div>
      </div>
    </div>
  );
}
