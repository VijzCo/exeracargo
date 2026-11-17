// Console → Notifications: this device's push status, a test button, and what the site needs.
import { useAdmin } from './AuthGate';
import { useTenant } from '../tenant/TenantProvider';
import { PushStatus } from '../push/PushStatus';
import { opsMode } from '../ops/store';

export default function Notifications() {
  const p = useAdmin();
  const { tenant } = useTenant();
  const webKey = !!import.meta.env.VITE_FIREBASE_VAPID_KEY;
  return (
    <div className="adm-page">
      <header className="adm-page-head">
        <h1>Notifications</h1>
        <p className="muted">Pushes for new and changed jobs, driver updates (accepted, delivered, failed) and chat messages.</p>
      </header>
      <section className="card" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>This device</h2>
        <PushStatus role="ops" tenantId={tenant.id} />
        <p className="muted small" style={{ margin: 0 }}>
          Signed in as {p.email}. Each browser or phone you use must turn notifications on once.
        </p>
      </section>
      <section className="card" style={{ padding: 18, display: 'grid', gap: 8, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Site set-up</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li>{opsMode === 'firebase' ? '✅' : '⚠️'} Live data (not demo mode)</li>
          <li>
            {webKey ? '✅' : '❌'} Web push key — {webKey ? 'configured' : 'missing: add the GitHub secret VITE_FIREBASE_VAPID_KEY (Firebase → Project settings → Cloud Messaging → Web Push certificates), then re-run the release'}
          </li>
          <li>
            ℹ️ Android app push needs the GitHub secret GOOGLE_SERVICES_JSON when the APK is built; drivers then get an “update the app” prompt.
          </li>
          <li>ℹ️ Notifications are sent by the Cloud Functions (Blaze plan). Firebase console → Functions → Logs shows each send.</li>
        </ul>
      </section>
    </div>
  );
}
