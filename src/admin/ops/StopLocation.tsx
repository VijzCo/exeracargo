// Where a stop really is: dispatch's exact pin, the driver's GPS spot, the street address or only the
// town. Lets dispatch adopt the driver's spot as the exact location and save it to the address book.
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { findPlace } from '../../geo';
import { applyStopPin } from '../../ops/store';
import { distanceM, driverPin, navUrl, stopTarget, TARGET_LABEL, viewUrl, type LatLng } from '../../ops/maps';
import type { Job, JobStop } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { errMsg, useUi } from '../ui';
import { useOpsUser } from './hooks';
import { fmtTs } from './lib';
import { SavePlaceModal, type PlaceDraft } from './PinTools';

type AnyStop = Job['pickup'] | JobStop;

const LVL = { pin: 'ops-lvl-ok', driver: 'ops-lvl-ok', address: 'ops-lvl-none', town: 'ops-lvl-warn' } as const;

/** Ordered navigation points of a job ("lat,lng" or address text). */
export function jobRoutePoints(job: Job, stops: { id: string; s: AnyStop }[]): string[] {
  return stops.map(({ id, s }) => stopTarget(s, driverPin(job, id)).q);
}

export function StopLocation({ job, stopId, s }: { job: Job; stopId: string; s: AnyStop }) {
  const { tenant } = useTenant();
  const user = useOpsUser();
  const { toast } = useUi();
  const [save, setSave] = useState<PlaceDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const pin = job.pins?.[stopId];
  const t = stopTarget(s, pin && !pin.suggested ? pin : undefined);

  const adopt = async (ll: LatLng) => {
    setBusy(true);
    try {
      await applyStopPin(tenant.id, job, stopId, ll, user);
      toast('Exact location updated — future navigation uses this spot');
    } catch (e) {
      toast(errMsg(e), 'err');
    } finally {
      setBusy(false);
    }
  };
  const draft = (ll: LatLng): PlaceDraft => {
    const who = job.customer.company?.trim() || job.customer.name.trim();
    return {
      label: [who, s.place, s.address].filter(Boolean).join(' – ').slice(0, 120),
      customer: who || undefined,
      address: s.address ?? '',
      place: s.place,
      placeId: s.placeId || undefined,
      region: s.region || findPlace(s.placeId)?.region,
      lat: ll.lat,
      lng: ll.lng,
      contact: s.contact,
      phone: s.phone,
      notes: 'instructions' in s ? s.instructions : undefined,
    };
  };

  return (
    <div className="ops-loc">
      <span className={`ops-chip ${LVL[t.kind]}`} title={t.ll ? `${t.ll.lat.toFixed(6)}, ${t.ll.lng.toFixed(6)}` : t.q}>
        <Icon name="pin" size={12} /> {TARGET_LABEL[t.kind]}
      </span>
      <a className="adm-link tiny ops-noprint" target="_blank" rel="noopener noreferrer" href={navUrl(t.q)}>
        Navigate
      </a>
      {t.ll ? (
        <a className="adm-link tiny ops-noprint" target="_blank" rel="noopener noreferrer" href={viewUrl(t.ll)}>
          View pin
        </a>
      ) : null}
      {pin ? (
        <div className={`ops-loc-actions small ${pin.suggested ? 'ops-loc-suggest' : ''}`} style={{ flexBasis: '100%' }}>
          {pin.suggested ? (
            <>
              <strong>Driver’s GPS differs from your pin</strong>
              {typeof s.lat === 'number' && typeof s.lng === 'number' ? ` by ${Math.round(distanceM(pin, { lat: s.lat, lng: s.lng }))} m` : ''} · {fmtTs(pin.at)}
              {pin.acc ? ` · ±${Math.round(pin.acc)} m` : ''}{' '}
            </>
          ) : (
            <span className="muted">
              Driver pinned this spot · {fmtTs(pin.at)}
              {pin.acc ? ` · ±${Math.round(pin.acc)} m` : ''}{' '}
            </span>
          )}
          <a className="adm-link" target="_blank" rel="noopener noreferrer" href={viewUrl(pin)}>
            View
          </a>{' '}
          ·{' '}
          <button type="button" className="adm-link ops-linkbtn" disabled={busy} onClick={() => void adopt(pin)}>
            Use as exact location
          </button>{' '}
          ·{' '}
          <button type="button" className="adm-link ops-linkbtn" onClick={() => setSave(draft(pin))}>
            Save to address book
          </button>
        </div>
      ) : t.kind === 'pin' && t.ll ? (
        <button type="button" className="adm-link ops-linkbtn tiny ops-loc-actions" onClick={() => setSave(draft(t.ll!))}>
          Save to address book
        </button>
      ) : null}
      <SavePlaceModal open={!!save} onClose={() => setSave(null)} draft={save} />
    </div>
  );
}
