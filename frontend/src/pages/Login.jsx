// frontend/src/pages/Login.jsx
import React, { useState, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { login as apiLogin, whoAmI } from "@/api/base.js";

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/co2";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const mountedRef = useRef(true);

  React.useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setErr("");
    setLoading(true);

    try {
      const mail = email.trim();
      if (!mail || !password) {
        throw new Error("Vul je e-mail en wachtwoord in.");
      }

      // ✅ Hybride login: zet HttpOnly cookie en (optioneel) Bearer via base.js
      const user = await apiLogin(mail, password);

      // (Optioneel) check of cookie/Bearer werkt:
      try { await whoAmI(); } catch {}

      // Eventueel user lokaal bewaren voor snelle UI
      if (user) {
        try { localStorage.setItem("user", JSON.stringify(user)); } catch {}
      }

      // Door naar gewenste pagina
      nav(next, { replace: true });
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e?.message || "Er ging iets mis bij het inloggen.";
      setErr(msg);
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Inloggen</h1>

      <form className="grid gap-3" onSubmit={onSubmit} noValidate>
        <label className="grid gap-1">
          <span className="text-sm opacity-70">E-mail</span>
          <input
            className="rounded-xl px-3 py-2 border border-white/20 bg-white/5"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm opacity-70">Wachtwoord</span>
          <input
            className="rounded-xl px-3 py-2 border border-white/20 bg-white/5"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </label>

        {err && (
          <div
            className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2"
            role="alert"
          >
            {err}
          </div>
        )}

        <button
          disabled={loading}
          className="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          type="submit"
          aria-busy={loading ? "true" : "false"}
        >
          {loading ? "Bezig…" : "Log in"}
        </button>
      </form>

      <div className="mt-4 text-sm opacity-80 space-x-3">
        <Link to="/signup" className="underline hover:opacity-100">
          Account aanmaken
        </Link>
        <Link to="/forgot" className="underline hover:opacity-100">
          Wachtwoord vergeten?
        </Link>
      </div>
    </div>
  );
}
