// Notification status + self-test for this device (console Settings → Notifications, driver Profile).
// Shows exactly what is missing (site set-up, browser, permission) and lets the user send a test push.
import { useState } from 'react';
import { usePushState } from './usePush';
import { sendTestPush } from './functions';

export function PushStatus({ role, tenantId, compact = false }: { role: 'ops' | 'driver'; tenantId: string; compact?: boolean }) {
  const { state, error, request } = usePushState();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await sendTestPush(tenantId, role);
      if (!r.devices) setMsg({ ok: false, text: 'No device is registered for you yet. Turn on notifications first.' });
      else if (!r.sent) setMsg({ ok: false, text: `Found ${r.devices} device(s) but none accepted the message. Turn notifications off and on again.` });
      else setMsg({ ok: true, text: `Sent to ${r.sent} of ${r.devices} device(s) (${r.platforms.join(', ')}). It should appear within a few seconds.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const line =
    state === 'granted'
      ? '🔔 Notifications are on for this device.'
      : state === 'denied'
        ? '🔕 Blocked. Allow notifications for this site in the browser settings (Safari: Settings → Websites → Notifications; Chrome: the lock icon in the address bar), or in the phone’s app settings, then reload.'
        : state === 'unsupported'
          ? `⚠️ ${error || 'Notifications are not available here.'}`
          : state === 'error'
            ? `⚠️ Could not turn on notifications: ${error}`
            : '🔕 Notifications are off for this device.';

  return (
    <div className={compact ? 'push-status compact' : 'push-status'} style={{ display: 'grid', gap: 10 }}>
      <p style={{ margin: 0 }}>{line}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(state === 'default' || state === 'error') && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void request()}>
            {state === 'error' ? 'Try again' : 'Turn on notifications'}
          </button>
        )}
        {state === 'granted' && (
          <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void test()}>
            {busy ? 'Sending…' : 'Send a test notification'}
          </button>
        )}
      </div>
      {msg && (
        <p role="status" style={{ margin: 0, color: msg.ok ? 'var(--ok, #2fbf71)' : 'var(--err, #e5484d)' }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
