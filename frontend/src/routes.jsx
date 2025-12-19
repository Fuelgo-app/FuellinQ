// frontend/src/routes.jsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { whoAmI } from "@/api/base";

/* ───────────────── Cookie-first auth helpers ──────────────── */
/** simpele in-memory cache met dedup */
const TTL_MS = 60_000;
let cache = { user: null, ts: 0 };
let inflight = null;

async function fetchSession() {
  const now = Date.now();
  if (cache.ts && now - cache.ts < TTL_MS) return cache.user;
  if (inflight) return inflight;

  inflight = whoAmI()
    .then((user) => {
      cache = { user: user || null, ts: Date.now() };
      return cache.user;
    })
    .catch(() => {
      cache = { user: null, ts: Date.now() };
      return null;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

function useAuthStatus() {
  const loc = useLocation();
  const [state, setState] = React.useState({ status: "loading", user: null });
  const called = React.useRef(false);

  React.useEffect(() => {
    if (called.current) return; // StrictMode dubbelloop voorkomen
    called.current = true;

    fetchSession().then((user) => {
      if (user && user.id) setState({ status: "authed", user });
      else setState({ status: "guest", user: null });
    });
  }, [loc.key]); // bij echte routewissel mag hij opnieuw kijken (maar cache voorkomt spam)

  return state;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", fontFamily: "system-ui" }}>
      <div>Beveiligde pagina laden…</div>
    </div>
  );
}

function RequireAuth({ children }) {
  const loc = useLocation();
  const { status } = useAuthStatus();
  if (status === "loading") return <LoadingScreen />;
  if (status === "guest") {
    const next = encodeURIComponent(loc.pathname + (loc.search || ""));
    return <Navigate to={`/auth?mode=login&next=${next}`} replace />;
  }
  return children;
}

function GuestOnly({ children }) {
  const { status } = useAuthStatus();
  if (status === "loading") return <LoadingScreen />;
  if (status === "authed") return <Navigate to="/app" replace />;
  return children;
}

/* ───────────────── Lazy pages ───────────────── */
const HomePage         = lazy(() => import("@/pages/HomePage.jsx"));
const AboutPage        = lazy(() => import("@/pages/AboutPage.jsx"));
const ContactPage      = lazy(() => import("@/pages/ContactPage.jsx"));

const AuthPage         = lazy(() => import("@/pages/AuthPage.jsx"));
const DashboardPage    = lazy(() => import("@/pages/dashboard.jsx"));
const WalletPage       = lazy(() => import("@/pages/Wallet.jsx"));
const VehiclesPage     = lazy(() => import("@/pages/Vehicles.jsx").catch(() => ({ default: () => <div style={{padding:16}}>Vehicles page ontbreekt (nog).</div> })));
const TransactionsPage = lazy(() => import("@/pages/Transactions.jsx"));
const InvoicesPage     = lazy(() => import("@/pages/Invoices.jsx"));
const InsightsPage     = lazy(() => import("@/pages/Insights.jsx"));
const RewardsPage      = lazy(() => import("@/pages/Rewards.jsx"));

const GreenDealPage    = lazy(() => import("@/pages/GreenDealPage.jsx"));
const EUAgendaPage     = lazy(() => import("@/pages/EUAgenda.jsx"));
const DemoPage         = lazy(() => import("@/pages/DemoPage.jsx"));
const PublicPage       = lazy(() => import("@/pages/PublicPage.jsx"));

const CO2Page          = lazy(() => import("@/pages/CO2.jsx").catch(() => ({ default: () => <div style={{padding:16}}>CO₂ page ontbreekt (nog).</div> })));

const OffersPage       = lazy(() => import("@/pages/partner/OffersPage.jsx"));
const SettingsPage     = lazy(() => import("@/pages/partner/SettingsPage.jsx").catch(() => ({ default: () => <div style={{padding:16}}>Partner Settings ontbreekt (nog).</div> })));

// Onboarding
const OnbWalletPage    = lazy(() => import("@/pages/OnboardingWallet.jsx"));
const OnbBankPage      = lazy(() => import("@/pages/OnboardingBank.jsx"));

// Component i.p.v. page
const AdminBranding    = lazy(() => import("@/components/AdminBranding.jsx"));
const StationFinder    = lazy(() => import("@/components/StationFinder.jsx"));

/* ───────────────── Kleine fallback UI ───────────────── */
function Loading() { return <div style={{ padding: 16 }}>Laden…</div>; }
function NotFound() {
  return (
    <div style={{ padding: 16 }}>
      <h2>404 — Pagina niet gevonden</h2>
      <p>De pagina die je zoekt bestaat niet. <a href="/">Terug naar home</a></p>
    </div>
  );
}

/* ───────────────── Routes ───────────────── */
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

        {/* Auth (guest-only) */}
        <Route
          path="/auth"
          element={
            <GuestOnly>
              <AuthPage />
            </GuestOnly>
          }
        />

        {/* Onboarding (achter login) */}
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
          path="/app"
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

        {/* Partner-portal (publiek laten; zet achter RequireAuth als je wilt) */}
        <Route path="/partner" element={<Navigate to="/partner/offers" replace />} />
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
