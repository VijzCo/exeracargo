import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import { listMessages } from '../lib/data';
import { telLink, waLink } from '../lib/wa';
import { phoneDigits } from './bookingUtils';
import { copyText, EmptyState, fmtDateTime, PageHeader, useLoader, useUi } from './ui';

export default function Messages() {
  const { tenant } = useTenant();
  const { toast } = useUi();
  const { data, loading, error, reload } = useLoader(() => listMessages(tenant.id), [tenant.id]);
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = data ?? [];
    if (!n) return list;
    return list.filter((m) =>
      [m.name, m.phone, m.email ?? '', m.message].some((s) => (s || '').toLowerCase().includes(n)),
    );
  }, [data, q]);

  return (
    <div className="stack adm-page">
      <PageHeader
        title="Messages"
        subtitle={loading ? 'Loading…' : `${rows.length} message${rows.length === 1 ? '' : 's'} from the contact form`}
        actions={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void reload()} disabled={loading}>
            <Icon name="clock" size={16} /> Refresh
          </button>
        }
      />
      <label className="field" style={{ maxWidth: 420 }}>
        <span className="sr-only">Search messages</span>
        <div className="adm-affix">
          <input className="input" type="search" placeholder="Search name, phone, text…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="adm-affix-s" aria-hidden>
            <Icon name="search" size={16} />
          </span>
        </div>
      </label>

      {error ? (
        <div className="alert alert-err" role="alert">
          <Icon name="x" size={18} /> Couldn’t load messages: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="stack" style={{ gap: 10 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="mail" title={data?.length ? 'No messages match' : 'Inbox is empty'}>
            {data?.length ? 'Try another search.' : 'Enquiries sent from the Contact page will appear here.'}
          </EmptyState>
        </div>
      ) : (
        <ul className="adm-msgs">
          {rows.map((m, i) => {
            const greeting = `Hello ${m.name || ''}, thanks for contacting ${tenant.name}. `.replace('Hello ,', 'Hello,');
            return (
              <li key={m.id ?? i} className="card adm-msg">
                <div className="spread">
                  <div className="row" style={{ gap: 10 }}>
                    <span className="adm-avatar" aria-hidden>
                      {(m.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div>
                      <strong>{m.name || 'Unknown'}</strong>
                      <div className="muted tiny">
                        {m.phone}
                        {m.email ? ` · ${m.email}` : ''}
                      </div>
                    </div>
                  </div>
                  <time className="muted tiny">{fmtDateTime(m.createdAt)}</time>
                </div>
                <p className="adm-msg-body">{m.message}</p>
                <div className="adm-actions-row">
                  {m.phone ? (
                    <>
                      <a className="btn btn-ghost btn-sm" href={telLink(m.phone)}>
                        <Icon name="phone" size={16} /> Call
                      </a>
                      <a
                        className="btn btn-ghost btn-sm"
                        href={waLink(phoneDigits(m.phone), greeting)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="whatsapp" size={16} /> WhatsApp
                      </a>
                    </>
                  ) : null}
                  {m.email ? (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: your enquiry to ${tenant.name}`)}`}
                    >
                      <Icon name="mail" size={16} /> Email
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => toast((await copyText(m.message)) ? 'Message copied' : 'Copy failed', 'info')}
                  >
                    <Icon name="copy" size={16} /> Copy
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
