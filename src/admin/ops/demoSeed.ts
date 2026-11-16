// Demo mode only: two transporters (mixed rate cards), one hired truck and one hired driver.
import { createDriverLogin, opsMode, savePlace, saveDriver, saveTransporter, saveVehicle } from '../../ops/store';
import type { Transporter } from '../../ops/types';

const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
export const DEMO_HIRED_DRIVER = { phone: '+27834445555', pin: '654321', name: 'Thabo Nkosi' };

export async function seedHiredDemo(t: string, country: 'ZA' | 'LK'): Promise<void> {
  if (opsMode !== 'demo') return;
  const flag = `hp:ops:${t}:hired-seeded`;
  if (localStorage.getItem(flag)) return;
  localStorage.setItem(flag, '1');
  const za = country === 'ZA';
  const a: Omit<Transporter, 'createdAt' | 'updatedAt'> = {
    id: 'tr-ridgeback',
    name: za ? 'Ridgeback Haulage CC' : 'Kelani Transport (Pvt) Ltd',
    contactName: za ? 'Lerato Mokoena' : 'Nimal Silva',
    phone: za ? '+27825550101' : '+94775550101',
    email: 'ops@ridgeback.example',
    regNo: za ? '2014/123456/23' : 'PV 12345',
    vatNo: za ? '4123456789' : undefined,
    vatRegistered: za,
    bank: { bank: za ? 'FNB' : 'BOC', accountName: 'Ridgeback Haulage', accountNo: '62000000000', branchCode: '250655' },
    gitInsuranceExpiry: iso(140),
    gitCover: za ? 1_500_000 : 5_000_000,
    taxClearanceExpiry: iso(20),
    bbbeeLevel: 2,
    bbbeeExpiry: iso(200),
    paymentTermsDays: 30,
    rates: [
      { id: 'r1', basis: 'km', amount: za ? 24 : 320, vehicleType: 'superlink', minCharge: za ? 4500 : 60000, note: 'Long haul, fuel incl.' },
      { id: 'r2', basis: 'day', amount: za ? 6800 : 85000, vehicleType: 'lorry', note: 'Dedicated 8-ton, 10 h day' },
      { id: 'r3', basis: 'trip', amount: za ? 1650 : 22000, vehicleType: 'tipper', note: 'Metro tip load' },
    ],
    active: true,
    notes: 'Preferred for JHB–DBN and Maseru lanes.',
  };
  const b: Omit<Transporter, 'createdAt' | 'updatedAt'> = {
    id: 'tr-kwena',
    name: za ? 'Kwena Logistics (Pty) Ltd' : 'Ruhuna Movers',
    contactName: za ? 'Pieter van Wyk' : 'Kasun Perera',
    phone: za ? '+27825550202' : '+94775550202',
    vatRegistered: false,
    gitInsuranceExpiry: iso(-5), // expired — dispatch is blocked until renewed
    gitCover: za ? 500_000 : 2_000_000,
    paymentTermsDays: 14,
    rates: [
      { id: 'r1', basis: 'ton', amount: za ? 180 : 2400, note: 'Bulk aggregate' },
      { id: 'r2', basis: 'hour', amount: za ? 650 : 9000, vehicleType: 'tipper', minCharge: za ? 2600 : 36000 },
    ],
    active: true,
  };
  await saveTransporter(t, a);
  await saveTransporter(t, b);
  await saveVehicle(t, {
    id: 'vh-ridge1',
    registration: za ? 'ND 418-552' : 'SP LH-5520',
    name: 'Ridgeback superlink',
    type: 'superlink',
    capacity: '34 t',
    status: 'available',
    ownership: 'hired',
    transporterId: a.id,
    transporterName: a.name,
    odometerKm: 402_150,
    licenceDiscExpiry: iso(160),
    roadworthyExpiry: iso(90),
  });
  const uid = await createDriverLogin(t, DEMO_HIRED_DRIVER.phone, DEMO_HIRED_DRIVER.pin);
  await saveDriver(t, {
    id: uid,
    name: DEMO_HIRED_DRIVER.name,
    phone: DEMO_HIRED_DRIVER.phone,
    licenceCode: 'EC',
    licenceExpiry: iso(500),
    prdpExpiry: iso(300),
    status: 'available',
    active: true,
    loginId: DEMO_HIRED_DRIVER.phone,
    ownership: 'hired',
    transporterId: a.id,
    transporterName: a.name,
    defaultVehicleId: 'vh-ridge1',
  });
}

/** Demo mode only: three saved customer locations for the address book (South Africa). */
export async function seedPlacesDemo(t: string, country: 'ZA' | 'LK'): Promise<void> {
  if (opsMode !== 'demo' || country !== 'ZA') return;
  const flag = `hp:ops:${t}:places-seeded`;
  if (localStorage.getItem(flag)) return;
  localStorage.setItem(flag, '1');
  const rows = [
    { id: 'pl-abc-isando', label: 'ABC Steel – Isando gate 3', customer: 'ABC Steel', address: '14 Electron Ave, gate 3', place: 'Isando', placeId: 'za-gp-isando', region: 'Gauteng', lat: -26.13702, lng: 28.20841, contact: 'Themba', phone: '+27115550110', notes: 'Weighbridge at gate 3. Hard hat + vest.', uses: 6 },
    { id: 'pl-buildit-midrand', label: 'BuildIt DC – Midrand', customer: 'BuildIt', address: '2 Lever Rd, Midrand DC', place: 'Midrand', placeId: 'za-gp-midrand', region: 'Gauteng', lat: -25.99381, lng: 28.13042, contact: 'Receiving', phone: '+27115550220', notes: 'Bookings 07:00–15:00 only.', uses: 3 },
    { id: 'pl-port-durban', label: 'Durban Container Terminal – Pier 2', customer: 'Transnet', address: 'Bayhead Rd, Pier 2', place: 'Durban Harbour', placeId: 'za-kzn-durban-port', region: 'KwaZulu-Natal', lat: -29.87695, lng: 31.02315, notes: 'Port permit + TAP slot required.', uses: 1 },
  ];
  for (const r of rows) await savePlace(t, r);
}
