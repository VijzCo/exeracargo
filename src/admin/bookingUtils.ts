import type { Booking, BookingStatus, TenantConfig } from '../tenant/types';
import { normaliseLkPhone, waLink } from '../lib/wa';

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  in_transit: 'In transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function phoneDigits(phone: string): string {
  return normaliseLkPhone(phone || '').replace(/\D/g, '');
}

export function customerWaLink(t: TenantConfig, b: Booking, status: BookingStatus = b.status, note?: string): string {
  const lines = [
    `Hello ${b.customer.name || ''}, this is ${t.name}.`.replace('Hello ,', 'Hello,'),
    `Booking ${b.ref} (${b.vehicleName}, ${b.date} ${b.time}) — status: ${STATUS_LABEL[status]}.`,
  ];
  const n = (note ?? b.adminNote ?? '').trim();
  if (n) lines.push(`Note: ${n}`);
  lines.push(`Track: ${window.location.origin}/track?ref=${encodeURIComponent(b.ref)}`);
  return waLink(phoneDigits(b.customer.phone), lines.join('\n'));
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayYmd = () => ymd(new Date());
export { ymd };

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function bookingsToCsv(rows: Booking[]): string {
  const head = [
    'Ref',
    'Status',
    'Created',
    'Job date',
    'Job time',
    'Customer',
    'Phone',
    'Email',
    'Company',
    'Vehicle',
    'Load type',
    'Pickup',
    'Pickup town',
    'Pickup region',
    'Drop-off',
    'Drop-off town',
    'Drop-off region',
    'Distance km',
    'Trips',
    'Subtotal',
    'Discount',
    'Tax',
    'Total',
    'Currency',
    'Kind',
    'Freight service',
    'Pallets',
    'Weight kg',
    'Cross-border',
    'RFQ',
    'VAT no',
    'PO',
    'Promo',
    'Customer notes',
    'Dispatcher note',
  ];
  const lines = rows.map((b) =>
    [
      b.ref,
      STATUS_LABEL[b.status] ?? b.status,
      new Date(b.createdAt).toISOString(),
      b.date,
      b.time,
      b.customer?.name,
      b.customer?.phone,
      b.customer?.email,
      b.customer?.company,
      b.vehicleName,
      b.loadType,
      b.pickup?.address,
      b.pickup?.place,
      b.pickup?.region,
      b.dropoff?.address,
      b.dropoff?.place,
      b.dropoff?.region,
      b.distanceKm,
      b.trips,
      b.quote?.subtotal,
      b.quote?.discount,
      b.quote?.tax,
      b.quote?.total,
      b.quote?.currency,
      b.kind ?? 'vehicle',
      b.freight?.service,
      b.freight?.pallets,
      b.freight?.weightKg,
      b.freight?.crossBorder ? `${b.freight.crossBorder.country} via ${b.freight.crossBorder.borderPostName}` : '',
      b.rfq ? 'yes' : '',
      b.customer?.vatNo,
      b.customer?.poNumber,
      b.promoCode,
      b.notes,
      b.adminNote,
    ]
      .map(csvCell)
      .join(','),
  );
  return '﻿' + [head.join(','), ...lines].join('\r\n');
}
