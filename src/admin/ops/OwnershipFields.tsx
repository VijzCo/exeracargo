// Own / hired switch + transporter picker for vehicles and drivers.
import type { Ownership } from '../../ops/types';
import { Field } from '../ui';
import { useTransporters } from './hooks';

interface Value {
  ownership?: Ownership;
  transporterId?: string;
  transporterName?: string;
}

export function OwnershipFields({ value, onChange, error }: { value: Value; onChange: (v: Value) => void; error?: string }) {
  const { data: transporters } = useTransporters();
  const hired = value.ownership === 'hired';
  return (
    <>
      <Field label="Ownership" hint={hired ? 'Paid through the transporter’s rate card and settlements' : 'Part of your own fleet'}>
        <select
          className="select"
          value={value.ownership ?? 'own'}
          onChange={(e) => {
            const o = e.target.value as Ownership;
            onChange(o === 'own' ? { ownership: 'own', transporterId: undefined, transporterName: undefined } : { ownership: 'hired' });
          }}
        >
          <option value="own">Own</option>
          <option value="hired">Hired (subcontracted)</option>
        </select>
      </Field>
      <Field label={hired ? 'Transporter *' : 'Transporter'} error={error}>
        <select
          className="select"
          disabled={!hired}
          value={value.transporterId ?? ''}
          aria-invalid={!!error || undefined}
          onChange={(e) => {
            const t = transporters.find((x) => x.id === e.target.value);
            onChange({ ownership: 'hired', transporterId: t?.id, transporterName: t?.name });
          }}
        >
          <option value="">{hired ? '— Choose —' : '—'}</option>
          {transporters
            .filter((t) => t.active || t.id === value.transporterId)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
        </select>
      </Field>
    </>
  );
}
