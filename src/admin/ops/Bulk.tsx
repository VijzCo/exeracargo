// "Multi jobs at once": assign a trip, duplicate ×N, bulk cancel, CSV import.
import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { findPlace, findPlaceByName, isValidPhone, normalisePhone } from '../../geo';
import { advanceJob, assignTrip, createJob, saveFinance, type NewJob } from '../../ops/store';
import type { Job, JobFinance, JobStop, Priority, StopKind } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { downloadText, errMsg, Field, Modal, useUi } from '../ui';
import { useDrivers, useOpsUser, useToday, useVehicles } from './hooks';
import { addDays, CLOSED, csv, forAdvance } from './lib';
import { AssignFields, useAssignBlockers } from './widgets';

// ── assign several jobs as one trip ─────────────────────────

export function TripModal({ jobs, all, onClose, onDone }: { jobs: Job[] | null; all: Job[]; onClose: () => void; onDone: () => void }) {
  const { tenant } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast } = useUi();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const [order, setOrder] = useState<Job[]>([]);
  const [sel, setSel] = useState({ vehicleId: '', driverId: '' });
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState('');
  const key = jobs?.map((j) => j.id).join(',') ?? '';
  if (key !== lastKey) {
    setLastKey(key);
    setOrder(jobs ? [...jobs].sort((a, b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`)) : []);
    setSel({ vehicleId: '', driverId: '' });
  }
  const vehicle = vehicles.find((v) => v.id === sel.vehicleId);
  const driver = drivers.find((d) => d.id === sel.driverId);
  const blockers = useAssignBlockers(vehicle, driver, order[0]?.scheduledDate ?? today);
  if (!jobs) return <Modal open={false} onClose={onClose} title="" />;
  const bad = order.find((j) => CLOSED.includes(j.status) || !['draft', 'assigned', 'accepted'].includes(j.status));
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const n = [...o];
      const k = i + d;
      if (k < 0 || k >= n.length) return o;
      [n[i], n[k]] = [n[k], n[i]];
      return n;
    });
  // ignore clashes between the jobs of this trip
  const others = all.filter((j) => !order.some((o) => o.id === j.id));

  const save = async () => {
    if (!vehicle || !driver) return;
    setBusy(true);
    try {
      await assignTrip(tenant.id, order, { vehicle, driver }, user);
      toast(`${order.length} job${order.length === 1 ? '' : 's'} assigned to ${driver.name} · ${vehicle.registration}`);
      onDone();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign ${order.length} job${order.length === 1 ? '' : 's'} as one trip`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !vehicle || !driver || !!bad || blockers.length > 0} onClick={() => void save()}>
            {busy ? 'Assigning…' : 'Assign trip & notify driver'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted small">The driver sees the jobs in this order and gets one message with the list.</p>
        {bad ? <div className="alert alert-err small">{bad.ref} is already under way or closed — remove it from the selection.</div> : null}
        <ol className="ops-triporder">
          {order.map((j, i) => (
            <li key={j.id}>
              <span className="mono small">{j.ref}</span>
              <span className="small ops-ellip">
                {j.scheduledDate} {j.scheduledTime} · {j.pickup.place} → {j.dropoff.place}
              </span>
              <span className="ops-stop-tools">
                <button type="button" className="icon-btn" aria-label={`Move ${j.ref} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <Icon name="arrow" size={14} className="ops-rot-up" />
                </button>
                <button type="button" className="icon-btn" aria-label={`Move ${j.ref} down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                  <Icon name="arrow" size={14} className="ops-rot-down" />
                </button>
              </span>
            </li>
          ))}
        </ol>
        <AssignFields job={{ id: '__trip__', scheduledDate: order[0]?.scheduledDate ?? today }} jobs={others} vehicles={vehicles} drivers={drivers} vehicleId={sel.vehicleId} driverId={sel.driverId} onChange={setSel} today={today} />
      </div>
    </Modal>
  );
}

// ── duplicate ×N ────────────────────────────────────────────

function copyOf(j: Job, date: string): NewJob {
  const { id: _i, ref: _r, bookingRef: _b, status: _s, createdAt: _c, updatedAt: _u, createdBy: _cb, lastEventAt: _l, vehicleId: _v, vehicleReg: _vr, driverId: _d, driverName: _dn, odoStart: _o1, odoEnd: _o2, actualKm: _a, inspection: _in, pod: _p, failReason: _f, tripId: _t, tripSeq: _ts, extLink: _e, ownership: _ow, transporterId: _ti, transporterName: _tn, ...rest } = j;
  void [_i, _r, _b, _s, _c, _u, _cb, _l, _v, _vr, _d, _dn, _o1, _o2, _a, _in, _p, _f, _t, _ts, _e, _ow, _ti, _tn];
  return {
    ...rest,
    scheduledDate: date,
    stops: j.stops?.map((s) => ({ ...s, status: 'pending', arrivedAt: undefined, doneAt: undefined, photoIds: undefined, pod: undefined, note: undefined, failReason: undefined })),
  };
}

export function DuplicateModal({ jobs, finance, onClose }: { jobs: Job[] | null; finance: Map<string, JobFinance>; onClose: () => void }) {
  const { tenant } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const { toast } = useUi();
  const [n, setN] = useState(1);
  const [start, setStart] = useState(addDays(today, 1));
  const [step, setStep] = useState<0 | 1 | 7>(1);
  const [weekdays, setWeekdays] = useState(true);
  const [busy, setBusy] = useState(false);
  const dates = useMemo(() => {
    const out: string[] = [];
    let d = start;
    let guard = 0;
    while (out.length < n && guard++ < 400) {
      const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
      if (step !== 1 || !weekdays || (dow !== 0 && dow !== 6)) out.push(d);
      d = step === 0 ? d : addDays(d, step);
      if (step === 0 && out.length >= n) break;
    }
    return out;
  }, [n, start, step, weekdays]);
  if (!jobs) return <Modal open={false} onClose={onClose} title="" />;
  const total = jobs.length * dates.length;

  const run = async () => {
    setBusy(true);
    let made = 0;
    try {
      for (const j of jobs) {
        const price = finance.get(j.id)?.price ?? j.price;
        for (const d of dates) {
          const c = await createJob(tenant.id, { ...copyOf(j, d), price }, user);
          const cost = finance.get(j.id)?.cost;
          if (cost) await saveFinance(tenant.id, c.id, { cost, currency: c.currency });
          made++;
        }
      }
      toast(`${made} job${made === 1 ? '' : 's'} created as drafts`);
      onClose();
    } catch (e) {
      toast(`${made} created, then: ${errMsg(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Duplicate ${jobs.length > 1 ? `${jobs.length} jobs` : jobs[0].ref}`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || total === 0 || total > 200} onClick={() => void run()}>
            {busy ? 'Creating…' : `Create ${total} job${total === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted small">Copies customer, route (all stops), cargo, price and buy cost. New jobs are drafts — assign them from the board.</p>
        <div className="form-grid">
          <Field label="Copies per job">
            <input className="input" type="number" min={1} max={60} value={n} onChange={(e) => setN(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} data-autofocus />
          </Field>
          <Field label="First date">
            <input className="input" type="date" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
          </Field>
          <Field label="Repeat">
            <select className="select" value={step} onChange={(e) => setStep(Number(e.target.value) as 0 | 1 | 7)}>
              <option value={0}>Same day (several loads)</option>
              <option value={1}>Daily</option>
              <option value={7}>Weekly</option>
            </select>
          </Field>
          {step === 1 ? (
            <label className="row small" style={{ gap: 8, alignSelf: 'end' }}>
              <input type="checkbox" checked={weekdays} onChange={(e) => setWeekdays(e.target.checked)} /> Weekdays only
            </label>
          ) : null}
        </div>
        <p className="small">
          Dates: <span className="mono">{dates.slice(0, 8).join(', ')}{dates.length > 8 ? ` … (+${dates.length - 8})` : ''}</span>
        </p>
        {total > 200 ? <div className="alert alert-warn small">Max 200 jobs at once.</div> : null}
      </div>
    </Modal>
  );
}

// ── bulk cancel ─────────────────────────────────────────────

export function CancelModal({ jobs, onClose, onDone }: { jobs: Job[] | null; onClose: () => void; onDone: () => void }) {
  const { tenant } = useTenant();
  const user = useOpsUser();
  const { toast } = useUi();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  if (!jobs) return <Modal open={false} onClose={onClose} title="" />;
  const ok = jobs.filter((j) => !CLOSED.includes(j.status));
  const run = async () => {
    setBusy(true);
    let n = 0;
    try {
      for (const j of ok) {
        await advanceJob(tenant.id, forAdvance(j), 'cancelled', user, { note: `Cancelled by dispatch: ${reason.trim()}` });
        n++;
      }
      toast(`${n} job${n === 1 ? '' : 's'} cancelled`);
      onDone();
      onClose();
    } catch (e) {
      toast(`${n} cancelled, then: ${errMsg(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={`Cancel ${ok.length} job${ok.length === 1 ? '' : 's'}?`}
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Keep
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy || reason.trim().length < 3 || !ok.length} onClick={() => void run()}>
            {busy ? 'Cancelling…' : 'Cancel jobs'}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="small mono">{ok.map((j) => j.ref).join(', ') || 'All selected jobs are already closed.'}</p>
        <label className="field">
          <span className="label">Reason *</span>
          <textarea className="textarea" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} data-autofocus />
        </label>
      </div>
    </Modal>
  );
}

// ── CSV import ──────────────────────────────────────────────

/** RFC 4180-ish parser (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export const IMPORT_COLS = ['job', 'date', 'time', 'customer_name', 'customer_phone', 'customer_company', 'cargo', 'kind', 'priority', 'price', 'instructions', 'stop_type', 'town', 'address', 'contact', 'contact_phone', 'stop_cargo', 'reference', 'window'] as const;

interface Parsed {
  key: string;
  job?: NewJob;
  errors: string[];
}

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tenant, country } = useTenant();
  const user = useOpsUser();
  const { toast } = useUi();
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [fileErr, setFileErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return <Modal open={false} onClose={onClose} title="" />;

  const template = () => {
    const za = country.code === 'ZA';
    const rows: (string | number)[][] = [
      [...IMPORT_COLS],
      ['A1', addDays(new Date().toISOString().slice(0, 10), 1), '07:30', 'Maluti Retail', za ? '0821234567' : '0771234567', 'Maluti Retail (Pty) Ltd', '8 pallets boxed stock', 'freight', 'normal', 6900, 'Call 30 min before', 'pickup', za ? 'Bloemfontein' : 'Colombo', 'Hamilton Industrial', 'Warehouse', '', '8 pallets', 'PO-1001', '07:00–08:00'],
      ['A1', '', '', '', '', '', '', '', '', '', '', 'delivery', za ? 'Ladybrand' : 'Kandy', 'Main Rd store', 'Store manager', '', '3 pallets', 'DN-552', ''],
      ['A1', '', '', '', '', '', '', '', '', '', '', 'delivery', za ? 'Maseru' : 'Kurunegala', 'Thetsane Industrial', '', '', '5 pallets', 'DN-553', ''],
      ['B7', addDays(new Date().toISOString().slice(0, 10), 1), '09:00', 'Mokoena Builders', za ? '0831234567' : '0712345678', '', '10 m³ building sand', 'vehicle', 'high', 2544, '', 'pickup', za ? 'Midrand' : 'Kadawatha', 'Quarry yard', '', '', '', '', ''],
      ['B7', '', '', '', '', '', '', '', '', '', '', 'delivery', za ? 'Sandton' : 'Gampaha', '14 Rivonia Rd', 'Site manager', '', '', '', ''],
    ];
    downloadText(`${tenant.id}-jobs-import-template.csv`, csv(rows), 'text/csv');
  };

  const onFile = async (file: File | undefined) => {
    setFileErr('');
    setParsed(null);
    if (!file) return;
    if (file.size > 2_000_000) return setFileErr('File is larger than 2 MB.');
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return setFileErr('No data rows found.');
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const missing = ['job', 'stop_type', 'town'].filter((c) => !head.includes(c));
    if (missing.length) return setFileErr(`Missing column(s): ${missing.join(', ')}. Download the template.`);
    const col = (r: string[], c: (typeof IMPORT_COLS)[number]) => (head.indexOf(c) >= 0 ? (r[head.indexOf(c)] ?? '').trim() : '');
    const groups = new Map<string, string[][]>();
    for (const r of rows.slice(1)) {
      const k = col(r, 'job') || `row${groups.size + 1}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    if (groups.size > 200) return setFileErr('Max 200 jobs per file.');
    const out: Parsed[] = [];
    for (const [key, rs] of groups) {
      const errors: string[] = [];
      const h = rs[0];
      const name = col(h, 'customer_name');
      const phone = col(h, 'customer_phone');
      const date = col(h, 'date');
      const time = col(h, 'time') || '08:00';
      const cargo = col(h, 'cargo');
      const kind = (col(h, 'kind') || 'vehicle').toLowerCase();
      const pr = (col(h, 'priority') || 'normal').toLowerCase();
      const price = col(h, 'price').replace(/[^\d.]/g, '');
      if (!name) errors.push('customer_name missing');
      if (!phone || !isValidPhone(phone, country.code, true)) errors.push('customer_phone invalid');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('date must be yyyy-mm-dd');
      if (!/^\d{1,2}:\d{2}$/.test(time)) errors.push('time must be HH:mm');
      if (!cargo) errors.push('cargo missing');
      if (!['vehicle', 'freight'].includes(kind)) errors.push('kind must be vehicle or freight');
      if (!['normal', 'high', 'urgent'].includes(pr)) errors.push('priority must be normal, high or urgent');
      const stops: JobStop[] = rs.map((r, i) => {
        const type = col(r, 'stop_type').toLowerCase();
        const town = col(r, 'town');
        const p = findPlaceByName(country.code, town) ?? findPlace(town);
        if (type !== 'pickup' && type !== 'delivery') errors.push(`row ${i + 1}: stop_type must be pickup or delivery`);
        if (!p) errors.push(`row ${i + 1}: town “${town}” not found`);
        const cp = col(r, 'contact_phone');
        if (cp && !isValidPhone(cp, country.code, true)) errors.push(`row ${i + 1}: contact_phone invalid`);
        return {
          id: `s${i}`,
          kind: (type === 'delivery' ? 'delivery' : 'pickup') as StopKind,
          seq: i,
          placeId: p?.id ?? '',
          place: p?.name ?? town,
          region: p?.region ?? '',
          address: col(r, 'address'),
          contact: col(r, 'contact') || undefined,
          phone: cp ? normalisePhone(cp, country.code) : undefined,
          lat: p?.lat,
          lng: p?.lng,
          cargo: col(r, 'stop_cargo') || undefined,
          reference: col(r, 'reference') || undefined,
          window: col(r, 'window') || undefined,
          status: 'pending',
        };
      });
      if (stops[0]?.kind !== 'pickup') errors.push('first stop must be a pickup');
      if (stops[stops.length - 1]?.kind !== 'delivery') errors.push('last stop must be a delivery');
      const end = (s: JobStop): Job['pickup'] => ({ placeId: s.placeId, place: s.place, region: s.region, address: s.address, contact: s.contact, phone: s.phone, lat: s.lat, lng: s.lng });
      const job: NewJob | undefined = errors.length
        ? undefined
        : {
            kind: kind as Job['kind'],
            title: `${cargo.split(/[.(\n]/)[0].slice(0, 60)} · ${stops[0].place} → ${stops[stops.length - 1].place}${stops.length > 2 ? ` (${stops.length} stops)` : ''}`,
            customer: { name, phone: normalisePhone(phone, country.code), company: col(h, 'customer_company') || undefined },
            pickup: end(stops[0]),
            dropoff: end(stops[stops.length - 1]),
            stops: stops.length > 2 ? stops : undefined,
            cargo,
            instructions: col(h, 'instructions') || undefined,
            scheduledDate: date,
            scheduledTime: time.padStart(5, '0'),
            priority: pr as Priority,
            price: price ? Math.round(Number(price) * 100) / 100 : undefined,
            currency: tenant.locale.currency,
          };
      out.push({ key, job, errors: [...new Set(errors)] });
    }
    setParsed(out);
  };

  const good = parsed?.filter((p) => p.job) ?? [];
  const run = async () => {
    setBusy(true);
    let n = 0;
    try {
      for (const p of good) {
        await createJob(tenant.id, p.job!, user);
        n++;
      }
      toast(`${n} job${n === 1 ? '' : 's'} imported as drafts`);
      setParsed(null);
      onClose();
    } catch (e) {
      toast(`${n} imported, then: ${errMsg(e)}`, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Import jobs from CSV"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={template} style={{ marginRight: 'auto' }}>
            <Icon name="download" size={16} /> Template
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !good.length} onClick={() => void run()}>
            {busy ? 'Importing…' : `Import ${good.length} job${good.length === 1 ? '' : 's'}`}
          </button>
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted small">
          One row per stop. Rows with the same <span className="mono">job</span> value become one job (first row = first stop; job details are read from the first row). Towns must match the place list. Jobs are imported as drafts.
        </p>
        <input className="input" type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => void onFile(e.target.files?.[0])} />
        {fileErr ? <div className="alert alert-err small">{fileErr}</div> : null}
        {parsed ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Date</th>
                  <th>Route</th>
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.key}>
                    <td className="mono small">{p.key}</td>
                    <td className="small">{p.job?.scheduledDate ?? '—'}</td>
                    <td className="small">{p.job ? `${p.job.pickup.place} → ${p.job.dropoff.place}${p.job.stops ? ` · ${p.job.stops.length} stops` : ''}` : '—'}</td>
                    <td className="small">{p.errors.length ? <span className="ops-text-err">{p.errors.join('; ')}</span> : <span className="ops-chip ops-lvl-ok">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

