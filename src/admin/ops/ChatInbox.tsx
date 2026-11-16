// Dispatch chat inbox: threads per driver + pinned broadcast channel.
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import Chat from '../../ops/Chat';
import { BROADCAST } from '../../ops/store';
import type { Thread } from '../../ops/types';
import { useTenant } from '../../tenant/TenantProvider';
import { Modal, PageHeader } from '../ui';
import { useDrivers, useNow, useOpsUser, useThreads } from './hooks';
import { timeAgo } from './lib';
import { DutyBadge, LoadingRows } from './widgets';
import './ops-admin.css';

export default function ChatInbox() {
  const { tenant } = useTenant();
  const user = useOpsUser();
  const now = useNow(30_000);
  const [params, setParams] = useSearchParams();
  const { data: threads, loading } = useThreads();
  const { data: drivers } = useDrivers();
  const [q, setQ] = useState('');
  const [picking, setPicking] = useState(false);
  const active = params.get('t');
  const select = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('t', id);
    else next.delete('t');
    setParams(next, { replace: !!active && !!id });
  };

  const driverById = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const broadcast = threads.find((t) => t.id === BROADCAST);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return threads.filter((t) => t.id !== BROADCAST && (!n || (t.driverName ?? driverById.get(t.id)?.name ?? '').toLowerCase().includes(n) || t.lastText.toLowerCase().includes(n)));
  }, [threads, q, driverById]);
  const nameOf = (id: string) => (id === BROADCAST ? 'All drivers (broadcast)' : driverById.get(id)?.name ?? threads.find((t) => t.id === id)?.driverName ?? 'Driver');
  const activeDriver = active && active !== BROADCAST ? driverById.get(active) : undefined;
  const totalUnread = threads.reduce((a, t) => a + (t.unreadOps || 0), 0);

  return (
    <div className="stack adm-page ops-page">
      <PageHeader
        title="Chat"
        subtitle={totalUnread ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : 'All caught up'}
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setPicking(true)}>
            <Icon name="plus" size={16} /> New chat
          </button>
        }
      />
      <div className={`ops-inbox${active ? ' has-active' : ''}`}>
        <aside className="card ops-inbox-list" aria-label="Conversations">
          <div className="ops-inbox-search">
            <div className="adm-affix">
              <input className="input" type="search" placeholder="Search drivers or messages" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search conversations" />
              <span className="adm-affix-s" aria-hidden>
                <Icon name="search" size={16} />
              </span>
            </div>
          </div>
          <ul className="ops-threads">
            <ThreadItem
              id={BROADCAST}
              name="All drivers"
              sub={broadcast ? broadcast.lastText : 'Broadcast an announcement to every driver'}
              at={broadcast?.lastAt}
              unread={broadcast?.unreadOps ?? 0}
              active={active === BROADCAST}
              onSelect={select}
              now={now}
              pinned
            />
            {loading ? (
              <li className="ops-thread-load">
                <LoadingRows n={3} h={48} />
              </li>
            ) : list.length === 0 ? (
              <li className="ops-thread-empty muted small">{q ? 'No conversations match.' : 'No driver conversations yet.'}</li>
            ) : (
              list.map((t: Thread) => (
                <ThreadItem
                  key={t.id}
                  id={t.id}
                  name={t.driverName ?? driverById.get(t.id)?.name ?? 'Driver'}
                  sub={`${t.lastFrom === 'ops' ? 'You: ' : ''}${t.lastText}`}
                  at={t.lastAt}
                  unread={t.unreadOps || 0}
                  active={active === t.id}
                  onSelect={select}
                  now={now}
                />
              ))
            )}
          </ul>
        </aside>
        <section className="card ops-inbox-pane" aria-label="Conversation">
          {active ? (
            <>
              <header className="ops-pane-head">
                <button type="button" className="icon-btn ops-pane-back" aria-label="Back to conversations" onClick={() => select(null)}>
                  <span className="ops-rot-back" aria-hidden>
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
                <span className={`ops-avatar${active === BROADCAST ? ' ops-avatar-bc' : ''}`} aria-hidden>
                  {active === BROADCAST ? <Icon name="bolt" size={16} /> : nameOf(active).charAt(0)}
                </span>
                <div className="ops-pane-title">
                  <strong>{nameOf(active)}</strong>
                  <span className="tiny muted">{active === BROADCAST ? 'Everyone sees messages sent here' : activeDriver ? activeDriver.phone : ''}</span>
                </div>
                {activeDriver ? <DutyBadge d={activeDriver} /> : null}
                {activeDriver ? (
                  <Link to={`/admin/jobs?driver=${encodeURIComponent(activeDriver.id)}&d=all`} className="btn btn-ghost btn-sm ops-hide-xs">
                    Jobs
                  </Link>
                ) : null}
              </header>
              <div className="ops-pane-chat">
                <Chat key={active} tenantId={tenant.id} threadId={active} user={user} driverName={active === BROADCAST ? 'All drivers' : nameOf(active)} height="100%" />
              </div>
            </>
          ) : (
            <div className="ops-pane-empty">
              <Icon name="mail" size={28} />
              <p className="muted">Pick a conversation, or start a new chat with a driver.</p>
            </div>
          )}
        </section>
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} title="New chat">
        {drivers.filter((d) => d.active).length === 0 ? (
          <p className="muted small">
            No active drivers yet. <Link className="adm-link" to="/admin/drivers?open=new">Add a driver</Link>
          </p>
        ) : (
          <ul className="ops-pick">
            {drivers
              .filter((d) => d.active)
              .map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="ops-pick-btn"
                    onClick={() => {
                      setPicking(false);
                      select(d.id);
                    }}
                  >
                    <span className="ops-avatar" aria-hidden>
                      {d.name.charAt(0)}
                    </span>
                    <span className="ops-pick-name">
                      <strong>{d.name}</strong>
                      <span className="tiny muted">{d.phone}</span>
                    </span>
                    <DutyBadge d={d} />
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

function ThreadItem({
  id,
  name,
  sub,
  at,
  unread,
  active,
  onSelect,
  now,
  pinned,
}: {
  id: string;
  name: string;
  sub: string;
  at?: number;
  unread: number;
  active: boolean;
  onSelect: (id: string) => void;
  now: number;
  pinned?: boolean;
}) {
  return (
    <li>
      <button type="button" className={`ops-thread${active ? ' active' : ''}${unread ? ' unread' : ''}${pinned ? ' pinned' : ''}`} onClick={() => onSelect(id)} aria-current={active ? 'true' : undefined}>
        <span className={`ops-avatar${pinned ? ' ops-avatar-bc' : ''}`} aria-hidden>
          {pinned ? <Icon name="bolt" size={16} /> : name.charAt(0)}
        </span>
        <span className="ops-thread-main">
          <span className="ops-thread-top">
            <strong>{name}</strong>
            {at ? <span className="tiny muted">{timeAgo(at, now)}</span> : null}
          </span>
          <span className="ops-thread-sub small">{sub}</span>
        </span>
        {unread ? (
          <span className="ops-unread" aria-label={`${unread} unread`}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
    </li>
  );
}
