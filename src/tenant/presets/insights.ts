import type { Insight } from '../types';

/** Default insight articles shipped with every preset. Tenants can edit/replace in the admin console. */
export const insightsLibrary: Insight[] = [
  {
    id: 'i1',
    slug: 'construction-rebound-2026',
    title: 'Sri Lanka’s construction rebound: what it means for haulage in 2026',
    excerpt:
      'Construction PMI has stayed firmly in expansion and a Rs 2 trillion public works pipeline is lining up. Here’s how that changes tipper and lorry demand.',
    category: 'Market',
    date: '2026-10-28',
    readMins: 4,
    body: `## Activity is expanding
The Central Bank's Construction Purchasing Managers' Index closed 2025 at 67.1 — well above the 50 line that separates growth from contraction — and readings through 2026 have stayed in expansion. Supplier delivery times have lengthened, a classic sign that transport and material capacity is stretched.

## The pipeline
Broker research published in April 2026 estimates roughly Rs 2 trillion of public investment for 2026–28, with highways taking close to half and irrigation and housing following. Credit to the construction sector also grew in double digits during 2025.

## Rebuilding after Cyclone Ditwah
Reconstruction after the late-2025 cyclone has been costed at around Rs 878 billion. That means sustained demand for debris removal, earth filling and material delivery well beyond the Western Province.

## What this means for you
- Book early for peak weeks — tippers in the 10–16 cube class are the first to sell out.
- Contractors should lock in day or monthly hire to protect against spot-rate spikes.
- Expect fuel-linked price adjustments; we always show the fuel basis on our quotes.

Sources: CBSL Construction PMI; Daily FT / CT Smith Securities (Apr 2026).`,
  },
  {
    id: 'i2',
    slug: 'how-many-cubes',
    title: 'How many cubes do I need? A tipper sizing guide',
    excerpt: 'Cubes, tons and truck sizes explained — so you order the right tipper the first time and don’t pay for half-empty trips.',
    category: 'Guide',
    date: '2026-10-15',
    readMins: 3,
    body: `## What is a cube?
In Sri Lanka, sand, metal and soil are sold by the cube. One cube is 100 cubic feet — about 2.83 cubic metres.

## Matching load to tipper
- 2.5 cube mini tipper: narrow lanes, small top-ups, garden work.
- 4 cube tipper: the everyday choice for house construction deliveries.
- 10 cube tipper: earth filling, larger slabs and site-to-site moves.
- 16 cube heavy tipper: infrastructure, quarry runs and bulk filling.

## Rules of thumb
- Measure the area and the depth in feet, multiply, then divide by 100 to get cubes.
- Add around 10% for compaction when filling soil.
- One larger truck is usually cheaper than two small trips over the same distance — but check access first.

## Stay within legal limits
Axle load limits apply (around 10 tonnes for two-axle and 22 tonnes for three-axle trucks). We never overload, which protects your road, our drivers and your schedule.`,
  },
  {
    id: 'i3',
    slug: 'sand-permits-school-hours',
    title: 'Sand permits and school-hour restrictions: a quick compliance guide',
    excerpt: 'Moving sand, gravel or soil? Here’s what GSMB transport permits and the school-hour schedule mean for your delivery time.',
    category: 'Safety',
    date: '2026-09-30',
    readMins: 3,
    body: `## Transport permits
Sand, gravel and soil must travel with a valid transport permit issued under the Mines and Minerals Act, administered by the Geological Survey and Mines Bureau (GSMB). Police check permits at roadside points, and the rules have changed at short notice in the past — so always use a supplier who carries permit-compliant loads.

## School-hour schedule
Since late 2025, trucks carrying mineral loads may not run on school days between 06:30–07:45 and 11:30–14:30. When you book sand, metal or soil, our scheduler avoids these windows automatically and will suggest the next available slot.

## What we handle for you
- Permit-compliant sourcing when we supply the material.
- Delivery slots planned around restricted hours.
- Drivers briefed on site safety and load securing.`,
  },
  {
    id: 'i4',
    slug: 'how-we-price',
    title: 'Transparent pricing: how your quote is built',
    excerpt: 'Call-out fare, per-km rate, trips, discounts and VAT — every rupee of your quote, explained.',
    category: 'Pricing',
    date: '2026-09-12',
    readMins: 2,
    body: `## The formula
Your quote is the vehicle's call-out fare, plus the loaded distance multiplied by its per-km rate, multiplied by the number of trips. Where a vehicle must return empty, the return leg is charged at half rate.

## Discounts and tax
Valid promo codes are applied to the subtotal, then VAT is added and shown as its own line.

## What can change the final price
- Waiting time beyond the free allowance at loading or unloading.
- Tolls, port or parking fees on the route.
- Significant fuel price revisions — container transport rates across the industry rose by about a fifth after the March 2026 fuel increase.

Our dispatcher confirms the final figure before your vehicle leaves — no surprises at the gate.`,
  },
  {
    id: 'i5',
    slug: 'colombo-port-local-boxes',
    title: 'Colombo Port hits a record — and local container trucking grows faster',
    excerpt: 'Record throughput is good news, but it’s the double-digit growth in local import/export boxes that drives demand for inland trucking.',
    category: 'Market',
    date: '2026-08-20',
    readMins: 3,
    body: `## A record year
The Port of Colombo handled about 8.29 million TEU in 2025, a new high and roughly 6% more than the year before.

## Why local boxes matter
Most port volume is transshipment that never leaves the terminal. Domestic import and export containers — the ones that need a prime mover to a factory, warehouse or BOI zone — grew close to 14% during January–October 2025.

## Planning your container moves
- Book prime movers 24–48 hours ahead around vessel arrivals.
- Consider night moves to avoid daytime congestion on port access roads.
- Share your delivery order and gate pass details at booking to avoid waiting charges.

Sources: Container News; Maritime Gateway.`,
  },
];
