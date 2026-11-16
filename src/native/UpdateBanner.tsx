// Update notice for the Android app (renders nothing on the web or when up to date).
import { useEffect, useState, type CSSProperties } from 'react';
import { applyNow, getUpdateState, installApk, onUpdateState, type UpdateState } from './updater';

export function UpdateBanner() {
  const [s, setS] = useState<UpdateState>(getUpdateState);
  const [hidden, setHidden] = useState(false);
  useEffect(() => onUpdateState((x) => (setS(x), setHidden(false))), []);
  if (s.kind === 'none' || (hidden && s.kind !== 'apk-required')) return null;

  const box: CSSProperties = {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 'calc(76px + env(safe-area-inset-bottom))',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 14,
    background: 'var(--surface, #121A2B)',
    color: 'var(--text, #EEF2F8)',
    border: '1px solid var(--primary, #FFB61E)',
    boxShadow: '0 8px 30px rgba(0,0,0,.45)',
    fontSize: 14,
  };
  const later = (
    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHidden(true)}>
      Later
    </button>
  );

  if (s.kind === 'ready')
    return (
      <div role="status" style={box}>
        <span style={{ flex: 1 }}>
          <strong>Update ready</strong> — applies next time you open the app.
        </span>
        {later}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void applyNow(s.id)}>
          Restart now
        </button>
      </div>
    );

  return (
    <div role="alert" style={box}>
      <span style={{ flex: 1 }}>
        <strong>{s.kind === 'apk-required' ? 'Please update the app' : 'New app version'}</strong> ({s.versionName})
        {s.kind === 'apk-required' ? ' — needed to keep receiving updates.' : '.'} Tap Install, then open the download.
      </span>
      {s.kind === 'apk-available' ? later : null}
      <button type="button" className="btn btn-primary btn-sm" onClick={() => installApk(s.url)}>
        Install
      </button>
    </div>
  );
}
