import { countryInfo, getPlaces } from '../../geo';
import type { Contact, Social } from '../../tenant/types';
import { Section, TextField } from '../ui';
import type { TabProps } from './draft';

const SOCIAL: { k: keyof Social; label: string }[] = [
  { k: 'facebook', label: 'Facebook' },
  { k: 'instagram', label: 'Instagram' },
  { k: 'tiktok', label: 'TikTok' },
  { k: 'youtube', label: 'YouTube' },
  { k: 'linkedin', label: 'LinkedIn' },
];

const isUrl = (v?: string) => !v || /^https?:\/\/\S+\.\S+/.test(v);

export function ContactTab({ draft, update }: TabProps) {
  const c = draft.contact;
  const setC = (patch: Partial<Contact>) => update((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
  const setS = (k: keyof Social, v: string) => update((d) => ({ ...d, social: { ...d.social, [k]: v.trim() || undefined } }));
  const ci = countryInfo(draft.locale.country);
  const waOk = new RegExp(`^${ci.dialCode}\\d{${ci.nsnLength}}$`).test(c.whatsapp);
  const sample = `${ci.dialCode}${ci.phonePlaceholder.replace(/\D/g, '').replace(/^0/, '')}`;

  return (
    <>
      <Section title="Contact details" desc="Shown in the header, footer, Contact page and click-to-call buttons.">
        <div className="form-grid">
          <TextField label="Phone (display)" type="tel" placeholder={`+${ci.dialCode} ${ci.phonePlaceholder.replace(/^0/, '')}`} value={c.phone} onChange={(v) => setC({ phone: v })} />
          <TextField
            label="WhatsApp number"
            inputMode="numeric"
            placeholder={sample}
            value={c.whatsapp}
            error={c.whatsapp && !waOk ? `Use international digits only, e.g. ${sample}` : null}
            hint="International format, digits only (no +, no spaces)"
            onChange={(v) => setC({ whatsapp: v.replace(/\D/g, '') })}
          />
          <TextField
            label="Email"
            type="email"
            value={c.email}
            error={c.email && !/^\S+@\S+\.\S+$/.test(c.email) ? 'Invalid email' : null}
            onChange={(v) => setC({ email: v.trim() })}
          />
          <TextField label="Opening hours" placeholder="Mon–Sat 6:00–20:00" value={c.hours} onChange={(v) => setC({ hours: v })} />
          <TextField label="Address" span value={c.address} onChange={(v) => setC({ address: v })} />
          <TextField
            label="Google Maps embed URL"
            type="url"
            span
            placeholder="https://www.google.com/maps?q=…&output=embed"
            hint="Google Maps → Share → Embed a map → copy the src URL. Or use https://www.google.com/maps?q=<address>&output=embed"
            error={!isUrl(c.mapEmbedUrl) ? 'Must be a full https:// URL' : null}
            value={c.mapEmbedUrl}
            onChange={(v) => setC({ mapEmbedUrl: v.trim() || undefined })}
          />
        </div>
      </Section>
      <Section title="Social links" desc="Leave blank to hide an icon.">
        <div className="form-grid">
          {SOCIAL.map(({ k, label }) => (
            <TextField
              key={k}
              label={label}
              type="url"
              placeholder={`https://${k}.com/yourpage`}
              value={draft.social[k]}
              error={!isUrl(draft.social[k]) ? 'Must be a full https:// URL' : null}
              onChange={(v) => setS(k, v)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

export function AreasTab({ draft, update }: TabProps) {
  const ci = countryInfo(draft.locale.country);
  const regions = ci.regions;
  const areas = draft.serviceAreas.filter((a) => regions.includes(a));
  const set = (next: string[]) => update((d) => ({ ...d, serviceAreas: regions.filter((r) => next.includes(r)) }));
  const selected = new Set(areas);
  const towns = areas.length ? getPlaces(ci.code, { regions: areas }).length : 0;
  const plural = ci.regionLabel === 'Province' ? 'provinces' : 'districts';

  return (
    <Section
      title="Service areas"
      desc={`${areas.length} of ${regions.length} ${plural} · ${towns} bookable towns in ${ci.name}. Customers pick town-to-town within these ${plural}.`}
      actions={
        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set([...regions])}>
            All {regions.length}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set([])}>
            None
          </button>
        </div>
      }
    >
      <fieldset className="adm-fieldset adm-districts">
        <legend className="sr-only">{ci.regionLabel}s</legend>
        {regions.map((r) => (
          <label key={r} className="checkbox adm-district">
            <input type="checkbox" checked={selected.has(r)} onChange={(e) => set(e.target.checked ? [...areas, r] : areas.filter((x) => x !== r))} />
            {r} <span className="muted tiny">({getPlaces(ci.code, { regions: [r] }).length})</span>
          </label>
        ))}
      </fieldset>
      {areas.length === 0 && <p className="field-error">Select at least one {ci.regionLabel.toLowerCase()} — otherwise no towns can be booked.</p>}
    </Section>
  );
}
