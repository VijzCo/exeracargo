import { useState } from 'react';
import { useTenant } from '../tenant/TenantProvider';
import PageHeader from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { createMessage } from '../lib/data';
import { safeMapEmbed } from '../lib/url';
import { telLink, waLink } from '../lib/wa';
import { isValidPhone, normalisePhone } from '../geo/countries';

export default function ContactPage() {
  const { tenant, t, country } = useTenant();
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (form.name.trim().length < 2) er.name = 'Please enter your name';
    if (!isValidPhone(form.phone, country.code)) er.phone = `Enter a valid ${country.name} number, e.g. ${country.phonePlaceholder}`;
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) er.email = 'Invalid email';
    if (form.message.trim().length < 5) er.message = 'Tell us a little more';
    setErrors(er);
    if (Object.keys(er).length) return;
    setState('sending');
    try {
      await createMessage(tenant.id, {
        name: form.name.trim().slice(0, 80),
        phone: normalisePhone(form.phone, country.code),
        email: form.email.trim().slice(0, 120) || undefined,
        message: form.message.trim().slice(0, 2000),
      });
      setState('sent');
      setForm({ name: '', phone: '', email: '', message: '' });
    } catch {
      setState('error');
    }
  };

  const cards = [
    { icon: 'phone', label: t('common.call'), value: tenant.contact.phone, href: telLink(tenant.contact.phone) },
    { icon: 'whatsapp', label: 'WhatsApp', value: tenant.contact.whatsapp && `+${tenant.contact.whatsapp}`, href: waLink(tenant.contact.whatsapp, `Hi ${tenant.name}`) },
    { icon: 'mail', label: 'Email', value: tenant.contact.email, href: `mailto:${tenant.contact.email}` },
    { icon: 'clock', label: 'Hours', value: tenant.contact.hours, href: undefined as string | undefined },
  ].filter((c) => !!c.value);

  return (
    <div>
      <PageHeader eyebrow={tenant.name} title={t('contact.title')} sub={tenant.contact.address} />
      <section className="section" style={{ paddingTop: 32 }}>
        <div className="container grid-2">
          <div className="stack" style={{ ['--gap' as string]: '14px' }}>
            {cards.map((c) => {
              const inner = (
                <>
                  <span className="service-icon">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <span>
                    <span className="tiny muted" style={{ display: 'block' }}>
                      {c.label}
                    </span>
                    <strong>{c.value}</strong>
                  </span>
                </>
              );
              return c.href ? (
                <a key={c.label} href={c.href} className="card card-hover contact-card" target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  {inner}
                </a>
              ) : (
                <div key={c.label} className="card contact-card">
                  {inner}
                </div>
              );
            })}
            {safeMapEmbed(tenant.contact.mapEmbedUrl) && (
              <div className="map-wrap card" style={{ padding: 0 }}>
                <iframe title="Map" src={safeMapEmbed(tenant.contact.mapEmbedUrl)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              </div>
            )}
          </div>
          <form className="card stack" onSubmit={submit} noValidate>
            <h2 className="h3">{t('contact.message')}</h2>
            {state === 'sent' && <div className="alert alert-ok">{t('contact.sent')}</div>}
            {state === 'error' && <div className="alert alert-err">Couldn’t send — please call or WhatsApp us instead.</div>}
            <label className="field">
              <span className="label">{t('contact.name')}</span>
              <input className="input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} autoComplete="name" maxLength={80} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
            <label className="field">
              <span className="label">{t('contact.phone')}</span>
              <input className="input" value={form.phone} onChange={set('phone')} aria-invalid={!!errors.phone} inputMode="tel" autoComplete="tel" placeholder={country.phonePlaceholder} />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </label>
            <label className="field">
              <span className="label">{t('contact.email')}</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} autoComplete="email" />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>
            <label className="field">
              <span className="label">{t('contact.message')}</span>
              <textarea className="textarea" value={form.message} onChange={set('message')} aria-invalid={!!errors.message} maxLength={2000} />
              {errors.message && <span className="field-error">{errors.message}</span>}
            </label>
            <button className="btn btn-primary btn-lg" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : t('contact.send')}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
