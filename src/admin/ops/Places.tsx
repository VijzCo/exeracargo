// Customer address book: saved exact locations (gates, loading bays) reused when creating jobs.
// Free: pins come from the map (OpenStreetMap), pasted Google Maps links or the driver's GPS.
import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { deletePlace } from '../../ops/store';
import { fmtLL, navUrl, viewUrl } from '../../ops/maps';
import type { SavedPlace } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { EmptyState, errMsg, PageHeader, Spinner, useUi } from '../ui';
import { useOpsUser, usePlaces } from './hooks';
import { fmtTs } from './lib';
import { PinMap, PinPickerModal, SavePlaceModal, type PlaceDraft } from './PinTools';
import './ops-admin.css';

export default function Places() {
  useOpsUser(); // seeds demo data
  const { tenant } = useTenant();
  const { toast, confirm } = useUi();
  const { data: places, loading } = usePlaces();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [edit, setEdit] = useState<PlaceDraft | null>(null);
  const [picking, setPicking] = useState(false);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? places.filter((p) => [p.label, p.customer, p.address, p.place, p.contact].some((v) => v?.toLowerCase().includes(n))) : places;
  }, [places, q]);
  const cur = places.find((p) => p.id === sel) ?? list[0];

  const remove = async (p: SavedPlace) => {
    const ok = await confirm({ title: `Delete “${p.label}”?`, body: 'Jobs that already used it keep their location.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deletePlace(tenant.id, p.id);
      toast('Place deleted');
      setSel(null);
    } catch (e) {
      toast(errMsg(e), 'err');
    }
  };

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Address book"
        subtitle={loading ? 'Loading…' : `${places.length} saved customer locations · used to fill job stops with an exact pin`}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} /> Add place
          </button>
        }
      />
      <div className="card" style={{ padding: 12 }}>
        <label className="sr-only" htmlFor="places-q">
          Search saved places
        </label>
        <input id="places-q" className="input" value={q} placeholder="Search name, customer, address, town…" onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <div className="adm-center adm-center-inline">
          <Spinner />
        </div>
      ) : !list.length ? (
        <div className="card">
          <EmptyState icon="pin" title={places.length ? 'No places match' : 'No saved places yet'}>
            {places.length
              ? 'Try another search.'
              : 'Save a stop from a job (“Save to address book”) or add one here. Next time, pick it in the job form and the driver navigates straight to the gate.'}
          </EmptyState>
        </div>
      ) : (
        <div className="ops-detail-grid">
          <ul className="card stack" style={{ listStyle: 'none', margin: 0, padding: 8, gap: 4 }} aria-label="Saved places">
            {list.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`ops-placerow${cur?.id === p.id ? ' sel' : ''}`}
                  aria-current={cur?.id === p.id || undefined}
                  onClick={() => setSel(p.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', padding: '10px 12px', borderRadius: 10, border: 0, background: cur?.id === p.id ? 'var(--surface-2)' : 'none', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                >
                  <strong>{p.label}</strong>
                  <span className="small muted">
                    {[p.address, p.place].filter(Boolean).join(', ')}
                    {p.customer ? ` · ${p.customer}` : ''}
                  </span>
                  <span className="tiny muted">
                    Used {p.uses ?? 0}×{p.lastUsedAt ? ` · last ${fmtTs(p.lastUsedAt)}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {cur ? (
            <section className="card ops-block stack" aria-label={`Details of ${cur.label}`}>
              <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
                <h2 className="adm-h2" style={{ margin: 0 }}>
                  {cur.label}
                </h2>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <a className="btn btn-ghost btn-sm" href={navUrl(fmtLL(cur))} target="_blank" rel="noopener noreferrer">
                    <Icon name="gps" size={14} /> Directions
                  </a>
                  <a className="btn btn-ghost btn-sm" href={viewUrl(cur)} target="_blank" rel="noopener noreferrer">
                    <Icon name="external" size={14} /> Open in Google Maps
                  </a>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...cur })}>
                    <Icon name="settings" size={14} /> Edit
                  </button>
                  <button type="button" className="icon-btn adm-danger-btn" aria-label={`Delete ${cur.label}`} onClick={() => void remove(cur)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              <dl className="adm-dl">
                {cur.customer ? <Row k="Customer" v={cur.customer} /> : null}
                <Row k="Address" v={[cur.address, cur.place, cur.region].filter(Boolean).join(', ')} />
                {cur.contact || cur.phone ? <Row k="Contact" v={[cur.contact, cur.phone].filter(Boolean).join(' · ')} /> : null}
                {cur.notes ? <Row k="Notes" v={cur.notes} /> : null}
                <Row k="Pin" v={<span className="mono">{fmtLL(cur)}</span>} />
              </dl>
              <PinMap key={cur.id} value={{ lat: cur.lat, lng: cur.lng }} readOnly height={300} />
            </section>
          ) : null}
        </div>
      )}
      <PinPickerModal
        open={picking}
        onClose={() => setPicking(false)}
        title="New place · set the exact spot"
        initial={null}
        onPick={(p) => setEdit({ label: '', address: '', place: '', lat: p.lat, lng: p.lng })}
      />
      <SavePlaceModal open={!!edit} onClose={() => setEdit(null)} draft={edit} onSaved={(p) => setSel(p.id)} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="adm-dl-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
