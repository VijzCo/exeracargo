import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage, OpsUser } from './types';
import { getMedia, markThreadRead, putMedia, sendMessage, watchMessages } from './store';
import { compressImage } from './image';
import { Icon } from '../components/Icon';
import './ops.css';

/** Realtime chat thread between dispatch and a driver (or the broadcast channel). Shared by console + driver app. */
export default function Chat({
  tenantId,
  threadId,
  user,
  driverName,
  readOnly,
  jobContext,
  height = 480,
}: {
  tenantId: string;
  threadId: string;
  user: OpsUser;
  /** Thread title for the summary (ops side writing to a driver thread). */
  driverName?: string;
  readOnly?: boolean;
  /** Attach messages to a job (shows a job chip). */
  jobContext?: { id: string; ref: string };
  height?: number | string;
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => watchMessages(tenantId, threadId, setMsgs), [tenantId, threadId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    if (msgs.length) void markThreadRead(tenantId, threadId, user.role);
  }, [msgs, tenantId, threadId, user.role]);

  const send = async (e?: FormEvent, imageId?: string) => {
    e?.preventDefault();
    if (busy || (!text.trim() && !imageId)) return;
    setBusy(true);
    setErr(null);
    try {
      await sendMessage(tenantId, threadId, { text, imageId, jobId: jobContext?.id, jobRef: jobContext?.ref }, user, driverName);
      setText('');
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Message not sent');
    } finally {
      setBusy(false);
    }
  };

  const attach = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    try {
      const img = await compressImage(f, 1024, 0.7);
      const id = await putMedia(tenantId, { kind: 'chat', threadId, dataUrl: img.dataUrl, by: user.uid, at: Date.now(), w: img.w, h: img.h });
      setBusy(false);
      await send(undefined, id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Photo not sent');
      setBusy(false);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  let lastDay = '';
  return (
    <div className="chat" style={{ height }}>
      <div className="chat-list" ref={listRef} aria-live="polite" aria-label="Messages">
        {msgs.length === 0 && <p className="chat-empty">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => {
          const day = new Date(m.at).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.from === user.uid;
          return (
            <div key={m.id}>
              {showDay && <div className="chat-day">{new Date(m.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</div>}
              <div className={`chat-msg ${mine ? 'mine' : ''} ${m.role}`}>
                {!mine && <span className="chat-from">{m.fromName}</span>}
                {m.jobRef && <span className="chat-job">#{m.jobRef}</span>}
                {m.imageId && <ChatImage tenantId={tenantId} id={m.imageId} />}
                {m.text && <span className="chat-text">{m.text}</span>}
                <time className="chat-time">{new Date(m.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
              </div>
            </div>
          );
        })}
      </div>
      {!readOnly && (
        <form className="chat-input" onSubmit={send}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void attach(e.target.files?.[0])} />
          <button type="button" className="icon-btn" aria-label="Send a photo" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Icon name="upload" size={18} />
          </button>
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={jobContext ? `Message about #${jobContext.ref}…` : 'Type a message…'}
            maxLength={2000}
            aria-label="Message"
          />
          <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label="Send">
            <Icon name="arrow" size={18} />
          </button>
        </form>
      )}
      {err && (
        <p className="field-error" role="alert" style={{ padding: '0 12px 8px' }}>
          {err}
        </p>
      )}
    </div>
  );
}

function ChatImage({ tenantId, id }: { tenantId: string; id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void getMedia(tenantId, id).then((m) => live && setSrc(m?.dataUrl ?? null));
    return () => {
      live = false;
    };
  }, [tenantId, id]);
  return src ? (
    <button
      type="button"
      className="chat-img"
      aria-label="Open photo"
      onClick={() => {
        // browsers block navigating to data: URLs — render into a blank window instead
        const w = window.open();
        if (!w) return;
        w.document.title = 'Photo';
        w.document.body.style.cssText = 'margin:0;background:#111;display:grid;place-items:center;min-height:100vh';
        const img = w.document.createElement('img');
        img.src = src;
        img.alt = 'Shared photo';
        img.style.maxWidth = '100%';
        w.document.body.appendChild(img);
      }}
    >
      <img src={src} alt="Shared photo" loading="lazy" />
    </button>
  ) : (
    <span className="chat-img skeleton" style={{ width: 160, height: 120 }} />
  );
}
