# Exera Cargo — Haulage & Logistics Platform (South Africa + SADC)

An AXILogic product. It is a multi-tenant website with online booking and an admin console for **tipper/truck hire and logistics** companies.
One codebase and one Firebase project can serve **unlimited branded sites**, each with its own domain, theme, fleet, rates, offers and content.

**Home market:** South Africa (ZAR, 15% VAT, 9 provinces, ~180 towns), with cross-border freight to Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique.
**Also supported:** Sri Lanka (LKR, 25 districts). Pick the country per client site in Admin → Site content → Market.

**Stack:** React 18 · TypeScript · Vite · Three.js (procedural 3D) · Firebase Hosting + Firestore (Lite SDK) + Auth on the **free Spark plan**. There are no Cloud Functions.

---

## What it does

| Area | Features |
|---|---|
| **Vehicle hire** | Tippers 6/10/18 cube, bakkies, 4-ton/8-ton trucks, tri-axle, superlink, flatdeck, reefer and lowbed. Every quote is itemised: call-out, distance, empty return, fuel surcharge and VAT. |
| **Logistics** | Full truckload (FTL), part-load by pallet/kg, courier with volumetric weight, and removals. Delivery speeds are Economy, Express and Same-day (with a distance cap). Add-ons: GIT insurance top-up, tail-lift, helpers, after-hours. Customers can tick RFQ to ask for a firm quote. |
| **Cross-border (SADC)** | Destination towns in neighbouring countries, with border post selection showing hours and typical delay. Border/documentation fees and estimated waiting are priced in, and shared pro rata on part-loads. Documents checklist (SACU vs ZW/MZ). Exports are VAT zero-rated. |
| **Town-level booking** | Searchable town picker, with aliases such as Witbank → eMalahleni and PE → Gqeberha. Distance is estimated from real coordinates, so no paid maps API is needed. |
| **Pricing engine** | `src/lib/quote.ts` is pure, unit-testable and itemised (`Quote.lines`). The monthly fuel-surcharge index is set by the tenant. |
| **Public site** | 3D hero, logistics section, live popular-lane prices, a coverage map drawn from real town coordinates, trust badges (RTMS, GIT, C-BRTA, B-BBEE), offers, insights, FAQ and a WhatsApp button. |
| **Admin** | Bookings split by vehicle/freight/RFQ, with full consignment details, re-pricing check and CSV. Content editor with live preview, including Market (country/currency), Logistics rates (with live example quotes), trust badges, fleet and SEO. Also a Sites manager for selling to clients. |
| **Languages** | ZA: English, Afrikaans, isiZulu. LK: English, Sinhala, Tamil. |

---

## Run locally (demo mode, zero config)

```bash
npm install
npm run dev            # http://localhost:5173
```
With no Firebase env vars, data is stored in the browser's localStorage.
- Admin: `/admin`, any email, password **`demo1234`**.
- Demo sites: `?site=exera` (Exera Cargo: tippers + trucks + freight, dark) and `?site=maluti` (Free State ↔ Lesotho freight, light). Use `?site=reset` to clear.

---

## Deploy on Firebase (free Spark plan)

1. Create a Firebase project. Create a Firestore database in region **`africa-south1` (Johannesburg)**.
2. Authentication → Email/Password → enable, then add your admin user.
3. Copy the web app config into `.env.local` (see `.env.example`). Set `VITE_DEFAULT_TENANT=exera`, or use your first client's id.
4. In Firestore, create `admins/{your-uid}` = `{ "role": "super", "tenants": ["*"] }`.
5. Deploy:
   ```bash
   cp .firebaserc.example .firebaserc   # set your project id
   npm run deploy
   ```
6. Open `/admin`, go to Site content and press **Save & publish** once per site. The rules reject bookings for unpublished sites.
7. Recommended: enable **App Check** (reCAPTCHA v3 key in `VITE_APPCHECK_SITE_KEY`, then enforce for Firestore).

---

## Selling to clients

Admin → **Sites → New site** → choose the country, name and colours. The site then serves at `https://<project>.web.app/?site=<id>`, at `<id>.web.app` (create it with `firebase hosting:sites:create <id>`), or on the client's own domain. For a custom domain, add it in Hosting and then in the site's domains list.
On a client's domain, `?site=` is ignored and only that client's site is shown. Details are in **SECURITY** below.

### Before a client goes live
- Set **real rates**: Fleet, Logistics, fuel surcharge. The bundled rates are 2026 indicative benchmarks (`docs/za-market-research.md`).
- Add **real** credentials (RTMS, GIT policy, C-BRTA permit, B-BBEE level) and real reviews only.
- Update the fuel surcharge monthly. SA diesel prices change on the first Wednesday of each month.

---

## Operations module (day-to-day)

**Dispatch console** (`/admin`, Operations menu) — for the office team:
- **Dispatch board**: unassigned → assigned → on the road → delivered, plus a *Problems* column (failed or overdue). Quick-assign with conflict checks for vehicle/driver availability and expired documents.
- **Jobs**: create manually or with one click from a website booking. Assign a vehicle and driver; see a live timeline with locations, start/end ODO photos (actual km vs estimate), pre-trip inspection results, and proof of delivery (signature + photos). Each job has its own chat.
- **Vehicles**: fleet units by registration, plus odometer, service-due countdown, and licence disc / roadworthy / insurance / permit expiry alerts. Includes fuel history (L/100 km).
- **Drivers**: profiles, licence/PrDP/medical expiry, live duty status. **Create login** (phone + PIN) can be shared on WhatsApp.
- **Chat**: realtime inbox per driver plus a broadcast channel, with photo sharing and unread badges.
- **Live map**: driver positions on OpenStreetMap, plus pickup/drop pins for active jobs.
- **Reports**: job and fuel CSV exports with revenue, km, fuel spend and cost per km. Compliance alerts appear on the dashboard.

**Driver app** (`/driver`, installable PWA) — for drivers on their phones:
- Sign in with phone + PIN. The app has Jobs, Chat, Fuel and Profile tabs, plus an on/off-duty toggle.
- Job flow: **Accept → Start trip** (pre-trip inspection + **start ODO**) **→ At pickup → Picked up → In transit → At delivery → Deliver** (recipient name, signature, photos) **→ Close trip** (**end ODO**).
- **ODO capture**: the driver takes a photo, crops the digits, and on-device OCR (Tesseract, self-hosted under `/ocr`) reads them. The driver must confirm or correct the number; manual entry is always available. The photo is kept as evidence and the method and confidence are recorded.
- Navigation buttons for Google Maps and Waze, tap-to-call for site contacts, problem reporting (failed with reason), and fuel logging with a receipt photo.
- Location is shared every 60 s or 250 m while on duty, only while the app is open. Works offline — updates sync when signal returns.

Every status change updates the customer's public tracking page automatically (for jobs created from bookings).

**Free-plan design:** no Cloud Functions or Cloud Storage. Photos are compressed to ≤ 650 KB and stored in Firestore, and realtime uses Firestore listeners. The OCR language pack (~15 MB) downloads once per phone and is then cached.

**Safeguards built in:** drivers can only move a job one step forward (or mark it failed); the start ODO is locked once captured; end ODO must be ≥ start and ≤ start + 5,000 km; drivers can only update the odometer of the truck on their own job; trips under way cannot be reassigned (fail/cancel and re-create); chat photos are visible only inside their own thread; internal failure reasons never reach the customer tracking page; the driver disappears from the live map when going off duty.

**PIN reset:** Drivers → **New login** removes the old driver record. First delete the old user in Firebase console → Authentication (no Cloud Functions on Spark). The new login gets a new uid, so their chat thread, fuel history and location start fresh; past jobs keep the driver's name.

**Onboarding the team**
1. Admin → **Vehicles**: add each truck (registration, odometer, expiry dates).
2. Admin → **Drivers** → **Create login** for each driver. Send the WhatsApp invite with the `/driver` link, their phone number and PIN.
3. Drivers open the link, then **Add to Home screen**, sign in, and allow camera + location.
4. Dispatchers: add them in Firestore as `admins/{uid}` = `{ "role": "tenant", "tenants": ["<site-id>"] }`.
5. Deploy rules + indexes whenever they change: `firebase deploy --only firestore:rules,firestore:indexes`.
6. Demo: open `/admin` and `/driver` in two tabs (driver: `+27821112222` / PIN `123456`) — updates sync live between tabs.

## Hired trucks, multi-stop jobs and trips

**Transporters** (`/admin/transporters`) are the companies you hire trucks and drivers from. Each one has contact and bank details, VAT status, GIT insurance (expiry + cover), tax clearance, B-BBEE, payment terms and a **rate card with several lines**. A line can be per trip, km, day, hour, ton or load, optionally for one vehicle type, with a minimum charge. A scorecard shows jobs done, on-time %, failures and spend.
- Mark vehicles and drivers **Own** or **Hired → transporter**. Hired units are tagged in every picker. **Dispatch is blocked** when the transporter is inactive or its GIT insurance is missing or expired.
- **Buy cost** (job editor → "Buy cost"): pick the transporter and rate line, or enter it manually. Set the quantity (km can follow the actual ODO km), extras (waiting time, tolls) and deductions (fuel advance, damage). The margin (sell excl. VAT − buy) is shown live.
- **Prices are dispatch-only:** the sell price and buy cost live in `finance/{jobId}`, which drivers (including hired ones) cannot read.
- **Settlements** (`/admin/settlements`): pick a transporter and period. This lists delivered hired jobs with a cost that isn't on a statement yet, flagging lines without POD. Flow: draft → approve → mark paid (date + payment ref). Capture the transporter's invoice no. Exports: CSV and a printable statement. Paid statements are locked, and a job's cost is locked once it is on a statement.
- **One-time link** (job page or bulk "Send as one link"): for hired drivers without a login. Enter the name, mobile, hired truck (or a typed registration) and validity, then copy the link or send it on WhatsApp. Its status (sent / opened / expired / revoked) is shown on the job, and **Revoke** cuts access immediately.

**Multi-stop jobs:** in the job editor, **Add pickup / Add delivery**, reorder with the arrows. The first stop must be a pickup and the last a delivery. Each stop has a contact, what is collected/dropped, a reference (DN/PO), a time window and instructions. The km estimate runs through all stops. The job page shows each stop's status, POD and photos.

**Multi jobs at once** (Dispatch/Jobs): tick jobs (checkboxes on cards and rows), then:
- **Assign together (trip):** one truck + driver, ordered. The driver gets one message, and the jobs carry a `TRP-…` badge.
- **Send as one link:** one external driver for all selected jobs.
- **Duplicate…:** ×N copies on the same day, daily (optionally weekdays only) or weekly. Copies keep the price and cost and are created as drafts.
- **Cancel…:** with a reason.

**Import CSV** (Dispatch header → Template): **one row per stop**. Rows with the same `job` value form one job, in order (first row = first stop). Job-level columns are read from a job's first row: `date` (yyyy-mm-dd), `time`, `customer_name`, `customer_phone`, `customer_company`, `cargo`, `kind` (vehicle/freight), `priority`, `price`, `instructions`. Stop columns: `stop_type` (pickup/delivery), `town` (must match the place list), `address`, `contact`, `contact_phone`, `stop_cargo`, `reference`, `window`. Rows are validated before import, and jobs arrive as drafts (max 200 per file).

## Android driver app

`android/` is a Capacitor 8 app (**Exera Cargo Driver**, `com.exeracargo.driver`) that bundles the web build and opens at `/driver`. It has the same features as the web driver app, plus system push notifications. One-time job links (`https://<host>/j/<token>`) open in the app when it is installed, and in the browser when it is not. The app runs on Android 7 (API 24) and newer.

**Build on your Mac** (needs Android Studio, which bundles JDK 21 and the Android SDK):
```bash
cp .env.example .env.local            # Firebase keys, VITE_DEFAULT_TENANT=exera, VITE_PUBLIC_ORIGIN=https://exeracargo.web.app
cp ~/Downloads/google-services.json android/app/   # from Firebase (see Push notifications below)
npm run build:android                 # web build (--mode android) + cap sync
npm run android:open                  # opens Android Studio → ▶ Run on a phone (USB debugging on)
# or straight to a connected phone:
npm run android:run
```
Run `npm run build:android` again after every code change. `npm run android:assets` regenerates the icon, splash screen and notification icon from `public/driver-icon.svg`.

**Release signing (once):**
```bash
keytool -genkeypair -v -keystore exera-release.jks -alias exera -keyalg RSA -keysize 2048 -validity 10000
keytool -list -v -keystore exera-release.jks -alias exera | grep SHA256   # fingerprint for App Links
ANDROID_SHA256="AA:BB:…" npm run assetlinks && npm run deploy:spark       # publishes /.well-known/assetlinks.json
export ANDROID_KEYSTORE_FILE=$PWD/exera-release.jks ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=exera ANDROID_KEY_PASSWORD=…
cd android && ./gradlew assembleRelease bundleRelease   # app/build/outputs/apk/release/*.apk, bundle/release/*.aab
```
Keep the `.jks` file and its passwords safe. Without them you can't update the app. If you publish on Google Play, add Play's "App signing key" SHA-256 to `ANDROID_SHA256` too (comma-separated).

**Build in GitHub instead (no Android Studio needed):** push the repo to GitHub and add these secrets: `VITE_FIREBASE_*` (6 keys), `VITE_DEFAULT_TENANT`, `VITE_PUBLIC_ORIGIN`, `GOOGLE_SERVICES_JSON` (`base64 -i android/app/google-services.json`), `ANDROID_KEYSTORE_BASE64` (`base64 -i exera-release.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD`. Then run **Actions → Android driver app**, or push a tag `v1.0.0`. Download the APK/AAB from the run's artifacts. Without the keystore secrets it builds a debug APK instead.

**Getting it onto drivers' phones:** share the APK (WhatsApp/Drive, with "Install unknown apps" allowed), or publish it on Google Play (internal testing is fastest). App link host: `APP_LINK_HOST` env/variable (default `exeracargo.web.app`). Custom-domain links need that domain's `assetlinks.json` as well.

## Auto-deploy and app auto-update (GitHub → Firebase)

Every push to `main` runs `.github/workflows/release.yml`. It builds a signed APK and deploys the website, rules, indexes and functions. It also publishes the app update on Firebase Hosting and creates a GitHub Release `v1.0.<run>` with the APK attached.

**How the installed app updates itself (no Play Store needed):**
- **Web changes (most releases):** the app checks `/app-update/latest.json` on start and every 30 minutes when it is reopened. It downloads only the changed files in the background, and the new version starts the next time the app opens (or right away with **Restart now**). If a new version fails to start, it rolls back automatically.
- **Native changes** (anything in `android/`, `capacitor.config.ts` or a `@capacitor/*` / `@capgo/*` package): older apps stop taking web updates and show **Please update the app → Install**. Android downloads the APK and asks to install it over the old one. Your data and login are kept.
- First install link for drivers: `https://<your-site>/app-update/exera-cargo-driver.apk`. Android phones also see **Get the Android app** on the `/driver` sign-in page.
- The same signing key must sign every release; Android refuses an update signed with another key.

**One-time setup:**
1. Push this folder to a private GitHub repo with branch `main`.
2. Create a deploy key for Firebase: Google Cloud console → IAM & Admin → Service accounts → **Create service account** `github-deploy`. Give it these roles: *Firebase Admin*, *Cloud Functions Admin*, *Service Account User*, *Cloud Scheduler Admin*, *Artifact Registry Administrator*, *Cloud Build Editor*, *API Keys Viewer*. Then **Keys → Add key → JSON**.
3. GitHub → Settings → Secrets and variables → Actions. **Secrets**:
   - `FIREBASE_SERVICE_ACCOUNT` (the whole JSON file)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY` (same values as `.env.local`)
   - `GOOGLE_SERVICES_JSON` = `base64 -i android/app/google-services.json`
   - `ANDROID_KEYSTORE_BASE64` = `base64 -i exera-release.jks`, plus `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`exera`) and `ANDROID_KEY_PASSWORD`

   **Variables** (optional):
   - `VITE_PUBLIC_ORIGIN` (default `https://<project-id>.web.app`; set it when you move to your own domain)
   - `VITE_DEFAULT_TENANT` (`exera`), `FUNCTIONS_REGION`
   - `DEPLOY_ONLY` (`hosting,firestore` while on the free plan)
   - `PLAY_SIGNING_SHA256` (only if you also publish on Google Play)
4. Push. Actions → **Release** shows progress (about 10 minutes). The APK is on the Releases page and at `/app-update/exera-cargo-driver.apk`.

`assetlinks.json` (links opening in the app) is generated from the signing key on every release, so the manual `npm run assetlinks` step is not needed when you use this workflow. `android.yml` remains for manual test builds.

## Push notifications (Blaze plan)

Push needs **Cloud Functions**, which run only on the pay-as-you-go **Blaze** plan. The free quota (2M calls/month) covers a fleet many times your size. Everything else still works on Spark: without the functions, drivers and dispatch rely on the in-app badges.

| Who | Gets a notification when |
|---|---|
| Driver (app / Chrome) | a job or trip is assigned, a job is changed, cancelled or taken away, dispatch sends a chat message or broadcast |
| Dispatch (console in Chrome/Edge) | a driver accepts, starts, delivers, completes or fails a job; a driver sends a chat message; documents expire (daily 06:00 digest, 14-day window) |

**Setup (once):**
1. Firebase console → ⚙ Usage and billing → **upgrade to Blaze**. Set a budget alert, e.g. R100.
2. Project settings → General → **Add app → Android**, package `com.exeracargo.driver`, plus the SHA-1/SHA-256 from `keytool -list` above. Download **google-services.json** to `android/app/`.
3. Project settings → Cloud Messaging → Web Push certificates → **Generate key pair**. Copy it to `VITE_FIREBASE_VAPID_KEY` in `.env.local`.
4. Authentication → Sign-in method → enable **Anonymous**. External drivers use it when they open a one-time link.
5. Deploy the functions, then the web app, rules and indexes:
   ```bash
   npm i -g firebase-tools && firebase login
   cd functions && npm i && cd ..
   npm run deploy            # hosting + firestore + functions   (npm run deploy:spark = without functions)
   ```
   The functions run in `africa-south1` (Johannesburg, same as Firestore). The daily digest runs in `europe-west1`, because Cloud Scheduler isn't available everywhere. To change either, set `FUNCTIONS_REGION` / `SCHEDULE_REGION` in `functions/.env` and keep `VITE_FUNCTIONS_REGION` in sync.
6. Dispatchers click **🔔 Turn on notifications** in the console header, once per browser. Drivers are asked automatically after signing in to the app.

**PIN reset** also uses a function (`resetDriverPin`). Dispatch sets a new PIN and the driver keeps their account, chat and history. The driver's other devices are signed out.

## Data model (Firestore)

```
tenants/{id}                    TenantConfig (public get; managers write; list = super only)
tenants/{id}/bookings/{ref}     Booking: vehicle hire or freight consignment (public create, validated)
tenants/{id}/tracking/{ref}     status, date, service, from/to town + dispatcher note (public get by ref)
tenants/{id}/messages/{id}      contact form
domains/{hostname}              { tenantId } (super admins only)
admins/{uid}                    { role: 'super'|'tenant', tenants: [] }
tenants/{id}/vehicles|drivers|jobs(+events)|media|threads(+messages)|locations|fuel   operations (see src/ops/types.ts)
driverIndex/{uid}               { tenantId }
```

## SECURITY
- Rules field-whitelist every booking, including freight details and stop objects, and cap sizes. A booking's doc id is its reference, and its tracking record can only be created in the same batch.
- Tenant URLs (logo, covers, social, map) render only over `https:`. Hosting sends a strict Content-Security-Policy.
- Quotes are computed in the browser, so the admin re-prices every booking against current rates and flags mismatches.
- `?site=` switching only works on platform hosts (localhost, `<project>.web.app`, `VITE_PLATFORM_HOSTS`).

## Project structure
```
src/geo/        countries (ZA, LK), places/za.ts (~180 towns + SADC towns + border posts), places/lk.ts, search & distance
src/lib/        quote.ts (pricing engine), data.ts (Firestore + demo), firebase.ts, time.ts, url.ts, wa.ts
src/tenant/     types.ts, presets/ (exera, maluti, logistics defaults, ZA insights, LK template), resolve.ts, TenantProvider
src/pages/      Home, Fleet, Services, Logistics, Offers, Insights, Booking (vehicle + freight), Track, Contact
src/components/ Layout, sections, PlacePicker, QuoteBreakdown, QuickEstimate, Icon
src/admin/      dashboard, bookings, messages, content editor (market, logistics, trust…), sites
docs/           za-market-research.md
```

## Scripts
`npm run dev` · `npm run build` · `npm run preview` · `npm run deploy` · `npm run typecheck`
