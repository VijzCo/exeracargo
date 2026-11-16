import { useState, type DragEvent } from 'react';
import { Icon } from '../../components/Icon';
import type { Lang, SectionKey, TenantConfig } from '../../tenant/types';
import { LANG_OPTIONS } from '../market';
import { Section, SelectField, Toggle } from '../ui';
import type { TabProps } from './draft';

export const ALL_SECTIONS: { key: SectionKey; label: string; desc: string }[] = [
  { key: 'hero', label: 'Hero', desc: 'Headline, buttons and 3D scene' },
  { key: 'stats', label: 'Stats', desc: 'Animated counters' },
  { key: 'services', label: 'Services', desc: 'What you haul' },
  { key: 'fleet', label: 'Fleet', desc: 'Vehicles & rates' },
  { key: 'promotions', label: 'Promotions', desc: 'Active offers' },
  { key: 'process', label: 'How it works', desc: 'Booking steps' },
  { key: 'insights', label: 'Insights', desc: 'Latest articles' },
  { key: 'logistics', label: 'Logistics', desc: 'Freight services & delivery speeds' },
  { key: 'trust', label: 'Trust badges', desc: 'Certifications & insurance' },
  { key: 'story', label: 'Our story', desc: 'Who you are & what you stand for' },
  { key: 'areas', label: 'Service areas', desc: 'Coverage map & regions' },
  { key: 'testimonials', label: 'Testimonials', desc: 'Customer quotes' },
  { key: 'faq', label: 'FAQ', desc: 'Common questions' },
  { key: 'cta', label: 'Call to action', desc: 'Closing banner' },
];
const LABEL = Object.fromEntries(ALL_SECTIONS.map((s) => [s.key, s])) as Record<SectionKey, (typeof ALL_SECTIONS)[number]>;

const LANGS = LANG_OPTIONS;

const FEATURES: { key: keyof TenantConfig['features']; label: string; desc: string }[] = [
  { key: 'insights', label: 'Insights / blog', desc: 'Articles page and homepage section' },
  { key: 'promotions', label: 'Promotions', desc: 'Offers page and promo codes at checkout' },
  { key: 'tracking', label: 'Booking tracking', desc: 'Public “Track booking” page by reference' },
  { key: 'languageSwitcher', label: 'Language switcher', desc: 'Language buttons in the header' },
];

export default function LayoutTab({ draft, update }: TabProps) {
  // Ensure every known section is present (new sections added later appear at the end).
  const order: SectionKey[] = [
    ...draft.sections.order.filter((k) => LABEL[k]),
    ...ALL_SECTIONS.map((s) => s.key).filter((k) => !draft.sections.order.includes(k)),
  ];
  const hidden = new Set(draft.sections.hidden);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const setOrder = (next: SectionKey[]) => update((d) => ({ ...d, sections: { ...d.sections, order: next } }));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setOrder(next);
  };
  const toggleHidden = (k: SectionKey, visible: boolean) =>
    update((d) => {
      const h = new Set(d.sections.hidden);
      if (visible) h.delete(k);
      else h.add(k);
      return { ...d, sections: { ...d.sections, order, hidden: [...h] } };
    });

  const onDrop = (e: DragEvent, to: number) => {
    e.preventDefault();
    const from = dragIdx ?? Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(from)) move(from, to);
    setDragIdx(null);
    setOverIdx(null);
  };

  const langs = draft.locale.languages;
  const setLangs = (next: Lang[]) =>
    update((d) => ({
      ...d,
      locale: { ...d.locale, languages: next, defaultLang: next.includes(d.locale.defaultLang) ? d.locale.defaultLang : next[0] },
    }));

  return (
    <>
      <Section title="Homepage sections" desc="Drag to reorder (or use the arrows). Toggle to show or hide.">
        <ol className="adm-sections">
          {order.map((k, i) => {
            const vis = !hidden.has(k);
            return (
              <li
                key={k}
                className={`adm-section-row${dragIdx === i ? ' dragging' : ''}${overIdx === i && dragIdx !== i ? ' over' : ''}${vis ? '' : ' off'}`}
                draggable
                onDragStart={(e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(i));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overIdx !== i) setOverIdx(i);
                }}
                onDragLeave={() => overIdx === i && setOverIdx(null)}
                onDrop={(e) => onDrop(e, i)}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
              >
                <span className="adm-grip" aria-hidden>
                  ⋮⋮
                </span>
                <span className="adm-section-idx muted tiny">{i + 1}</span>
                <div className="adm-section-txt">
                  <strong>{LABEL[k].label}</strong>
                  <span className="muted tiny">{LABEL[k].desc}</span>
                </div>
                <div className="adm-list-actions">
                  <button type="button" className="icon-btn" aria-label={`Move ${LABEL[k].label} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <span className="adm-rot-up" aria-hidden>
                      <Icon name="arrow" size={14} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${LABEL[k].label} down`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <span className="adm-rot-down" aria-hidden>
                      <Icon name="arrow" size={14} />
                    </span>
                  </button>
                  <Toggle checked={vis} onChange={(v) => toggleHidden(k, v)} label={<span className="sr-only">Show {LABEL[k].label}</span>} />
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section title="Features">
        <div className="adm-toggle-grid">
          {FEATURES.map((f) => (
            <Toggle
              key={f.key}
              checked={draft.features[f.key]}
              label={f.label}
              desc={f.desc}
              onChange={(v) => update((d) => ({ ...d, features: { ...d.features, [f.key]: v } }))}
            />
          ))}
        </div>
      </Section>

      <Section title="Languages" desc="Choose which languages visitors can switch between.">
        <div className="form-grid">
          <fieldset className="adm-fieldset">
            <legend className="label">Enabled languages</legend>
            {LANGS.map((l) => (
              <label key={l.value} className="checkbox">
                <input
                  type="checkbox"
                  checked={langs.includes(l.value)}
                  disabled={langs.length === 1 && langs.includes(l.value)}
                  onChange={(e) =>
                    setLangs(
                      e.target.checked
                        ? LANGS.map((x) => x.value).filter((x) => x === l.value || langs.includes(x))
                        : langs.filter((x) => x !== l.value),
                    )
                  }
                />
                {l.label}
              </label>
            ))}
            <span className="hint">At least one language must stay enabled.</span>
          </fieldset>
          <SelectField<Lang>
            label="Default language"
            value={draft.locale.defaultLang}
            options={LANGS.filter((l) => langs.includes(l.value))}
            onChange={(v) => update((d) => ({ ...d, locale: { ...d.locale, defaultLang: v } }))}
          />
        </div>
      </Section>
    </>
  );
}
