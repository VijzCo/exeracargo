import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { safeHttpsUrl } from '../lib/url';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import type { NewBooking, Quote, TenantConfig, Vehicle, VehicleType } from '../tenant/types';
import { createBooking } from '../lib/data';
import { computeQuote, findPromo, hasRestrictionsOn, isRestrictedSlot, timeSlots, type HireMode } from '../lib/quote';
import { estimateRoadKm, findPlace, findPlaceByName, isValidPhone, normalisePhone, type CountryInfo, type Place } from '../geo';
import { telLink, waLink } from '../lib/wa';
import { todayIn, zonedEpoch } from '../lib/time';
import PlacePicker from '../components/PlacePicker';
import QuoteBreakdown from '../components/QuoteBreakdown';
import { Icon } from '../components/Icon';
import '../styles/booking.css';

// ── constants ────────────────────────────────────────────────

const STEPS = ['Vehicle', 'Route & load', 'Schedule', 'Your details', 'Confirmed'] as const;
const LAST_INPUT_STEP = 3;
const MAX_TRIPS = 50;
const MAX_DAYS = 30;
export const MAX_KM = 4000;
export const MAX_ADVANCE_DAYS = 120;
export const SLOTS = timeSlots('05:00', '21:00', 30);

/** Field length caps — mirrored in firestore.rules. */
export const LIMITS = { name: 80, phone: 20, email: 120, company: 120, address: 200, notes: 1000, promo: 30 } as const;

export const TYPE_LABEL: Record<VehicleType, string> = {
  tipper: 'Tipper',
  lorry: 'Lorry',
  flatbed: 'Flatbed',
  lowbed: 'Lowbed',
  'prime-mover': 'Prime mover',
  container: 'Container',
  van: 'Mini lorry',
  bakkie: 'Bakkie',
  tautliner: 'Tautliner',
  superlink: 'Superlink',
  reefer: 'Reefer',
};

export const TYPE_ICON: Record<VehicleType, string> = {
  tipper: 'sand',
  lorry: 'truck',
  flatbed: 'layers',
  lowbed: 'machinery',
  'prime-mover': 'container',
  container: 'container',
  van: 'moving',
  bakkie: 'moving',
  tautliner: 'freight',
  superlink: 'freight',
  reefer: 'reefer',
};

/** ?service=<id> → keyword matched against tenant load types. */
const SERVICE_LOAD_HINT: Record<string, string[]> = {
  sand: ['sand', 'stone'],
  metal: ['metal', 'aggregate'],
  soil: ['soil', 'gravel', 'earth'],
  debris: ['debris', 'waste'],
  moving: ['household', 'furniture', 'moving'],
  container: ['container'],
  machinery: ['machinery', 'equipment'],
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── form model ───────────────────────────────────────────────

interface Form {
  step: number;
  typeFilter: VehicleType | 'all';
  vehicleId: string;
  serviceId: string;
  pickupAddress: string;
  pickupPlaceId: string;
  dropAddress: string;
  dropPlaceId: string;
  km: string;
  kmManual: boolean;
  trips: number;
  loadType: string;
  mode: HireMode;
  days: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  notes: string;
  promoInput: string;
  promoCode: string;
  agree: boolean;
}

type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = {
  step: 0,
  typeFilter: 'all',
  vehicleId: '',
  serviceId: '',
  pickupAddress: '',
  pickupPlaceId: '',
  dropAddress: '',
  dropPlaceId: '',
  km: '',
  kmManual: false,
  trips: 1,
  loadType: '',
  mode: 'trip',
  days: 1,
  date: '',
  time: '',
  name: '',
  phone: '',
  email: '',
  company: '',
  notes: '',
  promoInput: '',
  promoCode: '',
  agree: false,
};

const storageKey = (tenantId: string) => `hp:booking:${tenantId}`;

function loadSaved(tenantId: string): Partial<Form> | null {
  try {
    const raw = sessionStorage.getItem(storageKey(tenantId));
    return raw ? (JSON.parse(raw) as Partial<Form>) : null;
  } catch {
    return null;
  }
}
function saveForm(tenantId: string, f: Form) {
  try {
    sessionStorage.setItem(storageKey(tenantId), JSON.stringify(f));
  } catch {
    /* storage unavailable — progress just isn't persisted */
  }
}
function clearSaved(tenantId: string) {
  try {
    sessionStorage.removeItem(storageKey(tenantId));
  } catch {
    /* ignore */
  }
}

const clampInt = (n: unknown, lo: number, hi: number, dflt: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;
};

function matchLoadType(serviceId: string, loadTypes: string[]): string {
  const hints = SERVICE_LOAD_HINT[serviceId] ?? [serviceId];
  const lower = loadTypes.map((l) => l.toLowerCase());
  for (const h of hints) {
    const i = lower.findIndex((l) => l.includes(h.toLowerCase()));
    if (i >= 0) return loadTypes[i];
  }
  return '';
}

/** Restore saved progress, sanitise against the current tenant, then apply URL params. */
/** Town is bookable for this tenant: home country and inside a served region. */
export function placeAllowed(tenant: TenantConfig, id: string): boolean {
  const p = findPlace(id);
  return !!p && p.country === tenant.locale.country && (tenant.serviceAreas ?? []).includes(p.region);
}

/** ?from= / ?to= accept a place id or a town name. */
export function resolvePlaceParam(tenant: TenantConfig, q: string | null): string {
  const v = (q ?? '').trim();
  if (!v) return '';
  const p = findPlace(v) ?? findPlaceByName(tenant.locale.country, v);
  return p && placeAllowed(tenant, p.id) ? p.id : '';
}

function initForm(tenant: TenantConfig, params: URLSearchParams): Form {
  const saved = loadSaved(tenant.id) ?? {};
  const f: Form = { ...EMPTY };
  for (const key of Object.keys(EMPTY) as (keyof Form)[]) {
    const v = saved[key];
    if (v !== undefined && typeof v === typeof EMPTY[key]) (f as unknown as Record<string, unknown>)[key] = v;
  }
  const fleet = tenant.fleet ?? [];
  const country = tenant.locale.country;
  const loadTypes = tenant.booking.loadTypes ?? [];
  if (!fleet.some((v) => v.id === f.vehicleId && v.available)) f.vehicleId = '';
  if (!placeAllowed(tenant, f.pickupPlaceId)) f.pickupPlaceId = '';
  if (!placeAllowed(tenant, f.dropPlaceId)) f.dropPlaceId = '';
  if (!loadTypes.includes(f.loadType)) f.loadType = '';
  f.trips = clampInt(f.trips, 1, MAX_TRIPS, 1);
  f.days = clampInt(f.days, 1, MAX_DAYS, 1);
  f.step = clampInt(f.step, 0, LAST_INPUT_STEP, 0);
  const tz = countryTz(tenant);
  if (f.promoCode && !findPromo(tenant.promotions, f.promoCode, new Date(), tz)) f.promoCode = '';

  // ?from=&to= (homepage quick-quote) — place id or town name, only towns this tenant serves
  const qFrom = resolvePlaceParam(tenant, params.get('from'));
  const qTo = resolvePlaceParam(tenant, params.get('to'));
  if (qFrom) f.pickupPlaceId = qFrom;
  if (qTo) f.dropPlaceId = qTo;
  if (qFrom || qTo) {
    const est = estimateRoadKm(country, f.pickupPlaceId, f.dropPlaceId);
    if (est !== null && f.pickupPlaceId && f.dropPlaceId) {
      f.km = String(est);
      f.kmManual = false;
    }
  }

  // ?vehicle=<id> — preselect and jump straight to Route & load
  const qVehicle = params.get('vehicle');
  if (qVehicle && fleet.some((v) => v.id === qVehicle && v.available)) {
    f.step = f.vehicleId !== qVehicle || qFrom || qTo ? 1 : Math.max(1, f.step);
    f.vehicleId = qVehicle;
  }
  const qService = params.get('service');
  if (qService && /^[\w-]{1,60}$/.test(qService)) {
    f.serviceId = qService;
    const lt = matchLoadType(qService, loadTypes);
    if (lt) f.loadType = lt;
  }
  const qPromo = params.get('promo');
  if (qPromo) {
    const code = qPromo.trim().toUpperCase().slice(0, LIMITS.promo);
    f.promoInput = code;
    f.promoCode = findPromo(tenant.promotions, code, new Date(), tz) ? code : '';
  }
  if (f.step > 0 && !f.vehicleId) f.step = 0;
  const v = fleet.find((x) => x.id === f.vehicleId);
  if (!v?.perDay) f.mode = 'trip';
  return f;
}

// ── validation ───────────────────────────────────────────────

interface Ctx {
  tenant: TenantConfig;
  minDT: Date;
  country: CountryInfo;
}

export const countryTz = (t: TenantConfig) => (t.locale.country === 'ZA' ? 'Africa/Johannesburg' : 'Asia/Colombo');

/** Slot instant in the tenant's time zone (not the visitor's device zone). */
export const slotDate = (date: string, time: string, tz: string) => new Date(zonedEpoch(date, time, tz));

function validateStep(step: number, f: Form, { tenant, minDT, country }: Ctx): Errors {
  const tz = country.timeZone;
  const e: Errors = {};
  if (step === 0) {
    if (!tenant.fleet.some((v) => v.id === f.vehicleId && v.available)) e.vehicleId = 'Choose a vehicle to continue.';
  }
  if (step === 1) {
    if (f.pickupAddress.trim().length < 3) e.pickupAddress = 'Enter the pickup address or site name.';
    if (!f.pickupPlaceId) e.pickupPlaceId = 'Select the pickup town.';
    if (f.dropAddress.trim().length < 3) e.dropAddress = 'Enter the drop-off address or site name.';
    if (!f.dropPlaceId) e.dropPlaceId = 'Select the drop-off town.';
    const km = Number(f.km);
    if (!f.km.trim() || !Number.isFinite(km) || km <= 0) e.km = 'Enter the approximate distance in km.';
    else if (km > MAX_KM) e.km = `Distance must be ${MAX_KM} km or less — call us for longer hauls.`;
    if (!f.loadType) e.loadType = 'Select what you are transporting.';
    if (f.mode === 'trip' && (f.trips < 1 || f.trips > MAX_TRIPS)) e.trips = `Trips must be between 1 and ${MAX_TRIPS}.`;
    if (f.mode === 'day' && (f.days < 1 || f.days > MAX_DAYS)) e.days = `Days must be between 1 and ${MAX_DAYS}.`;
  }
  if (step === 2) {
    const minDate = todayIn(tz, minDT);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Choose a date.';
    else if (f.date < minDate) e.date = `Earliest available date is ${minDate}.`;
    else if (f.date > todayIn(tz, new Date(Date.now() + MAX_ADVANCE_DAYS * 86_400_000))) e.date = `Book at most ${MAX_ADVANCE_DAYS} days ahead.`;
    if (!f.time) e.time = 'Choose a time.';
    else if (f.date && !e.date) {
      if (isRestrictedSlot(tenant.booking, f.loadType, f.date, f.time))
        e.time = `${f.loadType} can’t be transported at ${f.time} on this day. Choose another slot.`;
      else if (slotDate(f.date, f.time, tz) < minDT)
        e.time = `We need at least ${tenant.booking.minNoticeHours} hours’ notice. Choose a later time.`;
    }
  }
  if (step === 3) {
    if (f.name.trim().length < 2) e.name = 'Enter your name.';
    if (!isValidPhone(f.phone, country.code)) e.phone = `Enter a valid ${country.name} number, e.g. ${country.phonePlaceholder}.`;
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email or leave it blank.';
    if (f.promoInput.trim() && f.promoInput.trim().toUpperCase() !== f.promoCode)
      e.promoInput = 'Tap “Apply” to use this code, or clear the field.';
    if (!f.agree) e.agree = 'Please confirm you’ve read the payment terms.';
  }
  return e;
}

// ── page ─────────────────────────────────────────────────────

interface Done {
  ref: string;
  booking: NewBooking;
  mode: HireMode;
  days: number;
}

function VehicleBooking({ switcher }: { switcher: ReactNode }) {
  const { tenant, fmtMoney, lang, country } = useTenant();
  const [params] = useSearchParams();
  const [form, setForm] = useState<Form>(() => initForm(tenant, params));
  const [errors, setErrors] = useState<Errors>({});
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const submitLock = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const lastView = useRef<string | null>(null);

  const settings = tenant.booking;
  const fleet = useMemo(() => (tenant.fleet ?? []).filter((v) => v.available), [tenant.fleet]);
  const vehicle = fleet.find((v) => v.id === form.vehicleId) ?? null;
  const promo = useMemo(() => findPromo(tenant.promotions, form.promoCode, new Date(), country.timeZone), [tenant.promotions, form.promoCode, country.timeZone]);
  const hasPromoCodes = (tenant.promotions ?? []).some((p) => p.active && p.code);

  const minDT = useMemo(
    () => new Date(Date.now() + Math.max(0, settings.minNoticeHours || 0) * 3_600_000),
    // recompute when the user moves between steps or changes date/time so "now" stays fresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.minNoticeHours, form.step, form.date, form.time],
  );
  const ctx: Ctx = { tenant, minDT, country };

  const quote = useMemo<Quote | null>(() => {
    if (!vehicle) return null;
    return computeQuote({
      vehicle,
      distanceKm: Number(form.km) || 0,
      trips: form.trips,
      settings,
      currency: tenant.locale.currency,
      promo,
      mode: form.mode,
      days: form.days,
    });
  }, [vehicle, form.km, form.trips, form.mode, form.days, settings, promo, tenant.locale.currency]);

  // persist progress
  useEffect(() => {
    if (!done) saveForm(tenant.id, form);
  }, [tenant.id, form, done]);

  // focus heading + scroll on step change (not on first paint)
  useEffect(() => {
    const view = done ? 'done' : String(form.step);
    const prev = lastView.current;
    lastView.current = view;
    if (prev === null || prev === view) return; // first paint (incl. StrictMode re-run)
    const el = wizardRef.current;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [form.step, done]);

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  const setDistrict = (which: 'pickupPlaceId' | 'dropPlaceId', value: string) => {
    setForm((f) => {
      const next = { ...f, [which]: value };
      const est = estimateRoadKm(country.code, next.pickupPlaceId, next.dropPlaceId);
      if (est !== null && next.pickupPlaceId && next.dropPlaceId) {
        next.km = String(est);
        next.kmManual = false;
      }
      return next;
    });
    setErrors((e) => ({ ...e, [which]: undefined, km: undefined }));
  };

  const estimate = form.pickupPlaceId && form.dropPlaceId ? estimateRoadKm(country.code, form.pickupPlaceId, form.dropPlaceId) : null;

  const focusFirstError = (errs: Errors) => {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`bk-${first}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const goTo = (step: number) => {
    // only allow jumping back, or forward through steps that validate
    for (let s = 0; s < step; s++) {
      const errs = validateStep(s, form, ctx);
      if (Object.keys(errs).length) {
        setForm((f) => ({ ...f, step: s }));
        setErrors(errs);
        focusFirstError(errs);
        return;
      }
    }
    setErrors({});
    setForm((f) => ({ ...f, step }));
  };

  const next = () => {
    const errs = validateStep(form.step, form, ctx);
    setErrors(errs);
    if (Object.keys(errs).length) {
      focusFirstError(errs);
      return;
    }
    setForm((f) => ({ ...f, step: Math.min(LAST_INPUT_STEP, f.step + 1) }));
  };
  const back = () => {
    setErrors({});
    setForm((f) => ({ ...f, step: Math.max(0, f.step - 1) }));
  };

  const applyPromo = () => {
    const code = form.promoInput.trim().toUpperCase();
    if (!code) {
      set('promoCode', '');
      setPromoMsg(null);
      return;
    }
    const p = findPromo(tenant.promotions, code, new Date(), country.timeZone);
    if (p) {
      setForm((f) => ({ ...f, promoInput: code, promoCode: code }));
      setErrors((e) => ({ ...e, promoInput: undefined }));
      setPromoMsg({ ok: true, text: `${p.title}${p.discountPct ? ` — ${p.discountPct}% off applied.` : ' applied.'}` });
    } else {
      setForm((f) => ({ ...f, promoCode: '' }));
      setPromoMsg({ ok: false, text: 'That code isn’t valid or has expired.' });
    }
  };

  const removePromo = () => {
    setForm((f) => ({ ...f, promoInput: '', promoCode: '' }));
    setErrors((e) => ({ ...e, promoInput: undefined }));
    setPromoMsg(null);
  };

  const submit = async () => {
    if (submitLock.current) return;
    for (let s = 0; s <= LAST_INPUT_STEP; s++) {
      const errs = validateStep(s, form, ctx);
      if (Object.keys(errs).length) {
        setForm((f) => ({ ...f, step: s }));
        setErrors(errs);
        focusFirstError(errs);
        return;
      }
    }
    if (!vehicle || !quote) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    const dayHire = form.mode === 'day' && !!vehicle.perDay;
    const userNotes = form.notes.trim();
    const notes = (dayHire ? `Day hire: ${form.days} day${form.days > 1 ? 's' : ''}.${userNotes ? `\n${userNotes}` : ''}` : userNotes).slice(
      0,
      LIMITS.notes,
    );
    const booking: NewBooking = {
      tenantId: tenant.id,
      kind: 'vehicle',
      customer: {
        name: form.name.trim().slice(0, LIMITS.name),
        phone: normalisePhone(form.phone, country.code),
        email: form.email.trim() || undefined,
        company: form.company.trim() || undefined,
      },
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      serviceId: form.serviceId || undefined,
      loadType: form.loadType,
      pickup: toStop(form.pickupAddress, form.pickupPlaceId),
      dropoff: toStop(form.dropAddress, form.dropPlaceId),
      date: form.date,
      time: form.time,
      distanceKm: Math.round(Number(form.km) * 10) / 10,
      trips: dayHire ? form.days : form.trips,
      notes: notes || undefined,
      promoCode: promo?.code ? promo.code.toUpperCase() : undefined,
      quote,
      lang,
    };

    try {
      const { ref } = await createBooking(booking, tenant.logoText || tenant.name);
      clearSaved(tenant.id);
      setDone({ ref, booking, mode: dayHire ? 'day' : 'trip', days: form.days });
    } catch (err) {
      console.error('[booking] create failed', err);
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setSubmitError(
        offline
          ? 'You appear to be offline. Check your connection and try again — your details are saved.'
          : 'We couldn’t submit your booking just now. Please try again, or call / WhatsApp us and we’ll book it for you.',
      );
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  // ── render ──

  if (!settings.enabled) return <BookingClosed tenant={tenant} />;

  if (done) {
    return (
      <main className="bk-page">
        <div className="container" ref={wizardRef}>
          <Confirmation done={done} tenant={tenant} fmtMoney={fmtMoney} headingRef={headingRef} />
        </div>
      </main>
    );
  }

  const step = form.step;
  const progress = ((step + 1) / STEPS.length) * 100;
  const summary = (
    <QuoteSummary
      vehicle={vehicle}
      quote={quote}
      form={form}
      depositPct={settings.depositPct}
      paymentNote={settings.paymentNote}
      fmtMoney={fmtMoney}
    />
  );

  return (
    <main className={`bk-page${vehicle ? ' has-bar' : ''}`}>
      <div className="container">
        <header className="bk-head">
          <span className="eyebrow">Online booking</span>
          <h1 className="h2" style={{ margin: '8px 0 0' }}>
            Book a vehicle with {tenant.name}
          </h1>
          <p className="lead muted">Instant indicative quote. Our dispatcher confirms price and timing before dispatch.</p>
        </header>
        {switcher}

        <nav className="bk-stepper" aria-label="Booking progress">
          <ol className="bk-steps">
            {STEPS.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo';
              return (
                <li key={label} aria-current={i === step ? 'step' : undefined}>
                  <button
                    type="button"
                    className="bk-step-btn"
                    data-state={state}
                    disabled={i === step || i > LAST_INPUT_STEP}
                    onClick={() => goTo(i)}
                    aria-label={`Step ${i + 1}: ${label}${state === 'done' ? ' (completed)' : ''}`}
                  >
                    <span className="bk-step-num" aria-hidden="true">
                      {state === 'done' ? <Icon name="check" size={14} /> : i + 1}
                    </span>
                    <span className="bk-step-label">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div
            className="bk-progress"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="bk-step-caption" aria-hidden="true">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </div>
        </nav>

        <div className="bk-layout" ref={wizardRef}>
          <div className="bk-main">
            <form
              className="card bk-panel"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (step < LAST_INPUT_STEP) next();
                else void submit();
              }}
              aria-labelledby="bk-step-heading"
            >
              {step === 0 && (
                <StepVehicle
                  headingRef={headingRef}
                  fleet={fleet}
                  form={form}
                  set={set}
                  error={errors.vehicleId}
                  fmtMoney={fmtMoney}
                />
              )}
              {step === 1 && vehicle && (
                <StepRoute
                  headingRef={headingRef}
                  form={form}
                  set={set}
                  setDistrict={setDistrict}
                  errors={errors}
                  areas={tenant.serviceAreas ?? []}
                  loadTypes={settings.loadTypes ?? []}
                  vehicle={vehicle}
                  estimate={estimate}
                  fmtMoney={fmtMoney}
                  country={country.code}
                />
              )}
              {step === 2 && (
                <StepSchedule headingRef={headingRef} form={form} set={set} errors={errors} tenant={tenant} minDT={minDT} tz={country.timeZone} />
              )}
              {step === 3 && (
                <StepDetails
                  headingRef={headingRef}
                  form={form}
                  set={set}
                  errors={errors}
                  paymentNote={settings.paymentNote}
                  showPromo={hasPromoCodes || !!form.promoInput}
                  promoMsg={promoMsg}
                  applyPromo={applyPromo}
                  removePromo={removePromo}
                  promoApplied={!!promo}
                />
              )}

              {submitError && step === LAST_INPUT_STEP && (
                <div className="alert alert-err" role="alert" style={{ marginTop: 20 }}>
                  <Icon name="x" />
                  <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
                    <span>{submitError}</span>
                    <ContactButtons tenant={tenant} small />
                  </div>
                </div>
              )}

              <div className="bk-nav">
                {step > 0 && (
                  <button type="button" className="btn btn-ghost" onClick={back} disabled={submitting}>
                    Back
                  </button>
                )}
                {step < LAST_INPUT_STEP ? (
                  <button type="submit" className="btn btn-primary">
                    Continue <Icon name="arrow" size={18} />
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} aria-busy={submitting}>
                    {submitting ? (
                      <>
                        <span className="bk-spin" aria-hidden="true" /> Submitting…
                      </>
                    ) : (
                      <>
                        Confirm booking{quote ? ` · ${fmtMoney(quote.total)}` : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>

          <aside className="bk-aside" aria-label="Quote summary">
            {summary}
          </aside>
        </div>
      </div>

      {vehicle && quote && (
        <div className="bk-bar" role="region" aria-label="Quote summary">
          {sheetOpen && (
            <div className="bk-bar-sheet" id="bk-sheet">
              {summary}
            </div>
          )}
          <div className="bk-bar-row">
            <div className="bk-bar-total">
              <span className="small muted">Estimated total{settings.taxPct ? ' incl. VAT' : ''}</span>
              <strong aria-live="polite">{fmtMoney(quote.total)}</strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-expanded={sheetOpen}
              aria-controls="bk-sheet"
              onClick={() => setSheetOpen((o) => !o)}
            >
              {sheetOpen ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ── mode switch: vehicle hire vs freight ─────────────────────

const FreightBooking = lazy(() => import('./FreightBooking'));

export default function Booking() {
  const { tenant } = useTenant();
  const [params] = useSearchParams();
  const loc = useLocation();
  const freightOn = !!tenant.logistics?.enabled;
  const mode = freightOn && params.get('mode') === 'freight' ? 'freight' : 'vehicle';
  const href = (m: string) => {
    const q = new URLSearchParams();
    q.set('mode', m);
    return `${loc.pathname}?${q.toString()}`;
  };
  const switcher = freightOn ? (
    <nav className="bk-mode container" aria-label="Booking type">
      <Link to={href('vehicle')} aria-current={mode === 'vehicle' ? 'page' : undefined}>
        <Icon name="truck" size={18} /> Hire a vehicle
      </Link>
      <Link to={href('freight')} aria-current={mode === 'freight' ? 'page' : undefined}>
        <Icon name="pallet" size={18} /> Ship freight
      </Link>
    </nav>
  ) : null;
  return (
    <>
      {mode === 'freight' ? (
        <Suspense fallback={<div className="boot" style={{ minHeight: '60vh' }}><div className="boot-spinner" /></div>}>
          <FreightBooking switcher={switcher} />
        </Suspense>
      ) : (
        <VehicleBooking switcher={switcher} key="vehicle" />
      )}
    </>
  );
}

// ── shared bits ──────────────────────────────────────────────

export function toStop(address: string, placeId: string): NewBooking['pickup'] {
  const p = findPlace(placeId);
  return { address: address.trim().slice(0, 200), placeId, place: p?.name ?? '', region: p?.region ?? '' };
}

type SetFn = <K extends keyof Form>(key: K, value: Form[K]) => void;
export type HeadingRef = RefObject<HTMLHeadingElement>;

export function capacityText(v: Vehicle): string {
  const unit = v.capacityUnit === 'cube' ? (v.capacity === 1 ? 'cube' : 'cubes') : v.capacityUnit === 'ton' ? (v.capacity === 1 ? 'ton' : 'tons') : 'ft';
  return `${v.capacity} ${unit}`;
}

export function StepHeading({ headingRef, title, sub }: { headingRef: HeadingRef; title: string; sub?: string }) {
  return (
    <div className="bk-panel-head">
      <h2 className="h3" id="bk-step-heading" ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      {sub && <p className="muted small" style={{ margin: 0 }}>{sub}</p>}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** aria props for an input given its error/hint state. */
export function aria(id: string, error?: string, hasHint = false) {
  return {
    id,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': error ? `${id}-err` : hasHint ? `${id}-hint` : undefined,
  };
}

export function Counter({
  id,
  value,
  min,
  max,
  onChange,
  label,
  error,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  error?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.floor(n) || min));
  return (
    <div className="bk-counter" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        −
      </button>
      <input
        {...aria(id, error)}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button type="button" aria-label={`Increase ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>
        +
      </button>
    </div>
  );
}

export function ContactButtons({ tenant, small }: { tenant: TenantConfig; small?: boolean }) {
  const size = small ? ' btn-sm' : '';
  return (
    <div className="row" style={{ '--gap': '8px', justifyContent: 'inherit' } as CSSProperties}>
      {tenant.contact.phone && (
        <a className={`btn btn-ghost${size}`} href={telLink(tenant.contact.phone)}>
          <Icon name="phone" size={18} /> Call {tenant.contact.phone}
        </a>
      )}
      {tenant.contact.whatsapp && (
        <a
          className={`btn btn-ghost${size}`}
          href={waLink(tenant.contact.whatsapp, `Hello ${tenant.name}, I’d like to book a vehicle.`)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="whatsapp" size={18} /> WhatsApp
        </a>
      )}
    </div>
  );
}

// ── step 1: vehicle ──────────────────────────────────────────

function StepVehicle({
  headingRef,
  fleet,
  form,
  set,
  error,
  fmtMoney,
}: {
  headingRef: HeadingRef;
  fleet: Vehicle[];
  form: Form;
  set: SetFn;
  error?: string;
  fmtMoney: (n: number) => string;
}) {
  const types = useMemo(() => Array.from(new Set(fleet.map((v) => v.type))), [fleet]);
  const filter = form.typeFilter !== 'all' && types.includes(form.typeFilter) ? form.typeFilter : 'all';
  const shown = filter === 'all' ? fleet : fleet.filter((v) => v.type === filter);

  const choose = (v: Vehicle) => {
    set('vehicleId', v.id);
    if (!v.perDay && form.mode === 'day') set('mode', 'trip');
  };

  return (
    <>
      <StepHeading headingRef={headingRef} title="Choose your vehicle" sub="Pick the size that fits your load. Prices are indicative." />
      {fleet.length === 0 ? (
        <div className="alert alert-warn" role="status">
          <Icon name="clock" /> No vehicles are available for online booking right now. Please call or WhatsApp us.
        </div>
      ) : (
        <>
          {types.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Filter by vehicle type">
              {(['all', ...types] as const).map((tp) => (
                <button
                  key={tp}
                  type="button"
                  role="tab"
                  className="tab"
                  aria-selected={filter === tp}
                  aria-controls="bk-vgrid"
                  onClick={() => set('typeFilter', tp)}
                >
                  {tp === 'all' ? 'All' : TYPE_LABEL[tp] ?? tp}
                </button>
              ))}
            </div>
          )}
          <div className="grid bk-vgrid" id="bk-vgrid" role="tabpanel" aria-label="Available vehicles">
            {shown.map((v, i) => (
              <button
                key={v.id}
                id={i === 0 ? 'bk-vehicleId' : undefined}
                type="button"
                className="bk-vcard"
                aria-pressed={form.vehicleId === v.id}
                onClick={() => choose(v)}
                onDoubleClick={() => choose(v)}
              >
                <span className="bk-vcard-check" aria-hidden="true">
                  <Icon name="check" size={14} />
                </span>
                {safeHttpsUrl(v.imageUrl) ? (
                  <img className="bk-vcard-img" src={safeHttpsUrl(v.imageUrl)} alt="" loading="lazy" />
                ) : (
                  <span className="bk-vcard-icon" aria-hidden="true">
                    <Icon name={TYPE_ICON[v.type] ?? 'truck'} size={24} />
                  </span>
                )}
                <span className="bk-vcard-name">{v.name}</span>
                <span className="bk-vcard-meta">
                  <span className="badge badge-muted">{TYPE_LABEL[v.type] ?? v.type}</span>
                  <span className="badge">{capacityText(v)}</span>
                  {v.perDay ? <span className="badge badge-accent">Day hire</span> : null}
                </span>
                {v.features.length > 0 && <span className="small muted">{v.features.slice(0, 3).join(' · ')}</span>}
                <span className="bk-vcard-price">
                  <span>
                    <span className="tiny muted">From </span>
                    <strong>{fmtMoney(v.baseFare)}</strong>
                  </span>
                  <span className="small muted">
                    {fmtMoney(v.perKm)}/km{v.perDay ? ` · ${fmtMoney(v.perDay)}/day` : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </>
  );
}

// ── step 2: route & load ─────────────────────────────────────

function StepRoute({
  headingRef,
  form,
  set,
  setDistrict,
  errors,
  areas,
  loadTypes,
  vehicle,
  estimate,
  fmtMoney,
  country,
}: {
  headingRef: HeadingRef;
  country: CountryInfo['code'];
  form: Form;
  set: SetFn;
  setDistrict: (which: 'pickupPlaceId' | 'dropPlaceId', v: string) => void;
  errors: Errors;
  areas: string[];
  loadTypes: string[];
  vehicle: Vehicle;
  estimate: number | null;
  fmtMoney: (n: number) => string;
}) {
  const kmHint =
    estimate !== null
      ? form.kmManual && Number(form.km) !== estimate
        ? `You changed this. Our estimate is ~${estimate} km.`
        : `Estimated ~${estimate} km by road between town centres. Edit if you know the exact distance.`
      : 'Enter the one-way road distance. Select both towns for an estimate.';

  return (
    <>
      <StepHeading headingRef={headingRef} title="Route & load" sub={`${vehicle.name} · ${capacityText(vehicle)}`} />

      <fieldset className="bk-fieldset bk-section">
        <legend className="bk-legend">
          <span className="bk-dot" aria-hidden="true" /> Pickup
        </legend>
        <div className="form-grid">
          <Field id="bk-pickupAddress" label="Pickup address / site" error={errors.pickupAddress}>
            <input
              {...aria('bk-pickupAddress', errors.pickupAddress)}
              className="input"
              autoComplete="street-address"
              maxLength={LIMITS.address}
              placeholder="Street address or site name"
              value={form.pickupAddress}
              onChange={(e) => set('pickupAddress', e.target.value)}
            />
          </Field>
          <PlacePicker
            id="bk-pickupPlaceId"
            label="Town / city"
            country={country}
            regions={areas}
            value={form.pickupPlaceId}
            onChange={(p?: Place) => setDistrict('pickupPlaceId', p?.id ?? '')}
            error={errors.pickupPlaceId}
          />
        </div>
      </fieldset>

      <fieldset className="bk-fieldset bk-section">
        <legend className="bk-legend">
          <span className="bk-dot drop" aria-hidden="true" /> Drop-off
        </legend>
        <div className="form-grid">
          <Field id="bk-dropAddress" label="Drop-off address / site" error={errors.dropAddress}>
            <input
              {...aria('bk-dropAddress', errors.dropAddress)}
              className="input"
              maxLength={LIMITS.address}
              placeholder="Street address or site name"
              value={form.dropAddress}
              onChange={(e) => set('dropAddress', e.target.value)}
            />
          </Field>
          <PlacePicker
            id="bk-dropPlaceId"
            label="Town / city"
            country={country}
            regions={areas}
            value={form.dropPlaceId}
            onChange={(p?: Place) => setDistrict('dropPlaceId', p?.id ?? '')}
            error={errors.dropPlaceId}
          />
        </div>
      </fieldset>

      <div className="bk-section form-grid">
        <Field id="bk-km" label="Distance (km, one way)" error={errors.km} hint={kmHint}>
          <div className="bk-km">
            <input
              {...aria('bk-km', errors.km, true)}
              className="input"
              type="number"
              inputMode="decimal"
              min={1}
              max={MAX_KM}
              step="any"
              value={form.km}
              onChange={(e) => {
                set('km', e.target.value);
                set('kmManual', true);
              }}
            />
            {estimate !== null && form.kmManual && Number(form.km) !== estimate && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  set('km', String(estimate));
                  set('kmManual', false);
                }}
              >
                Use estimate
              </button>
            )}
          </div>
        </Field>

        <Field id="bk-loadType" label="What are you transporting?" error={errors.loadType}>
          <select
            {...aria('bk-loadType', errors.loadType)}
            className="select"
            value={form.loadType}
            onChange={(e) => set('loadType', e.target.value)}
          >
            <option value="">Select load type…</option>
            {loadTypes.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        {vehicle.perDay ? (
          <div className="field span-2">
            <span className="label" id="bk-mode-label">
              Hire type
            </span>
            <div className="tabs" role="radiogroup" aria-labelledby="bk-mode-label" style={{ width: 'max-content' }}>
              {(
                [
                  ['trip', 'Per trip'],
                  ['day', `Day hire · ${fmtMoney(vehicle.perDay)}/day`],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  className="tab"
                  aria-checked={form.mode === m}
                  onClick={() => set('mode', m)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {form.mode === 'day' && vehicle.perDay ? (
          <Field id="bk-days" label="Number of days" error={errors.days} hint="Vehicle and driver for the full working day.">
            <Counter id="bk-days" label="Days" value={form.days} min={1} max={MAX_DAYS} onChange={(n) => set('days', n)} error={errors.days} />
          </Field>
        ) : (
          <Field id="bk-trips" label="Number of trips" error={errors.trips} hint={`Up to ${MAX_TRIPS} trips per booking.`}>
            <Counter id="bk-trips" label="Trips" value={form.trips} min={1} max={MAX_TRIPS} onChange={(n) => set('trips', n)} error={errors.trips} />
          </Field>
        )}
      </div>
    </>
  );
}

// ── step 3: schedule ─────────────────────────────────────────

function StepSchedule({
  headingRef,
  form,
  set,
  errors,
  tenant,
  minDT,
  tz,
}: {
  headingRef: HeadingRef;
  form: Form;
  set: SetFn;
  errors: Errors;
  tenant: TenantConfig;
  minDT: Date;
  tz: string;
}) {
  const settings = tenant.booking;
  const minDate = todayIn(tz, minDT);
  const maxDate = todayIn(tz, new Date(Date.now() + MAX_ADVANCE_DAYS * 86_400_000));
  const restrictedToday = form.date ? hasRestrictionsOn(settings, form.loadType, form.date) : false;
  const windows = settings.restrictedWindows?.windows ?? [];

  const slots = SLOTS.map((s) => {
    const restricted = form.date ? isRestrictedSlot(settings, form.loadType, form.date, s) : false;
    const tooSoon = form.date ? slotDate(form.date, s, tz) < minDT : false;
    return { s, restricted, tooSoon };
  });
  const anyOpen = !form.date || slots.some((x) => !x.restricted && !x.tooSoon);

  return (
    <>
      <StepHeading
        headingRef={headingRef}
        title="When do you need it?"
        sub={`Online bookings need at least ${settings.minNoticeHours} hour${settings.minNoticeHours === 1 ? '' : 's'}’ notice.`}
      />
      {(settings.notices ?? []).length > 0 && (
        <div className="bk-notices">
          {settings.notices.map((n, i) => (
            <div key={i} className="alert alert-warn">
              <Icon name="shield" size={18} />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="form-grid">
        <Field id="bk-date" label="Date" error={errors.date}>
          <input
            {...aria('bk-date', errors.date)}
            className="input"
            type="date"
            min={minDate}
            max={maxDate}
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </Field>
        <Field
          id="bk-time"
          label="Pickup time"
          error={errors.time}
          hint={form.date ? (anyOpen ? undefined : 'No slots left on this date — choose another day.') : 'Choose a date first.'}
        >
          <select
            {...aria('bk-time', errors.time, !form.date || !anyOpen)}
            className="select"
            value={form.time}
            disabled={!form.date}
            onChange={(e) => set('time', e.target.value)}
          >
            <option value="">Select time…</option>
            {slots.map(({ s, restricted, tooSoon }) => (
              <option key={s} value={s} disabled={restricted || tooSoon}>
                {s}
                {restricted ? ' — restricted' : tooSoon ? ' — too soon' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {restrictedToday && windows.length > 0 && (
        <div className="alert alert-warn" role="status" style={{ marginTop: 16 }}>
          <Icon name="clock" size={18} />
          <span>
            <strong>{form.loadType}</strong> can’t be transported {settings.restrictedWindows.weekdaysOnly ? 'on weekdays ' : ''}during{' '}
            {windows.map((w) => `${w.start}–${w.end}`).join(' and ')}. Those slots are disabled.
          </span>
        </div>
      )}
    </>
  );
}

// ── step 4: details ──────────────────────────────────────────

function StepDetails({
  headingRef,
  form,
  set,
  errors,
  paymentNote,
  showPromo,
  promoMsg,
  applyPromo,
  removePromo,
  promoApplied,
}: {
  headingRef: HeadingRef;
  form: Form;
  set: SetFn;
  errors: Errors;
  paymentNote: string;
  showPromo: boolean;
  promoMsg: { ok: boolean; text: string } | null;
  applyPromo: () => void;
  removePromo: () => void;
  promoApplied: boolean;
}) {
  const { country } = useTenant();
  return (
    <>
      <StepHeading headingRef={headingRef} title="Your details" sub="We’ll call or WhatsApp you to confirm." />
      <div className="form-grid">
        <Field id="bk-name" label="Full name" error={errors.name}>
          <input
            {...aria('bk-name', errors.name)}
            className="input"
            autoComplete="name"
            maxLength={LIMITS.name}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </Field>
        <Field id="bk-phone" label="Mobile number" error={errors.phone} hint={`${country.name} number — we’ll contact you here.`}>
          <input
            {...aria('bk-phone', errors.phone, true)}
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={LIMITS.phone}
            placeholder={country.phonePlaceholder}
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            required
          />
        </Field>
        <Field id="bk-email" label="Email (optional)" error={errors.email}>
          <input
            {...aria('bk-email', errors.email)}
            className="input"
            type="email"
            autoComplete="email"
            maxLength={LIMITS.email}
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field id="bk-company" label="Company (optional)">
          <input
            id="bk-company"
            className="input"
            autoComplete="organization"
            maxLength={LIMITS.company}
            value={form.company}
            onChange={(e) => set('company', e.target.value)}
          />
        </Field>
        <Field
          id="bk-notes"
          label="Notes for the dispatcher (optional)"
          className="span-2"
          hint={`Access, gate times, unloading point, landmarks… ${form.notes.length}/${LIMITS.notes - 40}`}
        >
          <textarea
            {...aria('bk-notes', undefined, true)}
            className="textarea"
            maxLength={LIMITS.notes - 40}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {showPromo && (
          <Field id="bk-promoInput" label="Promo code" className="span-2" error={errors.promoInput}>
            <div className="bk-promo">
              <input
                {...aria('bk-promoInput', errors.promoInput)}
                className="input"
                autoComplete="off"
                autoCapitalize="characters"
                maxLength={LIMITS.promo}
                value={form.promoInput}
                onChange={(e) => {
                  set('promoInput', e.target.value);
                  if (promoApplied && e.target.value.trim().toUpperCase() !== form.promoCode) set('promoCode', '');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPromo();
                  }
                }}
              />
              {promoApplied ? (
                <button type="button" className="btn btn-ghost" onClick={removePromo}>
                  Remove
                </button>
              ) : (
                <button type="button" className="btn" onClick={applyPromo} disabled={!form.promoInput.trim()}>
                  Apply
                </button>
              )}
            </div>
            {promoMsg && !errors.promoInput && (
              <span className={promoMsg.ok ? 'hint' : 'field-error'} role="status" style={promoMsg.ok ? { color: 'var(--ok)' } : undefined}>
                {promoMsg.text}
              </span>
            )}
            {!promoMsg && promoApplied && (
              <span className="hint" style={{ color: 'var(--ok)' }}>
                Code {form.promoCode} applied.
              </span>
            )}
          </Field>
        )}

        <div className="field span-2">
          <label className="checkbox bk-agree" htmlFor="bk-agree">
            <input
              id="bk-agree"
              type="checkbox"
              checked={form.agree}
              aria-invalid={errors.agree ? true : undefined}
              aria-describedby={errors.agree ? 'bk-agree-err' : undefined}
              onChange={(e) => set('agree', e.target.checked)}
            />
            <span className="small">
              I understand this is an indicative quote. {paymentNote}
            </span>
          </label>
          {errors.agree && (
            <span className="field-error" id="bk-agree-err" role="alert">
              {errors.agree}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ── quote summary ────────────────────────────────────────────

function QuoteSummary({
  vehicle,
  quote,
  form,
  depositPct,
  paymentNote,
  fmtMoney,
}: {
  vehicle: Vehicle | null;
  quote: Quote | null;
  form: Form;
  depositPct: number;
  paymentNote: string;
  fmtMoney: (n: number) => string;
}) {
  if (!vehicle || !quote) {
    return (
      <div className="card bk-quote">
        <h3 className="h3">Your quote</h3>
        <p className="muted small" style={{ marginTop: 8 }}>
          Choose a vehicle to see a live price estimate.
        </p>
      </div>
    );
  }
  const km = Number(form.km) || 0;
  return (
    <div className="card bk-quote">
      <div className="spread">
        <h3 className="h3">Your quote</h3>
        <span className="badge badge-muted">Indicative</span>
      </div>
      <div className="bk-quote-vehicle">
        <span className="bk-vcard-icon" aria-hidden="true">
          <Icon name={TYPE_ICON[vehicle.type] ?? 'truck'} size={22} />
        </span>
        <div>
          <div style={{ fontWeight: 700 }}>{vehicle.name}</div>
          <div className="small muted">
            {capacityText(vehicle)}
            {form.loadType ? ` · ${form.loadType}` : ''}
          </div>
        </div>
      </div>

      {(form.pickupPlaceId || form.dropPlaceId || form.date) && (
        <div className="bk-route">
          {(form.pickupPlaceId || form.dropPlaceId) && (
            <div>
              <Icon name="pin" size={16} />
              <span>
                {findPlace(form.pickupPlaceId)?.name || '—'} → {findPlace(form.dropPlaceId)?.name || '—'}
                {km ? ` · ${km} km` : ''}
              </span>
            </div>
          )}
          {form.date && (
            <div>
              <Icon name="calendar" size={16} />
              <span>
                {form.date}
                {form.time ? ` at ${form.time}` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      <QuoteBreakdown quote={quote} />
      {depositPct > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Deposit {depositPct}% ({fmtMoney(Math.round((quote.total * depositPct) / 100))}) on confirmation.
        </p>
      )}
      {paymentNote && (
        <p className="tiny muted" style={{ marginTop: 10, marginBottom: 0 }}>
          {paymentNote}
        </p>
      )}
    </div>
  );
}

// ── confirmation ─────────────────────────────────────────────

function Confirmation({
  done,
  tenant,
  fmtMoney,
  headingRef,
}: {
  done: Done;
  tenant: TenantConfig;
  fmtMoney: (n: number) => string;
  headingRef: HeadingRef;
}) {
  const { ref, booking: b, mode, days } = done;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = ref;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const qty = mode === 'day' ? `${days} day${days > 1 ? 's' : ''} (day hire)` : `${b.trips} trip${b.trips > 1 ? 's' : ''}`;
  const waText = [
    `Hello ${tenant.name}, I just booked online.`,
    `Booking ref: ${ref}`,
    `Vehicle: ${b.vehicleName}`,
    `Load: ${b.loadType} · ${qty}`,
    `From: ${b.pickup.address}, ${b.pickup.place}`,
    `To: ${b.dropoff.address}, ${b.dropoff.place}`,
    `Date/time: ${b.date} ${b.time}`,
    `Estimated total: ${fmtMoney(b.quote.total)}`,
    `Name: ${b.customer.name} (${b.customer.phone})`,
  ].join('\n');
  const trackHref = `/track?ref=${encodeURIComponent(ref)}`;

  return (
    <section className="bk-done" aria-labelledby="bk-done-heading">
      <div className="bk-done-icon" aria-hidden="true">
        <Icon name="check" size={36} />
      </div>
      <h1 className="h2" id="bk-done-heading" ref={headingRef} tabIndex={-1} style={{ margin: 0, outline: 'none' }}>
        Booking received
      </h1>
      <p className="lead muted" style={{ marginTop: 8 }}>
        Thank you, {b.customer.name.split(' ')[0]}. Our dispatcher will contact you on {b.customer.phone} to confirm.
      </p>

      <div className="bk-ref">
        <div style={{ textAlign: 'left' }}>
          <div className="tiny muted">Your booking reference</div>
          <code aria-label={`Booking reference ${ref.split('').join(' ')}`}>{ref}</code>
        </div>
        <button type="button" className="icon-btn" onClick={() => void copy()} aria-label="Copy booking reference">
          <Icon name={copied ? 'check' : 'copy'} size={18} />
        </button>
      </div>
      <p className="small muted" role="status" aria-live="polite" style={{ minHeight: '1.2em', margin: 0 }}>
        {copied ? 'Copied to clipboard.' : 'Save this reference to track your booking.'}
      </p>

      <div className="bk-done-actions">
        {tenant.booking.whatsappConfirm && tenant.contact.whatsapp && (
          <a className="btn btn-primary btn-lg" href={waLink(tenant.contact.whatsapp, waText)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" /> Send to WhatsApp
          </a>
        )}
        <Link className="btn btn-ghost btn-lg" to={trackHref}>
          <Icon name="gps" /> Track booking
        </Link>
        {tenant.contact.phone && (
          <a className="btn btn-ghost btn-lg" href={telLink(tenant.contact.phone)}>
            <Icon name="phone" /> Call us
          </a>
        )}
      </div>

      <div className="card bk-summary">
        <div className="spread" style={{ marginBottom: 14 }}>
          <h2 className="h3" style={{ margin: 0 }}>
            Summary
          </h2>
          <span className="status status-pending">Pending confirmation</span>
        </div>
        <dl className="bk-dl">
          <dt>Vehicle</dt>
          <dd>{b.vehicleName}</dd>
          <dt>Load</dt>
          <dd>
            {b.loadType} · {qty}
          </dd>
          <dt>Pickup</dt>
          <dd>
            {b.pickup.address}, {b.pickup.place} ({b.pickup.region})
          </dd>
          <dt>Drop-off</dt>
          <dd>
            {b.dropoff.address}, {b.dropoff.place} ({b.dropoff.region})
          </dd>
          <dt>Distance</dt>
          <dd>~{b.distanceKm} km one way</dd>
          <dt>Date & time</dt>
          <dd>
            {b.date} at {b.time}
          </dd>
          {b.promoCode && (
            <>
              <dt>Promo</dt>
              <dd>
                {b.promoCode} (−{fmtMoney(b.quote.discount)})
              </dd>
            </>
          )}
          <dt>Estimated total</dt>
          <dd>
            <strong>{fmtMoney(b.quote.total)}</strong>
            {b.quote.tax > 0 ? <span className="muted small"> incl. VAT {fmtMoney(b.quote.tax)}</span> : null}
          </dd>
        </dl>
        {tenant.booking.paymentNote && (
          <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
            {tenant.booking.paymentNote}
          </p>
        )}
      </div>
    </section>
  );
}

// ── booking disabled ─────────────────────────────────────────

export function BookingClosed({ tenant }: { tenant: TenantConfig }) {
  return (
    <main className="bk-page">
      <div className="container">
        <section className="card bk-closed" aria-labelledby="bk-closed-heading">
          <div className="bk-done-icon" style={{ background: 'rgb(var(--primary-rgb) / 0.14)', color: 'var(--primary)' }} aria-hidden="true">
            <Icon name="phone" size={32} />
          </div>
          <h1 className="h2" id="bk-closed-heading" style={{ margin: 0 }}>
            Book by phone or WhatsApp
          </h1>
          <p className="lead muted" style={{ marginTop: 8 }}>
            Online booking is currently unavailable. Our team will book your vehicle and confirm the price right away.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <ContactButtons tenant={tenant} />
          </div>
          {tenant.contact.hours && (
            <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
              <Icon name="clock" size={14} /> {tenant.contact.hours}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
