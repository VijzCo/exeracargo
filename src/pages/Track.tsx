import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenant } from '../tenant/TenantProvider';
import type { BookingStatus, Tracking } from '../tenant/types';
import type { StringKey } from '../i18n/strings';
import { getTracking } from '../lib/data';
import { waLink } from '../lib/wa';
import { Icon } from '../components/Icon';
import '../styles/booking.css';

const FLOW: BookingStatus[] = ['pending', 'confirmed', 'assigned', 'in_transit', 'completed'];

const STATUS_HELP: Record<BookingStatus, string> = {
  pending: 'Request received — awaiting dispatcher review.',
  confirmed: 'Price and time confirmed.',
  assigned: 'A vehicle and driver have been assigned.',
  in_transit: 'Your load is on the way.',
  completed: 'Delivered / tipped. Thank you!',
  cancelled: 'This booking was cancelled.',
};

const STATUS_ICON: Record<BookingStatus, string> = {
  pending: 'clock',
  confirmed: 'check',
  assigned: 'user',
  in_transit: 'truck',
  completed: 'star',
  cancelled: 'x',
};

/** Loose client-side shape check; the server lookup is authoritative. */
const REF_RE = /^[A-Z]{1,3}-[A-Z0-9]{7}$/;

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'found'; data: Tracking }
  | { kind: 'notfound'; ref: string }
  | { kind: 'error'; message: string };

export default function Track() {
  const { tenant, t } = useTenant();
  const [params, setParams] = useSearchParams();
  const [ref, setRef] = useState(() => (params.get('ref') ?? '').trim().toUpperCase());
  const [inputError, setInputError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const reqId = useRef(0);
  const resultRef = useRef<HTMLDivElement>(null);

  const lookup = useCallback(
    async (raw: string, focusResult: boolean) => {
      const r = raw.trim().toUpperCase().replace(/\s+/g, '');
      if (!r) {
        setInputError('Enter your booking reference.');
        return;
      }
      if (!REF_RE.test(r)) {
        setInputError('References look like ABC-7K2M9QX.');
        return;
      }
      setInputError(null);
      const id = ++reqId.current;
      setState({ kind: 'loading' });
      try {
        const data = await getTracking(tenant.id, r);
        if (id !== reqId.current) return;
        setState(data ? { kind: 'found', data } : { kind: 'notfound', ref: r });
      } catch (err) {
        if (id !== reqId.current) return;
        console.error('[track] lookup failed', err);
        setState({ kind: 'error', message: 'We couldn’t check that reference right now. Please try again shortly.' });
      }
      if (focusResult) requestAnimationFrame(() => resultRef.current?.focus());
    },
    [tenant.id],
  );

  // auto-lookup when arriving with ?ref=
  const initialRef = useRef(ref);
  useEffect(() => {
    if (initialRef.current) void lookup(initialRef.current, false);
  }, [lookup]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const r = ref.trim().toUpperCase();
    setParams(r ? { ref: r } : {}, { replace: true });
    void lookup(r, true);
  };

  const statusLabel = (s: BookingStatus) => t(`status.${s}` as StringKey);
  const supportText =
    state.kind === 'found' || state.kind === 'notfound'
      ? `Hello ${tenant.name}, I need help with booking ${state.kind === 'found' ? state.data.ref : state.ref}.`
      : `Hello ${tenant.name}, I need help with my booking.`;

  return (
    <main className="bk-page">
      <div className="container bk-track">
        <header className="bk-head">
          <span className="eyebrow">{t('track.go')}</span>
          <h1 className="h2" style={{ margin: '8px 0 0' }}>
            {t('track.title')}
          </h1>
          <p className="lead muted">{t('track.sub')}</p>
        </header>

        <form className="card bk-track-form" onSubmit={onSubmit} noValidate role="search" aria-label={t('track.title')}>
          <div className="field">
            <label className="label" htmlFor="tr-ref">
              {t('track.ref')}
            </label>
            <input
              id="tr-ref"
              className="input"
              value={ref}
              onChange={(e) => {
                setRef(e.target.value.toUpperCase());
                if (inputError) setInputError(null);
              }}
              placeholder="ABC-7K2M9QX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? 'tr-ref-err' : undefined}
            />
            {inputError && (
              <span className="field-error" id="tr-ref-err" role="alert">
                {inputError}
              </span>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={state.kind === 'loading'} aria-busy={state.kind === 'loading'}>
            {state.kind === 'loading' ? <span className="bk-spin" aria-hidden="true" /> : <Icon name="search" size={18} />}
            {t('track.go')}
          </button>
        </form>

        <div ref={resultRef} tabIndex={-1} aria-live="polite" style={{ outline: 'none', marginTop: 20 }}>
          {state.kind === 'loading' && (
            <div className="card" aria-busy="true">
              <div className="skeleton" style={{ height: 22, width: '40%', borderRadius: 8 }} />
              <div className="skeleton" style={{ height: 160, marginTop: 16, borderRadius: 12 }} />
            </div>
          )}

          {state.kind === 'notfound' && (
            <div className="card stack">
              <div className="alert alert-warn" role="status">
                <Icon name="search" size={18} />
                <span>
                  {t('track.notFound')} <strong className="mono">{state.ref}</strong>
                </span>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                Check the reference from your confirmation, or contact us and we’ll look it up.
              </p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="alert alert-err" role="alert">
              <Icon name="x" size={18} />
              <span>{state.message}</span>
            </div>
          )}

          {state.kind === 'found' && <Result data={state.data} statusLabel={statusLabel} />}
        </div>

        <div className="card spread" style={{ marginTop: 20 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Need help with a booking?</div>
            <div className="small muted">{tenant.contact.hours}</div>
          </div>
          <div className="row" style={{ '--gap': '8px' } as CSSProperties}>
            {tenant.contact.whatsapp && (
              <a className="btn btn-primary" href={waLink(tenant.contact.whatsapp, supportText)} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={18} /> WhatsApp support
              </a>
            )}
            {tenant.booking.enabled && (
              <Link className="btn btn-ghost" to="/book">
                New booking
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Result({ data, statusLabel }: { data: Tracking; statusLabel: (s: BookingStatus) => string }) {
  const cancelled = data.status === 'cancelled';
  const idx = FLOW.indexOf(data.status);
  const updated = data.updatedAt
    ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt))
    : '—';

  return (
    <section className="card stack" style={{ '--gap': '20px' } as CSSProperties} aria-labelledby="tr-result-h">
      <div className="spread">
        <div>
          <div className="tiny muted">Booking</div>
          <h2 className="h3 mono" id="tr-result-h" style={{ margin: 0 }}>
            {data.ref}
          </h2>
        </div>
        <span className={`status status-${data.status}`}>{statusLabel(data.status)}</span>
      </div>

      {cancelled ? (
        <div className="bk-cancelled" role="status">
          <Icon name="x" size={22} />
          <div>
            <strong>{statusLabel('cancelled')}</strong>
            <div className="small">{STATUS_HELP.cancelled} Contact us if you’d like to rebook.</div>
          </div>
        </div>
      ) : (
        <ol className="bk-timeline" aria-label="Booking progress">
          {FLOW.map((s, i) => {
            const st = i < idx || (i === idx && s === 'completed') ? 'done' : i === idx ? 'current' : 'todo';
            return (
              <li key={s} className="bk-tl-item" data-state={st} aria-current={i === idx ? 'step' : undefined}>
                <span className="bk-tl-dot" aria-hidden="true">
                  <Icon name={st === 'done' ? 'check' : STATUS_ICON[s]} size={16} />
                </span>
                <div className="bk-tl-body">
                  <div className="bk-tl-title">
                    {statusLabel(s)}
                    <span className="sr-only">{st === 'done' ? ' — done' : st === 'current' ? ' — current' : ' — upcoming'}</span>
                  </div>
                  {i <= idx && <div className="small muted">{STATUS_HELP[s]}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {data.note && (
        <div className="bk-note">
          <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 4 }}>
            Note from dispatcher
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{data.note}</div>
        </div>
      )}

      <dl className="bk-dl">
        <dt>{data.kind === 'freight' ? 'Shipment' : 'Vehicle'}</dt>
        <dd>
          {data.vehicleName}
          <span className="badge badge-muted" style={{ marginLeft: 8 }}>
            {data.kind === 'freight' ? 'Freight' : 'Vehicle hire'}
          </span>
        </dd>
        <dt>Date & time</dt>
        <dd>
          {data.date} at {data.time}
        </dd>
        <dt>Route</dt>
        <dd>
          {data.pickupPlace || (data as { pickupDistrict?: string }).pickupDistrict} → {data.dropoffPlace || (data as { dropoffDistrict?: string }).dropoffDistrict}
        </dd>
        <dt>Last updated</dt>
        <dd>{updated}</dd>
      </dl>
    </section>
  );
}
