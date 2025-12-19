// src/pages/AuthPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiPost, whoAmI, clearToken } from "@/api/base";

/* ───────────────── Helpers ───────────────── */

function mapAuthErrorMessage(err) {
  const raw = String(err?.message || "").toLowerCase();

  if (raw.includes("invalid_login")) return "E-mailadres of wachtwoord klopt niet.";
  if (raw.includes("missing_fields")) return "Vul je e-mailadres en wachtwoord in.";
  if (raw.includes("network_error")) return "Netwerk- of CORS-probleem. Probeer het opnieuw.";
  if (raw.includes("server_error")) return "Serverfout. Probeer het later opnieuw.";
  if (raw.match(/http 4\d\d/)) return "Aanvraag geweigerd.";
  if (raw.match(/http 5\d\d/)) return "Serverfout.";

  return "Inloggen mislukt. Probeer het opnieuw.";
}

function roleToPath(role) {
  if (!role) return "/app";
  const r = role.toLowerCase();
  if (r.includes("admin")) return "/admin";
  if (r.includes("partner")) return "/partner";
  return "/app";
}

/**
 * Slaat ALLEEN UI-state op (user + role)
 * Geen tokens → cookie-first
 */
function setAuthInStorage(user, remember) {
  const primary = remember ? localStorage : sessionStorage;
  const secondary = remember ? sessionStorage : localStorage;

  if (user) {
    primary.setItem("user", JSON.stringify(user));
    primary.setItem("role", user.role || "");
  }

  ["user", "role", "token"].forEach((k) => secondary.removeItem(k));
  clearToken();
}

/* ───────────────── Component ───────────────── */

export default function AuthPage({ mode = "login" }) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  const next = params.get("next");
  const qsMode = (params.get("mode") || mode).toLowerCase();
  const isSignup = qsMode === "signup";

  /* ───── State ───── */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  const [remember, setRemember] = useState(true);
  const [showPass, setShowPass] = useState(false);

  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [verifying, setVerifying] = useState(true);

  const didRedirect = useRef(false);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = password.length >= 6;
  const canSubmit = emailOk && passOk && !pending && !verifying;

  /* ───── Session check bij mount (SOFT) ───── */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const user = await whoAmI();
        if (!alive) return;

        if (user && !didRedirect.current) {
          didRedirect.current = true;
          setAuthInStorage(user, true);
          navigate(next || roleToPath(user.role), { replace: true });
        }
      } catch {
        // ❗️NIET uitloggen — cookies kunnen cross-site geblokkeerd zijn
      } finally {
        if (alive) setVerifying(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, next]);

  /* ───── Submit ───── */
  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setMessage("");
    setPending(true);

    try {
      let res;

      if (isSignup) {
        res = await apiPost("/api/auth/register", {
          email: email.trim(),
          password,
          first_name: first || null,
          last_name: last || null,
        });
      } else {
        res = await apiPost("/api/auth/login", {
          email: email.trim(),
          password,
        });
      }

      // 🔑 Cookie kan falen → fallback op response.user
      let user = null;
      try {
        user = await whoAmI({ force: true, cacheMs: 0 });
      } catch {}

      user = user || res?.user;

      if (!user) {
        throw new Error("Geen gebruiker ontvangen na login.");
      }

      setAuthInStorage(user, remember);

      if (!didRedirect.current) {
        didRedirect.current = true;
        navigate(
          isSignup ? "/onboarding/bank" : next || roleToPath(user.role),
          { replace: true }
        );
      }
    } catch (err) {
      setMessage(mapAuthErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  /* ───────────────── UI ───────────────── */

  return (
    <div className="signup-wrapper">
      <div className="container" style={{ maxWidth: 480, padding: "40px 16px" }}>
        {message && (
          <div className="card" style={{ marginBottom: 12, background: "#fff7ed", border: "1px solid #fdba74" }}>
            {message}
          </div>
        )}

        {verifying && (
          <div className="card" style={{ marginBottom: 12 }}>
            Sessie controleren…
          </div>
        )}

        <form className="card" onSubmit={onSubmit}>
          <h2>{isSignup ? "Account aanmaken" : "Inloggen"}</h2>

          {isSignup && (
            <>
              <input
                className="input"
                placeholder="Voornaam"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
              />
              <input
                className="input"
                placeholder="Achternaam"
                value={last}
                onChange={(e) => setLast(e.target.value)}
              />
            </>
          )}

          <input
            className="input"
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div style={{ position: "relative" }}>
            <input
              className="input"
              type={showPass ? "text" : "password"}
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="btn btn-outline"
              style={{ position: "absolute", right: 6, top: 6 }}
            >
              {showPass ? "Verberg" : "Toon"}
            </button>
          </div>

          <label style={{ display: "flex", gap: 8 }}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Onthoud mij
          </label>

          <button className="btn" type="submit" disabled={!canSubmit}>
            {pending ? "Bezig…" : isSignup ? "Account aanmaken" : "Inloggen"}
          </button>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            {isSignup ? (
              <Link to="/auth?mode=login">Ik heb al een account</Link>
            ) : (
              <Link to="/auth?mode=signup">Nieuw account</Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
