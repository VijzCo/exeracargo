import type { Insight } from '../types';

/** South Africa insight articles (paraphrased from public 2025–26 sources; see docs/za-market-research.md). */
export const insightsZA: Insight[] = [
  {
    id: 'za1',
    slug: 'road-freight-2026',
    title: 'Why road still moves South Africa — and what it means for your freight costs',
    excerpt: 'Roads now carry more than 85% of land freight. Here’s what that means for capacity, pricing and planning in 2026.',
    category: 'Market',
    date: '2026-11-05',
    readMins: 4,
    body: `## Six tonnes by road for every tonne by rail
Industry figures published in late 2025 show road carrying over 85% of land freight — roughly six tonnes on the road for every tonne on rail. Rail volumes fell over the past decade while road tonnage climbed steadily, and private access to the rail network is only starting to change that.

## What drives your rate
- Diesel can be up to half of a fleet's running cost, so rates track the monthly fuel price.
- Empty return legs: lanes with strong back-loads (JHB–DBN on the N3) price better than one-way lanes.
- Waiting time at sites, ports and borders is a real cost and should be priced openly.

## How to plan better
- Book full loads 24–48 hours ahead on busy corridors (N3, N1, N4).
- Use part-load for 1–12 pallets instead of paying for an empty truck.
- Ask for an all-in quote that shows fuel surcharge, VAT and waiting terms.

Sources: Creamer Media Engineering News (Oct 2025); DealerFloor (Nov 2025).`,
  },
  {
    id: 'za2',
    slug: 'tipper-sizes-cubes',
    title: '6, 10 or 18 cube? Choosing the right tipper for your site',
    excerpt: 'Tipper sizes, payloads and what a load of building sand really costs — so you book the right truck once.',
    category: 'Guide',
    date: '2026-10-28',
    readMins: 3,
    body: `## Sizes in plain terms
- 6-cube tipper: about 6 m³ — residential sites, tight access, rubble.
- 10-cube tipper: about 10 m³ on a 6×4 truck — the workhorse for sand, stone and earthworks.
- 18-cube side tipper: bulk aggregate, coal and quarry runs.

## Working out your volume
Measure length × width × depth in metres. Add about 10% for compaction when filling. One 10-cube load covers roughly a 5 m × 5 m area at 40 cm deep.

## What it costs
Published 2026 rates put a 10-cube tipper with driver at about R4,400 for a nine-hour day in Gauteng. Per-load pricing within 30 km is usually cheaper for one-off deliveries. Always check that tip-site fees are included for rubble.

Sources: Gauteng plant-hire rate cards (2026); Kandua rubble-removal cost guide.`,
  },
  {
    id: 'za3',
    slug: 'cross-border-checklist',
    title: 'Cross-border trucking into SADC: the document checklist and the border-wait reality',
    excerpt: 'Lesotho, Eswatini, Botswana, Namibia, Zimbabwe and Mozambique — what paperwork you need and how long borders really take.',
    category: 'Guide',
    date: '2026-10-15',
    readMins: 5,
    body: `## The documents
- Commercial invoice and packing list.
- Customs declaration (SAD500) and proof of export for VAT zero-rating.
- Cross-border road transport permit for the carrier (issued by the C-BRTA).
- Consignee details at destination; for Zimbabwe, Mozambique and Zambia a clearing agent and bond are usually required.

## SACU vs the rest
Lesotho, Eswatini, Botswana and Namibia are in the Southern African Customs Union, so paperwork is lighter. Zimbabwe and Mozambique add clearing and bond requirements.

## Border waiting time
Industry reporting in 2026 put average truck delays at major posts between roughly 7 and 70 hours, with Beitbridge the worst. A 20-hour delay can cost over R20,000 for a single truck. Posts into Lesotho and Eswatini are usually hours rather than days, with peaks at month-end.

## How we price it
Your quote shows border and documentation fees plus estimated waiting based on the post's typical delay. Actual waiting is reconciled on delivery.

Sources: C-BRTA; FOCUS on Transport (Aug 2026); EWN (Jul 2026).`,
  },
  {
    id: 'za4',
    slug: 'fuel-surcharge-explained',
    title: 'Fuel surcharge explained: why your quote moves with the diesel price',
    excerpt: 'Diesel is adjusted on the first Wednesday of every month. Here’s how a transparent fuel surcharge keeps quotes fair both ways.',
    category: 'Pricing',
    date: '2026-11-02',
    readMins: 2,
    body: `## The monthly cycle
South African fuel prices are adjusted monthly, usually on the first Wednesday. In November 2026 inland wholesale diesel sat around R31 per litre after a temporary levy relief.

## How the surcharge works
We apply a fuel-surcharge percentage to distance charges only — not to call-out fees, insurance or extras. When diesel falls, the surcharge falls too.

## What you see
- Distance charge and fuel surcharge on separate lines.
- 15% VAT shown separately.
- Cross-border exports zero-rated with proof of export.

Sources: BusinessTech and Bizcommunity fuel price coverage (Nov 2026).`,
  },
  {
    id: 'za5',
    slug: 'choosing-a-carrier-safety',
    title: 'Choosing a carrier: RTMS, insurance and cargo security',
    excerpt: 'What corporate buyers check before they hand over a load — and the security habits that cut hijacking risk.',
    category: 'Safety',
    date: '2026-09-22',
    readMins: 3,
    body: `## Trust signals that matter
- RTMS: a voluntary industry standard covering load control, driver wellness and vehicle maintenance — many mines and corporates require it.
- Goods-in-transit and liability insurance, with the policy on file.
- Operator cards and professional driving permits for heavy vehicles.
- Cross-border permits for SADC work, and a B-BBEE certificate for procurement scoring.

## Cargo security
Truck hijackings are concentrated in Gauteng, with Mpumalanga an emerging hotspot; incidents peak in the late afternoon and evening. Good carriers plan routes, limit night stops on high-risk corridors and use tracking with live alerts.

## What we do
Every load is tracked, drivers check in at handover, and high-value loads can be escorted on request.

Sources: FreightNews (RTMS); FleetWatch (Nov 2025).`,
  },
];
