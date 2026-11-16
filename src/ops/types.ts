// ─────────────────────────────────────────────────────────────
// Operations module (dispatch console + driver app) — data contracts.
// Firestore layout (per tenant):
//   tenants/{t}/vehicles/{vehicleId}          Vehicle unit (actual truck, by registration)
//   tenants/{t}/drivers/{uid}                 Driver profile; doc id == Firebase Auth uid
//   tenants/{t}/jobs/{jobId}                  Job (one trip / consignment)
//   tenants/{t}/jobs/{jobId}/events/{id}      Status audit trail (who, when, where)
//   tenants/{t}/media/{mediaId}               Compressed photos/signatures as data URLs (≤ 700 KB)
//   tenants/{t}/threads/{threadId}            Chat thread (driver uid, or 'broadcast')
//   tenants/{t}/threads/{threadId}/messages/{id}
//   tenants/{t}/locations/{uid}               Last known driver position (while on duty)
//   tenants/{t}/fuel/{id}                     Fuel / expense log entries
//   tenants/{t}/transporters/{id}             Subcontracted transport companies (hired trucks + drivers)
//   tenants/{t}/finance/{jobId}               Sell price + buy cost of a job (dispatch only — drivers never read it)
//   tenants/{t}/settlements/{id}              Transporter payment statements
//   tenants/{t}/devices/{deviceId}            Push-notification tokens (FCM) per signed-in device
//   jobLinks/{token}                          One-time job links for external (hired) drivers
//   driverIndex/{uid}                         { tenantId } — lets the driver app find its tenant
// Media stays in Firestore (no Cloud Storage). Push notifications are sent by Cloud Functions
// (functions/, needs the Blaze plan); everything else also runs on the free Spark plan.
// ─────────────────────────────────────────────────────────────
import type { Stop, VehicleType } from '../tenant/types';

export type VehicleStatus = 'available' | 'on_job' | 'maintenance' | 'inactive';

/** Own fleet vs. hired in from a transporter (subcontractor). */
export type Ownership = 'own' | 'hired';

// ── transporters (subcontractors) ────────────────────────────

/** How a hired truck is paid. Transporters can have several lines ("mix"). */
export type RateBasis = 'trip' | 'km' | 'day' | 'hour' | 'ton' | 'load';

export const RATE_BASIS_LABEL: Record<RateBasis, string> = {
  trip: 'per trip',
  km: 'per km',
  day: 'per day',
  hour: 'per hour',
  ton: 'per ton',
  load: 'per load',
};

export interface RateLine {
  id: string;
  basis: RateBasis;
  amount: number; // excl. VAT
  /** Optional vehicle class this rate applies to (blank = any). */
  vehicleType?: VehicleType;
  minCharge?: number;
  /** Free text: lane, conditions ("JHB–DBN", "fuel incl."). */
  note?: string;
}

export interface Transporter {
  id: string;
  name: string; // trading name
  contactName: string;
  phone: string; // +27…
  email?: string;
  regNo?: string; // CIPC registration
  vatNo?: string;
  bank?: { bank: string; accountName: string; accountNo: string; branchCode?: string };
  /** Compliance documents (yyyy-mm-dd). Expired GIT insurance blocks assignment. */
  gitInsuranceExpiry?: string;
  gitCover?: number; // rand value of goods-in-transit cover
  taxClearanceExpiry?: string;
  bbbeeExpiry?: string;
  bbbeeLevel?: number;
  rates: RateLine[];
  paymentTermsDays?: number; // e.g. 30
  vatRegistered?: boolean;
  active: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// ── job costing (dispatch only) ──────────────────────────────

export interface CostAdj {
  label: string; // "Waiting time", "Tolls", "Fuel advance", "Damage"
  amount: number; // positive
}

/** What we pay the transporter for a hired job. */
export interface BuyCost {
  transporterId: string;
  transporterName: string;
  basis: RateBasis;
  rate: number;
  /** Units for the basis (km, days, tons…); trip/load = 1. When basis = km and qtyFromOdo, qty follows actual km. */
  qty: number;
  qtyFromOdo?: boolean;
  minCharge?: number;
  extras: CostAdj[];
  deductions: CostAdj[];
  /** max(rate*qty, minCharge) + extras − deductions (excl. VAT). */
  total: number;
  vatRate?: number; // 0.15 when the transporter is VAT registered
  note?: string;
}

export interface JobFinance {
  /** == job id */
  id: string;
  price?: number; // sell price incl. VAT (what the customer pays)
  currency: 'ZAR' | 'LKR';
  cost?: BuyCost;
  /** Set when the cost is put on a settlement statement (locks it). */
  settlementId?: string;
  updatedAt: number;
}

export type SettlementStatus = 'draft' | 'approved' | 'paid';

export interface SettlementLine {
  jobId: string;
  ref: string;
  date: string; // yyyy-mm-dd
  route: string;
  vehicleReg?: string;
  basis: RateBasis;
  qty: number;
  amount: number; // BuyCost.total
  vatRate?: number; // BuyCost.vatRate at the time
  podOk: boolean;
}

export interface Settlement {
  id: string;
  ref: string; // "STL-XXXX"
  transporterId: string;
  transporterName: string;
  from: string; // yyyy-mm-dd
  to: string;
  lines: SettlementLine[];
  subtotal: number;
  vat: number;
  total: number;
  currency: 'ZAR' | 'LKR';
  invoiceNo?: string; // transporter's invoice
  status: SettlementStatus;
  approvedBy?: string;
  approvedAt?: number;
  paidAt?: number;
  paymentRef?: string;
  notes?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ── one-time job links (external drivers) ────────────────────

export type JobLinkStatus = 'open' | 'claimed' | 'revoked' | 'closed';

/** Top-level `jobLinks/{token}`. The token (32 random chars) is the secret in the URL /j/{token}. */
export interface JobLink {
  token: string;
  tenantId: string;
  jobIds: string[]; // one job, or a trip of several
  driverName: string;
  phone?: string;
  vehicleReg?: string;
  transporterId?: string;
  transporterName?: string;
  status: JobLinkStatus;
  createdBy: string;
  createdAt: number;
  expiresAt: number; // ms
  claimedBy?: string; // anonymous Firebase uid of the phone that opened it first
  claimedAt?: number;
}

/** Placeholder driverId on a job that waits for its link to be opened. */
export const LINK_DRIVER_PREFIX = 'link:';

// ── push notifications ───────────────────────────────────────

export interface Device {
  id: string; // stable per install
  uid: string;
  role: 'ops' | 'driver';
  token: string; // FCM registration token
  platform: 'android' | 'ios' | 'web';
  tenantId: string;
  updatedAt: number;
}

export interface FleetUnit {
  id: string;
  registration: string; // e.g. "GP 123-456" / "CA 12345"
  name: string; // friendly name, e.g. "Tipper 10m³ #2"
  type: VehicleType;
  /** Optional link to the public fleet catalogue entry (TenantConfig.fleet[].id) for pricing. */
  fleetId?: string;
  make?: string;
  model?: string;
  year?: number;
  capacity?: string; // "10 m³" / "34 t"
  status: VehicleStatus;
  /** 'hired' = belongs to a transporter (subcontractor). Default 'own'. */
  ownership?: Ownership;
  transporterId?: string;
  transporterName?: string;
  odometerKm: number; // last confirmed reading
  serviceIntervalKm?: number; // e.g. 15000
  lastServiceKm?: number;
  licenceDiscExpiry?: string; // yyyy-mm-dd
  roadworthyExpiry?: string;
  insuranceExpiry?: string;
  permitExpiry?: string; // cross-border / operating permit
  trackerId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export type DriverStatus = 'off_duty' | 'available' | 'on_job';

export interface Driver {
  /** == Firebase Auth uid (demo mode: generated). */
  id: string;
  name: string;
  phone: string; // +27…
  email?: string;
  licenceCode?: string; // e.g. "EC", "C1"
  licenceExpiry?: string;
  prdpExpiry?: string; // Professional Driving Permit
  medicalExpiry?: string;
  defaultVehicleId?: string;
  status: DriverStatus;
  active: boolean;
  /** 'hired' = works for a transporter. Default 'own'. */
  ownership?: Ownership;
  transporterId?: string;
  transporterName?: string;
  /** One-time-link driver (anonymous login, limited to the link's jobs, expires). */
  external?: boolean;
  linkToken?: string;
  expiresAt?: number;
  /** Login identifier shown to admins (phone-based sign-in). */
  loginId: string;
  createdAt: number;
  updatedAt: number;
}

/** Driver-facing workflow. Order matters (index used for progress). */
export const JOB_FLOW = [
  'assigned',
  'accepted',
  'started', // pre-trip check + start ODO captured
  'at_pickup',
  'loaded', // goods picked up
  'in_transit',
  'at_delivery',
  'delivered', // POD captured
  'completed', // end ODO captured, trip closed
] as const;

export type JobStatus = 'draft' | (typeof JOB_FLOW)[number] | 'cancelled' | 'failed';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  accepted: 'Accepted',
  started: 'Trip started',
  at_pickup: 'At pickup',
  loaded: 'Picked up',
  in_transit: 'In transit',
  at_delivery: 'At delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export type Priority = 'normal' | 'high' | 'urgent';

export interface OdoReading {
  km: number;
  at: number;
  method: 'ocr' | 'manual';
  /** Raw OCR value and confidence when method = 'ocr' or when OCR was attempted. */
  ocrKm?: number;
  ocrConfidence?: number; // 0–100
  photoId?: string; // media id
  lat?: number;
  lng?: number;
}

export interface InspectionItem {
  key: string;
  label: string;
  ok: boolean;
  note?: string;
}

export interface Inspection {
  at: number;
  items: InspectionItem[];
  allOk: boolean;
  photoIds?: string[];
}

export interface Pod {
  recipientName: string;
  signatureId?: string; // media id (PNG)
  photoIds: string[];
  note?: string;
  at: number;
  lat?: number;
  lng?: number;
}

export type StopKind = 'pickup' | 'delivery';
export type StopStatus = 'pending' | 'arrived' | 'done' | 'failed';

/** One pickup or delivery point of a multi-stop job. */
export interface JobStop extends Stop {
  id: string;
  kind: StopKind;
  /** Planned order (0-based). Driver may do them in this order. */
  seq: number;
  contact?: string;
  phone?: string;
  lat?: number;
  lng?: number;
  /** What is collected / dropped here (e.g. "12 pallets", "DN 4471"). */
  cargo?: string;
  reference?: string; // customer's delivery note / PO / order no.
  instructions?: string;
  window?: string; // "08:00–10:00"
  status: StopStatus;
  arrivedAt?: number;
  doneAt?: number;
  /** Pickup: load photos. Delivery: see pod. */
  photoIds?: string[];
  pod?: Pod;
  note?: string;
  failReason?: string;
}

export interface Job {
  id: string;
  ref: string; // human ref, e.g. "JOB-7K2Q9"
  /** Source website booking (if created from one). Updating the job also updates the public tracking record. */
  bookingRef?: string;
  kind: 'vehicle' | 'freight';
  title: string; // "10m³ sand · Midrand → Sandton"
  customer: { name: string; phone: string; company?: string };
  /** First pickup / final delivery. Kept in sync with `stops` for list views and the public tracking page. */
  pickup: Stop & { contact?: string; phone?: string; lat?: number; lng?: number };
  dropoff: Stop & { contact?: string; phone?: string; lat?: number; lng?: number };
  /** Multi-stop jobs: every pickup and delivery in planned order (absent = single pickup → single drop). */
  stops?: JobStop[];
  /** Several jobs dispatched together to one truck/driver ("trip"). */
  tripId?: string;
  tripSeq?: number;
  /** Own truck or hired from a transporter. */
  ownership?: Ownership;
  transporterId?: string;
  transporterName?: string;
  /** One-time link given to an external driver (token is secret — dispatch only). */
  extLink?: { token: string; status: JobLinkStatus; expiresAt: number; driverName: string; phone?: string };
  cargo: string; // description
  instructions?: string; // for the driver
  scheduledDate: string; // yyyy-mm-dd
  scheduledTime: string; // HH:mm
  priority: Priority;
  vehicleId?: string;
  vehicleReg?: string;
  driverId?: string;
  driverName?: string;
  status: JobStatus;
  /** @deprecated moved to finance/{jobId} (drivers can read jobs). Read via jobPrice(). */
  price?: number;
  currency: 'ZAR' | 'LKR';
  estimatedKm?: number;
  odoStart?: OdoReading;
  odoEnd?: OdoReading;
  actualKm?: number; // odoEnd - odoStart
  inspection?: Inspection;
  pod?: Pod;
  failReason?: string;
  createdBy: string; // uid
  createdAt: number;
  updatedAt: number;
  /** Denormalised for list views / rules. */
  lastEventAt?: number;
}

export interface JobEvent {
  id: string;
  status: JobStatus | 'note' | 'reassigned';
  at: number;
  by: string; // uid
  byName: string;
  role: 'ops' | 'driver';
  note?: string;
  /** Photos attached to this step (media ids). */
  photoIds?: string[];
  lat?: number;
  lng?: number;
}

export type MediaKind = 'odo_start' | 'odo_end' | 'fuel_odo' | 'pod_photo' | 'signature' | 'inspection' | 'load' | 'damage' | 'receipt' | 'chat';

export interface Media {
  id: string;
  jobId?: string;
  /** chat photos: the thread they belong to (rules limit drivers to their own thread) */
  threadId?: string;
  kind: MediaKind;
  dataUrl: string; // image/jpeg or image/png data URL, ≤ ~700 KB
  by: string;
  at: number;
  w?: number;
  h?: number;
}

export interface Thread {
  id: string; // driver uid or 'broadcast'
  driverId?: string;
  driverName?: string;
  lastText: string;
  lastAt: number;
  lastFrom: 'ops' | 'driver';
  unreadOps: number; // unread by dispatch
  unreadDriver: number; // unread by driver
}

export interface ChatMessage {
  id: string;
  from: string; // uid
  fromName: string;
  role: 'ops' | 'driver';
  text: string;
  jobId?: string;
  jobRef?: string;
  imageId?: string;
  /** Automatic message (assignment) — no separate push, the job notification covers it. */
  auto?: boolean;
  at: number;
}

export interface DriverLocation {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  accuracy?: number;
  speedKmh?: number;
  heading?: number;
  jobId?: string;
  at: number;
}

export interface FuelEntry {
  id: string;
  driverId: string;
  vehicleId: string;
  jobId?: string;
  litres: number;
  amount: number;
  odometerKm: number;
  station?: string;
  receiptId?: string;
  at: number;
}

/** Who is using the ops module right now. */
export interface OpsUser {
  uid: string;
  name: string;
  role: 'ops' | 'driver';
  tenantId: string;
}

export const DEFAULT_INSPECTION: { key: string; label: string }[] = [
  { key: 'tyres', label: 'Tyres & wheel nuts' },
  { key: 'lights', label: 'Lights & indicators' },
  { key: 'brakes', label: 'Brakes & air pressure' },
  { key: 'fluids', label: 'Oil, water & no leaks' },
  { key: 'mirrors', label: 'Mirrors & windscreen' },
  { key: 'load', label: 'Load secured / tipper body locked' },
  { key: 'docs', label: 'Licence disc, PrDP & permits on board' },
  { key: 'safety', label: 'Triangle, extinguisher & PPE' },
];
