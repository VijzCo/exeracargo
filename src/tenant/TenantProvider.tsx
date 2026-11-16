import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, TenantConfig } from './types';
import { loadTenant, resolveTenantId } from './resolve';
import { translate, type StringKey } from '../i18n/strings';
import { safeHttpsUrl } from '../lib/url';
import { countryInfo, type CountryInfo } from '../geo';

interface TenantCtx {
  tenant: TenantConfig;
  /** Replace the live config (admin preview / after save). */
  setTenant: (t: TenantConfig) => void;
  reload: () => Promise<void>;
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
  /** Home-market info: currency, phone format, regions, time zone. */
  country: CountryInfo;
  /** Format an amount in the tenant's currency, e.g. "R 12 500" / "Rs 12,500". */
  fmtMoney: (n: number) => string;
}

const Ctx = createContext<TenantCtx | null>(null);

const FONT_STACK: Record<TenantConfig['theme']['font'], string> = {
  Inter: "'Inter', system-ui, sans-serif",
  Poppins: "'Poppins', system-ui, sans-serif",
  Montserrat: "'Montserrat', system-ui, sans-serif",
  Barlow: "'Barlow', system-ui, sans-serif",
  Manrope: "'Manrope', system-ui, sans-serif",
};

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const n = parseInt(full.slice(0, 6), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Contrast-safe text colour on top of `hex`. */
function onColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex).split(' ').map(Number);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#0B0F14' : '#FFFFFF';
}

export function applyTheme(t: TenantConfig) {
  const r = document.documentElement;
  const th = t.theme;
  r.dataset.mode = th.mode;
  const vars: Record<string, string> = {
    '--primary': th.primary,
    '--primary-rgb': hexToRgb(th.primary),
    '--on-primary': onColor(th.primary),
    '--accent': th.accent,
    '--accent-rgb': hexToRgb(th.accent),
    '--bg': th.bg,
    '--bg-rgb': hexToRgb(th.bg),
    '--surface': th.surface,
    '--text': th.text,
    '--text-rgb': hexToRgb(th.text),
    '--muted': th.muted,
    '--radius': `${th.radius}px`,
    '--font': FONT_STACK[th.font] ?? FONT_STACK.Inter,
  };
  for (const [k, v] of Object.entries(vars)) r.style.setProperty(k, v);

  // font
  const id = 'hp-font';
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(th.font)}:wght@400;500;600;700;800&family=Noto+Sans+Sinhala:wght@400;600&family=Noto+Sans+Tamil:wght@400;600&display=swap`;
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== href) link.href = href;

  // SEO / meta
  document.title = t.seo.title;
  setMeta('description', t.seo.description);
  setMeta('keywords', t.seo.keywords);
  setMeta('theme-color', th.bg);
  setMeta('og:title', t.seo.title, 'property');
  setMeta('og:description', t.seo.description, 'property');
  setFavicon(t);
  setJsonLd(t);
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let m = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute(attr, name);
    document.head.appendChild(m);
  }
  m.content = content;
}

function setFavicon(t: TenantConfig) {
  const letter = (t.logoText || t.name || 'H').trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${t.theme.primary}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="36" font-weight="800" text-anchor="middle" fill="${onColor(t.theme.primary)}">${letter}</text></svg>`;
  let l = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!l) {
    l = document.createElement('link');
    l.rel = 'icon';
    document.head.appendChild(l);
  }
  l.href = safeHttpsUrl(t.logoUrl) || `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function setJsonLd(t: TenantConfig) {
  const id = 'hp-jsonld';
  let s = document.getElementById(id) as HTMLScriptElement | null;
  if (!s) {
    s = document.createElement('script');
    s.id = id;
    s.type = 'application/ld+json';
    document.head.appendChild(s);
  }
  s.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'MovingCompany',
    name: t.name,
    description: t.seo.description,
    telephone: t.contact.phone,
    email: t.contact.email,
    address: { '@type': 'PostalAddress', streetAddress: t.contact.address, addressCountry: t.locale.country ?? 'LK' },
    areaServed: t.serviceAreas.map((a) => ({ '@type': 'AdministrativeArea', name: a })),
    priceRange: t.locale.currency ?? 'LKR',
  });
}

const LANG_KEY = 'hp:lang';

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenantState] = useState<TenantConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLangState] = useState<Lang>('en');

  const reload = useCallback(async () => {
    setError(null);
    try {
      const id = await resolveTenantId();
      const cfg = await loadTenant(id);
      setTenantState(cfg);
      let saved: Lang | null = null;
      try {
        saved = localStorage.getItem(LANG_KEY) as Lang | null;
      } catch {
        /* ignore */
      }
      setLangState(saved && cfg.locale.languages.includes(saved) ? saved : cfg.locale.defaultLang);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (tenant) applyTheme(tenant);
  }, [tenant]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<TenantCtx | null>(() => {
    if (!tenant) return null;
    const country = countryInfo(tenant.locale.country);
    const nf0 = new Intl.NumberFormat(country.numberLocale, { maximumFractionDigits: 0 });
    const nf2 = new Intl.NumberFormat(country.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // whole amounts for totals; keep cents for small unit rates (e.g. R9.50/km)
    const fmtMoney = (n: number) =>
      `${country.currencySymbol} ${Number.isInteger(n) || Math.abs(n) >= 1000 ? nf0.format(Math.round(n)) : nf2.format(n)}`;
    return {
      tenant,
      setTenant: setTenantState,
      reload,
      lang,
      setLang,
      t: (key) => translate(lang, key, country.code),
      country,
      fmtMoney,
    };
  }, [tenant, lang, reload, setLang]);

  if (error) {
    return (
      <div className="boot-error">
        <h1>Site unavailable</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="boot">
        <div className="boot-spinner" aria-label="Loading" />
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenant(): TenantCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTenant outside TenantProvider');
  return c;
}
