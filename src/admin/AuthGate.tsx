import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { safeHttpsUrl } from '../lib/url';
import { Icon } from '../components/Icon';
import { useTenant } from '../tenant/TenantProvider';
import type { AdminProfile } from '../tenant/types';
import { canManage, dataMode, DEMO_PASSWORD, onAdminAuth, resetPassword, signIn, signOut } from '../lib/data';
import { errMsg, Spinner } from './ui';
import { AcceptanceGate } from '../legal/AcceptanceGate';

const AdminCtx = createContext<AdminProfile | null>(null);

export function useAdmin(): AdminProfile {
  const p = useContext(AdminCtx);
  if (!p) throw new Error('useAdmin outside AuthGate');
  return p;
}

export function isSuper(p: AdminProfile): boolean {
  return p.role === 'super';
}

function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes or reset your password.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    default:
      return errMsg(e).replace(/^Firebase:\s*/, '');
  }
}

export function signOutSafe() {
  void signOut().catch(() => undefined);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null | undefined>(undefined);
  const { tenant } = useTenant();

  useEffect(() => onAdminAuth(setProfile), []);

  if (profile === undefined) {
    return (
      <div className="adm-center">
        <Spinner label="Checking session" />
      </div>
    );
  }
  if (!profile) return <Login />;
  if (!canManage(profile, tenant.id)) return <NoAccess profile={profile} />;
  return (
    <AdminCtx.Provider value={profile}>
      <AcceptanceGate role="ops" uid={profile.uid} name={profile.email} onDecline={signOutSafe}>
        {children}
      </AcceptanceGate>
    </AdminCtx.Provider>
  );
}

function Brand() {
  const { tenant } = useTenant();
  return (
    <div className="adm-auth-brand">
      {tenant.logoUrl ? (
        <img src={safeHttpsUrl(tenant.logoUrl)} alt="" className="adm-logo-img" />
      ) : (
        <span className="adm-logo-mark" aria-hidden>
          {(tenant.logoText || tenant.name).charAt(0)}
        </span>
      )}
      <div>
        <div className="adm-auth-name">{tenant.name}</div>
        <div className="muted tiny">Admin console</div>
      </div>
    </div>
  );
}

function Login() {
  const [mode, setMode] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        if (!password) throw new Error('Enter your password.');
        await signIn(email.trim(), password);
      } else {
        await resetPassword(email.trim());
        setInfo(
          dataMode === 'demo'
            ? `Demo mode doesn’t send emails — sign in with password “${DEMO_PASSWORD}”.`
            : 'If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.',
        );
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adm-auth">
      <form className="card adm-auth-card stack" onSubmit={submit} noValidate>
        <Brand />
        <div>
          <h1 className="adm-h1">{mode === 'login' ? 'Sign in' : 'Reset password'}</h1>
          <p className="muted small">
            {mode === 'login' ? 'Manage bookings, content and branding.' : 'We’ll email you a link to set a new password.'}
          </p>
        </div>
        {dataMode === 'demo' ? (
          <div className="alert alert-warn" role="note">
            <Icon name="bolt" size={18} />
            <span>
              <strong>Demo mode</strong> — any email, password <code className="mono">{DEMO_PASSWORD}</code>. Data stays in this browser.
            </span>
          </div>
        ) : null}
        {error ? (
          <div className="alert alert-err" role="alert">
            <Icon name="x" size={18} />
            <span>{error}</span>
          </div>
        ) : null}
        {info ? (
          <div className="alert alert-ok" role="status">
            <Icon name="check" size={18} />
            <span>{info}</span>
          </div>
        ) : null}
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        {mode === 'login' ? (
          <label className="field">
            <span className="label">Password</span>
            <div className="adm-affix">
              <input
                className="input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="adm-affix-btn"
                aria-label={show ? 'Hide password' : 'Show password'}
                aria-pressed={show}
                onClick={() => setShow((s) => !s)}
              >
                <Icon name="eye" size={18} />
              </button>
            </div>
          </label>
        ) : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Send reset link'}
        </button>
        <button
          type="button"
          className="adm-link small"
          onClick={() => {
            setMode(mode === 'login' ? 'reset' : 'login');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'login' ? 'Forgot password?' : '← Back to sign in'}
        </button>
      </form>
    </div>
  );
}

function NoAccess({ profile }: { profile: AdminProfile }) {
  const { tenant } = useTenant();
  const others = profile.tenants.filter((t) => t !== '*' && t !== tenant.id);
  return (
    <div className="adm-auth">
      <div className="card adm-auth-card stack">
        <Brand />
        <div className="alert alert-err" role="alert">
          <Icon name="shield" size={18} />
          <span>
            <strong>No access to this site.</strong> {profile.email} isn’t an admin for “{tenant.name}” (<code className="mono">{tenant.id}</code>).
          </span>
        </div>
        {others.length ? (
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">Sites you can manage</span>
            {others.map((id) => (
              <a key={id} className="btn btn-ghost btn-sm" href={`/admin?site=${encodeURIComponent(id)}`}>
                <Icon name="globe" size={16} /> {id}
              </a>
            ))}
          </div>
        ) : (
          <p className="muted small">Ask the platform owner to add this site to your admin profile.</p>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={signOutSafe}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </div>
    </div>
  );
}
