import { lazy, Suspense } from 'react';
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
const Settlements = lazy(() => import('./ops/Settlements'));

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

export default function AdminApp() {
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
                  <Route path="settlements" element={<Settlements />} />
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
