// Click-wrap gate shown AFTER sign-in: the user must accept the current version of each required
// document before the console / driver app opens. Decline = sign out.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTenant } from '../tenant/TenantProvider';
import { DRAFT_NOTE, legalDoc, REQUIRED, type LegalDoc } from './docs';
import { acceptDocs, pendingDocs, type AcceptRole } from './acceptance';
import { LegalText } from './LegalText';
import './legal.css';

export function AcceptanceGate({
  role,
  uid,
  name,
  onDecline,
  children,
}: {
  role: Exclude<AcceptRole, 'customer'>;
  uid: string;
  name: string;
  onDecline: () => void;
  children: ReactNode;
}) {
  const { tenant } = useTenant();
  const [todo, setTodo] = useState<LegalDoc[] | null>(null);

  useEffect(() => {
    let live = true;
    const docs = REQUIRED[role].map((id) => legalDoc(id, tenant));
    void pendingDocs(tenant.id, uid, docs)
      .then((p) => live && setTodo(p))
      .catch(() => live && setTodo(docs));
    return () => {
      live = false;
    };
  }, [tenant, uid, role]);

  if (todo === null) return <div className="legal-gate-wait" aria-busy="true" />;
  if (!todo.length) return <>{children}</>;
  return <Gate docs={todo} onAccepted={() => setTodo([])} onDecline={onDecline} who={{ uid, name, role }} tenantId={tenant.id} tenantName={tenant.name} />;
}

function Gate({
  docs,
  who,
  tenantId,
  tenantName,
  onAccepted,
  onDecline,
}: {
  docs: LegalDoc[];
  who: { uid: string; name: string; role: AcceptRole };
  tenantId: string;
  tenantName: string;
  onAccepted: () => void;
  onDecline: () => void;
}) {
  const [tab, setTab] = useState(0);
  const [read, setRead] = useState<Set<number>>(new Set());
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // ✓ on a tab once its document was scrolled to the end (informational — never blocks accepting)
  const check = () => {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead((r) => (r.has(tab) ? r : new Set(r).add(tab)));
  };
  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    const t = window.setTimeout(check, 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const d = docs[tab];

  const accept = async () => {
    setBusy(true);
    setErr(null);
    try {
      await acceptDocs(tenantId, who, docs);
      onAccepted();
    } catch (e) {
      setErr(`Could not save your acceptance — check your connection and try again. (${(e as Error).message})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="legal-gate" role="dialog" aria-modal="true" aria-labelledby="legal-gate-h">
      <div className="legal-card">
        <header className="legal-head">
          <span className="legal-eyebrow">{tenantName}</span>
          <h1 id="legal-gate-h">Before you continue</h1>
          <p>Please read and accept {docs.length > 1 ? 'these documents' : 'this document'}. {docs.some((x) => x.version) ? 'We ask again whenever they change.' : ''}</p>
        </header>
        {docs.length > 1 && (
          <div className="legal-tabs" role="tablist">
            {docs.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
                {read.has(i) ? '✓ ' : ''}
                {x.short}
              </button>
            ))}
          </div>
        )}
        <div className="legal-scroll" ref={box} onScroll={check} tabIndex={0} aria-label={d.title}>
          <h2>{d.title}</h2>
          <p className="legal-meta">
            Version {d.version} · <em>{DRAFT_NOTE}</em>
          </p>
          <LegalText body={d.body} />
        </div>
        {docs.length > 1 && read.size < docs.length && <p className="legal-hint">Tap each tab above to read every document.</p>}
        <label className="legal-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>
            I have read and accept the {docs.map((x) => x.title).join(' and the ')}.
          </span>
        </label>
        {err && (
          <p className="legal-err" role="alert">
            {err}
          </p>
        )}
        <div className="legal-actions">
          <button type="button" className="btn btn-ghost" onClick={onDecline} disabled={busy}>
            Decline &amp; sign out
          </button>
          <button type="button" className="btn btn-primary" disabled={!ok || busy} onClick={() => void accept()}>
            {busy ? 'Saving…' : 'Accept & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
