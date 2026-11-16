import type { TenantConfig } from '../../tenant/types';
import { ListEditor, NumField, Section, TagInput, TextField, AreaField } from '../ui';
import type { TabProps } from './draft';

type Stat = TenantConfig['stats'][number];

export default function HeroTab({ draft, update }: TabProps) {
  const h = draft.hero;
  const setHero = (patch: Partial<TenantConfig['hero']>) => update((d) => ({ ...d, hero: { ...d.hero, ...patch } }));

  return (
    <>
      <Section title="Hero" desc="The first screen visitors see on the homepage.">
        <div className="form-grid">
          <TextField label="Eyebrow" span value={h.eyebrow} counter={60} onChange={(v) => setHero({ eyebrow: v })} />
          <AreaField label="Headline" rows={2} value={h.title} counter={90} onChange={(v) => setHero({ title: v })} />
          <AreaField label="Subtitle" rows={3} value={h.subtitle} counter={220} onChange={(v) => setHero({ subtitle: v })} />
          <TextField label="Primary button" hint="Opens the booking form" value={h.ctaPrimary} onChange={(v) => setHero({ ctaPrimary: v })} />
          <TextField label="Secondary button" hint="Opens WhatsApp / fleet" value={h.ctaSecondary} onChange={(v) => setHero({ ctaSecondary: v })} />
          <TagInput
            label="Trust badges"
            value={h.badges}
            onChange={(v) => setHero({ badges: v })}
            placeholder="e.g. Same-day dispatch"
            hint="Short phrases shown under the hero buttons. Enter or comma to add."
          />
        </div>
      </Section>

      <Section title="Stats" desc="Animated counters under the hero (e.g. 12,000 trips completed).">
        <ListEditor<Stat>
          items={draft.stats}
          onChange={(stats) => update((d) => ({ ...d, stats }))}
          itemLabel="stat"
          max={6}
          create={() => ({ label: 'New stat', value: 100, suffix: '+' })}
          title={(s) => `${s.value.toLocaleString()}${s.suffix ?? ''} — ${s.label}`}
          render={(s, set) => (
            <>
              <TextField label="Label" span value={s.label} onChange={(v) => set({ label: v })} />
              <NumField label="Value" value={s.value} min={0} onChange={(v) => set({ value: v ?? 0 })} />
              <TextField label="Suffix" placeholder="+, %, hrs" value={s.suffix} onChange={(v) => set({ suffix: v || undefined })} />
            </>
          )}
        />
      </Section>
    </>
  );
}
