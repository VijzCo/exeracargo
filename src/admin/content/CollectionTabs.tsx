import { useTenant } from '../../tenant/TenantProvider';
import { SERVICE_ICONS as SERVICE_ICON_OPTIONS } from '../market';
import type { Faq, Insight, Promotion, Service, Testimonial } from '../../tenant/types';
import { todayYmd } from '../bookingUtils';
import { AreaField, Field, ListEditor, NumField, Section, SelectField, TextField, Toggle, slugify, uid } from '../ui';
import type { TabProps } from './draft';

// ── Services ─────────────────────────────────────────────────

const SERVICE_ICONS = SERVICE_ICON_OPTIONS;

export function ServicesTab({ draft, update }: TabProps) {
  const { fmtMoney } = useTenant();
  return (
    <Section title="Services" desc="What you haul. Shown on the homepage and Services page; selectable in booking.">
      <ListEditor<Service>
        items={draft.services}
        onChange={(services) => update((d) => ({ ...d, services }))}
        itemLabel="service"
        create={() => ({ id: uid('svc'), title: 'New service', description: '', icon: 'sand' })}
        duplicate={(s) => ({ ...s, id: uid('svc'), title: `${s.title} (copy)` })}
        title={(s) => s.title}
        subtitle={(s) => (s.priceFrom ? `From ${fmtMoney(s.priceFrom)}${s.unit ? ` ${s.unit}` : ''}` : SERVICE_ICONS.find((i) => i.value === s.icon)?.label)}
        render={(s, set) => (
          <>
            <TextField label="Title" value={s.title} onChange={(v) => set({ title: v })} />
            <SelectField label="Icon" value={s.icon} options={SERVICE_ICONS} onChange={(v) => set({ icon: v })} />
            <AreaField label="Description" rows={3} counter={200} value={s.description} onChange={(v) => set({ description: v })} />
            <NumField label="Price from" suffix="LKR" optional min={0} step={500} value={s.priceFrom} onChange={(v) => set({ priceFrom: v })} />
            <TextField label="Price unit" placeholder="per trip, per cube…" value={s.unit} onChange={(v) => set({ unit: v || undefined })} />
          </>
        )}
      />
    </Section>
  );
}

// ── Promotions ───────────────────────────────────────────────

export function PromotionsTab({ draft, update }: TabProps) {
  const today = todayYmd();
  const codes = draft.promotions.map((p) => (p.code || '').toUpperCase()).filter(Boolean);
  return (
    <>
      {!draft.features.promotions ? (
        <div className="alert alert-warn">Promotions are turned off in Homepage layout → Features, so these won’t be shown.</div>
      ) : null}
      <Section title="Promotions" desc="Offers shown on the Offers page. Codes are applied in the booking form.">
        <ListEditor<Promotion>
          items={draft.promotions}
          onChange={(promotions) => update((d) => ({ ...d, promotions }))}
          itemLabel="promotion"
          create={() => ({ id: uid('promo'), title: 'New offer', description: '', active: false, discountPct: 10 })}
          duplicate={(p) => ({ ...p, id: uid('promo'), title: `${p.title} (copy)`, code: p.code ? `${p.code}2` : undefined, active: false })}
          title={(p) => p.title}
          subtitle={(p) => {
            const expired = p.validUntil && p.validUntil < today;
            return (
              <span className="row" style={{ gap: 6 }}>
                <span className={`badge ${p.active && !expired ? '' : 'badge-muted'}`}>{expired ? 'Expired' : p.active ? 'Active' : 'Inactive'}</span>
                {p.code ? <span className="mono">{p.code}</span> : null}
                {p.discountPct ? <span>{p.discountPct}% off</span> : null}
              </span>
            );
          }}
          render={(p, set) => {
            const code = (p.code || '').toUpperCase();
            const dup = code && codes.filter((c) => c === code).length > 1;
            return (
              <>
                <TextField label="Title" value={p.title} onChange={(v) => set({ title: v })} />
                <TextField label="Badge" placeholder="e.g. Monsoon deal" value={p.badge} onChange={(v) => set({ badge: v || undefined })} />
                <AreaField label="Description" rows={3} value={p.description} onChange={(v) => set({ description: v })} />
                <TextField
                  label="Promo code"
                  placeholder="SAND10"
                  value={p.code}
                  error={dup ? 'This code is used by another promotion' : null}
                  hint="Letters & digits; customers enter this at booking"
                  onChange={(v) => set({ code: v.toUpperCase().replace(/[^A-Z0-9-]/g, '') || undefined })}
                />
                <NumField label="Discount" suffix="%" optional min={0} max={100} value={p.discountPct} onChange={(v) => set({ discountPct: v === undefined ? undefined : Math.min(100, Math.max(0, v)) })} />
                <TextField
                  label="Valid until"
                  type="date"
                  value={p.validUntil?.slice(0, 10)}
                  error={p.validUntil && p.validUntil < today ? 'This date is in the past — the offer is expired' : null}
                  onChange={(v) => set({ validUntil: v || undefined })}
                />
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <Toggle checked={p.active} onChange={(v) => set({ active: v })} label="Active" desc="Only active, unexpired offers are shown" />
                </div>
              </>
            );
          }}
        />
      </Section>
    </>
  );
}

// ── Insights ─────────────────────────────────────────────────

const CATS: Insight['category'][] = ['Market', 'Guide', 'Company', 'Safety', 'Pricing'];

export function InsightsTab({ draft, update }: TabProps) {
  const slugs = draft.insights.map((i) => i.slug);
  return (
    <>
      {!draft.features.insights ? (
        <div className="alert alert-warn">Insights are turned off in Homepage layout → Features, so articles won’t be shown.</div>
      ) : null}
      <Section title="Insights" desc="Articles for the Insights page — great for SEO and customer education.">
        <ListEditor<Insight>
          items={draft.insights}
          onChange={(insights) => update((d) => ({ ...d, insights }))}
          itemLabel="article"
          create={() => ({
            id: uid('ins'),
            slug: `new-article-${Date.now().toString(36)}`,
            title: 'New article',
            excerpt: '',
            body: '',
            category: 'Guide',
            date: todayYmd(),
            readMins: 3,
          })}
          duplicate={(i) => ({ ...i, id: uid('ins'), title: `${i.title} (copy)`, slug: `${i.slug}-copy` })}
          title={(i) => i.title}
          subtitle={(i) => `${i.category} · ${i.date?.slice(0, 10)} · ${i.readMins} min · /insights/${i.slug}`}
          render={(i, set) => {
            const dupSlug = slugs.filter((s) => s === i.slug).length > 1;
            const words = i.body.trim() ? i.body.trim().split(/\s+/).length : 0;
            return (
              <>
                <TextField
                  label="Title"
                  span
                  value={i.title}
                  onChange={(v) => {
                    // keep slug in sync while it still matches the auto-generated one
                    const auto = !i.slug || i.slug === slugify(i.title) || /^new-article-/.test(i.slug);
                    set(auto ? { title: v, slug: slugify(v) || i.slug } : { title: v });
                  }}
                />
                <TextField
                  label="URL slug"
                  value={i.slug}
                  error={!i.slug ? 'Slug is required' : dupSlug ? 'Another article uses this slug' : null}
                  hint="Auto-generated from the title"
                  onChange={(v) => set({ slug: slugify(v) })}
                />
                <SelectField label="Category" value={i.category} options={CATS} onChange={(v) => set({ category: v })} />
                <TextField label="Date" type="date" value={i.date?.slice(0, 10)} onChange={(v) => set({ date: v })} />
                <NumField
                  label="Read time"
                  suffix="min"
                  min={1}
                  value={i.readMins}
                  hint={words ? `${words} words ≈ ${Math.max(1, Math.round(words / 200))} min` : undefined}
                  onChange={(v) => set({ readMins: Math.max(1, v ?? 1) })}
                />
                <TextField label="Cover image URL" type="url" span value={i.coverUrl} onChange={(v) => set({ coverUrl: v.trim() || undefined })} />
                <AreaField label="Excerpt" rows={2} counter={200} value={i.excerpt} onChange={(v) => set({ excerpt: v })} />
                <AreaField
                  label="Body"
                  rows={12}
                  value={i.body}
                  hint={
                    <>
                      Formatting: <code className="mono">## heading</code>, <code className="mono">- bullet</code>, blank line = new paragraph
                    </>
                  }
                  onChange={(v) => set({ body: v })}
                />
              </>
            );
          }}
        />
      </Section>
    </>
  );
}

// ── Testimonials ─────────────────────────────────────────────

export function TestimonialsTab({ draft, update }: TabProps) {
  return (
    <Section title="Testimonials" desc="Customer quotes shown on the homepage.">
      <ListEditor<Testimonial>
        items={draft.testimonials}
        onChange={(testimonials) => update((d) => ({ ...d, testimonials }))}
        itemLabel="testimonial"
        create={() => ({ name: '', role: '', quote: '', rating: 5 })}
        title={(t) => t.name}
        subtitle={(t) => `${'★'.repeat(t.rating)}${'☆'.repeat(Math.max(0, 5 - t.rating))} ${t.role}`}
        render={(t, set) => (
          <>
            <TextField label="Name" value={t.name} onChange={(v) => set({ name: v })} />
            <TextField label="Role / company" placeholder="Site engineer, Kandy" value={t.role} onChange={(v) => set({ role: v })} />
            <AreaField label="Quote" rows={3} counter={280} value={t.quote} onChange={(v) => set({ quote: v })} />
            <Field label="Rating">
              <div className="adm-stars" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={t.rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className={n <= t.rating ? 'on' : ''}
                    onClick={() => set({ rating: n })}
                  >
                    ★
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}
      />
    </Section>
  );
}

// ── FAQs ─────────────────────────────────────────────────────

export function FaqsTab({ draft, update }: TabProps) {
  return (
    <Section title="FAQs" desc="Questions & answers on the homepage (also helps SEO).">
      <ListEditor<Faq>
        items={draft.faqs}
        onChange={(faqs) => update((d) => ({ ...d, faqs }))}
        itemLabel="FAQ"
        create={() => ({ q: '', a: '' })}
        title={(f) => f.q}
        render={(f, set) => (
          <>
            <TextField label="Question" span value={f.q} onChange={(v) => set({ q: v })} />
            <AreaField label="Answer" rows={4} value={f.a} onChange={(v) => set({ a: v })} />
          </>
        )}
      />
    </Section>
  );
}
