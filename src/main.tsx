import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isNative } from './native/platform';
import './styles/global.css';
import './styles/site.css';

// The Android app is the driver app: anything outside /driver and one-time links (/j/…) opens the jobs list.
if (isNative() && !/^\/(driver|j\/)/.test(window.location.pathname)) {
  window.history.replaceState({}, '', '/driver');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isNative()) void import('./native/boot').then((m) => m.bootNative());
