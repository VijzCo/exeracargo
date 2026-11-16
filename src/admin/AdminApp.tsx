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
