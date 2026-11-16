import { AreaField, Section, TextField } from '../ui';
import type { TabProps } from './draft';

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default function SeoTab({ draft, update }: TabProps) {
  const s = draft.seo;
  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, seo: { ...d.seo, ...patch } }));
  const host = draft.domains[0] || window.location.host;

  return (
    <>
      <Section title="Search engine listing" desc="How the site appears in Google and when shared on WhatsApp / Facebook.">
        <div className="form-grid">
          <TextField label="Page title" span counter={60} hint="Aim for 50–60 characters" value={s.title} onChange={(v) => set({ title: v })} />
          <AreaField label="Meta description" rows={3} counter={160} hint="Aim for 120–160 characters" value={s.description} onChange={(v) => set({ description: v })} />
          <TextField
            label="Keywords"
            span
            hint="Comma-separated, e.g. tipper hire Colombo, sand delivery Gampaha"
            value={s.keywords}
            onChange={(v) => set({ keywords: v })}
          />
        </div>
      </Section>
      <Section title="Google preview">
        <div className="adm-serp" aria-label="Google search result preview">
          <div className="adm-serp-site">
            <span className="adm-serp-fav" aria-hidden>
              {(draft.logoText || draft.name).charAt(0)}
            </span>
            <div>
              <div className="adm-serp-name">{draft.name}</div>
              <div className="adm-serp-url">https://{host}</div>
            </div>
          </div>
          <div className="adm-serp-title">{trunc(s.title || draft.name, 60)}</div>
          <div className="adm-serp-desc">{trunc(s.description || draft.tagline, 160)}</div>
        </div>
      </Section>
    </>
  );
}
