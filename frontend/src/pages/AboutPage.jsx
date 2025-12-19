// src/pages/AuthPage.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiPost, whoAmI, clearToken } from "@/api/base"; // cookie-first helpers
import { klIdentify, klSubscribe, klEvent } from "@/lib/klaviyo"; // ⬅️ nieuw

/* ================= Helpers ================= */
function mapAuthErrorMessage(err) {
  const raw = String(err?.message || "").toLowerCase();
  if (raw.includes("invalid_login")) return "E-mailadres of wachtwoord klopt niet.";
  if (raw.includes("missing_fields") || raw.includes("missing_credentials")) return "Vul je e-mailadres en wachtwoord in.";
  if (raw.includes("server_error")) return "Er ging iets mis op de server. Probeer het zo opnieuw.";
  if (raw.includes("network_error")) return "Netwerk/CORS probleem. Controleer je verbinding of domeinen.";
  if (raw.match(/http 4\d\d/)) return "Aanvraag geweigerd. Controleer je invoer.";
  if (raw.match(/http 5\d\d/)) return "Serverfout. Probeer het zo opnieuw.";
  return err?.message || "Actie mislukt. Probeer het opnieuw.";
}

// Alleen user/role bijhouden voor UI; GEEN token
function setAuthInStorage({ user }, remember = true) {
  const L = window.localStorage;
  const S = window.sessionStorage;
  const T = remember ? L : S;
  const O = remember ? S : L;

  if (user) T.setItem("user", JSON.stringify(user));
  const role = user?.role ?? "";
  if (role) T.setItem("role", role);

  ["user", "role", "token"].forEach((k) => O.removeItem(k));
  try { clearToken(); } catch {}
}

function roleToPath(role) {
  if (!role) return "/app";
  const r = String(role).toLowerCase();
  if (r.includes("admin")) return "/admin";
  if (r.includes("partner")) return "/partner";
  return "/app";
}

/* ================= Component ================= */
export default function AuthPage({ mode = "login", onAuthed }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const next = params.get("next") || null;
  const qsMode = (params.get("mode") || mode).toLowerCase();
  const isSignup = qsMode === "signup";

  // form state
  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [marketing, setMarketing] = React.useState(true); // ⬅️ opt-in checkbox

  // ui state
  const [msg, setMsg] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(true);

  // validatie
  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = (pass || "").length >= 6;
  const canSubmit = !pending && !verifying && emailOk && passOk;

  // ⛳️ zorg dat we maar één keer navigeren (fix redirect loop)
  const didNavigateRef = React.useRef(false);

  // Cookie-first: check server-sessie via whoAmI
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const user = await whoAmI();
        if (!alive) return;
        if (user) {
          setAuthInStorage({ user }, true);
          if (!didNavigateRef.current) {
            didNavigateRef.current = true;
            navigate(next || roleToPath(user.role), { replace: true });
          }
        }
      } finally {
        if (alive) setVerifying(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate, next]);

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setMsg("");
    setPending(true);
    try {
      let res, user;

      if (isSignup) {
        res = await apiPost("/api/auth/register", {
          email: email.trim(),
          password: pass,
          first_name: first || null,
          last_name: last || null,
        });
      } else {
        res = await apiPost("/api/auth/login", {
          email: email.trim(),
          password: pass,
        });
      }

      // warm sessie + haal user uit cookie
      try { user = await whoAmI(); } catch {}
      user = user || res?.user || null;
      if (!user) throw new Error("Login gelukt maar sessie niet gevonden.");

      // ✅ Onsite identify (browser) + evt. subscribe (alleen bij expliciete opt-in)
      try { klIdentify({ email: email.trim(), first_name: first, last_name: last }); } catch {}
      if (isSignup && marketing) {
        try {
          await klSubscribe({
            email: email.trim(),
            first_name: first || null,
            last_name: last || null,
            consent: "email",
            properties: { plan: "prepaid", brand: "FuelLinq" },
          });
        } catch {}
      }
      // Event
      try { await klEvent({ email: email.trim(), event: isSignup ? "Signup" : "Login" }); } catch {}

      setAuthInStorage({ user }, remember);
      onAuthed?.(user ?? null);

      const target = isSignup ? "/onboarding/bank" : (next || roleToPath(user?.role));
      if (!didNavigateRef.current) {
        didNavigateRef.current = true;
        navigate(target, { replace: true });
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
          <div className="card" role="alert"
               style={{ padding: 12, marginBottom: 12, background: "#fff7ed", border: "1px solid #fdba74", color: "#9a3412" }}>
            {msg}
          </div>
        )}

        {verifying && <div className="card" style={{ padding: 10, marginBottom: 12 }}>Sessie controleren…</div>}

        <form className="card" onSubmit={submit} style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>{isSignup ? "Account aanmaken" : "Log in"}</h2>

          {isSignup && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input className="input" placeholder="Voornaam (optioneel)" value={first}
                     onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
              <input className="input" placeholder="Achternaam (optioneel)" value={last}
                     onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
            </div>
          )}

          <input className="input" type="email" placeholder="E-mailadres" value={email}
                 onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 10 }}
                 autoComplete="email" required aria-invalid={!emailOk ? "true" : "false"} disabled={verifying} />

          <div style={{ position: "relative", marginTop: 10 }}>
            <input className="input" type={showPass ? "text" : "password"} placeholder="Wachtwoord (min. 6 tekens)"
                   value={pass} onChange={(e) => setPass(e.target.value)}
                   autoComplete={isSignup ? "new-password" : "current-password"} required minLength={6}
                   aria-invalid={!passOk ? "true" : "false"} disabled={verifying} />
            <button type="button" onClick={() => setShowPass((v) => !v)} className="btn btn-outline"
                    style={{ position: "absolute", right: 6, top: 6, padding: "6px 10px", fontSize: 12 }}
                    aria-label={showPass ? "Verberg wachtwoord" : "Toon wachtwoord"} tabIndex={-1} disabled={verifying}>
              {showPass ? "Verberg" : "Toon"}
            </button>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, userSelect: "none" }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={verifying} />
            <span>Onthoud mij op dit apparaat</span>
          </label>

          {isSignup && (
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, userSelect: "none" }}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              <span>Ik wil e-mails ontvangen met updates en aanbiedingen</span>
            </label>
          )}

          <button className="btn" type="submit" disabled={!canSubmit}
                  aria-busy={pending ? "true" : "false"}
                  style={{ width: "100%", marginTop: 12, opacity: canSubmit ? 1 : 0.7 }}>
            {pending ? (isSignup ? "Aanmaken..." : "Inloggen...") : isSignup ? "Account aanmaken" : "Log in"}
          </button>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            {isSignup ? (
              <Link className="btn btn-outline" to="/auth?mode=login">Ik heb al een account</Link>
            ) : (
              <Link className="btn btn-outline" to="/auth?mode=signup">Nieuw account</Link>
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
