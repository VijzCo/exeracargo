import { useEffect, useState } from 'react';
import Chat from '../ops/Chat';
import { BROADCAST, watchThread } from '../ops/store';
import type { Thread } from '../ops/types';
import { Icon } from '../components/Icon';
import { fmtTime, useDriver } from './ctx';

export default function ChatTab() {
  const { tenantId, driver, user } = useDriver();
  const [bc, setBc] = useState<Thread | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => watchThread(tenantId, BROADCAST, setBc), [tenantId]);

  return (
    <div className="drv-chatpage">
      {bc && (
        <section className={`drv-announce ${open ? 'open' : ''}`}>
          <button type="button" className="drv-announce-head" aria-expanded={open} aria-controls="drv-announce-body" onClick={() => setOpen((o) => !o)}>
            <Icon name="bolt" size={18} />
            <span className="drv-announce-t">
              <strong>Announcements</strong>
              {!open && <span className="small">{bc.lastText}</span>}
            </span>
            <time className="small muted">{fmtTime(bc.lastAt)}</time>
            <Icon name="arrow" size={18} style={{ transform: `rotate(${open ? -90 : 90}deg)` }} />
          </button>
          {open && (
            <div id="drv-announce-body">
              <Chat tenantId={tenantId} threadId={BROADCAST} user={user} readOnly height={240} />
            </div>
          )}
        </section>
      )}
      <div className="drv-chat-fill">
        <Chat tenantId={tenantId} threadId={driver.id} user={user} height="100%" />
      </div>
    </div>
  );
}
