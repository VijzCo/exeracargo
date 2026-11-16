import type { SVGProps } from 'react';

/** Single inline icon set (stroke icons, 24×24). */
const P: Record<string, string> = {
  sand: 'M3 19h18M5 19c1-4 3-7 7-7s6 3 7 7M9 9l.01 0M13 6l.01 0M16 9l.01 0',
  metal: 'M4 18l4-7 4 3 3-6 5 10zM3 21h18',
  soil: 'M3 17c3-3 6-3 9 0s6 3 9 0M3 12c3-3 6-3 9 0s6 3 9 0M12 3v4',
  debris: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  moving: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  container: 'M3 7h18v10H3zM7 7v10M11 7v10M15 7v10M19 7v10',
  machinery: 'M3 17h12v3H3zM5 17l3-6h5l2 6M14 11l4-5 3 2-3 5M18 6l2-3',
  contract: 'M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6',
  island: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  freight: 'M1 7h13v9H1zM14 10h4l4 4v2h-8M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 10h7M4 13h5',
  pallet: 'M4 4h16v9H4zM12 4v9M4 8.5h16M3 13h18v2H3zM5 15v4M12 15v4M19 15v4',
  parcel: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5M8 5.2l8 4.6',
  express: 'M3 12h6M2 8h5M4 16h5M13 5l-3 7h5l-3 7 8-9h-5l3-5z',
  crossborder: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3v18M7 8l-2 4 2 4M17 8l2 4-2 4',
  warehouse: 'M3 21V9l9-5 9 5v12M7 21v-7h10v7M7 17h10',
  reefer: 'M12 2v20M4 6l16 12M20 6L4 18M9 3l3 3 3-3M9 21l3-3 3 3',
  truck: 'M2 6h12v10H2zM14 9h4l4 4v3h-8M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  whatsapp: 'M3 21l1.6-4.8A8.5 8.5 0 1 1 8 19.6zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 1c-1-.5-2.5-2-3-3l1-1-1-2z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  menu: 'M4 7h16M4 12h16M4 17h16',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gps: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.3.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2L6 7.2 4 7 3 10l2 1v1.8l-2 1 1 3 2-.2 1.3 1.3-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.3-1.3 2 .2 1-3-2-1z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  facebook: 'M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z',
  instagram: 'M4 4h16v16H4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17 7h.01',
  tiktok: 'M14 3v11a4 4 0 1 1-4-4M14 3c0 3 2 5 5 5',
  youtube: 'M3 7c0-2 1-3 3-3h12c2 0 3 1 3 3v10c0 2-1 3-3 3H6c-2 0-3-1-3-3zM10 9l5 3-5 3z',
  linkedin: 'M4 9h4v11H4zM6 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM10 9h4v2c1-2 6-3 6 2v7h-4v-6c0-2-2-2-2 0v6h-4z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-2 3-4 3h-2a2 2 0 0 0-1 4c0 1-1 2-2 2zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 20, ...rest }: { name: IconName | string; size?: number } & SVGProps<SVGSVGElement>) {
  const d = P[name] ?? P.truck;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
