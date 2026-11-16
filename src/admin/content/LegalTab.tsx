// Site content → Legal: company details printed in the Terms / Privacy / agreements, optional text
// overrides (each override has its own version, so users accept again), plus the "Our story" block.
import { useState } from 'react';
import type { LegalDocId, LegalSettings, Story } from '../../tenant/types';
import { DRAFT_NOTE, LEGAL_DOCS } from '../../legal/docs';
import { AreaField, ListEditor, NumField, Section, SelectField, TextField } from '../ui';
import type { TabProps } from './draft';

const today = () => new Date().toISOString().slice(0, 10);

export default function LegalTab({ draft, update }: TabProps) {
  const l: LegalSettings = draft.legal ?? {};
  const set = (patch: Partial<LegalSettings>) => update((d) => ({ ...d, legal: { ...(d.legal ?? {}), ...patch } }));
  const [docId, setDocId] = useState<LegalDocId>('terms');
  const o = l.overrides?.[docId];
  const setOverride = (body: string) =>
    set({
      overrides: {
        ...(l.overrides ?? {}),
        [docId]: body.trim() ? { body, version: o?.body === body ? (o?.version ?? today()) : today() } : undefined,
      },
    });

  return (
    <>
      <Section
        title="Company details for legal documents"
        desc={
          <>
            Filled into the Terms of Use, Privacy Notice, Driver licence, Booking terms and Transporter agreement. <em>{DRAFT_NOTE}</em>
          </>
        }
      >
        <div className="form-grid">
          <TextField label="Registered company name" value={l.legalName ?? ''} maxLength={120} placeholder="Exera Cargo (Pty) Ltd" onChange={(v) => set({ legalName: v })} />
          <TextField label="Registration no. (CIPC)" value={l.regNo ?? ''} maxLength={40} placeholder="2024/123456/07" onChange={(v) => set({ regNo: v })} />
          <TextField label="VAT no." value={l.vatNo ?? ''} maxLength={20} onChange={(v) => set({ vatNo: v })} />
          <TextField label="Legal & privacy email" value={l.email ?? ''} maxLength={120} placeholder="privacy@…" onChange={(v) => set({ email: v })} />
          <TextField label="Information Officer (POPIA)" value={l.infoOfficer ?? ''} maxLength={80} onChange={(v) => set({ infoOfficer: v })} />
          <TextField label="Court / jurisdiction" value={l.jurisdiction ?? ''} maxLength={120} placeholder="Gauteng Division of the High Court, Johannesburg" onChange={(v) => set({ jurisdiction: v })} />
          <NumField label="Liability cap per consignment (booking terms)" value={l.gitLimit} min={0} step={1000} optional suffix="R" onChange={(v) => set({ gitLimit: v })} />
          <NumField label="Transporter payment terms" value={l.payTermsDays} min={0} max={120} optional suffix="days" onChange={(v) => set({ payTermsDays: v })} />
          <TextField label="Registered address" span value={l.address ?? ''} maxLength={200} onChange={(v) => set({ address: v })} />
        </div>
      </Section>

      <Section
        title="Custom document text (optional)"
        desc="Leave empty to use the built-in draft. Saving new text gives it today's version, so everyone is asked to accept again. Format: '## Heading', blank line between paragraphs, '- ' for bullets. Placeholders like {{company}}, {{legalName}}, {{email}} still work."
      >
        <div className="form-grid">
          <SelectField<LegalDocId>
            label="Document"
            value={docId}
            options={(Object.keys(LEGAL_DOCS) as LegalDocId[]).map((id) => ({ value: id, label: LEGAL_DOCS[id].title }))}
            onChange={setDocId}
          />
          <p className="small muted" style={{ alignSelf: 'end' }}>
            Version in use: <strong>{o?.body ? o.version : LEGAL_DOCS[docId].version}</strong>
            {o?.body ? ' (custom)' : ' (built-in)'}
          </p>
          <AreaField label="Text" rows={14} value={o?.body ?? ''} placeholder={LEGAL_DOCS[docId].body.slice(0, 400) + '…'} onChange={setOverride} />
        </div>
      </Section>

      <StorySection draft={draft} update={update} />
    </>
  );
}

function StorySection({ draft, update }: TabProps) {
    const s: Story = draft.story ?? { title: '', body: '', values: [] };
    const setS = (patch: Partial<Story>) => update((d) => ({ ...d, story: { ...(d.story ?? { title: '', body: '', values: [] }), ...patch } }));
    return (
      <Section title="Our story (home page)" desc="Who you are and what customers can count on. Show or hide it under Homepage layout.">
        <div className="form-grid">
          <TextField label="Eyebrow" value={s.eyebrow ?? ''} maxLength={40} placeholder="Our story" onChange={(v) => setS({ eyebrow: v })} />
          <TextField label="Title" value={s.title} maxLength={90} onChange={(v) => setS({ title: v })} />
          <AreaField label="Story (blank line between paragraphs)" rows={8} value={s.body} counter={1500} onChange={(v) => setS({ body: v.slice(0, 1500) })} />
        </div>
        <ListEditor<Story['values'][number]>
          items={s.values ?? []}
          onChange={(next) => setS({ values: next })}
          create={() => ({ title: 'New value', text: '' })}
          duplicate={(v) => ({ ...v, title: `${v.title} (copy)` })}
          title={(v) => v.title}
          subtitle={(v) => v.text}
          itemLabel="value"
          max={6}
          emptyText="No values yet."
          render={(v, set) => (
            <div className="form-grid">
              <TextField label="Title" value={v.title} maxLength={40} onChange={(x) => set({ title: x })} />
              <TextField label="Text" span value={v.text} maxLength={160} onChange={(x) => set({ text: x })} />
            </div>
          )}
        />
      </Section>
    );
  }
