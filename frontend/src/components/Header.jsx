// src/components/Header.jsx
import React from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { whoAmI, apiPost } from "@/api/base";

/* ------- Brand helpers ------- */
function applyBrandFromLocalStorage() {
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
function getLogoUrlLocal() {
  try {
    const b = JSON.parse(localStorage.getItem("brand") || "{}");
    return b.logo_url || localStorage.getItem("brand_logo") || "";
  } catch { return ""; }
}

/* ------- Auth helpers ------- */
function readAuthSnapshot() {
  try {
    const L = localStorage, S = sessionStorage;
    const token = L.getItem("token") || S.getItem("token");
    const role  = L.getItem("role")  || S.getItem("role");
    const uRaw  = L.getItem("user")  || S.getItem("user");
    const user  = uRaw ? JSON.parse(uRaw) : null;
    const authed = Boolean(token || (user && (user.id || user.email)));
    return { authed, role: role || user?.role || null, user };
  } catch {
    return { authed: false, role: null, user: null };
  }
}

export default function Header() {
  const navigate = useNavigate();

  // null = unknown (voorkomt UI-flicker)
  const [authState, setAuthState] = React.useState(() => ({
    status: "unknown", // "unknown" | "authed" | "guest"
    role: null,
    user: null,
  }));

  React.useEffect(() => { applyBrandFromLocalStorage(); }, []);

  async function refreshAuth() {
    // 1) snelle lokale snapshot
    const snap = readAuthSnapshot();
    setAuthState(s =>
      snap.authed
        ? { status: "authed", role: snap.role, user: snap.user }
        : (s.status === "unknown" ? s : { status: "guest", role: null, user: null })
    );

    // 2) server check (cookie-based)
    try {
      const user = await whoAmI(); // mag 401 geven
      const ok = Boolean(user && (user.id || user.email));
      if (ok) {
        try {
          localStorage.setItem("user", JSON.stringify(user));
          if (user.role) localStorage.setItem("role", user.role);
        } catch {}
        setAuthState({ status: "authed", role: user.role || snap.role || null, user });
      } else {
        setAuthState({ status: "guest", role: null, user: null });
      }
    } catch {
      // geen server sessie → val terug op snapshot
      if (!snap.authed) setAuthState({ status: "guest", role: null, user: null });
      else setAuthState({ status: "authed", role: snap.role, user: snap.user });
    }
  }

  React.useEffect(() => {
    let live = true;
    (async () => { if (live) await refreshAuth(); })();

    const onStorage = () => refreshAuth();
    const onVisibility = () => { if (document.visibilityState === "visible") refreshAuth(); };
    const onAuthChanged = () => refreshAuth(); // handmatig te dispatchen: window.dispatchEvent(new Event("auth:changed"))

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("auth:changed", onAuthChanged);

    return () => {
      live = false;
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("auth:changed", onAuthChanged);
    };
  }, []);

  async function logout() {
    try { await apiPost("/api/auth/logout", {}); } catch {}
    try {
      ["token","role","user","brand_logo"].forEach(k => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch {}
    setAuthState({ status: "guest", role: null, user: null });
    // eventueel: force refresh zodat whoAmI-cookie state ook visueel klopt
    navigate("/", { replace: true });
    setTimeout(() => window.dispatchEvent(new Event("auth:changed")), 0);
  }

  const logo = getLogoUrlLocal() || "/logo-fuellinq.png";
  const isAuthed = authState.status === "authed";
  const role = authState.role;
  const canSeePartner = isAuthed && (role === "partner" || role === "admin"); // <- hier kun je aanpassen

  const dashboardHref = isAuthed ? "/app" : "/auth?mode=login&next=%2Fapp";

  return (
    <header className="sticky" style={{ background:"#fff", top:0, zIndex:1000, borderBottom:"1px solid #eef2f7" }}>
      <div className="container" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px" }}>
        <Link to="/" style={{ display:"inline-flex", alignItems:"center", textDecoration:"none" }}>
          <img src={logo} alt="Logo" style={{ height:40, width:"auto", display:"block", borderRadius:8 }} />
        </Link>

        <nav style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <NavLink to="/" className="btn btn-outline" end>Home</NavLink>
          <NavLink to="/about" className="btn btn-outline">Over ons</NavLink>
          <NavLink to="/eu-agenda" className="btn btn-outline">EU Agenda</NavLink>
          <NavLink to="/contact" className="btn btn-outline">Contact</NavLink>
          <NavLink to="/parking" className="btn btn-outline">Parkeren</NavLink>

          {/* Altijd zichtbaar; stuurt slim door */}
          <NavLink to={dashboardHref} className="btn btn-outline">Dashboard</NavLink>

          {isAuthed ? (
            <>
              {canSeePartner && <NavLink to="/partner" className="btn btn-outline">Partner</NavLink>}
              <button className="btn" type="button" onClick={logout}>Log uit</button>
            </>
          ) : authState.status === "unknown" ? (
            // korte laadstate — voorkomt knipperen van login/signup
            <span className="btn btn-outline" aria-busy="true">Laden…</span>
          ) : (
            <>
              <NavLink to="/auth?mode=login" className="btn btn-outline">Log in</NavLink>
              <NavLink to="/auth?mode=signup" className="btn">Account aanmaken</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
