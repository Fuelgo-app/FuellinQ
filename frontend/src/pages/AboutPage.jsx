// src/pages/AuthPage.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api, { setToken } from "@/api/base"; // korte helpers + setToken uit base

/* ================= Helpers ================= */

// Foutcodes -> nette UI-teksten
function mapAuthErrorMessage(err) {
  const raw = String(err?.message || "").toLowerCase();
  if (raw.includes("invalid_login")) return "E-mailadres of wachtwoord klopt niet.";
  if (raw.includes("missing_credentials")) return "Vul je e-mailadres en wachtwoord in.";
  if (raw.includes("server_error")) return "Er ging iets mis op de server. Probeer het zo opnieuw.";
  if (raw.includes("post") && raw.includes("failed")) return "Kan geen verbinding maken met de server.";
  return err?.message || "Actie mislukt. Probeer het opnieuw.";
}

// Bewaar auth in gekozen storage (localStorage voor onthouden, anders sessionStorage)
function setAuthInStorage({ token, user }, remember = true) {
  const L = window.localStorage;
  const S = window.sessionStorage;

  // setToken schrijft standaard naar localStorage (conform jouw helper)
  // → we roepen setToken altijd, en verplaatsen naar sessionStorage als 'remember' uit staat.
  if (token) setToken(token);

  const role = user?.role ?? "";

  if (remember) {
    if (user) L.setItem("user", JSON.stringify(user));
    if (role) L.setItem("role", role);
    // andere storage opschonen
    S.removeItem("token"); S.removeItem("user"); S.removeItem("role");
  } else {
    // verplaats token + user naar sessionStorage
    if (token) {
      S.setItem("token", token);
      L.removeItem("token");
    }
    if (user) {
      S.setItem("user", JSON.stringify(user));
      L.removeItem("user");
    }
    if (role) {
      S.setItem("role", role);
      L.removeItem("role");
    }
  }
}

// Lees auth uit beide storages
function getAuthFromStorage() {
  const L = window.localStorage;
  const S = window.sessionStorage;
  const token = L.getItem("token") || S.getItem("token") || "";
  let user = null;
  try {
    user = JSON.parse(L.getItem("user") || S.getItem("user") || "null");
  } catch {}
  const role = L.getItem("role") || S.getItem("role") || (user?.role ?? "");
  return { token, user, role };
}

// Role -> default route
function roleToPath(role) {
  if (!role) return "/app";
  const r = String(role).toLowerCase();
  if (r.includes("admin")) return "/admin";
  if (r.includes("partner")) return "/partner";
  return "/app";
}

/* ================= Component ================= */

export default function AuthPage({ mode = "login", onAuthed }) {
  const isSignup = mode === "signup";

  // Form state
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [remember, setRemember] = React.useState(true); // “Onthoud mij”

  // UI state
  const [msg, setMsg] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // Routing
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const next = params.get("next");

  // Validatie
  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = (pass || "").length >= 6;
  const canSubmit = !pending && emailOk && passOk;

  // Auto-redirect als er al een token is
  React.useEffect(() => {
    const { token, role } = getAuthFromStorage();
    if (token) navigate(next || roleToPath(role), { replace: true });
  }, [navigate, next]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setMsg("");
    setPending(true);
    try {
      if (isSignup) {
        const { token, user } = await api.post("/api/auth/register", {
          email: email.trim(),
          password: pass,
          first_name: first || null,
          last_name: last || null,
        });

        setAuthInStorage({ token, user }, remember);
        onAuthed?.(user ?? null);
        navigate("/onboarding/bank", { replace: true });
      } else {
        const { token, user } = await api.post("/api/auth/login", {
          email: email.trim(),
          password: pass,
        });

        setAuthInStorage({ token, user }, remember);
        onAuthed?.(user ?? null);
        navigate(next || roleToPath(user?.role), { replace: true });
      }
    } catch (err) {
      setMsg(mapAuthErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="signup-wrapper">
      <div className="container" style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 48px" }}>
        {msg && (
          <div
            className="card"
            role="alert"
            style={{ padding: 12, marginBottom: 12, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412" }}
          >
            {msg}
          </div>
        )}

        <form className="card" onSubmit={submit} style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>{isSignup ? "Account aanmaken" : "Log in"}</h2>

          {isSignup && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                className="input"
                placeholder="Voornaam (optioneel)"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                autoComplete="given-name"
              />
              <input
                className="input"
                placeholder="Achternaam (optioneel)"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                autoComplete="family-name"
              />
            </div>
          )}

          <input
            className="input"
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginTop: 10 }}
            autoComplete="email"
            required
            aria-invalid={!emailOk ? "true" : "false"}
          />

          <div style={{ position: "relative", marginTop: 10 }}>
            <input
              className="input"
              type={showPass ? "text" : "password"}
              placeholder="Wachtwoord (min. 6 tekens)"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
              aria-invalid={!passOk ? "true" : "false"}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="btn btn-outline"
              style={{ position: "absolute", right: 6, top: 6, padding: "6px 10px", fontSize: 12 }}
              aria-label={showPass ? "Verberg wachtwoord" : "Toon wachtwoord"}
              tabIndex={-1}
            >
              {showPass ? "Verberg" : "Toon"}
            </button>
          </div>

          {/* Onthoud mij */}
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Onthoud mij op dit apparaat</span>
          </label>

          <button
            className="btn"
            type="submit"
            disabled={!canSubmit}
            aria-busy={pending ? "true" : "false"}
            style={{ width: "100%", marginTop: 12, opacity: canSubmit ? 1 : 0.7 }}
          >
            {pending ? (isSignup ? "Aanmaken..." : "Inloggen...") : isSignup ? "Account aanmaken" : "Log in"}
          </button>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            {isSignup ? (
              <Link className="btn btn-outline" to="/login">Ik heb al een account</Link>
            ) : (
              <Link className="btn btn-outline" to="/signup">Nieuw account</Link>
            )}
          </div>

          {!isSignup && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <Link to="/forgot" style={{ textDecoration: "none", color: "var(--brand-2, #2563eb)" }}>
                Wachtwoord vergeten?
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
