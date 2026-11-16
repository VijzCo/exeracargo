import type { Credential } from '../../tenant/types';
import { ListEditor, Section, SelectField, TextField } from '../ui';
import type { TabProps } from './draft';

const ICONS: { value: Credential['icon']; label: string }[] = [
  { value: 'shield', label: 'Shield' },
  { value: 'check', label: 'Tick' },
  { value: 'star', label: 'Star' },
  { value: 'globe', label: 'Globe' },
  { value: 'contract', label: 'Document' },
];

/** Verifiable credentials shown as trust badges. Only list what the client can prove. */
export default function TrustTab({ draft, update }: TabProps) {
  const items = draft.credentials ?? [];
  return (
    <Section
      title="Trust badges"
      desc="Certifications, insurance and permits buyers check before booking (e.g. RTMS, GIT cover, C-BRTA permits, B-BBEE level). Only list what you can show on request."
    >
      <ListEditor<Credential>
        items={items}
        onChange={(next) => update((d) => ({ ...d, credentials: next }))}
        create={() => ({ title: 'New credential', detail: '', icon: 'shield' })}
        duplicate={(c) => ({ ...c, title: `${c.title} (copy)` })}
        title={(c) => c.title}
        subtitle={(c) => c.detail}
        itemLabel="badge"
        max={8}
        emptyText="No trust badges yet."
        render={(c, set) => (
          <div className="form-grid">
            <TextField label="Title" value={c.title} maxLength={60} onChange={(v) => set({ title: v })} />
            <SelectField<Credential['icon']> label="Icon" value={c.icon} options={ICONS} onChange={(v) => set({ icon: v })} />
            <TextField label="Detail" span value={c.detail} maxLength={160} placeholder="Certificate no. / insurer / valid until" onChange={(v) => set({ detail: v })} />
          </div>
        )}
      />
    </Section>
  );
}
