import { useTenant } from '../../tenant/TenantProvider';
import { VEHICLE_TYPES } from '../market';
import type { Vehicle } from '../../tenant/types';
import { ListEditor, NumField, Section, SelectField, TagInput, TextField, Toggle, uid } from '../ui';
import type { TabProps } from './draft';

const TYPES = VEHICLE_TYPES;
const UNITS: { value: Vehicle['capacityUnit']; label: string }[] = [
  { value: 'cube', label: 'cubes' },
  { value: 'ton', label: 'tons' },
  { value: 'ft', label: 'ft (body length)' },
];

export default function FleetTab({ draft, update }: TabProps) {
  const { fmtMoney } = useTenant();
  const allFeatures = [...new Set(draft.fleet.flatMap((v) => v.features))];

  return (
    <Section
      title="Fleet"
      desc="Vehicles shown on the Fleet page and in the booking form. Rates drive the instant quote."
    >
      <ListEditor<Vehicle>
        items={draft.fleet}
        onChange={(fleet) => update((d) => ({ ...d, fleet }))}
        itemLabel="vehicle"
        create={() => ({
          id: uid('veh'),
          name: 'New vehicle',
          type: 'tipper',
          capacity: 3,
          capacityUnit: 'cube',
          features: [],
          baseFare: 3500,
          perKm: 180,
          available: true,
        })}
        duplicate={(v) => ({ ...v, id: uid('veh'), name: `${v.name} (copy)`, features: [...v.features] })}
        title={(v) => v.name}
        subtitle={(v) => (
          <>
            {TYPES.find((t) => t.value === v.type)?.label} · {v.capacity} {v.capacityUnit} · {fmtMoney(v.baseFare)} + {fmtMoney(v.perKm)}/km
            {v.available ? '' : ' · unavailable'}
          </>
        )}
        render={(v, set) => (
          <>
            <TextField label="Name" value={v.name} maxLength={100} onChange={(x) => set({ name: x })} />
            <SelectField label="Type" value={v.type} options={TYPES} onChange={(x) => set({ type: x })} />
            <NumField label="Capacity" value={v.capacity} min={0} step={0.5} onChange={(x) => set({ capacity: x ?? 0 })} />
            <SelectField label="Capacity unit" value={v.capacityUnit} options={UNITS} onChange={(x) => set({ capacityUnit: x })} />
            <NumField label="Base fare (call-out / loading)" suffix="LKR" min={0} step={100} value={v.baseFare} onChange={(x) => set({ baseFare: x ?? 0 })} />
            <NumField label="Per km (loaded)" suffix="LKR" min={0} step={5} value={v.perKm} onChange={(x) => set({ perKm: x ?? 0 })} />
            <NumField
              label="Day hire"
              suffix="LKR"
              optional
              min={0}
              step={500}
              hint="Optional — leave blank if not offered"
              value={v.perDay}
              onChange={(x) => set({ perDay: x })}
            />
            <TextField
              label="Image URL"
              type="url"
              placeholder="https://…"
              value={v.imageUrl}
              onChange={(x) => set({ imageUrl: x.trim() || undefined })}
            />
            <TagInput
              label="Features"
              value={v.features}
              suggestions={allFeatures}
              placeholder="e.g. Hydraulic tipping"
              onChange={(x) => set({ features: x })}
            />
            <div className="span-2">
              <Toggle
                checked={v.available}
                onChange={(x) => set({ available: x })}
                label="Available for booking"
                desc="Unavailable vehicles stay listed but can’t be booked."
              />
            </div>
            <div className="span-2 muted tiny mono">id: {v.id}</div>
          </>
        )}
      />
    </Section>
  );
}
