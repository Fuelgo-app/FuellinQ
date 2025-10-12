// src/App.jsx
import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  Routes, Route, Navigate, NavLink, Link, useNavigate, Outlet, useLocation,
} from "react-router-dom";

/* ----------------- Direct ingeladen (lichtgewicht) ----------------- */
import HomePage from "./pages/HomePage.jsx";
import DashboardPage from "./pages/dashboard.jsx";
import WalletPage from "./pages/Wallet.jsx";
import Publicpage from "./pages/Publicpage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import AdminBranding from "./components/AdminBranding.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import EUAgendaPage from "./pages/EUAgenda.jsx";
import DemoPage from "./pages/DemoPage.jsx";
import GreenDealPage from "./pages/GreenDealPage.jsx";

/* ✅ Live publieke feed */
import StationFinder from "./components/StationFinder.jsx";

/* ----------------- Lazy (zwaardere pagina's) ----------------- */
const TransactionsPage = lazy(() => import("./pages/Transactions.jsx"));
const RewardsPage      = lazy(() => import("./pages/Rewards.jsx"));
const InsightsPage     = lazy(() => import("./pages/Insights.jsx"));
const InvoicesPage     = lazy(() => import("./pages/Invoices.jsx"));
const VehiclesPage     = lazy(() => import("./pages/Vehicles.jsx"));

const OffersPage       = lazy(() => import("./pages/partner/OffersPage.jsx"));
const SettingsPage     = lazy(() => import("./pages/partner/SettingsPage.jsx"));
const PricesPage       = lazy(() => import("./pages/partner/PricesPage.jsx"));
const StationsPage     = lazy(() => import("./pages/partner/StationsPage.jsx"));
const StationsNew      = lazy(() => import("./pages/partner/StationsNew.jsx"));

/* 🔐 Jouw extra pagina */
const ProtectedRoutesPage = lazy(() => import("./pages/ProtectedRoutes.jsx"));

/* Onboarding */
import OnboardingBank from "./pages/OnboardingBank.jsx";
import OnboardingWallet from "./pages/OnboardingWallet.jsx";
import OnboardingDone from "./pages/OnboardingDone.jsx";

/* ----------------- CO₂ + token-koppeling ----------------- */
import VehicleCo2Card from "./components/VehicleCo2Card.jsx";
import { setToken as setCo2Token } from "./lib/apiCo2.js";

/* ----------------- Branding helpers ----------------- */
import { applyBrandFromStorage as applyBrandFromStorageLib } from "./lib/brand";

/* ----------------- Token helpers ----------------- */
const getToken = () => {
  try { return localStorage.getItem("token"); } catch { return null; }
};
const clearToken = () => {
  try { localStorage.removeItem("token"); } catch {}
};

/* ----------------- Brand toepassen ----------------- */
function applyBrandFromLocalStorage() {
  try { applyBrandFromStorageLib?.(); } catch {}
  try {
    const root = document.documentElement;
    const css  = getComputedStyle(root);
    const accent  = (css.getPropertyValue("--accent") || "").trim() || "#0b3654";
    const accent2 = (css.getPropertyValue("--accent-2") || "").trim() || "#f58220";
    root.style.setProperty("--brand-primary", accent);
    root.style.setProperty("--brand-secondary", accent2);
  } catch {}
  try {
    const b = JSON.parse(localStorage.getItem("brand") || "{}");
    if (b.font_family) document.body.style.fontFamily = b.font_family;
    if (b.logo_url) localStorage.setItem("brand_logo", b.logo_url);
  } catch {}
}

/* ----------------- Lokale fallbacks ----------------- */
const shouldShowBrandingLinkLocal = () => {
  try { return localStorage.getItem("role") === "admin"; } catch { return false; }
};
const getLogoUrlLocal = () => {
  try {
    const b = JSON.parse(localStorage.getItem("brand") || "{}");
    return b.logo_url || localStorage.getItem("brand_logo") || "";
  } catch { return ""; }
};

/* ----------------- Kleine Progress component ----------------- */
function ProgressSteps({ step }) {
  const items = [
    { n: 1, label: "Account" },
    { n: 2, label: "Bank koppelen" },
    { n: 3, label: "Wallet" },
  ];
  return (
    <div style={{ background:"#f8fafc", borderTop:"1px solid #eef2f7", borderBottom:"1px solid #eef2f7" }}>
      <div className="container" style={{ maxWidth:920, margin:"0 auto", padding:"12px 16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {items.map(it => {
            const active = it.n === step;
            const done   = it.n < step;
            return (
              <div key={it.n}
                   style={{
                     display:"flex", alignItems:"center", gap:10,
                     padding:"10px 12px",
                     borderRadius:12,
                     border:"1px solid #e5e7eb",
                     background:"#fff",
                     boxShadow: active ? "0 6px 16px rgba(2,6,23,.06)" : "none"
                   }}>
                <div style={{
                  width:28, height:28, borderRadius:999,
                  background: done ? "#22c55e" : active ? "#2563eb" : "#e5e7eb",
                  color:"#fff", display:"grid", placeItems:"center", fontWeight:800, fontSize:13
                }}>
                  {done ? "✓" : it.n}
                </div>
                <div style={{ fontWeight:800, color: active ? "#111827" : "#374151" }}>
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
  constructor(props){ super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error){ return { error }; }
  componentDidCatch(err, info){ console.error("App crash:", err, info); }
  render(){
    if (this.state.error) {
      return (
        <div style={{padding:16}}>
          <h3 style={{color:"#b91c1c", marginTop:0}}>Er ging iets mis</h3>
          <p className="muted">De fout hieronder komt uit een pagina/component. Je app blijft draaien.</p>
          <pre style={{whiteSpace:"pre-wrap", background:"#fff7ed", padding:12, borderRadius:8, border:"1px solid #fed7aa"}}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <Link className="btn" to="/">Terug naar home</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ----------------- Header ----------------- */
function Header() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => getToken());

  useEffect(() => { applyBrandFromLocalStorage(); }, []);

  // live token updates (storage/visibility)
  useEffect(() => {
    const sync = () => setToken(getToken());
    const onStorage = () => sync();
    const onVisibility = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  function logout() {
    try {
      clearToken(); localStorage.removeItem("role");
    } finally {
      setToken(""); // forceer UI update
      navigate("/", { replace: true });
    }
  }

  const logo = getLogoUrlLocal() || "/logo-fuellinq.png";

  return (
    <header className="sticky" style={{ background:"#fff" }}>
      <div className="container" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px" }}>
        <Link to="/" style={{ display:"inline-flex", alignItems:"center", textDecoration:"none" }}>
          <img src={logo} alt="Logo" style={{ height:40, width:"auto", display:"block", borderRadius:8 }} />
        </Link>

        <nav style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <NavLink to="/" className="btn btn-outline">Home</NavLink>
          <NavLink to="/about" className="btn btn-outline">Over ons</NavLink>
          <NavLink to="/eu-agenda" className="btn btn-outline">EU Agenda</NavLink>
          <NavLink to="/contact" className="btn btn-outline">Contact</NavLink>
          {/* <NavLink to="/demo" className="btn btn-outline">Demo</NavLink>
          <NavLink to="/greendeal" className="btn btn-outline">Green Deal</NavLink> */}
          {token ? (
            <>
              <NavLink to="/app" className="btn btn-outline">Dashboard</NavLink>
              <NavLink to="/partner" className="btn btn-outline">Partner</NavLink>
              <button className="btn" onClick={logout}>Log uit</button>
            </>
          ) : (
            <>
              {/* ✅ altijd /auth gebruiken */}
              <NavLink to="/auth" className="btn btn-outline">Log in</NavLink>
              <NavLink to="/signup" className="btn">Account aanmaken</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

/* ----------------- Guards ----------------- */
function Protected({ children }) {
  if (!getToken()) return <Navigate to="/auth" replace />; // ✅ redirect naar /auth
  return <>{children}</>;
}
function AdminOnly({ children }) {
  const isAdmin = (() => {
    try { return localStorage.getItem("role") === "admin"; } catch { return false; }
  })();
  if (!isAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

/* ----------------- Inline placeholders (geen build errors) ----------------- */
function ForgotPasswordPage() {
  return (
    <div className="container" style={{ maxWidth: 520, margin: "24px auto" }}>
      <div className="card p-4" style={{ borderRadius: 16 }}>
        <h3 style={{ marginTop: 0 }}>Wachtwoord vergeten</h3>
        <p className="muted">Vul je e-mailadres in. Je ontvangt (in een echte setup) een resetlink.</p>
        <form onSubmit={(e)=>e.preventDefault()}>
          <input type="email" required placeholder="jij@voorbeeld.nl" className="input" style={{ width:"100%", marginBottom:12 }} />
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
        <form onSubmit={(e)=>e.preventDefault()}>
          <input type="password" required placeholder="Nieuw wachtwoord" className="input" style={{ width:"100%", marginBottom:12 }} />
          <input type="password" required placeholder="Herhaal wachtwoord" className="input" style={{ width:"100%", marginBottom:12 }} />
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
      <div className="grid" style={{ gridTemplateColumns:"220px 1fr", gap:16, marginTop:16, alignItems:"start" }}>
        <aside className="card p-3" style={{ position:"sticky", top:8, borderRadius:16 }}>
          <div style={{ fontWeight:800, color:"var(--brand-primary,#0b3654)", marginBottom:10 }}>Dashboard</div>
          <ul style={{ listStyle:"none", padding:0, margin:0, display:"grid", gap:8 }}>
            <li><NavLink to="/app" end className={link}>🏠 &nbsp;Overzicht</NavLink></li>
            <li><NavLink to="/app/vehicles" className={link}>🚗 &nbsp;Voertuigen</NavLink></li>
            <li><NavLink to="/app/wallet" className={link}>💳 &nbsp;Wallet / Passen</NavLink></li>
            <li><NavLink to="/app/transactions" className={link}>🧾 &nbsp;Transacties</NavLink></li>
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

          <div style={{ marginTop:16, fontWeight:700, color:"var(--brand-primary,#0b3654)" }}>Info</div>
          <ul style={{ listStyle:"none", padding:0, margin:0, display:"grid", gap:8 }}>
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

/* ----------------- Partner layout (tabs) ----------------- */
function PartnerLayout() {
  const link = ({ isActive }) => `nav-link ${isActive ? "active" : ""}`;
  return (
    <div className="container" style={{ marginTop:16 }}>
      <div className="card" style={{ padding:12, borderRadius:16, marginBottom:12 }}>
        <nav style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <NavLink end to="/partner/offers" className={link}>🖼️ Aanbiedingen</NavLink>
          <NavLink to="/partner/prices" className={link}>⛽ Prijzen</NavLink>
          <NavLink to="/partner/stations" className={link}>📍 Stations</NavLink>
          <NavLink to="/partner/settings" className={link}>⚙️ Instellingen</NavLink>
          <div style={{ marginLeft:"auto" }}>
            <Link className="btn" to="/partner/stations/new">+ Nieuw station</Link>
          </div>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}

/* ----------------- (Demo) checkout helpers ----------------- */
function PageCard({ title, children }) {
  return (
    <div className="card p-4" style={{ borderRadius:16 }}>
      <h3 style={{ marginTop:0, color:"var(--brand-primary,#0b3654)" }}>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
function useQS() {
  const { search } = useLocation();
  return new URLSearchParams(search);
}
function CheckoutDemoPage() {
  const qs = useQS();
  const tx  = qs.get("tx") || qs.get("sid") || "-";
  const st  = qs.get("station") || "-";
  const c   = qs.get("c") || "-";
  const amt = qs.get("amt") ? Number(qs.get("amt"))/100 : null;
  return (
    <PageCard title="Demo Checkout">
      <p>Dit is een demo-pagina die geopend wordt na <i>Nu tanken</i> wanneer Stripe uit staat.</p>
      <ul>
        <li>Transactie: <b>{tx}</b></li>
        <li>Station: <b>{st}</b></li>
        <li>Card ID: <b>{c}</b></li>
        <li>Bedrag: <b>{amt != null ? `€${amt.toFixed(2)}` : "-"}</b></li>
      </ul>
      <Link className="btn" to="/app">Terug naar dashboard</Link>
    </PageCard>
  );
}
const CheckoutSuccessPage = () => (
  <PageCard title="Betaling geslaagd">Bedankt! Je betaling is gelukt. <br /><br /><Link className="btn" to="/app">Terug naar dashboard</Link></PageCard>
);
const CheckoutCancelPage = () => (
  <PageCard title="Betaling geannuleerd">Je hebt de betaling geannuleerd. <br /><br /><Link className="btn btn-outline" to="/app">Terug</Link></PageCard>
);

/* ----------------- Home wrapper met live StationFinder ----------------- */
function HomeWrapper() {
  useEffect(() => { applyBrandFromLocalStorage(); }, []);
  return (
    <>
      <HomePage />
      <div className="container" style={{ maxWidth: 980, margin: "24px auto" }}>
        <StationFinder />
      </div>
    </>
  );
}

/* ----------------- App (routes) ----------------- */
export default function App() {
  useEffect(() => { applyBrandFromLocalStorage(); }, []);

  // CO₂ client koppelen aan jouw JWT en wijzigingen volgen
  useEffect(() => {
    const sync = () => {
      try { setCo2Token(localStorage.getItem("token") || null); } catch {}
    };
    sync(); // init
    const onStorage = () => sync();
    const onVisibility = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const navigate = useNavigate();

  return (
    <AppErrorBoundary>
      <Header />

      <Routes>
        {/* Publiek */}
        <Route path="/" element={<HomeWrapper />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/eu-agenda" element={<EUAgendaPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/page/:slug" element={<Publicpage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/greendeal" element={<GreenDealPage />} />

        {/* ✅ Auth + Password flows */}
        <Route path="/auth"  element={<AuthPage mode="login"  onAuthed={()=>navigate("/app")} />} />
        <Route path="/signup" element={<AuthPage mode="signup" onAuthed={()=>{}} />} />
        {/* Backwards compat: /login -> /auth */}
        <Route path="/login" element={<Navigate to="/auth" replace />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/reset"  element={<ResetPasswordPage />} />

        {/* Onboarding */}
        <Route path="/onboarding/bank"   element={<><ProgressSteps step={2} /><OnboardingBank /></>} />
        <Route path="/onboarding/wallet" element={<><ProgressSteps step={3} /><OnboardingWallet /></>} />
        <Route path="/onboarding/done"   element={<OnboardingDone />} />

        {/* Partner Portal (achter login) */}
        <Route path="/partner" element={<Protected><PartnerLayout /></Protected>}>
          <Route index element={<Navigate to="offers" replace />} />
          <Route path="offers"   element={<Suspense fallback={<div className="card p-3">Aanbiedingen laden…</div>}><OffersPage /></Suspense>} />
          <Route path="prices"   element={<Suspense fallback={<div className="card p-3">Prijzen laden…</div>}><PricesPage /></Suspense>} />
          <Route path="stations" element={<Suspense fallback={<div className="card p-3">Stations laden…</div>}><StationsPage /></Suspense>} />
          <Route path="stations/new" element={<Suspense fallback={<div className="card p-3">Nieuw station laden…</div>}><StationsNew /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={<div className="card p-3">Instellingen laden…</div>}><SettingsPage /></Suspense>} />
        </Route>

        {/* App + sidebar layout (beschermd) */}
        <Route path="/app" element={<Protected><AppLayout /></Protected>}>
          <Route index element={<DashboardPage />} />
          <Route path="vehicles" element={<Suspense fallback={<div className="card p-3">Voertuigen laden…</div>}><VehiclesPage /></Suspense>} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="wallet-setup" element={<OnboardingWallet />} />
          <Route path="checkout-demo" element={<CheckoutDemoPage />} />
          <Route path="success" element={<CheckoutSuccessPage />} />
          <Route path="cancel" element={<CheckoutCancelPage />} />
          <Route path="transactions" element={<Suspense fallback={<div className="card p-3">Transacties laden…</div>}><TransactionsPage /></Suspense>} />
          <Route path="rewards"      element={<Suspense fallback={<div className="card p-3">Rewards laden…</div>}><RewardsPage /></Suspense>} />
          <Route path="insights"     element={<Suspense fallback={<div className="card p-3">Inzichten laden…</div>}><InsightsPage /></Suspense>} />
          <Route path="invoices"     element={<Suspense fallback={<div className="card p-3">Facturen laden…</div>}><InvoicesPage /></Suspense>} />
          <Route path="co2" element={<VehicleCo2Card />} />

          {/* 🔐 Jouw extra pagina */}
          <Route path="protected-routes" element={<Suspense fallback={<div className="card p-3">Protected Routes laden…</div>}><ProtectedRoutesPage /></Suspense>} />

          {/* 🔒 Admin-only Branding */}
          <Route path="admin" element={<Navigate to="admin/branding" replace />} />
          <Route path="admin/branding" element={<AdminOnly><AdminBranding /></AdminOnly>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppErrorBoundary>
  );
}
