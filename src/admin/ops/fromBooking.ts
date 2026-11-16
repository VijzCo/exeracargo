// Map a website booking to a job draft for the job editor.
import { findPlace } from '../../geo';
import type { NewJob } from '../../ops/store';
import type { Booking, TenantConfig } from '../../tenant/types';
import { suggestTitle } from './lib';

export function bookingToJobDraft(b: Booking, tenant: TenantConfig): Partial<NewJob> {
  const f = b.freight;
  const cargo = f
    ? [f.description, f.pallets ? `${f.pallets} pallet(s)` : '', f.service === 'courier' && f.packages ? `${f.packages} parcel(s)` : '', f.weightKg ? `${f.weightKg} kg` : '', f.hazardous ? 'HAZCHEM' : '']
        .filter(Boolean)
        .join(' · ')
    : [b.loadType, b.trips > 1 ? `${b.trips} trips` : ''].filter(Boolean).join(' · ');
  const stop = (s: Booking['pickup']) => {
    const p = findPlace(s.placeId);
    return { address: s.address, placeId: s.placeId, place: s.place || p?.name || '', region: s.region || p?.region || '', lat: p?.lat, lng: p?.lng };
  };
  const extras = f ? [f.tailLift && 'Tail-lift required', f.helpers ? `${f.helpers} helper(s)` : '', f.afterHours && 'After-hours delivery', f.crossBorder ? `Cross-border via ${f.crossBorder.borderPostName}` : ''].filter(Boolean) : [];
  const instructions = [b.notes, ...extras].filter(Boolean).join('\n');
  const title = b.kind === 'freight' || !b.vehicleName ? suggestTitle(cargo, b.pickup.place, b.dropoff.place) : `${b.vehicleName} · ${suggestTitle(b.loadType, b.pickup.place, b.dropoff.place)}`;
  return {
    ref: b.ref,
    bookingRef: b.ref,
    kind: b.kind ?? 'vehicle',
    title: title.slice(0, 140),
    customer: { name: b.customer.name, phone: b.customer.phone, company: b.customer.company },
    pickup: stop(b.pickup),
    dropoff: { ...stop(b.dropoff), contact: b.recipient?.name, phone: b.recipient?.phone },
    cargo,
    instructions: instructions || undefined,
    scheduledDate: b.date,
    scheduledTime: b.time,
    priority: f?.level === 'sameday' ? 'urgent' : f?.level === 'express' ? 'high' : 'normal',
    price: b.quote?.total,
    currency: tenant.locale.currency,
    estimatedKm: b.distanceKm,
  };
}
