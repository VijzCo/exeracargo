import { Icon } from '../../components/Icon';
import type { BookingSettings } from '../../tenant/types';
import { AreaField, NumField, Section, StringListEditor, TagInput, Toggle, useUi } from '../ui';
import type { TabProps } from './draft';

type Windows = BookingSettings['restrictedWindows'];

export default function BookingTab({ draft, update }: TabProps) {
  const b = draft.booking;
  const { confirm } = useUi();
  const set = (patch: Partial<BookingSettings>) => update((d) => ({ ...d, booking: { ...d.booking, ...patch } }));
  const rw: Windows = b.restrictedWindows ?? { loadTypes: [], weekdaysOnly: true, windows: [] };
  const setRw = (patch: Partial<Windows>) => set({ restrictedWindows: { ...rw, ...patch } });
  const setWin = (i: number, j: 0 | 1, v: string) =>
    setRw({ windows: rw.windows.map((w, k) => (k === i ? (j === 0 ? { ...w, start: v } : { ...w, end: v }) : w)) });

  return (
    <>
      <Section title="Online booking">
        <div className="stack">
          <Toggle
            checked={b.enabled}
            onChange={(v) => set({ enabled: v })}
            label="Accept online bookings"
            desc="When off, the booking page shows call / WhatsApp buttons instead of the form."
          />
          <Toggle
            checked={b.whatsappConfirm}
            onChange={(v) => set({ whatsappConfirm: v })}
            label="WhatsApp confirmation"
            desc="After booking, offer “Send to WhatsApp” with the booking summary."
          />
          <Toggle
            checked={b.roundTrip}
            onChange={(v) => set({ roundTrip: v })}
            label="Charge empty return leg"
            desc="Adds the return distance at 50% of the per-km rate."
          />
        </div>
      </Section>

      <Section title="Pricing & rules">
        <div className="form-grid">
          <NumField label="Minimum notice" suffix="hours" min={0} value={b.minNoticeHours} onChange={(v) => set({ minNoticeHours: Math.max(0, v ?? 0) })} />
          <NumField label="Tax (VAT)" suffix="%" min={0} max={50} step={0.5} hint="0 disables tax on quotes" value={b.taxPct} onChange={(v) => set({ taxPct: Math.max(0, v ?? 0) })} />
          <NumField
            label="Fuel surcharge"
            suffix="%"
            min={0}
            max={40}
            step={0.1}
            hint="Applied to distance charges. Update monthly when diesel changes (SA: first Wednesday of the month)."
            value={b.fuelSurchargePct ?? 0}
            onChange={(v) => set({ fuelSurchargePct: Math.max(0, v ?? 0) })}
          />
          <NumField label="Deposit" suffix="%" min={0} max={100} hint="Informational — shown to the customer" value={b.depositPct} onChange={(v) => set({ depositPct: Math.min(100, Math.max(0, v ?? 0)) })} />
          <AreaField label="Payment note" rows={2} placeholder="Cash or bank transfer on delivery…" value={b.paymentNote} onChange={(v) => set({ paymentNote: v })} />
          <TagInput
            label="Load types"
            value={b.loadTypes}
            normalize={(x: string) => x.slice(0, 60)}
            onChange={(v) => set({ loadTypes: v })}
            placeholder="e.g. River sand"
            hint="Options in the booking form’s “What are you moving?” field"
          />
        </div>
      </Section>

      <Section title="Notices" desc="Shown on the booking page (e.g. fuel price clause, school-hour restrictions).">
        <StringListEditor items={b.notices} onChange={(v) => set({ notices: v })} itemLabel="notice" placeholder="Notice text" />
      </Section>

      <Section
        title="Restricted time windows"
        desc="Block pickup times for certain load types — e.g. heavy tippers during school hours."
      >
        <div className="form-grid">
          <TagInput
            label="Applies to load types"
            value={rw.loadTypes}
            suggestions={b.loadTypes}
            onChange={(v) => setRw({ loadTypes: v })}
            hint="Leave empty to disable restrictions"
          />
          <div className="span-2">
            <Toggle checked={rw.weekdaysOnly} onChange={(v) => setRw({ weekdaysOnly: v })} label="Weekdays only" desc="Restrictions don’t apply on Saturday/Sunday" />
          </div>
          <div className="span-2 stack" style={{ gap: 8 }}>
            <span className="label">Blocked windows</span>
            {rw.windows.length === 0 ? <span className="muted small">No windows — all times allowed.</span> : null}
            {rw.windows.map((w, i) => {
              const bad = w.start && w.end && w.start >= w.end;
              return (
                <div key={i} className="adm-window">
                  <input className="input" type="time" aria-label={`Window ${i + 1} start`} value={w.start} onChange={(e) => setWin(i, 0, e.target.value)} />
                  <span className="muted">to</span>
                  <input
                    className="input"
                    type="time"
                    aria-label={`Window ${i + 1} end`}
                    aria-invalid={bad || undefined}
                    value={w.end}
                    onChange={(e) => setWin(i, 1, e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn adm-danger-btn"
                    aria-label={`Remove window ${i + 1}`}
                    onClick={async () => {
                      if (await confirm({ title: 'Remove this time window?', confirmLabel: 'Remove', danger: true }))
                        setRw({ windows: rw.windows.filter((_, k) => k !== i) });
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                  {bad ? <span className="field-error">End must be after start</span> : null}
                </div>
              );
            })}
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRw({ windows: [...rw.windows, { start: '07:00', end: '08:30' }] })}>
                <Icon name="plus" size={16} /> Add window
              </button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
