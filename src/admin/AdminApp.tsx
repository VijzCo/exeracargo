import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AuthGate, { useAdmin, isSuper } from './AuthGate';
import Shell from './Shell';
import Dashboard from './Dashboard';
import { DraftProvider } from './content/draft';
import { Spinner, UiProvider } from './ui';
import './admin.css';

const Bookings = lazy(() => import('./Bookings'));
const Messages = lazy(() => import('./Messages'));
const ContentEditor = lazy(() => import('./content/ContentEditor'));
const Sites = lazy(() => import('./Sites'));
const Dispatch = lazy(() => import('./ops/Dispatch'));
const JobEditor = lazy(() => import('./ops/JobEditor'));
const JobDetail = lazy(() => import('./ops/JobDetail'));
const Vehicles = lazy(() => import('./ops/Vehicles'));
const Drivers = lazy(() => import('./ops/Drivers'));
const ChatInbox = lazy(() => import('./ops/ChatInbox'));
const LiveMap = lazy(() => import('./ops/LiveMap'));
const Reports = lazy(() => import('./ops/Reports'));
const Transporters = lazy(() => import('./ops/Transporters'));
const Places = lazy(() => import('./ops/Places'));
const Settlements = lazy(() => import('./ops/Settlements'));
const Acceptances = lazy(() => import('./Acceptances'));
const Notifications = lazy(() => import('./Notifications'));
const LegalPrint = lazy(() => import('./LegalPrint'));

function SuperOnly({ children }: { children: JSX.Element }) {
  const p = useAdmin();
  return isSuper(p) ? children : <Navigate to="/admin" replace />;
}

function Loading() {
  return (
    <div className="adm-center adm-center-inline">
      <Spinner />
    </div>
  );
}

// After the console is idle, fetch the everyday screens in the background so the first click on
// Dispatch / a job / New job / Vehicles / Drivers / Chat opens instantly instead of waiting for a download.
let prefetched = false;
function prefetchScreens() {
  if (prefetched) return;
  prefetched = true;
  const go = () => {
    void import('./ops/Dispatch');
    void import('./ops/JobDetail');
    void import('./ops/JobEditor');
    void import('./ops/Vehicles');
    void import('./ops/Drivers');
    void import('./ops/ChatInbox');
    void import('./Bookings');
  };
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(go, { timeout: 4000 });
  else window.setTimeout(go, 2500);
}

export default function AdminApp() {
  useEffect(prefetchScreens, []);
  return (
    <UiProvider>
      <div className="adm-root">
        <AuthGate>
          <DraftProvider>
            <Shell>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="dispatch" element={<Dispatch view="board" />} />
                  <Route path="jobs" element={<Dispatch view="table" />} />
                  <Route path="jobs/new" element={<JobEditor />} />
                  <Route path="jobs/:id" element={<JobDetail />} />
                  <Route path="jobs/:id/edit" element={<JobEditor />} />
                  <Route path="vehicles" element={<Vehicles />} />
                  <Route path="drivers" element={<Drivers />} />
                  <Route path="chat" element={<ChatInbox />} />
                  <Route path="map" element={<LiveMap />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="transporters" element={<Transporters />} />
                  <Route path="places" element={<Places />} />
                  <Route path="settlements" element={<Settlements />} />
                  <Route path="consents" element={<Acceptances />} />
                  <Route path="notifications" element={<Notifications />} />
                  <Route path="legal/:docId" element={<LegalPrint />} />
                  <Route path="content" element={<ContentEditor />} />
                  <Route path="content/:tab" element={<ContentEditor />} />
                  <Route
                    path="sites"
                    element={
                      <SuperOnly>
                        <Sites />
                      </SuperOnly>
                    }
                  />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </Suspense>
            </Shell>
          </DraftProvider>
        </AuthGate>
      </div>
    </UiProvider>
  );
}
