import { Icon } from '../../components/Icon';
import type { Hero3D, Theme } from '../../tenant/types';
import { ColorField, Field, Section, SelectField, TextField } from '../ui';
import type { TabProps } from './draft';

type Palette = Pick<Theme, 'mode' | 'primary' | 'accent' | 'bg' | 'surface' | 'text' | 'muted'>;

export const THEME_PRESETS: { name: string; p: Palette }[] = [
  {
    name: 'Safety Amber dark',
    p: { mode: 'dark', primary: '#F5A524', accent: '#2DD4BF', bg: '#0B0F14', surface: '#141B23', text: '#EEF2F6', muted: '#93A1B1' },
  },
  {
    name: 'Emerald light',
    p: { mode: 'light', primary: '#059669', accent: '#F59E0B', bg: '#F5FAF7', surface: '#FFFFFF', text: '#0F1A17', muted: '#5B6B66' },
  },
  {
    name: 'Royal blue',
    p: { mode: 'dark', primary: '#3B82F6', accent: '#FACC15', bg: '#0A1020', surface: '#121A2E', text: '#EAF0FF', muted: '#8E9BB8' },
  },
  {
    name: 'Crimson',
    p: { mode: 'dark', primary: '#E11D48', accent: '#F97316', bg: '#110B0D', surface: '#1C1317', text: '#F8EEF0', muted: '#A8949A' },
  },
  {
    name: 'Monochrome',
    p: { mode: 'light', primary: '#111827', accent: '#6B7280', bg: '#FAFAFA', surface: '#FFFFFF', text: '#0A0A0A', muted: '#6B7280' },
  },
  {
    name: 'Sunset light',
    p: { mode: 'light', primary: '#EA580C', accent: '#0EA5E9', bg: '#FFF8F3', surface: '#FFFFFF', text: '#1C1410', muted: '#7A6A60' },
  },
];

const FONTS: Theme['font'][] = ['Inter', 'Poppins', 'Montserrat', 'Barlow', 'Manrope'];
const HERO3D: { value: Hero3D; label: string }[] = [
  { value: 'tipper', label: '3D tipper truck' },
  { value: 'truck', label: '3D lorry' },
  { value: 'convoy', label: '3D convoy' },
  { value: 'none', label: 'None (static)' },
];
const COLOR_KEYS: { k: keyof Palette; label: string }[] = [
  { k: 'primary', label: 'Primary' },
  { k: 'accent', label: 'Accent' },
  { k: 'bg', label: 'Background' },
  { k: 'surface', label: 'Surface' },
  { k: 'text', label: 'Text' },
  { k: 'muted', label: 'Muted text' },
];

export default function BrandTab({ draft, update }: TabProps) {
  const th = draft.theme;
  const setTheme = (patch: Partial<Theme>) => update((d) => ({ ...d, theme: { ...d.theme, ...patch } }));
  const isActive = (p: Palette) => (Object.keys(p) as (keyof Palette)[]).every((k) => String(th[k]).toLowerCase() === String(p[k]).toLowerCase());

  return (
    <>
      <Section title="Brand" desc="Company name and logo shown in the header, footer and browser tab.">
        <div className="form-grid">
          <TextField label="Company name" value={draft.name} onChange={(v) => update((d) => ({ ...d, name: v }))} />
          <TextField
            label="Logo text"
            hint="Used when no logo image is set"
            value={draft.logoText}
            onChange={(v) => update((d) => ({ ...d, logoText: v }))}
          />
          <TextField
            label="Logo image URL"
            type="url"
            span
            placeholder="https://…/logo.svg"
            hint="Optional. SVG or transparent PNG, ~40px tall. Also used as favicon."
            value={draft.logoUrl}
            onChange={(v) => update((d) => ({ ...d, logoUrl: v.trim() || undefined }))}
          />
          <TextField label="Tagline" span value={draft.tagline} onChange={(v) => update((d) => ({ ...d, tagline: v }))} />
        </div>
      </Section>

      <Section title="Theme presets" desc="One click sets the full colour palette. Fine-tune below.">
        <div className="adm-presets">
          {THEME_PRESETS.map(({ name, p }) => (
            <button
              key={name}
              type="button"
              className={`adm-preset${isActive(p) ? ' active' : ''}`}
              aria-pressed={isActive(p)}
              onClick={() => setTheme(p)}
            >
              <span className="adm-preset-sw" style={{ background: p.bg, borderColor: p.surface }}>
                <span style={{ background: p.primary }} />
                <span style={{ background: p.accent }} />
                <span style={{ background: p.surface }} />
              </span>
              <span className="small">{name}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Colours & style">
        <div className="adm-color-grid">
          {COLOR_KEYS.map(({ k, label }) => (
            <ColorField key={k} label={label} value={String(th[k])} onChange={(v) => setTheme({ [k]: v } as Partial<Theme>)} />
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 16 }}>
          <Field label="Mode">
            <div className="tabs" role="radiogroup" aria-label="Colour mode">
              {(['dark', 'light'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={th.mode === m}
                  aria-selected={th.mode === m}
                  className="tab"
                  onClick={() => setTheme({ mode: m })}
                >
                  {m === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Corner radius · ${th.radius}px`}>
            <input
              type="range"
              className="adm-range"
              min={0}
              max={28}
              step={1}
              value={th.radius}
              onChange={(e) => setTheme({ radius: Number(e.target.value) })}
            />
          </Field>
          <SelectField label="Font" value={th.font} options={FONTS} onChange={(v) => setTheme({ font: v })} />
          <SelectField
            label="Hero 3D scene"
            value={th.hero3d}
            options={HERO3D}
            onChange={(v) => setTheme({ hero3d: v })}
            hint="Animated WebGL scene in the homepage hero. Falls back to static on low-power devices."
          />
        </div>
      </Section>

      <Section title="Live preview" desc="The whole admin and site update as you edit. Publish to make it public.">
        <div className="adm-preview" style={{ fontFamily: 'var(--font)' }}>
          <div className="adm-preview-head">
            <span className="row" style={{ gap: 8 }}>
              <span className="adm-logo-mark" aria-hidden>
                {(draft.logoText || draft.name).charAt(0)}
              </span>
              <strong>{draft.logoText || draft.name}</strong>
            </span>
            <span className="btn btn-primary btn-sm" aria-hidden>
              <Icon name="phone" size={14} /> Call
            </span>
          </div>
          <div className="adm-preview-body">
            <span className="eyebrow">{draft.hero.eyebrow}</span>
            <h3 className="h3">{draft.hero.title}</h3>
            <p className="muted small">{draft.tagline}</p>
            <div className="row">
              <span className="btn btn-primary btn-sm">{draft.hero.ctaPrimary}</span>
              <span className="btn btn-ghost btn-sm">{draft.hero.ctaSecondary}</span>
              <span className="badge">Badge</span>
              <span className="badge badge-accent">Accent</span>
            </div>
            <div className="card" style={{ padding: 14 }}>
              <strong className="gradient-text">Card surface</strong>
              <p className="muted small">Muted text on surface.</p>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
