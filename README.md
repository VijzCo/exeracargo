# AxiFreight — White-label Haulage & Logistics Platform (South Africa + SADC)

A separate AXILogic product, built on the HaulPro engine. It is a multi-tenant website with online booking and an admin console for **tipper/truck hire and logistics** companies.
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
- Demo sites: `?site=kopano` (tippers + trucks + freight, dark) and `?site=maluti` (Free State ↔ Lesotho freight, light). Use `?site=reset` to clear.

---

## Deploy on Firebase (free Spark plan)

1. Create a Firebase project. Create a Firestore database in region **`africa-south1` (Johannesburg)**.
2. Authentication → Email/Password → enable, then add your admin user.
3. Copy the web app config into `.env.local` (see `.env.example`). Set `VITE_DEFAULT_TENANT=kopano`, or use your first client's id.
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

## Data model (Firestore)

```
tenants/{id}                    TenantConfig (public get; managers write; list = super only)
tenants/{id}/bookings/{ref}     Booking: vehicle hire or freight consignment (public create, validated)
tenants/{id}/tracking/{ref}     status, date, service, from/to town + dispatcher note (public get by ref)
tenants/{id}/messages/{id}      contact form
domains/{hostname}              { tenantId } (super admins only)
admins/{uid}                    { role: 'super'|'tenant', tenants: [] }
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
src/tenant/     types.ts, presets/ (kopano, maluti, logistics defaults, ZA insights, LK template), resolve.ts, TenantProvider
src/pages/      Home, Fleet, Services, Logistics, Offers, Insights, Booking (vehicle + freight), Track, Contact
src/components/ Layout, sections, PlacePicker, QuoteBreakdown, QuickEstimate, Icon
src/admin/      dashboard, bookings, messages, content editor (market, logistics, trust…), sites
docs/           za-market-research.md
```

## Scripts
`npm run dev` · `npm run build` · `npm run preview` · `npm run deploy` · `npm run typecheck`
