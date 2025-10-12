// frontend/src/routes.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

/* ---------------- Auth guard helpers ---------------- */
const getToken = () => localStorage.getItem("token") || "";

function RequireAuth({ children }) {
  return getToken() ? children : <Navigate to="/auth?mode=login" replace />;
}
function GuestOnly({ children }) {
  return getToken() ? <Navigate to="/dashboard" replace /> : children;
}

/* ---------------- Lazy pages (zorgt voor snellere bundels) ---------------- */
const HomePage         = lazy(() => import("@/pages/HomePage.jsx"));
const AboutPage        = lazy(() => import("@/pages/AboutPage.jsx"));
const ContactPage      = lazy(() => import("@/pages/ContactPage.jsx"));

const AuthPage         = lazy(() => import("@/pages/AuthPage.jsx"));
const DashboardPage    = lazy(() => import("@/pages/dashboard.jsx"));
const WalletPage       = lazy(() => import("@/pages/Wallet.jsx"));
const VehiclesPage     = lazy(() => import("@/pages/Vehicles.jsx").catch(() => ({ default: () => <div style={{padding:16}}>Vehicles page ontbreekt (nog). Voeg <code>src/pages/Vehicles.jsx</code> toe of pas de route aan.</div> })));
const TransactionsPage = lazy(() => import("@/pages/Transactions.jsx"));
const InvoicesPage     = lazy(() => import("@/pages/Invoices.jsx"));
const InsightsPage     = lazy(() => import("@/pages/Insights.jsx"));
const RewardsPage      = lazy(() => import("@/pages/Rewards.jsx"));

const GreenDealPage    = lazy(() => import("@/pages/GreenDealPage.jsx"));
const EUAgendaPage     = lazy(() => import("@/pages/EUAgenda.jsx"));
const DemoPage         = lazy(() => import("@/pages/DemoPage.jsx"));
const PublicPage       = lazy(() => import("@/pages/PublicPage.jsx"));

const CO2Page          = lazy(() => import("@/pages/CO2.jsx").catch(() => ({ default: () => <div style={{padding:16}}>CO₂ page ontbreekt (nog). Voeg <code>src/pages/CO2.jsx</code> toe of pas de route aan.</div> })));

const OffersPage       = lazy(() => import("@/pages/partner/OffersPage.jsx"));
const SettingsPage     = lazy(() => import("@/pages/partner/SettingsPage.jsx").catch(() => ({ default: () => <div style={{padding:16}}>Partner Settings ontbreekt (nog). Voeg <code>src/pages/partner/SettingsPage.jsx</code> toe of pas de route aan.</div> })));

const OnbWalletPage    = lazy(() => import("@/pages/OnboardingWallet.jsx"));
const OnbBankPage      = lazy(() => import("@/pages/OnboardingBank.jsx"));

// Component i.p.v. page (werkt prima als route target)
const AdminBranding    = lazy(() => import("@/components/AdminBranding.jsx"));
const StationFinder    = lazy(() => import("@/components/StationFinder.jsx"));

/* ---------------- Kleine fallback UI ---------------- */
function Loading() {
  return <div style={{ padding: 16 }}>Laden…</div>;
}
function NotFound() {
  return (
    <div style={{ padding: 16 }}>
      <h2>404 — Pagina niet gevonden</h2>
      <p>De pagina die je zoekt bestaat niet. <a href="/">Terug naar home</a></p>
    </div>
  );
}

/* ---------------- De routes ---------------- */
export default function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Publiek */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/public/:slug?" element={<PublicPage />} />
        <Route path="/finder" element={<StationFinder />} />

        {/* Auth */}
        <Route
          path="/auth"
          element={
            <GuestOnly>
              <AuthPage />
            </GuestOnly>
          }
        />

        {/* Onboarding (achter login of publiek, kies wat je wil) */}
        <Route
          path="/onboarding/wallet"
          element={
            <RequireAuth>
              <OnbWalletPage />
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding/bank"
          element={
            <RequireAuth>
              <OnbBankPage />
            </RequireAuth>
          }
        />

        {/* App (beschermd) */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireAuth>
              <WalletPage />
            </RequireAuth>
          }
        />
        <Route
          path="/vehicles"
          element={
            <RequireAuth>
              <VehiclesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/transactions"
          element={
            <RequireAuth>
              <TransactionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/invoices"
          element={
            <RequireAuth>
              <InvoicesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/insights"
          element={
            <RequireAuth>
              <InsightsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/rewards"
          element={
            <RequireAuth>
              <RewardsPage />
            </RequireAuth>
          }
        />

        {/* CO₂ / Green Deal / EU */}
        <Route
          path="/co2"
          element={
            <RequireAuth>
              <CO2Page />
            </RequireAuth>
          }
        />
        <Route path="/green-deal" element={<GreenDealPage />} />
        <Route path="/eu-agenda"  element={<EUAgendaPage />} />
        <Route path="/demo"       element={<DemoPage />} />

        {/* Partner-portal */}
        <Route
          path="/partner"
          element={<Navigate to="/partner/offers" replace />}
        />
        <Route path="/partner/offers"   element={<OffersPage />} />
        <Route path="/partner/settings" element={<SettingsPage />} />

        {/* Admin (optioneel achter RequireAuth zetten) */}
        <Route path="/admin/branding" element={<AdminBranding />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
