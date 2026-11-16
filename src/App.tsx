import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom';
import { TenantProvider } from './tenant/TenantProvider';
import Layout from './components/Layout';
import Home from './pages/Home';
import FleetPage from './pages/Fleet';
import ServicesPage from './pages/Services';
import InsightsPage from './pages/Insights';
import InsightArticle from './pages/InsightArticle';
import OffersPage from './pages/Offers';
import LogisticsPage from './pages/Logistics';
import ContactPage from './pages/Contact';
import NotFound from './pages/NotFound';

const Booking = lazy(() => import('./pages/Booking'));
const Track = lazy(() => import('./pages/Track'));
const Admin = lazy(() => import('./admin/AdminApp'));
const DriverApp = lazy(() => import('./driver/DriverApp'));
const JobLinkPage = lazy(() => import('./driver/JobLinkPage'));
const LegalPage = lazy(() => import('./pages/Legal'));

const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;

function Fallback() {
  return (
    <div className="boot" style={{ minHeight: '60vh' }}>
      <div className="boot-spinner" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <TenantProvider>
      <Router>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/driver/*" element={<DriverApp />} />
            <Route path="/j/:token" element={<JobLinkPage />} />
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="fleet" element={<FleetPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="insights" element={<InsightsPage />} />
              <Route path="insights/:slug" element={<InsightArticle />} />
              <Route path="offers" element={<OffersPage />} />
              <Route path="logistics" element={<LogisticsPage />} />
              <Route path="book" element={<Booking />} />
              <Route path="track" element={<Track />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="legal/:slug" element={<LegalPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </TenantProvider>
  );
}
