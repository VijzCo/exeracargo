// ─────────────────────────────────────────────────────────────
// Legal documents (defaults). DRAFTS for South Africa (POPIA, ECTA, CPA) with an SADC cross-border note.
// Have them reviewed by a South African attorney before relying on them.
//
// Format: "Markdown-lite" — "## Heading", blank-line separated paragraphs, "- " bullets, **bold**.
// Placeholders {{…}} are filled from the site's Legal settings (Admin → Site content → Legal).
// Bump `version` (yyyy-mm-dd) whenever the meaning changes: users are asked to accept again.
// ─────────────────────────────────────────────────────────────
import type { LegalDocId, TenantConfig } from '../tenant/types';

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  short: string; // tab / link label
  version: string; // yyyy-mm-dd — acceptance is recorded per version
  body: string;
  /** Shown publicly at /legal/<slug> (internal agreements are printed from the console). */
  slug?: string;
}

export const DRAFT_NOTE = 'Draft — have it reviewed by a South African attorney before relying on it.';

const TERMS = `## 1. About these terms
These Terms of Use apply to everyone who uses the {{company}} dispatch console, driver app or one-time job links (the **Platform**). The Platform is operated by {{legalName}} (registration {{regNo}}), {{address}} ("we", "us"). By ticking "I accept" you enter into a binding agreement with us under the Electronic Communications and Transactions Act 25 of 2002 (ECTA).

If you use the Platform for your employer or a transport company, you confirm that you are authorised to do so.

## 2. Your account
- Keep your password or PIN secret. Everything done under your login is treated as done by you.
- Tell us immediately at {{email}} if you think your login was misused.
- We may suspend access that is misused, shared, or no longer needed for your work.

## 3. Acceptable use
You may use the Platform only for genuine transport and logistics work for {{company}}. You must not:
- enter false information (status updates, odometer readings, proof-of-delivery, fuel records);
- access jobs, people or data you are not assigned to, or try to bypass security;
- copy, scrape, reverse-engineer or resell the Platform;
- upload unlawful, offensive or third-party confidential content;
- use the app while driving a vehicle.

## 4. Records and evidence
Job events, photos, signatures, GPS positions, odometer readings and chat messages are time-stamped records. They may be used to invoice customers, pay transporters, settle claims, investigate incidents and comply with law. Electronic records and signatures captured in the Platform are accepted as evidence in terms of ECTA.

## 5. Personal information
We process personal information as described in our Privacy Notice ({{website}}/legal/privacy), in line with the Protection of Personal Information Act 4 of 2013 (POPIA).

## 6. Availability
The Platform is provided "as is". We aim for high availability but do not guarantee uninterrupted service, especially where mobile coverage is poor. Keep a fallback (phone call to dispatch) for urgent matters.

## 7. Liability
To the extent the law allows, we are not liable for indirect or consequential loss arising from use of the Platform. Nothing in these terms limits liability that cannot be limited by law, including under the Consumer Protection Act 68 of 2008 where it applies.

## 8. Changes and termination
We may update these terms. A new version is shown to you before you can continue; using the Platform after accepting it means the new version applies. Access ends when your role ends or we close your account.

## 9. Law and disputes
South African law applies. Disputes go to the {{jurisdiction}}, unless the law gives you another forum. Contact: {{email}} · {{phone}}.`;

const PRIVACY = `## 1. Who we are
{{legalName}} (registration {{regNo}}), trading as {{company}}, {{address}}, is the **responsible party** for personal information processed through our website, booking forms, dispatch console and driver app. Information Officer: {{infoOfficer}} · {{email}}.

## 2. What we collect
- **Customers:** name, phone, email, company and VAT details, pickup and delivery addresses, consignee name and phone, booking history.
- **Drivers and dispatchers:** name, phone or email, login records, licence and PrDP expiry dates, job activity.
- **During a trip:** GPS location (only while the driver is on duty or a job link is active), arrival times, photos (load, damage, odometer, proof of delivery), recipient signatures and names, odometer and fuel records, chat messages.
- **Technical:** device type, app version, push-notification tokens, security logs.

## 3. Why we use it
To quote, book, dispatch and track transport; to prove collection and delivery; to invoice customers and pay transporters; to keep people and cargo safe; to meet legal, tax and insurance requirements; and to improve our service. Our lawful grounds are performing the contract, our legitimate interests in running a safe, accountable transport service, legal obligations, and your consent where we ask for it (e.g. location sharing).

## 4. Location tracking
Driver location is shared only while the driver is marked on duty (or while a one-time job link is active) and is removed from the dispatch map when the driver goes off duty. We do not track drivers outside working time.

## 5. Who we share it with
- Customers see the status of their own consignment and the proof of delivery.
- Transport subcontractors receive what they need to do the job.
- Service providers who host or support the Platform (Google Firebase / Google Cloud for hosting, database, sign-in and notifications), bound by confidentiality and security obligations.
- Authorities, insurers or courts where the law requires or a claim needs it.

We do not sell personal information.

## 6. Cross-border transfers
Our hosting provider may store or process data outside South Africa (and, for cross-border loads, information travels with the consignment to Lesotho, Eswatini, Botswana, Namibia, Zimbabwe or Mozambique). We only transfer where section 72 of POPIA allows it — e.g. the recipient is bound by binding agreements or laws giving adequate protection, or the transfer is necessary to perform your contract.

## 7. How long we keep it
- Bookings, jobs, proof of delivery and invoices: 5 years (tax and claims).
- GPS positions: the latest position only; route history attached to a job is kept with that job.
- Chat messages: 24 months.
- Accounts of people who no longer work with us: closed within 90 days, records kept as above.

## 8. Security
Access is limited by role, data is encrypted in transit, and every change is logged. If a security compromise affects you, we will notify you and the Information Regulator as POPIA requires.

## 9. Your rights
You may ask what we hold about you, ask us to correct or delete it, object to processing, and withdraw consent (withdrawing location consent means you cannot be dispatched through the app). Contact {{email}}. You may complain to the Information Regulator: inforeg.org.za · POPIAComplaints@inforegulator.org.za.

## 10. Changes
We will show you any new version of this notice before it applies.`;

const DRIVER = `## 1. Licence
{{legalName}} ("we") grants you a personal, non-transferable, revocable licence to install and use the {{company}} Driver app (web or Android) on a phone you control, only to carry out jobs we assign to you. The app remains our property; you may not copy, modify or distribute it.

## 2. Company phones and your own phone
- On a company phone, the device and its data belong to us; return it when asked.
- On your own phone, we only access what the app needs (camera when you take a photo, location while on duty, notifications). You can uninstall at any time.

## 3. Safety first
- **Never use the app while the vehicle is moving.** Stop safely before tapping, photographing or chatting.
- Use voice navigation; do not type addresses while driving.
- Your pre-trip inspection must reflect the real condition of the vehicle. Report defects before departing.

## 4. Accurate records
- Status updates (accepted, at pickup, loaded, delivered) must be made at the time they happen and at the place shown.
- Odometer readings read by the camera **must be checked** before you confirm them. Correct any wrong digit.
- Proof of delivery: get the recipient's real name and signature; photograph the goods and paperwork clearly.
- Fuel entries must match the slip.

Falsified records are serious misconduct and may lead to disciplinary action or termination of your engagement and recovery of losses.

## 5. Location consent
You agree that your location is shared with dispatch while you are marked on duty and while a job is in progress, so we can plan, assist you and update customers. Switch to off duty when your shift ends; sharing then stops.

## 6. PIN and account
Your PIN is personal. Do not share it or let anyone else use the app in your name. Tell dispatch immediately if your phone is lost or stolen so we can block access.

## 7. Messages
Chat with dispatch is a work channel and is recorded. Be professional.

## 8. Ending the licence
The licence ends when your engagement ends, when we revoke it, or if you breach these terms. Uninstall the app or hand back the company phone.

## 9. General
The Platform Terms of Use and Privacy Notice also apply. South African law governs.`;

const HIRED = `You are doing a job for {{company}} ({{legalName}}) as a driver of a hired vehicle.
- This link is for you only. Do not forward it. It stops working when the job is finished, cancelled or expires.
- Your location, photos, signatures and status updates are shared with {{company}} and the customer **only while this job is active**, to prove collection and delivery.
- Never use the phone while driving. Stop safely to update the job.
- Updates and proof of delivery must be true and made at the time and place they happen. False records may result in non-payment and claims.
- Your transport company's agreement with {{company}} governs payment and liability.
- Privacy Notice: {{website}}/legal/privacy · questions: {{email}}`;

const BOOKING = `## 1. Quotes
Online prices are estimates based on the distance, vehicle, load and options you enter. Freight quotes marked "request for quote", cross-border loads and abnormal loads are confirmed by us in writing before collection. Prices include VAT unless stated otherwise.

## 2. Your booking
A booking is confirmed when we accept it (by message, email or in the tracking page). You must give accurate addresses, load descriptions, weights and contact numbers, and ensure safe, legal access to the pickup and delivery points.

## 3. Prohibited and restricted goods
We do not carry illegal goods, unpackaged hazardous substances, live animals, cash, jewellery or similar valuables unless agreed in writing. Dangerous goods require prior written approval and correct documentation.

## 4. Waiting time, extra drops and changes
The quote includes reasonable loading and offloading time. Waiting beyond the free period, extra drops, re-delivery or route changes are charged at the rates shown in your quote or our current rate card.

## 5. Cancellations
- Free of charge until 24 hours before the scheduled collection.
- Less than 24 hours: up to 50 % of the quote.
- After the vehicle has been dispatched: the full trip charge (or the costs actually incurred, if lower).

Consumers retain their rights under section 17 of the Consumer Protection Act; any cancellation charge will be reasonable.

## 6. Liability for goods
Our liability for loss or damage is limited to the lesser of the proven value of the goods or R{{gitLimit}} per consignment, unless you declared a higher value and paid for additional cover before collection. Claims must be noted on the proof of delivery and submitted in writing within 7 days. We are not liable for delays or loss caused by events beyond our control (including border delays, weather, strikes and road closures), insufficient packaging, or incorrect information supplied by you.

## 7. Payment
Unless you have an approved credit account, payment is due before or on delivery. Accounts are payable within the agreed terms; overdue amounts may bear interest at the legal rate.

## 8. Cross-border loads
You are responsible for correct customs documentation, permits and duties unless we agree in writing to arrange them. Border waiting time is charged as waiting time.

## 9. Privacy
We use your information to perform the booking as described in our Privacy Notice ({{website}}/legal/privacy).

## 10. General
South African law applies. Complaints: {{email}} · {{phone}}.`;

const TRANSPORTER = `**Between** {{legalName}} (registration {{regNo}}), {{address}} ("the Company")
**and** ______________________________ (registration ______________), ______________________________ ("the Transporter").

## 1. Appointment
The Company may offer the Transporter loads from time to time. Each accepted job is governed by this agreement and the job details in the Company's dispatch system (pickup, delivery, cargo, date, rate).

## 2. Rates and payment
- Rates are per the Transporter's rate card agreed with the Company (per trip, km, day, hour, ton or load, plus agreed extras such as waiting time and tolls).
- The Company issues a monthly statement of completed jobs with proof of delivery. The Transporter invoices per statement.
- Payment within {{payTerms}} days of a valid tax invoice. The Company may deduct agreed advances, damages or shortages, with written reasons.

## 3. Transporter obligations
- Provide roadworthy, licensed and suitably equipped vehicles, and qualified drivers holding valid licences and PrDPs.
- Comply with the National Road Traffic Act, load limits, driving-hour rules and cross-border permits (C-BRTA) where applicable.
- Use the Company's driver app or one-time job links to record status, odometer, photos and proof of delivery for every job.
- Report incidents, accidents, delays and damage to dispatch immediately.

## 4. Insurance
The Transporter keeps goods-in-transit (GIT) insurance of at least R______ per load, plus vehicle and public liability insurance, and provides certificates on request. The Company will not dispatch loads while cover has expired.

## 5. Liability and claims
The Transporter is liable for loss of or damage to goods from collection until signed proof of delivery, and for losses caused by its negligence or that of its drivers, subject to proven value. Claims are notified within 7 days and resolved within 30 days.

## 6. Personal information (POPIA operator clause)
The Transporter processes customer and consignment information only on the Company's instructions and only to perform jobs; keeps it confidential and secure (section 19–21 POPIA); does not share it with anyone else; notifies the Company immediately of any security compromise; and deletes or returns it when no longer needed.

## 7. Non-solicitation
During this agreement and for 12 months after, the Transporter will not directly solicit or accept work from Company customers introduced through the Company, without the Company's written consent.

## 8. Independent contractor
The Transporter is an independent contractor. Nothing creates employment, partnership or agency. The Transporter is responsible for its drivers' wages, tax and statutory obligations.

## 9. Term and termination
This agreement runs until terminated by either party on 30 days' written notice, or immediately for material breach, lapse of insurance or loss of operating licences. Jobs in progress are completed or handed over.

## 10. General
South African law applies; disputes go to the {{jurisdiction}}. This agreement plus the dispatch job records are the whole agreement; changes must be in writing.

Signed for the Company: ______________________  Date: __________

Signed for the Transporter: ___________________  Date: __________`;

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  terms: { id: 'terms', title: 'Platform Terms of Use', short: 'Terms of Use', version: '2026-11-16', body: TERMS, slug: 'terms' },
  privacy: { id: 'privacy', title: 'Privacy Notice (POPIA)', short: 'Privacy', version: '2026-11-16', body: PRIVACY, slug: 'privacy' },
  driver: { id: 'driver', title: 'Driver App Licence & Acceptable Use', short: 'Driver licence', version: '2026-11-16', body: DRIVER },
  hired: { id: 'hired', title: 'Hired Driver Terms (one-time link)', short: 'Hired driver terms', version: '2026-11-16', body: HIRED },
  booking: { id: 'booking', title: 'Customer Booking Terms', short: 'Booking terms', version: '2026-11-16', body: BOOKING, slug: 'booking-terms' },
  transporter: { id: 'transporter', title: 'Transporter (Subcontractor) Agreement', short: 'Transporter agreement', version: '2026-11-16', body: TRANSPORTER },
};

/** Documents each signed-in role must accept before using the Platform. */
export const REQUIRED: Record<'ops' | 'driver' | 'hired', LegalDocId[]> = {
  ops: ['terms', 'privacy'],
  driver: ['driver', 'privacy'],
  hired: ['hired', 'privacy'],
};

const fill = (text: string, vars: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `[${k}]`);

/** A document with the site's details filled in and any admin override applied. */
export function legalDoc(id: LegalDocId, tenant: TenantConfig): LegalDoc {
  const base = LEGAL_DOCS[id];
  const l = tenant.legal ?? {};
  const o = l.overrides?.[id];
  const site = (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined) || (typeof window !== 'undefined' ? window.location.origin : '');
  const vars: Record<string, string> = {
    company: tenant.name,
    legalName: l.legalName || tenant.name,
    regNo: l.regNo || '[registration no.]',
    vatNo: l.vatNo || '[VAT no.]',
    address: l.address || tenant.contact.address || '[address]',
    email: l.email || tenant.contact.email || '[email]',
    phone: tenant.contact.phone || '[phone]',
    infoOfficer: l.infoOfficer || '[Information Officer]',
    jurisdiction: l.jurisdiction || 'High Court of South Africa having jurisdiction',
    website: site.replace(/\/$/, ''),
    gitLimit: l.gitLimit ? l.gitLimit.toLocaleString('en-ZA') : '[amount]',
    payTerms: String(l.payTermsDays ?? 30),
  };
  return { ...base, version: o?.body ? o.version || base.version : base.version, body: fill(o?.body || base.body, vars) };
}
