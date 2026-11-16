// /admin/legal/:docId — read or print a legal document. Transporter agreement: ?transporter=<id> fills the party details.
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { DRAFT_NOTE, LEGAL_DOCS, legalDoc } from '../legal/docs';
import { LegalText } from '../legal/LegalText';
import type { LegalDocId } from '../tenant/types';
import { useTransporters } from './ops/hooks';
import '../legal/legal.css';

export default function LegalPrint() {
  const { docId } = useParams();
  const [sp] = useSearchParams();
  const { tenant } = useTenant();
  const { data: transporters } = useTransporters();
  if (!docId || !(docId in LEGAL_DOCS)) return <p className="muted">Unknown document.</p>;
  const d = legalDoc(docId as LegalDocId, tenant);
  let body = d.body;
  const tr = sp.get('transporter') ? transporters?.find((x) => x.id === sp.get('transporter')) : undefined;
  if (docId === 'transporter' && tr) {
    body = body
      .replace('**and** ______________________________ (registration ______________), ______________________________ ("the Transporter").', `**and** ${tr.name} (registration ${tr.regNo || '______________'}), contact ${tr.contactName}, ${tr.phone} ("the Transporter").`)
      .replace('at least R______ per load', tr.gitCover ? `at least R${tr.gitCover.toLocaleString('en-ZA')} per load` : 'at least R______ per load')
      .replace(/Payment within \d+ days/, `Payment within ${tr.paymentTermsDays ?? tenant.legal?.payTermsDays ?? 30} days`);
  }
  return (
    <div className="stack adm-page">
      <div className="spread no-print">
        <Link to="/admin/consents" className="adm-link small">
          ← Consents
        </Link>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Icon name="download" size={16} /> Print / save PDF
        </button>
      </div>
      <article className="card legal-print">
        <h1 className="h3" style={{ marginTop: 0 }}>
          {d.title}
        </h1>
        <p className="small muted">
          {tenant.legal?.legalName || tenant.name} · Version {d.version}
          <span className="no-print"> · {DRAFT_NOTE}</span>
        </p>
        <LegalText body={body} />
      </article>
    </div>
  );
}
