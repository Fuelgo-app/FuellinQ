// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { API_BASE } from "@/api/base.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `Login failed (${r.status})`);

      // ⬇⬇⬇ DIT IS HET MOMENT ⬇⬇⬇
      localStorage.setItem("token", data.token);

      // optioneel: bewaar profiel/naam
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      // door naar je CO₂ pagina of dashboard
      nav("/co2"); // of "/" of waar je wil
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-sm px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Inloggen</h1>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <label className="grid gap-1">
          <span className="text-sm opacity-70">E-mail</span>
          <input
            className="rounded-xl px-3 py-2 border border-white/20 bg-white/5"
            type="email" required value={email} onChange={e=>setEmail(e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm opacity-70">Wachtwoord</span>
          <input
            className="rounded-xl px-3 py-2 border border-white/20 bg-white/5"
            type="password" required value={password} onChange={e=>setPassword(e.target.value)}
          />
        </label>
        {err && <div className="text-sm text-red-400">{err}</div>}
        <button
          disabled={loading}
          className="rounded-xl px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          type="submit"
        >
          {loading ? "Bezig…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
