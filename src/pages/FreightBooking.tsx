// ─────────────────────────────────────────────────────────────
// Freight booking: FTL · part-load (pallets) · courier · removals, incl. SADC cross-border.
// Shares form primitives with the vehicle-hire wizard in ./Booking.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import type { FreightDetails, FreightKind, NewBooking, Quote, ServiceLevel, TenantConfig, Vehicle } from '../tenant/types';
import { createBooking } from '../lib/data';
import { BookingTermsLinks, bookingTermsVersion } from '../legal/TermsConsent';
import { chargeableKg, computeFreightQuote, findPromo, FREIGHT_LIMITS, validateFreight, volumetricKg } from '../lib/quote';
import {
  borderPostsFor,
  CROSS_BORDER_NAMES,
  estimateRoadKm,
  findPlace,
  isValidPhone,
  normalisePhone,
  type CrossBorderCode,
  type Place,
} from '../geo';
import { telLink, waLink } from '../lib/wa';
import { todayIn } from '../lib/time';
import PlacePicker from '../components/PlacePicker';
import QuoteBreakdown from '../components/QuoteBreakdown';
import { Icon } from '../components/Icon';
import {
  aria,
  BookingClosed,
  capacityText,
  ContactButtons,
  Counter,
  EMAIL_RE,
  Field,
  LIMITS,
  MAX_ADVANCE_DAYS,
  MAX_KM,
  placeAllowed,
  resolvePlaceParam,
  slotDate,
  SLOTS,
  StepHeading,
  toStop,
  TYPE_ICON,
  TYPE_LABEL,
  type HeadingRef,
} from './Booking';
import '../styles/booking.css';

const STEPS = ['Service', 'Shipment', 'Route & schedule', 'Your details', 'Confirmed'] as const;
const LAST = 3;
const LEVELS: ServiceLevel[] = ['economy', 'express', 'sameday'];
const SERVICE_ICON: Record<FreightKind, string> = { ftl: 'freight', ltl: 'pallet', courier: 'parcel', removals: 'moving' };
const SACU: CrossBorderCode[] = ['LS', 'SZ', 'BW', 'NA'];
const RFQ_KM = 500;

interface FForm {
  step: number;
  service: FreightKind | '';
  level: ServiceLevel;
  vehicleId: string;
  helpers: number;
  packages: number;
  pallets: number;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  description: string;
  declaredValue: string;
  insured: boolean;
  hazardous: boolean;
  tailLift: boolean;
  afterHours: boolean;
  pickupAddress: string;
  pickupPlaceId: string;
  dropAddress: string;
  dropPlaceId: string;
  km: string;
  kmManual: boolean;
  borderPostId: string;
  recipientName: string;
  recipientPhone: string;
  date: string;
  time: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  vatNo: string;
  poNumber: string;
  notes: string;
  promoInput: string;
  promoCode: string;
  rfq: boolean;
  rfqTouched: boolean;
  agree: boolean;
}
type Errors = Partial<Record<keyof FForm | 'freight', string>>;

const EMPTY: FForm = {
  step: 0,
  service: '',
  level: 'economy',
  vehicleId: '',
  helpers: 0,
  packages: 1,
  pallets: 1,
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  description: '',
  declaredValue: '',
  insured: false,
  hazardous: false,
  tailLift: false,
  afterHours: false,
  pickupAddress: '',
  pickupPlaceId: '',
  dropAddress: '',
  dropPlaceId: '',
  km: '',
  kmManual: false,
  borderPostId: '',
  recipientName: '',
  recipientPhone: '',
  date: '',
  time: '',
  name: '',
  phone: '',
  email: '',
  company: '',
  vatNo: '',
  poNumber: '',
  notes: '',
  promoInput: '',
  promoCode: '',
  rfq: false,
  rfqTouched: false,
  agree: false,
};

const key = (t: string) => `hp:freight:${t}`;
const num = (s: string) => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Destination may be a served home town or a town in an enabled cross-border country. */
function destAllowed(t: TenantConfig, id: string): boolean {
  if (placeAllowed(t, id)) return true;
  const p = findPlace(id);
  const cb = t.logistics?.crossBorder;
  return !!p && !!cb?.enabled && cb.countries.includes(p.country as CrossBorderCode);
}

function vehiclesFor(t: TenantConfig, service: FreightKind | ''): Vehicle[] {
  const types = service === 'removals' ? t.logistics.removalsTypes : t.logistics.ftlTypes;
  return (t.fleet ?? []).filter((v) => v.available && (types ?? []).includes(v.type));
}

function initForm(t: TenantConfig, params: URLSearchParams, tz: string): FForm {
  let saved: Partial<FForm> = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(key(t.id)) || '{}') as Partial<FForm>;
  } catch {
    /* ignore */
  }
  const f: FForm = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof FForm)[]) {
    const v = saved[k];
    if (v !== undefined && typeof v === typeof EMPTY[k]) (f as unknown as Record<string, unknown>)[k] = v;
  }
  const enabled = t.logistics.services.filter((s) => s.enabled).map((s) => s.id);
  if (f.service && !enabled.includes(f.service)) f.service = '';
  if (!t.logistics.levels[f.level]?.enabled) f.level = 'economy';
  if (!vehiclesFor(t, f.service).some((v) => v.id === f.vehicleId)) f.vehicleId = '';
  if (!placeAllowed(t, f.pickupPlaceId)) f.pickupPlaceId = '';
  if (!destAllowed(t, f.dropPlaceId)) f.dropPlaceId = '';
  if (f.promoCode && !findPromo(t.promotions, f.promoCode, new Date(), tz)) f.promoCode = '';
  f.step = Math.min(LAST, Math.max(0, Math.floor(f.step) || 0));

  const qs = params.get('service') as FreightKind | null;
  if (qs && enabled.includes(qs)) {
    if (f.service !== qs) f.vehicleId = '';
    f.service = qs;
    f.step = Math.max(f.step, 1);
  }
  const from = resolvePlaceParam(t, params.get('from'));
  const toRaw = params.get('to');
  const to = toRaw && destAllowed(t, toRaw) ? toRaw : resolvePlaceParam(t, toRaw);
  if (from) f.pickupPlaceId = from;
  if (to) f.dropPlaceId = to;
  if (from && to) {
    const est = estimateRoadKm(t.locale.country, from, to);
    if (est !== null) {
      f.km = String(est);
      f.kmManual = false;
    }
  }
  const qp = params.get('promo');
  if (qp) {
    const code = qp.trim().toUpperCase().slice(0, LIMITS.promo);
    f.promoInput = code;
    f.promoCode = findPromo(t.promotions, code, new Date(), tz) ? code : '';
  }
  if (!f.service) f.step = 0;
  return f;
}

function toFreight(f: FForm, borderName: string, delayHrs: number, dest: Place | undefined, home: string): FreightDetails {
  const cross = dest && dest.country !== home;
  return {
    service: (f.service || 'ltl') as FreightKind,
    level: f.level,
    packages: f.service === 'courier' ? Math.max(1, f.packages) : 1,
    pallets: f.service === 'ltl' ? Math.max(0, f.pallets) : 0,
    weightKg: num(f.weightKg),
    // box dimensions only drive volumetric weight for parcels
    lengthCm: f.service === 'courier' ? num(f.lengthCm) : 0,
    widthCm: f.service === 'courier' ? num(f.widthCm) : 0,
    heightCm: f.service === 'courier' ? num(f.heightCm) : 0,
    description: f.description.trim().slice(0, 300),
    declaredValue: num(f.declaredValue),
    insured: f.insured,
    hazardous: f.hazardous,
    tailLift: f.tailLift,
    helpers: f.service === 'removals' ? f.helpers : 0,
    afterHours: f.afterHours,
    ...(cross ? { crossBorder: { country: dest.country as CrossBorderCode, borderPostId: f.borderPostId, borderPostName: borderName, delayHrs } } : {}),
  };
}

interface Done {
  ref: string;
  booking: NewBooking;
}

export default function FreightBooking({ switcher }: { switcher: ReactNode }) {
  const { tenant, lang, country, fmtMoney } = useTenant();
  const l = tenant.logistics;
  const tz = country.timeZone;
  const [params] = useSearchParams();
  const [form, setForm] = useState<FForm>(() => initForm(tenant, params, tz));
  const [errors, setErrors] = useState<Errors>({});
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const lock = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wizardRef = useRef<HTMLDivElement>(null);
  const lastView = useRef<string | null>(null);

  const services = l.services.filter((s) => s.enabled);
  const vehicles = useMemo(() => vehiclesFor(tenant, form.service), [tenant, form.service]);
  const vehicle = vehicles.find((v) => v.id === form.vehicleId) ?? null;
  const dest = findPlace(form.dropPlaceId);
  const origin = findPlace(form.pickupPlaceId);
  const crossTo = dest && dest.country !== country.code ? (dest.country as CrossBorderCode) : null;
  const posts = useMemo(() => (crossTo ? borderPostsFor(country.code, crossTo, origin) : []), [crossTo, country.code, origin]);
  const post = posts.find((b) => b.id === form.borderPostId) ?? null;
  const km = Number(form.km) || 0;
  const promo = useMemo(() => findPromo(tenant.promotions, form.promoCode, new Date(), tz), [tenant.promotions, form.promoCode, tz]);
  const minDT = useMemo(
    () => new Date(Date.now() + Math.max(0, tenant.booking.minNoticeHours || 0) * 3_600_000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenant.booking.minNoticeHours, form.step, form.date, form.time],
  );

  const freight = useMemo(
    () => (form.service ? toFreight(form, post?.name ?? 'border', post?.typicalDelayHrs ?? 0, dest, country.code) : null),
    [form, post, dest, country.code],
  );
  const check = useMemo(
    () => (freight ? validateFreight(freight, km, l, !!vehicle) : { ok: false, errors: [] as string[] }),
    [freight, km, l, vehicle],
  );
  const quote = useMemo<Quote | null>(() => {
    if (!freight) return null;
    if ((freight.service === 'ftl' || freight.service === 'removals') && !vehicle) return null;
    return computeFreightQuote({
      freight,
      distanceKm: km,
      logistics: l,
      taxPct: tenant.booking.taxPct,
      fuelSurchargePct: tenant.booking.fuelSurchargePct,
      currency: tenant.locale.currency,
      vehicle,
      promo,
    });
  }, [freight, km, l, tenant.booking.taxPct, tenant.booking.fuelSurchargePct, tenant.locale.currency, vehicle, promo]);

  // RFQ auto-suggestion for long FTL and cross-border, until the customer decides
  useEffect(() => {
    if (form.rfqTouched) return;
    const suggest = (form.service === 'ftl' && km > RFQ_KM) || !!crossTo;
    if (suggest !== form.rfq) setForm((f) => ({ ...f, rfq: suggest }));
  }, [form.service, km, crossTo, form.rfq, form.rfqTouched]);

  // default border post = nearest
  useEffect(() => {
    if (crossTo && posts.length && !posts.some((b) => b.id === form.borderPostId)) setForm((f) => ({ ...f, borderPostId: posts[0].id }));
    if (!crossTo && form.borderPostId) setForm((f) => ({ ...f, borderPostId: '' }));
  }, [crossTo, posts, form.borderPostId]);

  useEffect(() => {
    if (done) return;
    try {
      sessionStorage.setItem(key(tenant.id), JSON.stringify(form));
    } catch {
      /* ignore */
    }
  }, [tenant.id, form, done]);

  useEffect(() => {
    const view = done ? 'done' : String(form.step);
    const prev = lastView.current;
    lastView.current = view;
    if (prev === null || prev === view) return;
    const el = wizardRef.current;
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 90), behavior: 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  }, [form.step, done]);

  const set = useCallback(<K extends keyof FForm>(k: K, v: FForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] || e.freight ? { ...e, [k]: undefined, freight: undefined } : e));
  }, []);

  const setPlace = (which: 'pickupPlaceId' | 'dropPlaceId', id: string) => {
    setForm((f) => {
      const n = { ...f, [which]: id };
      const est = estimateRoadKm(country.code, n.pickupPlaceId, n.dropPlaceId, n.borderPostId);
      if (est !== null && n.pickupPlaceId && n.dropPlaceId) {
        n.km = String(est);
        n.kmManual = false;
      }
      return n;
    });
    setErrors((e) => ({ ...e, [which]: undefined, km: undefined }));
  };
  const estimate = form.pickupPlaceId && form.dropPlaceId ? estimateRoadKm(country.code, form.pickupPlaceId, form.dropPlaceId, form.borderPostId || undefined) : null;

  // re-estimate when the border post changes (unless the customer typed their own distance)
  useEffect(() => {
    if (form.kmManual || estimate === null) return;
    if (String(estimate) !== form.km) setForm((f) => ({ ...f, km: String(estimate) }));
  }, [estimate, form.kmManual, form.km]);

  const validate = (step: number, f: FForm = form): Errors => {
    const e: Errors = {};
    const fr = f.service ? toFreight(f, post?.name ?? '', 0, findPlace(f.dropPlaceId), country.code) : null;
    if (step === 0) {
      if (!f.service) e.service = 'Choose a service.';
      if (!l.levels[f.level]?.enabled) e.level = 'Choose a delivery speed.';
    }
    if (step === 1 && fr) {
      if ((f.service === 'ftl' || f.service === 'removals') && !vehicles.some((v) => v.id === f.vehicleId)) e.vehicleId = 'Choose a vehicle.';
      if (f.service === 'ltl' && f.pallets < 1) e.pallets = 'Enter at least 1 pallet.';
      if ((f.service === 'ltl' || f.service === 'courier') && num(f.weightKg) <= 0) e.weightKg = 'Enter the total weight in kg.';
      if (f.description.trim().length < 3) e.description = 'Describe the goods (e.g. “boxed retail stock”).';
      if (f.hazardous) e.hazardous = 'Dangerous goods need DG-certified handling — please call our freight desk to book.';
      if (f.insured && num(f.declaredValue) <= 0) e.declaredValue = 'Enter the value to insure.';
      const v = validateFreight(fr, 0, l, (f.service !== 'ftl' && f.service !== 'removals') || !!f.vehicleId);
      const relevant = v.errors.filter((x) => !/available|Choose a vehicle|declared value/i.test(x));
      if (relevant.length) e.freight = relevant.join(' ');
    }
    if (step === 2 && fr) {
      if (f.pickupAddress.trim().length < 3) e.pickupAddress = 'Enter the collection address.';
      if (!f.pickupPlaceId) e.pickupPlaceId = 'Select the collection town.';
      if (f.dropAddress.trim().length < 3) e.dropAddress = 'Enter the delivery address.';
      if (!f.dropPlaceId) e.dropPlaceId = 'Select the delivery town.';
      const k = Number(f.km);
      if (!f.km.trim() || !Number.isFinite(k) || k <= 0) e.km = 'Enter the approximate distance in km.';
      else if (k > MAX_KM) e.km = `Distance must be ${MAX_KM} km or less.`;
      const d = findPlace(f.dropPlaceId);
      if (d && d.country !== country.code && !f.borderPostId) e.borderPostId = 'Choose a border post.';
      if (f.recipientName.trim().length < 2) e.recipientName = 'Who receives the goods?';
      if (!isValidPhone(f.recipientPhone, country.code, true)) e.recipientPhone = `Enter a valid number (${country.phonePlaceholder} or +country code).`;
      const minDate = todayIn(tz, minDT);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) e.date = 'Choose a collection date.';
      else if (f.date < minDate) e.date = `Earliest collection date is ${minDate}.`;
      else if (f.date > todayIn(tz, new Date(Date.now() + MAX_ADVANCE_DAYS * 86_400_000))) e.date = `Book at most ${MAX_ADVANCE_DAYS} days ahead.`;
      if (!f.time) e.time = 'Choose a collection time.';
      else if (f.date && !e.date && slotDate(f.date, f.time, tz) < minDT) e.time = `We need at least ${tenant.booking.minNoticeHours} hours’ notice.`;
      const lvl = l.levels[f.level];
      if (lvl?.maxKm && k > lvl.maxKm) e.freight = `${lvl.label} is only available up to ${lvl.maxKm} km — choose another speed.`;
    }
    if (step === 3) {
      if (f.name.trim().length < 2) e.name = 'Enter your name.';
      if (!isValidPhone(f.phone, country.code)) e.phone = `Enter a valid ${country.name} number, e.g. ${country.phonePlaceholder}.`;
      if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email or leave it blank.';
      if (f.promoInput.trim() && f.promoInput.trim().toUpperCase() !== f.promoCode) e.promoInput = 'Tap “Apply” to use this code, or clear the field.';
      if (!f.agree) e.agree = 'Please accept the booking terms.';
    }
    return e;
  };

  const focusFirst = (errs: Errors) => {
    const first = Object.keys(errs).find((k) => errs[k as keyof Errors]);
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`fr-${first}`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const next = () => {
    const errs = validate(form.step);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return focusFirst(errs);
    setForm((f) => ({ ...f, step: Math.min(LAST, f.step + 1) }));
  };
  const back = () => {
    setErrors({});
    setForm((f) => ({ ...f, step: Math.max(0, f.step - 1) }));
  };
  const goTo = (step: number) => {
    for (let s = 0; s < step; s++) {
      const errs = validate(s);
      if (Object.values(errs).some(Boolean)) {
        setForm((f) => ({ ...f, step: s }));
        setErrors(errs);
        return focusFirst(errs);
      }
    }
    setErrors({});
    setForm((f) => ({ ...f, step }));
  };

  const applyPromo = () => {
    const code = form.promoInput.trim().toUpperCase();
    if (!code) {
      set('promoCode', '');
      setPromoMsg(null);
      return;
    }
    const p = findPromo(tenant.promotions, code, new Date(), tz);
    if (p) {
      setForm((f) => ({ ...f, promoInput: code, promoCode: code }));
      setPromoMsg({ ok: true, text: `${p.title}${p.discountPct ? ` — ${p.discountPct}% off applied.` : ' applied.'}` });
    } else {
      setForm((f) => ({ ...f, promoCode: '' }));
      setPromoMsg({ ok: false, text: 'That code isn’t valid or has expired.' });
    }
  };

  const submit = async () => {
    if (lock.current) return;
    for (let s = 0; s <= LAST; s++) {
      const errs = validate(s);
      if (Object.values(errs).some(Boolean)) {
        setForm((f) => ({ ...f, step: s }));
        setErrors(errs);
        return focusFirst(errs);
      }
    }
    if (!freight || !quote) return;
    if (quote.total > FREIGHT_LIMITS.quoteTotal) {
      setSubmitError('This shipment is too large to book online — please call our freight desk for a quote.');
      return;
    }
    lock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    const svc = services.find((s) => s.id === form.service);
    const label = vehicle ? `${svc?.title ?? 'Freight'} · ${vehicle.name}` : svc?.title ?? 'Freight';
    const customer: NewBooking['customer'] = {
      name: form.name.trim().slice(0, LIMITS.name),
      phone: normalisePhone(form.phone, country.code),
    };
    if (form.email.trim()) customer.email = form.email.trim().slice(0, LIMITS.email);
    if (form.company.trim()) customer.company = form.company.trim().slice(0, LIMITS.company);
    if (form.vatNo.trim()) customer.vatNo = form.vatNo.trim().slice(0, 30);
    if (form.poNumber.trim()) customer.poNumber = form.poNumber.trim().slice(0, 40);
    const booking: NewBooking = {
      tenantId: tenant.id,
      kind: 'freight',
      customer,
      vehicleId: vehicle?.id ?? '',
      vehicleName: label.slice(0, 100),
      serviceId: form.service,
      loadType: (svc?.title ?? 'Freight').slice(0, 60),
      pickup: toStop(form.pickupAddress, form.pickupPlaceId),
      dropoff: toStop(form.dropAddress, form.dropPlaceId),
      recipient: { name: form.recipientName.trim().slice(0, LIMITS.name), phone: normalisePhone(form.recipientPhone, country.code) },
      freight,
      date: form.date,
      time: form.time,
      distanceKm: Math.round(km * 10) / 10,
      trips: 1,
      notes: form.notes.trim().slice(0, LIMITS.notes) || undefined,
      promoCode: promo?.code ? promo.code.toUpperCase() : undefined,
      rfq: form.rfq || undefined,
      quote,
      lang,
      termsVersion: bookingTermsVersion(tenant),
      termsAcceptedAt: Date.now(),
    };
    try {
      const { ref } = await createBooking(booking, tenant.logoText || tenant.name);
      try {
        sessionStorage.removeItem(key(tenant.id));
      } catch {
        /* ignore */
      }
      setDone({ ref, booking });
    } catch (err) {
      console.error('[freight] create failed', err);
      setSubmitError(
        navigator.onLine === false
          ? 'You appear to be offline. Check your connection and try again — your details are saved.'
          : 'We couldn’t submit your shipment just now. Please try again, or call / WhatsApp our freight desk.',
      );
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  if (!tenant.booking.enabled || !l?.enabled) return <BookingClosed tenant={tenant} />;
  if (done)
    return (
      <main className="bk-page">
        <div className="container" ref={wizardRef}>
          <FreightDone done={done} tenant={tenant} headingRef={headingRef} fmtMoney={fmtMoney} />
        </div>
      </main>
    );

  const step = form.step;
  const summary = (
    <div className="card bk-quote">
      <div className="spread">
        <h3 className="h3">Your quote</h3>
        <span className="badge badge-muted">{form.rfq ? 'Indicative · RFQ' : 'Instant'}</span>
      </div>
      {form.service && (
        <div className="bk-quote-vehicle">
          <span className="bk-vcard-icon" aria-hidden="true">
            <Icon name={SERVICE_ICON[form.service]} size={22} />
          </span>
          <div>
            <div style={{ fontWeight: 700 }}>{services.find((s) => s.id === form.service)?.title}</div>
            <div className="small muted">
              {l.levels[form.level]?.label} · {l.levels[form.level]?.eta}
              {vehicle ? ` · ${vehicle.name}` : ''}
            </div>
          </div>
        </div>
      )}
      {(origin || dest || form.date) && (
        <div className="bk-route">
          {(origin || dest) && (
            <div>
              <Icon name="pin" size={16} />
              <span>
                {origin?.name ?? '—'} → {dest?.name ?? '—'}
                {km ? ` · ${km} km` : ''}
              </span>
            </div>
          )}
          {crossTo && (
            <div>
              <Icon name="globe" size={16} />
              <span>
                {CROSS_BORDER_NAMES[crossTo]} via {post?.name ?? '…'}
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
      {quote ? (
        <QuoteBreakdown quote={quote} rfq={form.rfq} />
      ) : (
        <p className="muted small" style={{ marginTop: 8 }}>
          {form.service ? 'Add shipment details to see a live price.' : 'Choose a service to see a live price.'}
        </p>
      )}
      {quote && !check.ok && check.errors.length > 0 && step > 0 && (
        <p className="tiny" style={{ color: 'var(--warn)', marginTop: 8 }}>
          {check.errors[0]}
        </p>
      )}
    </div>
  );

  return (
    <main className={`bk-page${quote ? ' has-bar' : ''}`}>
      <div className="container">
        <header className="bk-head">
          <span className="eyebrow">Freight & logistics</span>
          <h1 className="h2" style={{ margin: '8px 0 0' }}>
            Ship with {tenant.name}
          </h1>
          <p className="lead muted">Instant all-in quote — fuel, VAT{l.crossBorder.enabled ? ' and border fees' : ''} shown before you book.</p>
        </header>
        {switcher}

        <nav className="bk-stepper" aria-label="Shipment progress">
          <ol className="bk-steps">
            {STEPS.map((label, i) => {
              const state = i < step ? 'done' : i === step ? 'current' : 'todo';
              return (
                <li key={label} aria-current={i === step ? 'step' : undefined}>
                  <button
                    type="button"
                    className="bk-step-btn"
                    data-state={state}
                    disabled={i === step || i > LAST}
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
          <div className="bk-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-valuetext={`Step ${step + 1}: ${STEPS[step]}`}>
            <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
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
                if (step < LAST) next();
                else void submit();
              }}
              aria-labelledby="bk-step-heading"
            >
              {step === 0 && (
                <>
                  <StepHeading headingRef={headingRef} title="What are you shipping?" sub="Choose a service and how fast it needs to arrive." />
                  <div className="fr-cards" role="radiogroup" aria-label="Freight service" id="fr-service">
                    {services.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        aria-checked={form.service === s.id}
                        className="fr-card"
                        onClick={() => {
                          setForm((f) =>
                            f.service === s.id
                              ? f
                              : { ...f, service: s.id, vehicleId: '', helpers: 0, packages: 1, pallets: 1, lengthCm: '', widthCm: '', heightCm: '' },
                          );
                          setErrors({});
                        }}
                      >
                        <span className="service-icon">
                          <Icon name={SERVICE_ICON[s.id]} size={22} />
                        </span>
                        <strong>{s.title}</strong>
                        <span className="small muted">{s.description}</span>
                      </button>
                    ))}
                  </div>
                  {errors.service && (
                    <p className="field-error" role="alert">
                      {errors.service}
                    </p>
                  )}
                  <div className="bk-section">
                    <span className="label" id="fr-level-label">
                      Delivery speed
                    </span>
                    <div className="fr-cards" role="radiogroup" aria-labelledby="fr-level-label" id="fr-level" style={{ marginTop: 8 }}>
                      {LEVELS.filter((k) => l.levels[k]?.enabled).map((k) => {
                        const lv = l.levels[k];
                        const tooFar = !!(lv.maxKm && km > lv.maxKm);
                        return (
                          <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={form.level === k}
                            aria-disabled={tooFar}
                            className="fr-card"
                            onClick={() => !tooFar && set('level', k)}
                          >
                            <strong>
                              {lv.label} {lv.multiplier !== 1 && <span className="tiny muted">×{lv.multiplier}</span>}
                            </strong>
                            <span className="small muted">
                              {lv.eta}
                              {lv.maxKm ? ` · up to ${lv.maxKm} km` : ''}
                            </span>
                            {tooFar && <span className="tiny" style={{ color: 'var(--warn)' }}>Not available for {km} km</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {step === 1 && form.service && (
                <StepShipment headingRef={headingRef} form={form} set={set} errors={errors} vehicles={vehicles} tenant={tenant} fmtMoney={fmtMoney} />
              )}

              {step === 2 && (
                <>
                  <StepHeading headingRef={headingRef} title="Route & collection" sub="Town-level pickup and delivery. Distance is estimated — edit it if you know better." />
                  <fieldset className="bk-fieldset bk-section">
                    <legend className="bk-legend">
                      <span className="bk-dot" aria-hidden="true" /> Collection
                    </legend>
                    <div className="form-grid">
                      <Field id="fr-pickupAddress" label="Street address / site" error={errors.pickupAddress}>
                        <input {...aria('fr-pickupAddress', errors.pickupAddress)} className="input" maxLength={LIMITS.address} value={form.pickupAddress} onChange={(e) => set('pickupAddress', e.target.value)} autoComplete="street-address" />
                      </Field>
                      <PlacePicker id="fr-pickupPlaceId" label="Town / city" country={country.code} regions={tenant.serviceAreas} value={form.pickupPlaceId} onChange={(p) => setPlace('pickupPlaceId', p?.id ?? '')} error={errors.pickupPlaceId} />
                    </div>
                  </fieldset>
                  <fieldset className="bk-fieldset bk-section">
                    <legend className="bk-legend">
                      <span className="bk-dot drop" aria-hidden="true" /> Delivery
                    </legend>
                    <div className="form-grid">
                      <Field id="fr-dropAddress" label="Street address / site" error={errors.dropAddress}>
                        <input {...aria('fr-dropAddress', errors.dropAddress)} className="input" maxLength={LIMITS.address} value={form.dropAddress} onChange={(e) => set('dropAddress', e.target.value)} />
                      </Field>
                      <PlacePicker
                        id="fr-dropPlaceId"
                        label="Town / city"
                        country={country.code}
                        regions={tenant.serviceAreas}
                        crossBorder={l.crossBorder.enabled ? l.crossBorder.countries : undefined}
                        value={form.dropPlaceId}
                        onChange={(p) => setPlace('dropPlaceId', p?.id ?? '')}
                        error={errors.dropPlaceId}
                        hint={l.crossBorder.enabled ? `Includes ${l.crossBorder.countries.map((c) => CROSS_BORDER_NAMES[c]).join(', ')}.` : undefined}
                      />
                      <Field id="fr-recipientName" label="Recipient name" error={errors.recipientName}>
                        <input {...aria('fr-recipientName', errors.recipientName)} className="input" maxLength={LIMITS.name} value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} />
                      </Field>
                      <Field id="fr-recipientPhone" label="Recipient phone" error={errors.recipientPhone} hint={crossTo ? 'Use the international format, e.g. +266 …' : undefined}>
                        <input {...aria('fr-recipientPhone', errors.recipientPhone, !!crossTo)} className="input" inputMode="tel" maxLength={LIMITS.phone} placeholder={crossTo ? '+266 …' : country.phonePlaceholder} value={form.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} />
                      </Field>
                    </div>
                  </fieldset>

                  {crossTo && (
                    <div className="bk-section card" style={{ background: 'rgb(var(--accent-rgb) / 0.06)' }}>
                      <div className="spread">
                        <strong>
                          <Icon name="globe" size={16} /> Cross-border to {CROSS_BORDER_NAMES[crossTo]}
                        </strong>
                        {SACU.includes(crossTo) ? <span className="badge badge-accent">SACU</span> : <span className="badge">Clearing agent required</span>}
                      </div>
                      <Field id="fr-borderPostId" label="Border post" error={errors.borderPostId} className="bk-section">
                        <select {...aria('fr-borderPostId', errors.borderPostId)} className="select" value={form.borderPostId} onChange={(e) => set('borderPostId', e.target.value)}>
                          {posts.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} · {b.hours} · typical delay ~{b.typicalDelayHrs} h
                            </option>
                          ))}
                        </select>
                      </Field>
                      <p className="small" style={{ margin: '10px 0 0' }}>
                        <strong>Documents you’ll need</strong>
                      </p>
                      <ul className="fr-docs">
                        <li>Commercial invoice & packing list</li>
                        <li>Customs declaration (SAD500) & proof of export</li>
                        <li>Carrier cross-border permit — we handle this</li>
                        <li>Consignee details (recipient above)</li>
                        {!SACU.includes(crossTo) && <li>Clearing agent at destination & transit bond</li>}
                      </ul>
                      {l.crossBorder.note && <p className="tiny muted" style={{ marginTop: 8 }}>{l.crossBorder.note}</p>}
                    </div>
                  )}

                  <div className="bk-section form-grid">
                    <Field
                      id="fr-km"
                      label="Distance (km, one way)"
                      error={errors.km}
                      hint={estimate !== null ? (form.kmManual && Number(form.km) !== estimate ? `You changed this. Our estimate is ~${estimate} km.` : `Estimated ~${estimate} km by road.`) : 'Select both towns for an estimate.'}
                    >
                      <div className="bk-km">
                        <input
                          {...aria('fr-km', errors.km, true)}
                          className="input"
                          type="number"
                          inputMode="decimal"
                          min={1}
                          max={MAX_KM}
                          value={form.km}
                          onChange={(e) => {
                            set('km', e.target.value);
                            set('kmManual', true);
                          }}
                        />
                        {estimate !== null && form.kmManual && Number(form.km) !== estimate && (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, km: String(estimate), kmManual: false }))}>
                            Use estimate
                          </button>
                        )}
                      </div>
                    </Field>
                    <Field id="fr-date" label="Collection date" error={errors.date}>
                      <input
                        {...aria('fr-date', errors.date)}
                        className="input"
                        type="date"
                        min={todayIn(tz, minDT)}
                        max={todayIn(tz, new Date(Date.now() + MAX_ADVANCE_DAYS * 86_400_000))}
                        value={form.date}
                        onChange={(e) => set('date', e.target.value)}
                      />
                    </Field>
                    <Field id="fr-time" label="Collection time" error={errors.time}>
                      <select {...aria('fr-time', errors.time)} className="select" value={form.time} onChange={(e) => set('time', e.target.value)}>
                        <option value="">Select time…</option>
                        {SLOTS.map((s) => {
                          const tooSoon = form.date ? slotDate(form.date, s, tz) < minDT : false;
                          return (
                            <option key={s} value={s} disabled={tooSoon}>
                              {s}
                              {tooSoon ? ' (too soon)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </Field>
                  </div>
                  {errors.freight && (
                    <div className="alert alert-warn" role="alert" style={{ marginTop: 12 }}>
                      <Icon name="clock" size={18} /> <span>{errors.freight}</span>
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <StepHeading headingRef={headingRef} title="Your details" sub="Business customers: add your VAT number and PO for a tax invoice." />
                  <div className="form-grid">
                    <Field id="fr-name" label="Full name" error={errors.name}>
                      <input {...aria('fr-name', errors.name)} className="input" autoComplete="name" maxLength={LIMITS.name} value={form.name} onChange={(e) => set('name', e.target.value)} />
                    </Field>
                    <Field id="fr-phone" label="Mobile number" error={errors.phone} hint={`${country.name} number — we’ll WhatsApp updates here.`}>
                      <input {...aria('fr-phone', errors.phone, true)} className="input" inputMode="tel" autoComplete="tel" maxLength={LIMITS.phone} placeholder={country.phonePlaceholder} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                    </Field>
                    <Field id="fr-email" label="Email (optional)" error={errors.email}>
                      <input {...aria('fr-email', errors.email)} className="input" type="email" autoComplete="email" maxLength={LIMITS.email} value={form.email} onChange={(e) => set('email', e.target.value)} />
                    </Field>
                    <Field id="fr-company" label="Company (optional)">
                      <input id="fr-company" className="input" autoComplete="organization" maxLength={LIMITS.company} value={form.company} onChange={(e) => set('company', e.target.value)} />
                    </Field>
                    <Field id="fr-vatNo" label="VAT number (optional)">
                      <input id="fr-vatNo" className="input" maxLength={30} value={form.vatNo} onChange={(e) => set('vatNo', e.target.value)} />
                    </Field>
                    <Field id="fr-poNumber" label="PO / reference (optional)">
                      <input id="fr-poNumber" className="input" maxLength={40} value={form.poNumber} onChange={(e) => set('poNumber', e.target.value)} />
                    </Field>
                    <Field id="fr-notes" label="Notes for the driver (optional)" className="span-2">
                      <textarea id="fr-notes" className="textarea" maxLength={LIMITS.notes} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Access, loading dock hours, contact on site…" />
                    </Field>
                    {(tenant.promotions ?? []).some((p) => p.active && p.code) && (
                      <Field id="fr-promoInput" label="Promo code" error={errors.promoInput} className="span-2">
                        <div className="bk-promo">
                          <input {...aria('fr-promoInput', errors.promoInput)} className="input" maxLength={LIMITS.promo} value={form.promoInput} onChange={(e) => set('promoInput', e.target.value.toUpperCase())} />
                          <button type="button" className="btn btn-ghost" onClick={applyPromo}>
                            Apply
                          </button>
                        </div>
                        {promoMsg && <span className={promoMsg.ok ? 'hint' : 'field-error'}>{promoMsg.text}</span>}
                      </Field>
                    )}
                  </div>
                  <div className="stack bk-section" style={{ '--gap': '10px' } as CSSProperties}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        id="fr-rfq"
                        checked={form.rfq}
                        onChange={(e) => setForm((f) => ({ ...f, rfq: e.target.checked, rfqTouched: true }))}
                      />
                      <span>
                        Request a firm quote (RFQ) — our freight desk confirms the price before dispatch
                        {((form.service === 'ftl' && km > RFQ_KM) || crossTo) && <span className="muted"> · recommended for this shipment</span>}
                      </span>
                    </label>
                    <label className="checkbox bk-agree">
                      <input type="checkbox" id="fr-agree" checked={form.agree} onChange={(e) => set('agree', e.target.checked)} aria-invalid={!!errors.agree} />
                      <span>
                        I understand this is an indicative quote. {tenant.booking.paymentNote} I accept the <BookingTermsLinks />.
                      </span>
                    </label>
                    {errors.agree && <span className="field-error">{errors.agree}</span>}
                  </div>
                </>
              )}

              {submitError && step === LAST && (
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
                {step < LAST ? (
                  <button type="submit" className="btn btn-primary">
                    Continue <Icon name="arrow" size={18} />
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} aria-busy={submitting} id="fr-submit">
                    {submitting ? 'Submitting…' : `${form.rfq ? 'Request quote' : 'Book shipment'}${quote ? ` · ${fmtMoney(quote.total)}` : ''}`}
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
      {quote && (
        <div className="bk-bar" role="region" aria-label="Quote summary">
          {sheetOpen && (
            <div className="bk-bar-sheet" id="fr-sheet">
              {summary}
            </div>
          )}
          <div className="bk-bar-row">
            <div className="bk-bar-total">
              <span className="small muted">{form.rfq ? 'Indicative total' : 'Estimated total'}</span>
              <strong aria-live="polite">{fmtMoney(quote.total)}</strong>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" aria-expanded={sheetOpen} aria-controls="fr-sheet" onClick={() => setSheetOpen((o) => !o)}>
              {sheetOpen ? 'Hide' : 'Details'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ── step 2: shipment ─────────────────────────────────────────

function StepShipment({
  headingRef,
  form,
  set,
  errors,
  vehicles,
  tenant,
  fmtMoney,
}: {
  headingRef: HeadingRef;
  form: FForm;
  set: <K extends keyof FForm>(k: K, v: FForm[K]) => void;
  errors: Errors;
  vehicles: Vehicle[];
  tenant: TenantConfig;
  fmtMoney: (n: number) => string;
}) {
  const l = tenant.logistics;
  const fr = toFreight(form, '', 0, undefined, tenant.locale.country);
  const vol = volumetricKg(fr, l.volumetricDivisor);
  const charge = chargeableKg(fr, l.volumetricDivisor);
  const dedicated = form.service === 'ftl' || form.service === 'removals';
  return (
    <>
      <StepHeading
        headingRef={headingRef}
        title="Shipment details"
        sub={dedicated ? 'Pick the vehicle that fits your load.' : form.service === 'ltl' ? 'Pay only for the pallet space you use.' : 'Billed on the greater of actual and volumetric weight.'}
      />
      {dedicated && (
        <div className="grid bk-vgrid" id="fr-vehicleId" role="radiogroup" aria-label="Vehicle">
          {vehicles.length === 0 && <div className="alert alert-warn">No vehicles are set up for this service yet — please call us.</div>}
          {vehicles.map((v) => (
            <button key={v.id} type="button" className="bk-vcard" role="radio" aria-checked={form.vehicleId === v.id} aria-pressed={form.vehicleId === v.id} onClick={() => set('vehicleId', v.id)}>
              <span className="bk-vcard-check" aria-hidden="true">
                <Icon name="check" size={14} />
              </span>
              <span className="bk-vcard-icon" aria-hidden="true">
                <Icon name={TYPE_ICON[v.type] ?? 'truck'} size={24} />
              </span>
              <span className="bk-vcard-name">{v.name}</span>
              <span className="bk-vcard-meta">
                <span className="badge badge-muted">{TYPE_LABEL[v.type] ?? v.type}</span>
                <span className="badge">{capacityText(v)}</span>
              </span>
              <span className="bk-vcard-price">
                <span>
                  <span className="tiny muted">From </span>
                  <strong>{fmtMoney(v.baseFare)}</strong>
                </span>
                <span className="small muted">{fmtMoney(v.perKm)}/km</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {errors.vehicleId && (
        <p className="field-error" role="alert">
          {errors.vehicleId}
        </p>
      )}

      <div className="form-grid bk-section">
        {form.service === 'ltl' && (
          <Field id="fr-pallets" label="Pallets" error={errors.pallets} hint={`Up to ${l.ltl.maxPallets} pallets · max ${l.ltl.palletMaxKg} kg each.`}>
            <Counter id="fr-pallets" label="Pallets" value={form.pallets} min={1} max={l.ltl.maxPallets} onChange={(n) => set('pallets', n)} error={errors.pallets} />
          </Field>
        )}
        {form.service === 'courier' && (
          <Field id="fr-packages" label="Parcels" hint="Identical boxes — use the largest size below.">
            <Counter id="fr-packages" label="Parcels" value={form.packages} min={1} max={50} onChange={(n) => set('packages', n)} />
          </Field>
        )}
        {form.service === 'removals' && (
          <Field id="fr-helpers" label="Loading helpers" hint={`${fmtMoney(l.addOns.helperPerPerson)} per helper.`}>
            <Counter id="fr-helpers" label="Helpers" value={form.helpers} min={0} max={10} onChange={(n) => set('helpers', n)} />
          </Field>
        )}
        {(form.service === 'ltl' || form.service === 'courier' || form.service === 'ftl') && (
          <Field id="fr-weightKg" label={form.service === 'ftl' ? 'Approx. total weight (kg, optional)' : 'Total weight (kg)'} error={errors.weightKg}>
            <input {...aria('fr-weightKg', errors.weightKg)} className="input" type="number" inputMode="decimal" min={0} max={40000} value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />
          </Field>
        )}
        {form.service === 'courier' && (
          <div className="field span-2">
            <span className="label">Box size (cm) — L × W × H</span>
            <div className="row" style={{ '--gap': '8px', flexWrap: 'nowrap' } as CSSProperties}>
              {(['lengthCm', 'widthCm', 'heightCm'] as const).map((k) => (
                <input key={k} id={`fr-${k}`} aria-label={k.replace('Cm', ' (cm)')} className="input" type="number" inputMode="numeric" min={0} max={1500} value={form[k]} onChange={(e) => set(k, e.target.value)} />
              ))}
            </div>
            <div className="fr-readout" aria-live="polite" style={{ marginTop: 8 }}>
              <span>
                Actual <strong>{num(form.weightKg) || 0} kg</strong>
              </span>
              <span>
                Volumetric <strong>{Math.round(vol * 10) / 10} kg</strong>
              </span>
              <span>
                Billed on <strong>{charge} kg</strong>
              </span>
              <span className="muted">Max {l.courier.maxKg} kg</span>
            </div>
          </div>
        )}
        <Field id="fr-description" label="What are the goods?" error={errors.description} className="span-2">
          <input {...aria('fr-description', errors.description)} className="input" maxLength={300} placeholder="e.g. Boxed retail stock, building materials, office furniture" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field id="fr-declaredValue" label={`Declared value (${tenant.locale.currency}, optional)`} error={errors.declaredValue} hint={`Top-up cover ${l.addOns.insurancePct}% (min ${fmtMoney(l.addOns.insuranceMin)}).`}>
          <input {...aria('fr-declaredValue', errors.declaredValue, true)} className="input" type="number" inputMode="decimal" min={0} value={form.declaredValue} onChange={(e) => set('declaredValue', e.target.value)} />
        </Field>
      </div>

      <div className="fr-toggles bk-section">
        <label className="checkbox">
          <input type="checkbox" checked={form.insured} onChange={(e) => set('insured', e.target.checked)} /> <span>Insure for declared value</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.tailLift} onChange={(e) => set('tailLift', e.target.checked)} /> <span>Tail-lift (+{fmtMoney(l.addOns.tailLift)})</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={form.afterHours} onChange={(e) => set('afterHours', e.target.checked)} /> <span>After-hours / weekend (+{fmtMoney(l.addOns.afterHours)})</span>
        </label>
        <label className="checkbox">
          <input type="checkbox" id="fr-hazardous" checked={form.hazardous} onChange={(e) => set('hazardous', e.target.checked)} /> <span>Dangerous goods (hazchem)</span>
        </label>
      </div>
      {errors.hazardous && (
        <div className="alert alert-err" role="alert">
          <Icon name="shield" size={18} />
          <div className="stack" style={{ '--gap': '8px' } as CSSProperties}>
            <span>{errors.hazardous}</span>
            <ContactButtons tenant={tenant} small />
          </div>
        </div>
      )}
      {errors.freight && (
        <div className="alert alert-warn" role="alert" style={{ marginTop: 12 }}>
          <Icon name="clock" size={18} /> <span>{errors.freight}</span>
        </div>
      )}
    </>
  );
}

// ── confirmation ─────────────────────────────────────────────

function FreightDone({ done, tenant, headingRef, fmtMoney }: { done: Done; tenant: TenantConfig; headingRef: HeadingRef; fmtMoney: (n: number) => string }) {
  const { ref, booking: b } = done;
  const f = b.freight!;
  const [copied, setCopied] = useState(false);
  const lvl = tenant.logistics.levels[f.level];
  const waText = [
    `Hello ${tenant.name}, I booked a shipment online.`,
    `Ref: ${ref}${b.rfq ? ' (firm quote requested)' : ''}`,
    `Service: ${b.vehicleName} · ${lvl?.label ?? f.level}`,
    `From: ${b.pickup.address}, ${b.pickup.place}`,
    `To: ${b.dropoff.address}, ${b.dropoff.place} (${b.dropoff.region})`,
    f.crossBorder ? `Border: ${f.crossBorder.borderPostName}` : '',
    `Goods: ${f.description}${f.pallets ? ` · ${f.pallets} pallet(s)` : ''}${f.weightKg ? ` · ${f.weightKg} kg` : ''}`,
    `Collection: ${b.date} ${b.time}`,
    `Estimated total: ${fmtMoney(b.quote.total)}`,
    `Name: ${b.customer.name} (${b.customer.phone})`,
  ]
    .filter(Boolean)
    .join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <section className="bk-done" aria-labelledby="bk-done-heading">
      <div className="bk-done-icon" aria-hidden="true">
        <Icon name="check" size={36} />
      </div>
      <h1 className="h2" id="bk-done-heading" ref={headingRef} tabIndex={-1} style={{ margin: 0, outline: 'none' }}>
        {b.rfq ? 'Quote request received' : 'Shipment booked'}
      </h1>
      <p className="lead muted" style={{ marginTop: 8 }}>
        Thank you, {b.customer.name.split(' ')[0]}. Our freight desk will contact you on {b.customer.phone}
        {b.rfq ? ' with a firm price.' : ' to confirm collection.'}
      </p>
      <div className="bk-ref">
        <div style={{ textAlign: 'left' }}>
          <div className="tiny muted">Consignment reference</div>
          <code>{ref}</code>
        </div>
        <button type="button" className="icon-btn" onClick={() => void copy()} aria-label="Copy reference">
          <Icon name={copied ? 'check' : 'copy'} size={18} />
        </button>
      </div>
      <div className="bk-done-actions bk-actions">
        {tenant.booking.whatsappConfirm && tenant.contact.whatsapp && (
          <a className="btn btn-primary btn-lg" href={waLink(tenant.contact.whatsapp, waText)} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" /> Send to WhatsApp
          </a>
        )}
        <Link className="btn btn-ghost btn-lg" to={`/track?ref=${encodeURIComponent(ref)}`}>
          <Icon name="gps" /> Track shipment
        </Link>
        <button type="button" className="btn btn-ghost btn-lg" onClick={() => window.print()}>
          <Icon name="download" /> Print / PDF
        </button>
        {tenant.contact.phone && (
          <a className="btn btn-ghost btn-lg" href={telLink(tenant.contact.phone)}>
            <Icon name="phone" /> Call
          </a>
        )}
      </div>
      <div className="consignment" style={{ textAlign: 'left', marginTop: 20 }}>
        <h3>Consignment note · {ref}</h3>
        <dl>
          <dt>Service</dt>
          <dd>
            {b.vehicleName} · {lvl?.label} ({lvl?.eta})
          </dd>
          <dt>Shipper</dt>
          <dd>
            {b.customer.name}
            {b.customer.company ? `, ${b.customer.company}` : ''}
            {b.customer.vatNo ? ` · VAT ${b.customer.vatNo}` : ''}
            {b.customer.poNumber ? ` · PO ${b.customer.poNumber}` : ''}
          </dd>
          <dt>Collect</dt>
          <dd>
            {b.pickup.address}, {b.pickup.place}, {b.pickup.region} — {b.date} {b.time}
          </dd>
          <dt>Deliver</dt>
          <dd>
            {b.dropoff.address}, {b.dropoff.place}, {b.dropoff.region}
          </dd>
          <dt>Recipient</dt>
          <dd>
            {b.recipient?.name} · {b.recipient?.phone}
          </dd>
          {f.crossBorder && (
            <>
              <dt>Border</dt>
              <dd>
                {f.crossBorder.borderPostName} → {CROSS_BORDER_NAMES[f.crossBorder.country]}
              </dd>
            </>
          )}
          <dt>Goods</dt>
          <dd>
            {f.description}
            {f.pallets ? ` · ${f.pallets} pallet(s)` : ''}
            {f.service === 'courier' ? ` · ${f.packages} parcel(s)` : ''}
            {f.weightKg ? ` · ${f.weightKg} kg` : ''}
            {f.insured ? ` · insured ${fmtMoney(f.declaredValue)}` : ''}
          </dd>
          <dt>Distance</dt>
          <dd>~{b.distanceKm} km</dd>
        </dl>
        <div style={{ marginTop: 14 }}>
          <QuoteBreakdown quote={b.quote} rfq={b.rfq} compact />
        </div>
      </div>
    </section>
  );
}
