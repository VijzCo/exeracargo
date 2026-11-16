// Minimal in-app banner for notifications that arrive while the app is open (Android foreground).
import { allowedAppPath, navigateTo } from '../native/platform';

export function showPushToast(title: string, body: string, url?: string): void {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('role', 'status');
  el.style.cssText =
    'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:9999;text-align:left;' +
    'background:#121A2B;color:#EEF2F8;border:1px solid #2a3550;border-left:4px solid #F5A524;border-radius:12px;' +
    'padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.45);font:inherit;cursor:pointer;transition:opacity .3s,transform .3s';
  const t = document.createElement('strong');
  t.textContent = title;
  t.style.display = 'block';
  const b = document.createElement('span');
  b.textContent = body;
  b.style.cssText = 'display:block;opacity:.85;font-size:.92em;margin-top:2px';
  el.append(t, b);
  const close = () => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    window.setTimeout(() => el.remove(), 300);
  };
  el.onclick = () => {
    if (url && allowedAppPath(url)) navigateTo(url);
    else if (url?.startsWith('/admin')) navigateTo(url);
    close();
  };
  document.body.appendChild(el);
  window.setTimeout(close, 6000);
}
