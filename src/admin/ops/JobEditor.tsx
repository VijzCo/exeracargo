// Create / edit a job. Supports any number of pickups and deliveries (multi-stop), the sell price
// (stored in finance/{jobId}, never on the job drivers can read) and the buy cost of hired jobs.
// New jobs can be pre-filled from a website booking (location.state.draft) or duplicated (?from=<id>).
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import PlacePicker from '../../components/PlacePicker';
import { estimateRoadKm, findPlace, isValidPhone, normalisePhone } from '../../geo';
import { assignJob, createJob, newId, saveFinance, updateJob, watchJob, watchJobFinance, type NewJob } from '../../ops/store';
import type { BuyCost, Job, JobFinance, JobStop, Priority, StopKind } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { AreaField, errMsg, Field, PageHeader, Section, Spinner, useUi } from '../ui';
import { CostPanel, costDraftError, costFromDraft, draftFromCost, withRateLine, type CostDraft } from './CostPanel';
import { useDrivers, useJobs, useOpsUser, useToday, useTransporters, useVehicles } from './hooks';
import { assignBlockers, suggestTitle } from './lib';
import { AssignFields } from './widgets';
import './ops-admin.css';

interface StopForm {
  key: string; // stable React key / stop id
  kind: StopKind;
  placeId: string;
  address: string;
  contact: string;
  phone: string;
  cargo: string;
  reference: string;
  window: string;
  instructions: string;
  /** Existing stop (keeps driver progress, POD, photos when editing). */
  orig?: JobStop;
}
interface Form {
  ref: string;
  bookingRef: string;
  kind: Job['kind'];
  title: string;
  titleTouched: boolean;
  customerName: string;
  customerPhone: string;
  customerCompany: string;
  stops: StopForm[];
  /** The job was saved with a `stops` list (keep saving it even if back to 2 stops). */
  hadStops: boolean;
  cargo: string;
  instructions: string;
  date: string;
  time: string;
  priority: Priority;
  price: string;
  estimatedKm: string;
  kmTouched: boolean;
  vehicleId: string;
  driverId: string;
  cost: CostDraft;
}

const blankStop = (kind: StopKind): StopForm => ({ key: newId(), kind, placeId: '', address: '', contact: '', phone: '', cargo: '', reference: '', window: '', instructions: '' });

function stopsFrom(j: Partial<Job>, keepOrig: boolean): StopForm[] {
  if (j.stops?.length)
    return [...j.stops]
      .sort((a, b) => a.seq - b.seq)
      .map((s) => ({
        key: keepOrig ? s.id : newId(),
        kind: s.kind,
        placeId: s.placeId,
        address: s.address ?? '',
        contact: s.contact ?? '',
        phone: s.phone ?? '',
        cargo: s.cargo ?? '',
        reference: s.reference ?? '',
        window: s.window ?? '',
        instructions: s.instructions ?? '',
        orig: keepOrig ? s : undefined,
      }));
  const one = (kind: StopKind, s?: Partial<Job['pickup']>): StopForm => ({ ...blankStop(kind), placeId: s?.placeId ?? '', address: s?.address ?? '', contact: s?.contact ?? '', phone: s?.phone ?? '' });
  return [one('pickup', j.pickup), one('delivery', j.dropoff)];
}

function fromJob(j: Partial<Job> & Partial<NewJob>, today: string, fin: JobFinance | null, keepOrig: boolean): Form {
  return {
    ref: j.ref ?? '',
    bookingRef: j.bookingRef ?? '',
    kind: j.kind ?? 'vehicle',
    title: j.title ?? '',
    titleTouched: !!j.title,
    customerName: j.customer?.name ?? '',
    customerPhone: j.customer?.phone ?? '',
    customerCompany: j.customer?.company ?? '',
    stops: stopsFrom(j, keepOrig),
    hadStops: keepOrig && !!j.stops?.length,
    cargo: j.cargo ?? '',
    instructions: j.instructions ?? '',
    date: j.scheduledDate ?? today,
    time: j.scheduledTime ?? '08:00',
    priority: j.priority ?? 'normal',
    price: (fin?.price ?? j.price) !== undefined ? String(fin?.price ?? j.price) : '',
    estimatedKm: j.estimatedKm !== undefined ? String(j.estimatedKm) : '',
    kmTouched: j.estimatedKm !== undefined,
    vehicleId: j.vehicleId ?? '',
    driverId: j.driverId && !j.driverId.startsWith('link:') ? j.driverId : '',
    cost: draftFromCost(fin?.cost, j.ownership === 'hired' ? j.transporterId : undefined),
  };
}

export default function JobEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const loc = useLocation();
  const { tenant } = useTenant();
  const { today } = useToday();
  const editing = !!id;
  const dupFrom = params.get('from');
  const srcId = id ?? dupFrom ?? '';
  const draft = (loc.state as { draft?: Partial<NewJob> } | null)?.draft;
  const [src, setSrc] = useState<Job | null | undefined>(srcId ? undefined : null);
  const [fin, setFin] = useState<JobFinance | null | undefined>(srcId ? undefined : null);

  useEffect(() => {
    if (!srcId) return;
    return watchJob(tenant.id, srcId, (j) => setSrc((prev) => (prev === undefined || !editing ? j : prev)));
  }, [tenant.id, srcId, editing]);
  useEffect(() => {
    if (!srcId) return;
    return watchJobFinance(tenant.id, srcId, (f) => setFin((prev) => (prev === undefined ? f : prev)));
  }, [tenant.id, srcId]);

  if (src === undefined || fin === undefined) {
    return (
      <div className="adm-center adm-center-inline">
        <Spinner />
      </div>
    );
  }
  if (srcId && !src) {
    return (
      <div className="stack adm-page">
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Job {srcId} was not found. <Link to="/admin/dispatch" className="adm-link">Back to dispatch</Link>
        </div>
      </div>
    );
  }
  let initial: Form;
  if (editing && src) initial = fromJob(src, today, fin, true);
  else if (src) {
    // duplicate: same customer/route/cargo/price, fresh ref + date, no assignment, no progress
    const { ref: _r, bookingRef: _b, vehicleId: _v, driverId: _d, tripId: _t, extLink: _e, ...rest } = src;
    void _r;
    void _b;
    void _v;
    void _d;
    void _t;
    void _e;
    initial = fromJob({ ...rest, scheduledDate: today }, today, fin ? { ...fin, settlementId: undefined } : null, false);
  } else initial = fromJob(draft ?? {}, today, draft?.price !== undefined ? { id: '', price: draft.price, currency: tenant.locale.currency, updatedAt: 0 } : null, false);

  return <EditorForm key={`${srcId}-${editing}`} initial={initial} job={editing ? src ?? null : null} fin={editing ? fin : null} fromBooking={!!draft?.bookingRef} />;
}

function EditorForm({ initial, job, fin, fromBooking }: { initial: Form; job: Job | null; fin: JobFinance | null; fromBooking: boolean }) {
  const { tenant, country } = useTenant();
  const { today } = useToday();
  const user = useOpsUser();
  const nav = useNavigate();
  const { toast } = useUi();
  const { data: jobs } = useJobs();
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { data: transporters } = useTransporters();
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const cc = tenant.logistics?.crossBorder?.enabled ? tenant.logistics.crossBorder.countries : undefined;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setStop = (i: number, patch: Partial<StopForm>) => setF((p) => ({ ...p, stops: p.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) =>
    setF((p) => {
      const n = [...p.stops];
      const k = i + d;
      if (k < 0 || k >= n.length) return p;
      [n[i], n[k]] = [n[k], n[i]];
      return { ...p, stops: n };
    });
  const removeStop = (i: number) => setF((p) => ({ ...p, stops: p.stops.filter((_, j) => j !== i) }));
  const addStop = (kind: StopKind) => setF((p) => ({ ...p, stops: [...p.stops, blankStop(kind)] }));

  const multi = f.stops.length > 2 || f.hadStops;
  const firstPick = f.stops.find((s) => s.kind === 'pickup');
  const lastDrop = [...f.stops].reverse().find((s) => s.kind === 'delivery');
  const pFrom = findPlace(firstPick?.placeId);
  const pTo = findPlace(lastDrop?.placeId);
  const autoTitle = suggestTitle(f.cargo, pFrom?.name, pTo?.name) + (f.stops.length > 2 ? ` (${f.stops.length} stops)` : '');
  const autoKm = useMemo(() => {
    let sum = 0;
    for (let i = 1; i < f.stops.length; i++) {
      const k = estimateRoadKm(country.code, f.stops[i - 1].placeId, f.stops[i].placeId);
      if (k === null) return null;
      sum += k;
    }
    return f.stops.length >= 2 ? sum : null;
  }, [f.stops, country.code]);

  useEffect(() => {
    if (!f.titleTouched) setF((p) => (p.title === autoTitle ? p : { ...p, title: autoTitle }));
  }, [autoTitle, f.titleTouched]);
  useEffect(() => {
    if (!f.kmTouched && autoKm !== null) setF((p) => (p.estimatedKm === String(autoKm) ? p : { ...p, estimatedKm: String(autoKm) }));
  }, [autoKm, f.kmTouched]);

  const vehicle = vehicles.find((v) => v.id === f.vehicleId);
  const driver = drivers.find((d) => d.id === f.driverId);
  // a hired truck/driver switches the cost panel on with its transporter
  const hiredFrom = vehicle?.ownership === 'hired' ? vehicle : driver?.ownership === 'hired' ? driver : undefined;
  useEffect(() => {
    if (!hiredFrom?.transporterId || fin?.settlementId) return;
    const t = transporters.find((x) => x.id === hiredFrom.transporterId);
    setF((p) => {
      // only pre-fill when no cost has been entered yet (never overwrite a typed rate)
      if (p.cost.enabled && Number(p.cost.rate) > 0) return p;
      if (!t) return { ...p, cost: { ...p.cost, enabled: true, transporterId: hiredFrom.transporterId! } };
      const km = { actualKm: job?.actualKm, estimatedKm: p.estimatedKm ? Number(p.estimatedKm) : undefined };
      return { ...p, cost: withRateLine(p.cost, t, km, vehicle?.type) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiredFrom?.transporterId, transporters.length]);
  const blockers = assignBlockers(vehicle, driver, transporters, f.date || today);
  const settled = fin?.settlementId ? `On settlement statement — the cost is locked. Remove the job from the statement to change it.` : undefined;

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!f.customerName.trim()) e.customerName = 'Customer name is required.';
    if (!f.customerPhone.trim()) e.customerPhone = 'Phone is required.';
    else if (!isValidPhone(f.customerPhone, country.code, true)) e.customerPhone = `Enter a valid number, e.g. ${country.phonePlaceholder}.`;
    if (!f.stops.some((s) => s.kind === 'pickup')) e.stops = 'Add at least one pickup.';
    else if (!f.stops.some((s) => s.kind === 'delivery')) e.stops = 'Add at least one delivery.';
    else if (f.stops[0].kind !== 'pickup') e.stops = 'The first stop must be a pickup.';
    else if (f.stops[f.stops.length - 1].kind !== 'delivery') e.stops = 'The last stop must be a delivery.';
    f.stops.forEach((s, i) => {
      if (!s.placeId) e[`stop${i}`] = `Choose the ${s.kind === 'pickup' ? 'pickup' : 'delivery'} town.`;
      if (s.phone && !isValidPhone(s.phone, country.code, true)) e[`stop${i}Phone`] = 'Invalid phone number.';
    });
    if (!f.cargo.trim()) e.cargo = 'Describe the cargo.';
    if (!f.title.trim()) e.title = 'Title is required.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Pick a date.';
    if (!/^\d{2}:\d{2}$/.test(f.time)) e.time = 'Pick a time.';
    if (f.price && (Number.isNaN(Number(f.price)) || Number(f.price) < 0)) e.price = 'Invalid amount.';
    if (f.estimatedKm && (Number.isNaN(Number(f.estimatedKm)) || Number(f.estimatedKm) < 0)) e.estimatedKm = 'Invalid distance.';
    if (f.ref && !/^[A-Za-z0-9-]{3,40}$/.test(f.ref)) e.ref = 'Letters, digits and dashes only.';
    if (!settled) {
      const ce = costDraftError(f.cost);
      if (ce) e.cost = ce;
    }
    return e;
  };
  const liveErrors = submitted ? validate() : errors;

  const toStop = (s: StopForm, i: number): JobStop => {
    const p = findPlace(s.placeId);
    const o = s.orig;
    return {
      ...(o ?? {}),
      id: o?.id ?? s.key,
      kind: s.kind,
      seq: i,
      placeId: s.placeId,
      place: p?.name ?? o?.place ?? '',
      region: p?.region ?? o?.region ?? '',
      address: s.address.trim(),
      contact: s.contact.trim() || undefined,
      phone: s.phone.trim() ? normalisePhone(s.phone, country.code) : undefined,
      lat: p?.lat,
      lng: p?.lng,
      cargo: s.cargo.trim() || undefined,
      reference: s.reference.trim() || undefined,
      window: s.window.trim() || undefined,
      instructions: s.instructions.trim() || undefined,
      status: o?.status ?? 'pending',
    };
  };

  const save = async () => {
    setSubmitted(true);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      toast(e.cost ? `Buy cost: ${e.cost}` : 'Please fix the highlighted fields', 'err');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (blockers.length && (vehicle || driver)) return toast(blockers[0], 'err');
    const stops = f.stops.map(toStop);
    const end = (s: JobStop): Job['pickup'] => ({ placeId: s.placeId, place: s.place, region: s.region, address: s.address, contact: s.contact, phone: s.phone, lat: s.lat, lng: s.lng });
    const data: Omit<NewJob, 'status'> = {
      kind: f.kind,
      title: f.title.trim(),
      customer: { name: f.customerName.trim(), phone: normalisePhone(f.customerPhone, country.code), company: f.customerCompany.trim() || undefined },
      pickup: end(stops[0]),
      dropoff: end(stops[stops.length - 1]),
      ...(multi ? { stops } : {}),
      cargo: f.cargo.trim(),
      instructions: f.instructions.trim() || undefined,
      scheduledDate: f.date,
      scheduledTime: f.time,
      priority: f.priority,
      price: f.price ? Math.round(Number(f.price) * 100) / 100 : undefined,
      currency: tenant.locale.currency,
      estimatedKm: f.estimatedKm ? Math.round(Number(f.estimatedKm)) : undefined,
    };
    const km = { actualKm: job?.actualKm, estimatedKm: data.estimatedKm };
    const cost: BuyCost | undefined = settled ? fin?.cost : costFromDraft(f.cost, transporters, km);
    setBusy(true);
    try {
      let jobId: string;
      if (job) {
        await updateJob(tenant.id, job.id, data, user, 'Job details edited');
        const changed = (f.vehicleId || '') !== (job.vehicleId ?? '') || (f.driverId || '') !== (job.driverId ?? '');
        if (changed && (vehicle || driver)) await assignJob(tenant.id, { ...job, ...data }, { vehicle, driver }, user);
        jobId = job.id;
      } else {
        const created = await createJob(tenant.id, { ...data, ref: f.ref.trim().toUpperCase() || undefined, bookingRef: f.bookingRef || undefined }, user);
        if (vehicle || driver) await assignJob(tenant.id, created, { vehicle, driver }, user);
        jobId = created.id;
      }
      if (!settled && (cost || fin?.cost)) await saveFinance(tenant.id, jobId, { cost: (cost ?? null) as BuyCost, currency: tenant.locale.currency });
      toast(job ? `${job.ref} saved` : `Job ${jobId} created${vehicle && driver ? ' and dispatched' : ''}`);
      nav(`/admin/jobs/${encodeURIComponent(jobId)}`, { replace: !job });
    } catch (ex) {
      toast(errMsg(ex), 'err');
    } finally {
      setBusy(false);
    }
  };

  const jobCtx = useMemo(() => ({ id: job?.id ?? '__new__', scheduledDate: f.date }), [job?.id, f.date]);
  const started = !!job && !['draft', 'assigned', 'accepted'].includes(job.status);

  return (
    <form
      className="stack adm-page ops-page ops-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <PageHeader
        title={job ? `Edit ${job.ref}` : 'New job'}
        subtitle={fromBooking ? `Pre-filled from website booking ${f.bookingRef} — check and assign.` : job ? job.title : 'Create a trip and dispatch it to a driver.'}
        actions={
          <>
            <Link to={job ? `/admin/jobs/${encodeURIComponent(job.id)}` : '/admin/dispatch'} className="btn btn-ghost btn-sm">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {busy ? 'Saving…' : job ? 'Save changes' : f.vehicleId && f.driverId ? 'Create & dispatch' : 'Create job'}
            </button>
          </>
        }
      />

      <div className="ops-editor-grid">
        <div className="stack">
          <Section title="Customer">
            <div className="form-grid">
              <Field label="Name *" error={liveErrors.customerName}>
                <input className="input" value={f.customerName} maxLength={120} aria-invalid={!!liveErrors.customerName || undefined} onChange={(e) => set('customerName', e.target.value)} autoComplete="off" />
              </Field>
              <Field label="Phone *" error={liveErrors.customerPhone} hint="Local or international format">
                <input className="input" type="tel" inputMode="tel" value={f.customerPhone} placeholder={country.phonePlaceholder} maxLength={24} aria-invalid={!!liveErrors.customerPhone || undefined} onChange={(e) => set('customerPhone', e.target.value)} />
              </Field>
              <Field label="Company" span>
                <input className="input" value={f.customerCompany} maxLength={120} onChange={(e) => set('customerCompany', e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section
            title={multi ? `Route · ${f.stops.length} stops` : 'Route'}
            desc={multi ? 'The driver works through the stops in this order. Pickups collect, deliveries need proof of delivery.' : 'Add more pickups or deliveries for a multi-stop job.'}
          >
            {liveErrors.stops ? (
              <div className="alert alert-err small" role="alert">
                {liveErrors.stops}
              </div>
            ) : null}
            <ol className="ops-stops ops-stoplist">
              {f.stops.map((s, i) => {
                const done = s.orig && s.orig.status !== 'pending';
                return (
                  <li key={s.key}>
                    <fieldset className="ops-stop">
                      <legend>
                        <span className={`ops-stop-dot ${s.kind === 'pickup' ? 'pickup' : 'dropoff'}`} aria-hidden /> {i + 1}.{' '}
                        <select className="ops-kindsel" value={s.kind} aria-label={`Stop ${i + 1} type`} disabled={!!done} onChange={(e) => setStop(i, { kind: e.target.value as StopKind })}>
                          <option value="pickup">Pickup</option>
                          <option value="delivery">Delivery</option>
                        </select>
                        {done ? <span className="ops-chip ops-lvl-ok">{s.orig!.status === 'done' ? 'Done' : s.orig!.status === 'failed' ? 'Failed' : 'Driver on site'}</span> : null}
                        <span className="ops-stop-tools">
                          <button type="button" className="icon-btn" aria-label={`Move stop ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                            <Icon name="arrow" size={14} className="ops-rot-up" />
                          </button>
                          <button type="button" className="icon-btn" aria-label={`Move stop ${i + 1} down`} disabled={i === f.stops.length - 1} onClick={() => move(i, 1)}>
                            <Icon name="arrow" size={14} className="ops-rot-down" />
                          </button>
                          <button type="button" className="icon-btn adm-danger-btn" aria-label={`Remove stop ${i + 1}`} disabled={f.stops.length <= 2 || !!done} onClick={() => removeStop(i)}>
                            <Icon name="trash" size={14} />
                          </button>
                        </span>
                      </legend>
                      <div className="form-grid">
                        <PlacePicker id={`job-stop-${s.key}`} label="Town / city *" country={country.code} crossBorder={cc} value={s.placeId} onChange={(p) => setStop(i, { placeId: p?.id ?? '' })} error={liveErrors[`stop${i}`]} />
                        <Field label="Street address / site">
                          <input className="input" value={s.address} maxLength={200} onChange={(e) => setStop(i, { address: e.target.value })} />
                        </Field>
                        <Field label="Site contact">
                          <input className="input" value={s.contact} maxLength={80} onChange={(e) => setStop(i, { contact: e.target.value })} />
                        </Field>
                        <Field label="Contact phone" error={liveErrors[`stop${i}Phone`]}>
                          <input className="input" type="tel" inputMode="tel" value={s.phone} maxLength={24} aria-invalid={!!liveErrors[`stop${i}Phone`] || undefined} onChange={(e) => setStop(i, { phone: e.target.value })} />
                        </Field>
                        {multi ? (
                          <>
                            <Field label={s.kind === 'pickup' ? 'Collect here' : 'Drop here'}>
                              <input className="input" value={s.cargo} maxLength={120} placeholder="e.g. 6 pallets / 12 m³" onChange={(e) => setStop(i, { cargo: e.target.value })} />
                            </Field>
                            <Field label="Reference (DN / PO / order)">
                              <input className="input mono" value={s.reference} maxLength={60} onChange={(e) => setStop(i, { reference: e.target.value })} />
                            </Field>
                            <Field label="Time window">
                              <input className="input" value={s.window} maxLength={40} placeholder="08:00–10:00" onChange={(e) => setStop(i, { window: e.target.value })} />
                            </Field>
                            <Field label="Stop instructions">
                              <input className="input" value={s.instructions} maxLength={300} placeholder="Gate 3, ask for Themba…" onChange={(e) => setStop(i, { instructions: e.target.value })} />
                            </Field>
                          </>
                        ) : null}
                      </div>
                    </fieldset>
                  </li>
                );
              })}
            </ol>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addStop('pickup')}>
                <Icon name="plus" size={14} /> Add pickup
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => addStop('delivery')}>
                <Icon name="plus" size={14} /> Add delivery
              </button>
            </div>
          </Section>

          <Section title="Load">
            <div className="form-grid">
              <Field label="Job type">
                <select className="select" value={f.kind} onChange={(e) => set('kind', e.target.value as Job['kind'])}>
                  <option value="vehicle">Vehicle hire (tipper / truck)</option>
                  <option value="freight">Freight consignment</option>
                </select>
              </Field>
              <Field label="Priority">
                <select className="select" value={f.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Cargo *" span error={liveErrors.cargo}>
                <input className="input" value={f.cargo} maxLength={300} placeholder="e.g. 10 m³ building sand · 4 pallets boxed stock (1.6 t)" aria-invalid={!!liveErrors.cargo || undefined} onChange={(e) => set('cargo', e.target.value)} />
              </Field>
              <Field
                label="Title *"
                span
                error={liveErrors.title}
                hint={
                  f.titleTouched && autoTitle && autoTitle !== f.title ? (
                    <button type="button" className="adm-link ops-linkbtn" onClick={() => setF((p) => ({ ...p, title: autoTitle, titleTouched: false }))}>
                      Use suggestion: {autoTitle}
                    </button>
                  ) : (
                    'Auto-suggested from cargo and towns — shown to the driver.'
                  )
                }
              >
                <input className="input" value={f.title} maxLength={140} aria-invalid={!!liveErrors.title || undefined} onChange={(e) => setF((p) => ({ ...p, title: e.target.value, titleTouched: true }))} />
              </Field>
              <AreaField label="Instructions for the driver" value={f.instructions} onChange={(v) => set('instructions', v)} rows={3} counter={1000} placeholder="Gate codes, PPE, who to call, loading notes…" />
            </div>
          </Section>
        </div>

        <div className="stack">
          <Section title="Schedule & price">
            <div className="form-grid">
              <Field label="Date *" error={liveErrors.date}>
                <input className="input" type="date" value={f.date} aria-invalid={!!liveErrors.date || undefined} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="Time *" error={liveErrors.time}>
                <input className="input" type="time" value={f.time} aria-invalid={!!liveErrors.time || undefined} onChange={(e) => set('time', e.target.value)} />
              </Field>
              <Field label={`Price (${tenant.locale.currency})`} error={liveErrors.price} hint="Agreed total incl. tax · visible to dispatch only">
                <div className="adm-affix">
                  <input className="input" type="number" inputMode="decimal" min={0} step="0.01" value={f.price} aria-invalid={!!liveErrors.price || undefined} onChange={(e) => set('price', e.target.value)} />
                  <span className="adm-affix-s">{country.currencySymbol}</span>
                </div>
              </Field>
              <Field
                label="Estimated km"
                error={liveErrors.estimatedKm}
                hint={
                  autoKm !== null ? (
                    f.kmTouched && String(autoKm) !== f.estimatedKm ? (
                      <button type="button" className="adm-link ops-linkbtn" onClick={() => setF((p) => ({ ...p, estimatedKm: String(autoKm), kmTouched: false }))}>
                        Reset to estimate ({autoKm} km)
                      </button>
                    ) : (
                      `Road estimate through ${f.stops.length} stops`
                    )
                  ) : (
                    'Pick all towns for an estimate'
                  )
                }
              >
                <div className="adm-affix">
                  <input className="input" type="number" inputMode="numeric" min={0} value={f.estimatedKm} aria-invalid={!!liveErrors.estimatedKm || undefined} onChange={(e) => setF((p) => ({ ...p, estimatedKm: e.target.value, kmTouched: true }))} />
                  <span className="adm-affix-s">km</span>
                </div>
              </Field>
              {!job ? (
                <Field label="Reference" span error={liveErrors.ref} hint={f.bookingRef ? 'Same as the website booking — keeps customer tracking in sync.' : 'Leave blank to auto-generate (JOB-…).'}>
                  <input className="input mono" value={f.ref} maxLength={40} disabled={!!f.bookingRef} placeholder="JOB-AUTO" aria-invalid={!!liveErrors.ref || undefined} onChange={(e) => set('ref', e.target.value)} />
                </Field>
              ) : null}
            </div>
          </Section>

          <Section title="Assignment" desc={started ? 'Trip in progress — the driver and vehicle can’t change now.' : job?.extLink && job.extLink.status !== 'revoked' ? 'Sent to an external driver by one-time link — manage it on the job page.' : 'Optional now — you can assign from the dispatch board later.'}>
            {started || (job?.extLink && job.extLink.status !== 'revoked') ? (
              <p className="small">
                {job?.vehicleReg ?? '—'} · {job?.driverName ?? '—'}
              </p>
            ) : (
              <AssignFields job={jobCtx} jobs={jobs} vehicles={vehicles} drivers={drivers} vehicleId={f.vehicleId} driverId={f.driverId} onChange={(v) => setF((p) => ({ ...p, ...v }))} today={today} />
            )}
          </Section>

          <Section title="Buy cost (hired truck)" desc="What you pay the transporter — dispatch only.">
            <CostPanel
              d={f.cost}
              onChange={(c) => set('cost', c)}
              transporters={transporters}
              vehicleType={vehicle?.type}
              job={{ actualKm: job?.actualKm, estimatedKm: f.estimatedKm ? Number(f.estimatedKm) : undefined }}
              sellPrice={f.price ? Number(f.price) : undefined}
              locked={settled}
              error={liveErrors.cost}
            />
          </Section>
        </div>
      </div>
    </form>
  );
}
