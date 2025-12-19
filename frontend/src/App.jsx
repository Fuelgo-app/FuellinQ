// src/App.jsx
import React, { useEffect, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";

/* ----------------- Direct (lichtgewicht) ----------------- */
import HomePage from "./pages/HomePage.jsx";
import DashboardPage from "./pages/app/dashboard.jsx"; // let op: lowercase bestandsnaam
import WalletPage from "./pages/app/Wallet.jsx";
import Publicpage from "./pages/Publicpage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import AdminBranding from "./components/AdminBranding.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import EUAgendaPage from "./pages/EUAgenda.jsx";
import DemoPage from "./pages/DemoPage.jsx";
import GreenDealPage from "./pages/GreenDealPage.jsx";
import Parking from "./pages/app/Parking.jsx";
import StationFinder from "@/components/StationFinder.jsx";
import Header from "@/components/Header.jsx";

/* ----------------- Lazy (zwaardere pagina's) ----------------- */
const TransactionsPage = lazy(() => import("./pages/app/Transactions.jsx"));
const RewardsPage = lazy(() => import("./pages/app/Rewards.jsx"));
const InsightsPage = lazy(() => import("./pages/app/Insights.jsx"));
const InvoicesPage = lazy(() => import("./pages/app/Invoices.jsx"));
const VehiclesPage = lazy(() => import("./pages/app/Vehicles.jsx"));
const ProtectedRoutesPage = lazy(() => import("./pages/ProtectedRoutes.jsx"));
const TollPage = lazy(() => import("./pages/app/Tolls.jsx"));

/* ✅ Partner */
const PartnerLayout = lazy(() => import("./components/PartnerLayout.jsx"));
const PartnerHome = lazy(() => import("./pages/partner/PartnerHome.jsx"));
const StationsPage = lazy(() => import("./pages/partner/StationsPage.jsx"));
const StationsNew = lazy(() => import("./pages/partner/StationsNew.jsx"));
const StationsEdit = lazy(() => import("./pages/partner/StationsEdit.jsx"));
const OffersPage = lazy(() => import("./pages/partner/OffersPage.jsx"));
const OffersNew = lazy(() => import("./pages/partner/OffersNew.jsx"));
const OffersEdit = lazy(() => import("./pages/partner/OffersEdit.jsx"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings.jsx"));
const PricesPage = lazy(() => import("./pages/partner/PartnerPrices.jsx"));

/* Onboarding */
import OnboardingBank from "./pages/app/onboarding/OnboardingBank.jsx";
import OnboardingWallet from "./pages/app/onboarding/OnboardingWallet.jsx";
import OnboardingDone from "./pages/app/onboarding/OnboardingDone.jsx";

/* ----------------- CO₂ + token-koppeling ----------------- */
import VehicleCo2Card from "./components/VehicleCo2Card.jsx";
import { setToken as setCo2Token } from "./lib/apiCo2.js";

/* ----------------- Branding helpers ----------------- */
import { applyBrandFromStorage as applyBrandFromStorageLib } from "./lib/brand";

/* ----------------- RequireAuth ----------------- */
import RequireAuth from "./components/RequireAuth.jsx";

/* ----------------- Brand toepassen ----------------- */
function applyBrandFromLocalStorage() {
  try {
    applyBrandFromStorageLib?.();
  } catch {}
  try {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    const accent = (css.getPropertyValue("--accent") || "").trim() || "#0b3654";
    const accent2 =
      (css.getPropertyValue("--accent-2") || "").trim() || "#f58220";
    root.style.setProperty("--brand-primary", accent);
    root.style.setProperty("--brand-secondary", accent2);
  } catch {}
  try {
    const b = JSON.parse(localStorage.getItem("brand") || "{}");
    if (b.font_family) document.body.style.fontFamily = b.font_family;
    if (b.logo_url) localStorage.setItem("brand_logo", b.logo_url);
  } catch {}
}

/* ----------------- Lokale helpers ----------------- */
const shouldShowBrandingLinkLocal = () => {
  try {
    return localStorage.getItem("role") === "admin";
  } catch {
    return false;
  }
};

/* ----------------- Kleine Progress component ----------------- */
function ProgressSteps({ step }) {
  const items = [
    { n: 1, label: "Account" },
    { n: 2, label: "Bank koppelen" },
    { n: 3, label: "Wallet" },
  ];
  return (
    <div
      style={{
        background: "#f8fafc",
        borderTop: "1px solid #eef2f7",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div className="container" style={{ maxWidth: 920, margin: "0 auto", padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {items.map((it) => {
            const active = it.n === step;
            const done = it.n < step;
            return (
              <div
                key={it.n}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  boxShadow: active ? "0 6px 16px rgba(2,6,23,.06)" : "none",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: done ? "#22c55e" : active ? "#2563eb" : "#e5e7eb",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {done ? "✓" : it.n}
                </div>
                <div style={{ fontWeight: 800, color: active ? "#111827" : "#374151" }}>
                  Stap {it.n}/3 · {it.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ----------------- Error boundary ----------------- */
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(err, info) {
    console.error("App crash:", err, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16 }}>
          <h3 style={{ color: "#b91c1c", marginTop: 0 }}>Er ging iets mis</h3>
          <p className="muted">De fout hieronder komt uit een pagina/component. Je app blijft draaien.</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#fff7ed",
              padding: 12,
              borderRadius: 8,
              border: "1px solid #fed7aa",
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <Link className="btn" to="/">Terug naar home</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ----------------- Admin-only guard ----------------- */
function AdminOnly({ children }) {
  const isAdmin = (() => {
    try {
      return localStorage.getItem("role") === "admin";
    } catch {
      return false;
    }
  })();
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/* ----------------- Auth placeholders ----------------- */
function ForgotPasswordPage() {
  return (
    <div className="container" style={{ maxWidth: 520, margin: "24px auto" }}>
      <div className="card p-4" style={{ borderRadius: 16 }}>
        <h3 style={{ marginTop: 0 }}>Wachtwoord vergeten</h3>
        <p className="muted">Vul je e-mailadres in. We sturen je (in een echte setup) een resetlink.</p>
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            required
            placeholder="jij@voorbeeld.nl"
            className="input"
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button className="btn" type="submit">Stuur resetlink</button>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordPage() {
  const qs = new URLSearchParams(useLocation().search);
  const token = qs.get("token") || "—";
  return (
    <div className="container" style={{ maxWidth: 520, margin: "24px auto" }}>
      <div className="card p-4" style={{ borderRadius: 16 }}>
        <h3 style={{ marginTop: 0 }}>Wachtwoord resetten</h3>
        <p className="muted">Token: <b>{token}</b></p>
        <form onSubmit={(e) => e.preventDefault()}>
          <input
            type="password"
            required
            placeholder="Nieuw wachtwoord"
            className="input"
            style={{ width: "100%", marginBottom: 12 }}
          />
          <input
            type="password"
            required
            placeholder="Herhaal wachtwoord"
            className="input"
            style={{ width: "100%", marginBottom: 12 }}
          />
          <button className="btn" type="submit">Reset wachtwoord</button>
        </form>
      </div>
    </div>
  );
}

/* ----------------- /app Layout met Sidebar ----------------- */
function AppLayout() {
  const link = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;

  return (
    <div className="container">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "220px 1fr",
          gap: 16,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        <aside className="card p-3" style={{ position: "sticky", top: 8, borderRadius: 16 }}>
          <div style={{ fontWeight: 800, color: "var(--brand-primary,#0b3654)", marginBottom: 10 }}>
            Dashboard
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            <li><NavLink to="/app" end className={link}>🏠 &nbsp;Overzicht</NavLink></li>
            <li><NavLink to="/app/vehicles" className={link}>🚗 &nbsp;Voertuigen</NavLink></li>
            <li><NavLink to="/app/wallet" className={link}>💳 &nbsp;Wallet / Passen</NavLink></li>
            <li><NavLink to="/app/transactions" className={link}>🧾 &nbsp;Transacties</NavLink></li>
            <li><NavLink to="/app/tolls" className={link}>🛣️ &nbsp;Tol</NavLink></li>
            <li><NavLink to="/app/rewards" className={link}>🎁 &nbsp;Punten & Rewards</NavLink></li>
            <li><NavLink to="/app/insights" className={link}>📊 &nbsp;Inzichten</NavLink></li>
            <li><NavLink to="/app/invoices" className={link}>📄 &nbsp;Facturen</NavLink></li>
            <li><NavLink to="/app/co2" className={link}>🌿 &nbsp;CO₂ rapport</NavLink></li>
            <li><NavLink to="/app/protected-routes" className={link}>🔐 &nbsp;Protected Routes</NavLink></li>
            <li><NavLink to="/partner" className={link}>🛠️ &nbsp;Partner Portal</NavLink></li>

            {shouldShowBrandingLinkLocal() && (
              <li><NavLink to="/app/admin/branding" className={link}>🎨 &nbsp;Thema / Branding</NavLink></li>
            )}
          </ul>

          <div style={{ marginTop: 16, fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
            Info
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {/* ✅ PUBLIC: /about en /contact zijn publieke routes */}
            <li><NavLink to="/about" className={link}>ℹ️ &nbsp;Over ons</NavLink></li>
            <li><NavLink to="/contact" className={link}>📞 &nbsp;Contact</NavLink></li>
          </ul>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ----------------- Home wrapper ----------------- */
function HomeWrapper() {
  useEffect(() => {
    applyBrandFromLocalStorage();
  }, []);

  return (
    <>
      <HomePage />
      <div className="container" style={{ maxWidth: 980, margin: "24px auto" }}>
        <StationFinder />
      </div>
    </>
  );
}

/* ----------------- Checkout placeholders ----------------- */
function CheckoutDemoPage() {
  return (
    <div className="container">
      <div className="card p-3">
        <h3>Checkout demo</h3>
        <p>Klik op “Betalen” om de demo te simuleren.</p>
        <Link className="btn" to="/app/success">Betalen</Link>
      </div>
    </div>
  );
}
function CheckoutSuccessPage() {
  return (
    <div className="container">
      <div className="card p-3">
        <h3>Betaling gelukt ✅</h3>
        <Link className="btn" to="/app">Terug naar dashboard</Link>
      </div>
    </div>
  );
}
function CheckoutCancelPage() {
  return (
    <div className="container">
      <div className="card p-3">
        <h3>Betaling geannuleerd</h3>
        <Link className="btn" to="/app">Terug naar dashboard</Link>
      </div>
    </div>
  );
}

/* ----------------- Routes ----------------- */
function AppRoutes() {
  useEffect(() => {
    applyBrandFromLocalStorage();
  }, []);

  useEffect(() => {
    try {
      setCo2Token(null);
    } catch {}
  }, []);

  return (
    <AppErrorBoundary>
      <Routes>
        {/* ===================== PUBLIC ===================== */}
        <Route path="/" element={<HomeWrapper />} />

        {/* ✅ Publieke info pages: GEEN auth */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />

        <Route path="/eu-agenda" element={<EUAgendaPage />} />
        <Route path="/page/:slug" element={<Publicpage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/greendeal" element={<GreenDealPage />} />

        {/* ✅ Parking publiek (zoals jij nu had) */}
        <Route path="/parking" element={<Parking />} />

        {/* ===================== AUTH ===================== */}
        <Route path="/auth" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<Navigate to="/auth?mode=signup" replace />} />
        <Route path="/login" element={<Navigate to="/auth?mode=login" replace />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />

        {/* ===================== ONBOARDING ===================== */}
        {/* (jij kunt dit ook onder RequireAuth zetten als je wilt; nu laat ik jouw setup intact) */}
        <Route
          path="/onboarding/bank"
          element={
            <>
              <ProgressSteps step={2} />
              <OnboardingBank />
            </>
          }
        />
        <Route
          path="/onboarding/wallet"
          element={
            <>
              <ProgressSteps step={3} />
              <OnboardingWallet />
            </>
          }
        />
        <Route path="/onboarding/done" element={<OnboardingDone />} />

        {/* ===================== PARTNER (PROTECTED) ===================== */}
        <Route
          path="/partner"
          element={
            <RequireAuth>
              <Suspense fallback={<div className="card p-3">Partnerportal laden…</div>}>
                <PartnerLayout />
              </Suspense>
            </RequireAuth>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<div className="card p-3">Dashboard laden…</div>}>
                <PartnerHome />
              </Suspense>
            }
          />

          <Route
            path="prices"
            element={
              <Suspense fallback={<div className="card p-3">Prijzen laden…</div>}>
                <PricesPage />
              </Suspense>
            }
          />

          <Route
            path="offers"
            element={
              <Suspense fallback={<div className="card p-3">Aanbiedingen laden…</div>}>
                <OffersPage />
              </Suspense>
            }
          />
          <Route
            path="offers/new"
            element={
              <Suspense fallback={<div className="card p-3">Nieuwe aanbieding laden…</div>}>
                <OffersNew />
              </Suspense>
            }
          />
          <Route
            path="offers/:id"
            element={
              <Suspense fallback={<div className="card p-3">Aanbieding laden…</div>}>
                <OffersEdit />
              </Suspense>
            }
          />

          <Route
            path="stations"
            element={
              <Suspense fallback={<div className="card p-3">Stations laden…</div>}>
                <StationsPage />
              </Suspense>
            }
          />
          <Route
            path="stations/new"
            element={
              <Suspense fallback={<div className="card p-3">Nieuw station laden…</div>}>
                <StationsNew />
              </Suspense>
            }
          />
          <Route
            path="stations/:id"
            element={
              <Suspense fallback={<div className="card p-3">Station bewerken laden…</div>}>
                <StationsEdit />
              </Suspense>
            }
          />

          <Route
            path="settings"
            element={
              <Suspense fallback={<div className="card p-3">Instellingen laden…</div>}>
                <PartnerSettings />
              </Suspense>
            }
          />
        </Route>

        {/* ===================== APP (PROTECTED) ===================== */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />

          <Route
            path="vehicles"
            element={
              <Suspense fallback={<div className="card p-3">Voertuigen laden…</div>}>
                <VehiclesPage />
              </Suspense>
            }
          />

          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet-setup" element={<OnboardingWallet />} />

          {/* (optioneel) als je Parking ook in app wilt tonen */}
          {/* <Route path="parking" element={<Parking />} /> */}

          <Route path="checkout-demo" element={<CheckoutDemoPage />} />
          <Route path="success" element={<CheckoutSuccessPage />} />
          <Route path="cancel" element={<CheckoutCancelPage />} />

          <Route
            path="transactions"
            element={
              <Suspense fallback={<div className="card p-3">Transacties laden…</div>}>
                <TransactionsPage />
              </Suspense>
            }
          />

          <Route
            path="tolls"
            element={
              <Suspense fallback={<div className="card p-3">Tol laden…</div>}>
                <TollPage />
              </Suspense>
            }
          />

          <Route
            path="rewards"
            element={
              <Suspense fallback={<div className="card p-3">Rewards laden…</div>}>
                <RewardsPage />
              </Suspense>
            }
          />

          <Route
            path="insights"
            element={
              <Suspense fallback={<div className="card p-3">Inzichten laden…</div>}>
                <InsightsPage />
              </Suspense>
            }
          />

          <Route
            path="invoices"
            element={
              <Suspense fallback={<div className="card p-3">Facturen laden…</div>}>
                <InvoicesPage />
              </Suspense>
            }
          />

          <Route path="co2" element={<VehicleCo2Card />} />

          <Route
            path="protected-routes"
            element={
              <Suspense fallback={<div className="card p-3">Protected Routes laden…</div>}>
                <ProtectedRoutesPage />
              </Suspense>
            }
          />

          <Route path="admin" element={<Navigate to="admin/branding" replace />} />
          <Route
            path="admin/branding"
            element={
              <AdminOnly>
                <AdminBranding />
              </AdminOnly>
            }
          />
        </Route>

        {/* ===================== FALLBACK ===================== */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppErrorBoundary>
  );
}

/* ----------------- Root ----------------- */
export default function App() {
  return (
    <>
      <Header />
      <AppRoutes />
    </>
  );
}
