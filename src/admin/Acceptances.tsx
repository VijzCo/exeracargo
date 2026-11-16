// Operations → Consents: who accepted which legal document version, when (click-wrap audit trail).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { LEGAL_DOCS, legalDoc } from '../legal/docs';
import { listAcceptances, type Acceptance } from '../legal/acceptance';
import { csv } from './ops/lib';
import { downloadText, EmptyState, errMsg, fmtDateTime, PageHeader, Spinner } from './ui';
import type { LegalDocId } from '../tenant/types';

const ROLE: Record<string, string> = { ops: 'Dispatcher', driver: 'Driver', hired: 'Hired driver (link)', customer: 'Customer' };

export default function Acceptances() {
  const { tenant } = useTenant();
  const [rows, setRows] = useState<Acceptance[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    listAcceptances(tenant.id)
      .then(setRows)
      .catch((e) => setErr(errMsg(e)));
  }, [tenant.id]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !s || `${r.name} ${r.docId} ${r.role} ${r.version}`.toLowerCase().includes(s));
  }, [rows, q]);

  const exportCsv = () =>
    downloadText(
      `${tenant.id}-consents.csv`,
      csv([
        ['Accepted at', 'Name', 'Role', 'Document', 'Version', 'User id', 'App version', 'Device'],
        ...shown.map((r) => [new Date(r.acceptedAt).toISOString(), r.name, ROLE[r.role] ?? r.role, LEGAL_DOCS[r.docId as LegalDocId]?.title ?? r.docId, r.version, r.uid, r.appVersion, r.userAgent]),
      ]),
      'text/csv',
    );

  return (
    <div className="stack adm-page">
      <PageHeader
        title="Consents"
        subtitle="Click-wrap records: who accepted which version of the Terms, Privacy Notice and Driver licence, and when. Records cannot be edited or deleted."
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!shown.length}>
            <Icon name="download" size={16} /> CSV
          </button>
        }
      />

      <section className="card stack">
        <h2 className="adm-h2">Current documents</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Version</th>
                <th>Who accepts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(Object.keys(LEGAL_DOCS) as LegalDocId[]).map((id) => {
                const d = legalDoc(id, tenant);
                const who = { terms: 'Dispatchers', privacy: 'Everyone', driver: 'Drivers', hired: 'Hired drivers (link)', booking: 'Customers (booking form)', transporter: 'Signed on paper' }[id];
                return (
                  <tr key={id}>
                    <td>{d.title}</td>
                    <td className="mono">{d.version}</td>
                    <td className="muted">{who}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Link className="adm-link small" to={`/admin/legal/${id}`}>
                        View / print
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="small muted">
          Edit company details or replace the text under <Link to="/admin/content/legal">Site content → Legal &amp; story</Link>. A new version makes everyone accept again.
        </p>
      </section>

      <section className="card stack">
        <div className="spread">
          <h2 className="adm-h2">Acceptance records</h2>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Search name, document…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search consents" />
        </div>
        {err ? (
          <p className="alert alert-err">{err}</p>
        ) : rows === null ? (
          <Spinner />
        ) : !shown.length ? (
          <EmptyState icon="contract" title="No records yet">
            Records appear when people accept the documents after signing in.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Document</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.acceptedAt)}</td>
                    <td>{r.name || <span className="muted">—</span>}</td>
                    <td>{ROLE[r.role] ?? r.role}</td>
                    <td>{LEGAL_DOCS[r.docId as LegalDocId]?.short ?? r.docId}</td>
                    <td className="mono">{r.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
