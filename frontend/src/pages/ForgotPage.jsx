// src/pages/ForgotPage.jsx
import React from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/api/base";

export default function ForgotPage() {
  const [email, setEmail] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [ok, setOk] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const emailOk = /\S+@\S+\.\S+/.test(email);
  const canSubmit = emailOk && !pending;

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setMsg("");
    setOk(false);
    setPending(true);
    try {
      // Backend verwacht: { email }
      const res = await apiFetch("/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      // apiFetch kan string of object teruggeven
      const message =
        typeof res === "string"
          ? res
          : res?.message || "Als het e-mailadres bestaat, is er een herstelmail verzonden.";
      setOk(true);
      setMsg(message);
    } catch (err) {
      setOk(false);
      setMsg(err?.message || "Kon geen herstelmail aanvragen.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="signup-wrapper">
      <div className="container" style={{ maxWidth: 720, margin: "0 auto", padding: "28px 16px 48px" }}>
        {msg && (
          <div
            className="card"
            role="alert"
            style={{
              padding: 12,
              marginBottom: 12,
              background: ok ? "#ecfeff" : "#fff7ed",
              border: `1px solid ${ok ? "#67e8f9" : "#fdba74"}`,
              color: ok ? "#155e75" : "#9a3412",
            }}
          >
            {msg}
          </div>
        )}

        <form className="card" onSubmit={submit} style={{ padding: 18 }}>
          <h2 style={{ marginTop: 0 }}>Wachtwoord vergeten</h2>
          <p style={{ marginTop: 0, color: "var(--muted, #6b7280)" }}>
            Vul je e-mail in. Als we je adres kennen, sturen we een link om je wachtwoord te resetten.
          </p>

          <input
            className="input"
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <button
            className="btn"
            type="submit"
            disabled={!canSubmit}
            style={{ width: "100%", marginTop: 12, opacity: canSubmit ? 1 : 0.7 }}
          >
            {pending ? "Versturen..." : "Stuur resetlink"}
          </button>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link className="btn btn-outline" to="/login">Terug naar inloggen</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
