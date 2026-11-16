import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { newTenantTemplate, PRESETS } from '../tenant/presets';
import { COUNTRIES, type CountryCode } from '../geo';
import { COUNTRY_OPTIONS } from './market';
import { loadTenant } from '../tenant/resolve';
import type { Hero3D, TenantConfig } from '../tenant/types';
import { dataMode, listStoredTenants, saveTenant } from '../lib/data';
import { useDraft } from './content/draft';
import { ColorField, copyText, EmptyState, errMsg, Field, Modal, PageHeader, SelectField, TagInput, TextField, slugify, useLoader, useUi } from './ui';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
const RESERVED = new Set(['reset', 'admin', 'www', 'api', 'localhost']);
const HOST_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const PROJECT = (import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined) || '<your-project>';

interface SiteRow {
  id: string;
  name: string;
  domains: string[];
  bundled: boolean;
  stored: boolean;
}

const normHost = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
const validateHost = (s: string) => (HOST_RE.test(s) ? null : `“${s}” isn’t a valid hostname (e.g. www.acmehaul.lk)`);

export default function Sites() {
  const { tenant, reload } = useTenant();
  const { dirty, discard, syncSaved } = useDraft();
  const { toast, confirm } = useUi();
  const navigate = useNavigate();
  const { data, loading, error, reload: refresh } = useLoader(() => listStoredTenants(), []);
  const [wizard, setWizard] = useState(false);
  const [editing, setEditing] = useState<SiteRow | null>(null);

  const rows = useMemo<SiteRow[]>(() => {
    const m = new Map<string, SiteRow>();
    for (const p of Object.values(PRESETS)) m.set(p.id, { id: p.id, name: p.name, domains: p.domains, bundled: true, stored: false });
    for (const s of data ?? []) {
      const cur = m.get(s.id);
      m.set(s.id, {
        id: s.id,
        name: s.name || cur?.name || s.id,
        domains: s.domains?.length ? s.domains : cur?.domains ?? [],
        bundled: !!cur,
        stored: true,
      });
    }
    return [...m.values()].sort((a, b) => (a.id === tenant.id ? -1 : b.id === tenant.id ? 1 : a.name.localeCompare(b.name)));
  }, [data, tenant.id]);

  const manage = async (id: string) => {
    if (id === tenant.id) {
      navigate('/admin');
      return;
    }
    if (dirty) {
      const ok = await confirm({
        title: 'Switch site and discard changes?',
        body: `You have unsaved edits to “${tenant.name}”. They’ll be lost if you switch.`,
        confirmLabel: 'Discard & switch',
        danger: true,
      });
      if (!ok) return;
      discard();
    }
    navigate(`/admin?site=${encodeURIComponent(id)}`);
    // the sticky resolver reads window.location; let navigation commit first
    setTimeout(() => void reload(), 0);
  };

  const saveDomains = async (row: SiteRow, domains: string[]) => {
    try {
      const cfg = await loadTenant(row.id);
      if (cfg.id !== row.id) throw new Error(`Couldn’t load site “${row.id}”`);
      await saveTenant({ ...cfg, domains }, { previous: cfg.domains ?? [] });
      if (row.id === tenant.id) syncSaved({ domains });
      toast(`Domains saved for ${row.name}`);
      setEditing(null);
      void refresh();
    } catch (e) {
      toast(`Save failed: ${errMsg(e)}`, 'err');
    }
  };

  return (
    <div className="stack adm-page">
      <PageHeader
        title="Sites"
        subtitle="Every white-label site on this platform. Create, open and manage customer sites."
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void refresh()} disabled={loading}>
              <Icon name="clock" size={16} /> Refresh
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setWizard(true)}>
              <Icon name="plus" size={16} /> New site
            </button>
          </>
        }
      />
      {error ? (
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Couldn’t list stored sites: {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid" style={{ '--min': '280px' } as CSSProperties}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 170 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon="globe" title="No sites" />
      ) : (
        <div className="grid" style={{ '--min': '280px' } as CSSProperties}>
          {rows.map((r) => (
            <article key={r.id} className={`card adm-site${r.id === tenant.id ? ' current' : ''}`}>
              <div className="spread">
                <div>
                  <h2 className="adm-h2">{r.name}</h2>
                  <div className="mono muted tiny">{r.id}</div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {r.id === tenant.id ? <span className="badge">Current</span> : null}
                  {r.bundled ? <span className="badge badge-muted">Preset</span> : null}
                  {r.stored ? <span className="badge badge-accent">{r.bundled ? 'Customised' : 'Stored'}</span> : null}
                </div>
              </div>
              <div className="adm-site-domains small">
                {r.domains.length ? (
                  r.domains.map((d) => (
                    <a key={d} className="adm-chip" href={`https://${d}`} target="_blank" rel="noopener noreferrer">
                      {d}
                    </a>
                  ))
                ) : (
                  <span className="muted">No domains · use ?site={r.id}</span>
                )}
              </div>
              <div className="adm-actions-row">
                <a className="btn btn-ghost btn-sm" href={`/?site=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={16} /> Open site
                </a>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(r)}>
                  <Icon name="globe" size={16} /> Domains
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void manage(r.id)}>
                  <Icon name="settings" size={16} /> Manage
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Onboarding />

      {wizard ? (
        <NewSiteWizard
          existing={rows}
          onClose={() => setWizard(false)}
          onCreated={(id) => {
            setWizard(false);
            void refresh();
            void manage(id);
          }}
        />
      ) : null}
      {editing ? <DomainsModal row={editing} onClose={() => setEditing(null)} onSave={(d) => saveDomains(editing, d)} /> : null}
    </div>
  );
}

function DomainsModal({ row, onClose, onSave }: { row: SiteRow; onClose: () => void; onSave: (d: string[]) => Promise<void> }) {
  const [domains, setDomains] = useState(row.domains);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title={`Domains · ${row.name}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onSave(domains);
              setBusy(false);
            }}
          >
            {busy ? 'Saving…' : 'Save domains'}
          </button>
        </>
      }
    >
      <div className="stack">
        <TagInput
          label="Hostnames"
          value={domains}
          onChange={setDomains}
          normalize={normHost}
          validate={validateHost}
          placeholder="www.acmehaul.lk"
          hint="Each hostname is mapped to this site (domains/{host}). Add both apex and www if you use both."
        />
        <p className="hint">
          Removed hostnames are released (their <code className="mono">domains/{'{host}'}</code> mapping is deleted) when you save.
        </p>
      </div>
    </Modal>
  );
}

function NewSiteWizard({
  existing,
  onClose,
  onCreated,
}: {
  existing: SiteRow[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [clone, setClone] = useState<string>('__template');
  const [country, setCountry] = useState<CountryCode>('ZA');
  const [primary, setPrimary] = useState('#F5A524');
  const [hero3d, setHero3d] = useState<Hero3D>('tipper');
  const [domains, setDomains] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const id = slugTouched ? slug : slugify(name).slice(0, 41);
  const slugErr = !id
    ? 'Required'
    : !SLUG_RE.test(id)
      ? '2–41 chars: lowercase letters, digits and hyphens; must start with a letter or digit'
      : RESERVED.has(id)
        ? 'This id is reserved'
        : existing.some((r) => r.id === id)
          ? 'A site with this id already exists'
          : null;
  const nameErr = name.trim().length < 2 ? 'Enter the company name' : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (slugErr || nameErr) return;
    setBusy(true);
    try {
      const tpl = newTenantTemplate(id, name.trim(), country);
      let base: TenantConfig = tpl;
      if (clone !== '__template') {
        const src = await loadTenant(clone);
        if (src.locale.country !== country) throw new Error(`“${src.name}” is a ${COUNTRIES[src.locale.country].name} site — pick a ${COUNTRIES[country].name} site or the default template.`);
        base = {
          ...JSON.parse(JSON.stringify(src)),
          id,
          name: tpl.name,
          logoText: tpl.logoText,
          logoUrl: undefined,
          tagline: src.tagline,
          seo: tpl.seo,
          contact: tpl.contact,
          social: {},
          stats: [],
          domains: [],
          testimonials: [],
          updatedAt: undefined,
        };
      }
      const cfg: TenantConfig = {
        ...base,
        id,
        domains,
        theme: { ...base.theme, primary, hero3d },
      };
      await saveTenant(cfg, { previous: [] });
      toast(`Site “${cfg.name}” created`);
      onCreated(id);
    } catch (err) {
      toast(`Couldn’t create site: ${errMsg(err)}`, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="New site"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="adm-new-site" className="btn btn-primary btn-sm" disabled={busy}>
            {busy ? 'Creating…' : 'Create & open'}
          </button>
        </>
      }
    >
      <form id="adm-new-site" className="form-grid" onSubmit={submit} noValidate>
        <TextField
          label="Company name"
          value={name}
          placeholder="Acme Haulage (Pvt) Ltd"
          error={submitted ? nameErr : null}
          onChange={setName}
        />
        <Field
          label="Site id (slug)"
          error={(submitted || slugTouched || name) && slugErr ? slugErr : null}
          hint={id ? `${id}.web.app · /?site=${id}` : 'Auto-generated from the name'}
        >
          <input
            className="input mono"
            value={id}
            aria-invalid={(submitted || slugTouched) && slugErr ? true : undefined}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
            }}
          />
        </Field>
        <SelectField<CountryCode>
          label="Country"
          value={country}
          options={COUNTRY_OPTIONS}
          hint={`Currency ${COUNTRIES[country].currency} · VAT ${COUNTRIES[country].defaultTaxPct}%`}
          onChange={(v) => {
            setCountry(v);
            setClone('__template');
          }}
        />
        <SelectField
          label="Start from"
          value={clone}
          span
          hint="Clone copies fleet, services, FAQs, booking settings and layout"
          options={[
            { value: '__template', label: 'Default template' },
            ...existing
              .filter((r) => (PRESETS[r.id]?.locale.country ?? country) === country)
              .map((r) => ({ value: r.id, label: `Clone ${r.name} (${r.id})` })),
          ]}
          onChange={setClone}
        />
        <ColorField label="Primary colour" value={primary} onChange={setPrimary} />
        <SelectField<Hero3D>
          label="Hero 3D scene"
          value={hero3d}
          options={[
            { value: 'tipper', label: '3D tipper truck' },
            { value: 'truck', label: '3D lorry' },
            { value: 'convoy', label: '3D convoy' },
            { value: 'none', label: 'None' },
          ]}
          onChange={setHero3d}
        />
        <TagInput
          label="Domains (optional)"
          value={domains}
          onChange={setDomains}
          normalize={normHost}
          validate={validateHost}
          placeholder={id ? `${id}.web.app` : 'www.example.lk'}
          hint="Hostnames that should open this site. You can add these later."
        />
        <p className="hint span-2">
          After creating, you’ll switch to managing the new site to finish contact details, fleet and rates.
        </p>
      </form>
    </Modal>
  );
}

function CopyLine({ text }: { text: string }) {
  const { toast } = useUi();
  return (
    <div className="adm-code">
      <code className="mono">{text}</code>
      <button
        type="button"
        className="icon-btn"
        aria-label="Copy"
        onClick={async () => toast((await copyText(text)) ? 'Copied' : 'Copy failed', 'info')}
      >
        <Icon name="copy" size={16} />
      </button>
    </div>
  );
}

function Onboarding() {
  return (
    <section className="card stack adm-onboard">
      <div>
        <h2 className="adm-h2">Selling a site — go-live options</h2>
        <p className="muted small">Pick one per customer. All options serve the same build; the site is chosen at runtime.</p>
      </div>
      {dataMode === 'demo' ? (
        <div className="alert alert-warn">
          Demo mode: sites are stored in this browser only. Configure <code className="mono">VITE_FIREBASE_*</code> to publish for real.
        </div>
      ) : null}
      <ol className="adm-steps">
        <li>
          <strong>Quick link (no setup)</strong>
          <p className="muted small">Share a link with the site id. The choice sticks for the browser session.</p>
          <CopyLine text={`https://${PROJECT}.web.app/?site=<id>`} />
        </li>
        <li>
          <strong>Own Firebase Hosting site</strong>
          <p className="muted small">
            Create a Hosting site named after the id, add it as a target in <code className="mono">firebase.json</code> and deploy the same build. <code className="mono">&lt;id&gt;.web.app</code> resolves automatically by its first hostname label.
          </p>
          <CopyLine text="firebase hosting:sites:create <id>" />
          <CopyLine text="firebase target:apply hosting <id> <id> && firebase deploy --only hosting:<id>" />
        </li>
        <li>
          <strong>Custom domain</strong>
          <p className="muted small">
            In Firebase console → Hosting → <em>Add custom domain</em>, verify DNS (TXT + A records at the customer’s registrar). Then add the hostname to the site’s <em>Domains</em> here — saving writes the <code className="mono">domains/{'{host}'}</code> mapping so the site resolves.
          </p>
        </li>
      </ol>
    </section>
  );
}
