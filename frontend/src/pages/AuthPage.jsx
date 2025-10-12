// src/pages/AuthPage.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "@/api/base"; // centrale fetch helper

// Kleine helper conform je screenshot-wens
function setToken(token) {
  if (!token) return;
  localStorage.setItem("token", token);
}

export default function AuthPage({ mode = "login", onAuthed }) {
  const isSignup = mode === "signup";

  const [first, setFirst] = React.useState("");
  const [last, setLast] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [pass, setPass] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);

  const [msg, setMsg] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const navigate = useNavigate();
  const { search } = useLocation();
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const next = params.get("next"); // optionele redirect na login

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const passOk = (pass || "").length >= 6;
  const canSubmit = !pending && emailOk && passOk;

  function persistAuth(data) {
    if (!data || typeof data !== "object") return;
    if (data.token) setToken(data.token);
    if (data.user) {
      localStorage.setItem("user", JSON.stringify(data.user));
      if (data.user.role) localStorage.setItem("role", data.user.role);
    }
  }

  function roleToPath(role) {
    if (!role) return "/app";
    const r = String(role).toLowerCase();
    if (r.includes("admin")) return "/admin";
    if (r.includes("partner")) return "/partner";
    return "/app";
  }

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setMsg("");
    setPending(true);
    try {
      const payload = isSignup
        ? {
            email: email.trim(),
            password: pass,
            first_name: first || null,
            last_name: last || null,
          }
        : { email: email.trim(), password: pass };

      // ✅ gefixt naar /api/auth/*
      const path = isSignup ? "/api/auth/register" : "/api/auth/login";
      const res = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = typeof res === "string" ? {} : res;

      persistAuth(data);
      onAuthed?.(data?.user ?? null);

      if (isSignup) {
        navigate("/onboarding/bank", { replace: true });
      } else {
        const dest = next || roleToPath(data?.user?.role);
        navigate(dest, { replace: true });
      }
    } catch (err) {
      setMsg(err?.message || "Actie mislukt. Probeer het opnieuw.");
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
            style={{
              padding: 12,
              marginBottom: 12,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
            }}
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

          <button
            className="btn"
            type="submit"
            disabled={!canSubmit}
            style={{ width: "100%", marginTop: 12, opacity: canSubmit ? 1 : 0.7 }}
          >
            {pending ? (isSignup ? "Aanmaken..." : "Inloggen...") : isSignup ? "Account aanmaken" : "Log in"}
          </button>

          <div style={{ marginTop: 10, display: "flex", justifyContent: "center" }}>
            {isSignup ? (
              <Link className="btn btn-outline" to="/login">
                Ik heb al een account
              </Link>
            ) : (
              <Link className="btn btn-outline" to="/signup">
                Nieuw account
              </Link>
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
