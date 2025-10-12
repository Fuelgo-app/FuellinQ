// src/pages/ResetPage.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "@/api/base";

export default function ResetPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = React.useMemo(() => new URLSearchParams(search), [search]);
  const token = params.get("token") || "";

  const [pass, setPass] = React.useState("");
  const [pass2, setPass2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [ok, setOk] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const passOk = (pass || "").length >= 6;
  const same = pass && pass2 && pass === pass2;
  const tokenOk = !!token && token.length > 10; // simpele sanity check
  const canSubmit = tokenOk && passOk && same && !pending;

  async function submit(e) {
    e?.preventDefault?.();
    if (!canSubmit) return;

    setMsg("");
    setOk(false);
    setPending(true);
    try {
      // Backend verwacht: { token, password }
      const res = await apiFetch("/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, password: pass }),
      });

      const message =
        typeof res === "string" ? res : res?.message || "Je wachtwoord is gewijzigd. Je kunt nu inloggen.";
      setOk(true);
      setMsg(message);

      // Na korte delay door naar login
      setTimeout(() => navigate("/login", { replace: true }), 800);
    } catch (err) {
      setOk(false);
      setMsg(err?.message || "Reset is niet gelukt. De link kan verlopen zijn.");
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
          <h2 style={{ marginTop: 0 }}>Nieuw wachtwoord instellen</h2>

          {!tokenOk && (
            <p style={{ marginTop: 0, color: "#9a3412", background: "#fff7ed", border: "1px solid #fdba74", padding: 8 }}>
              Ongeldige of ontbrekende token. Klik op{" "}
              <Link to="/forgot">wachtwoord vergeten</Link> om een nieuwe link te ontvangen.
            </p>
          )}

          <div style={{ position: "relative", marginTop: 10 }}>
            <input
              className="input"
              type={show ? "text" : "password"}
              placeholder="Nieuw wachtwoord (min. 6 tekens)"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="btn btn-outline"
              style={{ position: "absolute", right: 6, top: 6, padding: "6px 10px", fontSize: 12 }}
              aria-label={show ? "Verberg wachtwoord" : "Toon wachtwoord"}
              tabIndex={-1}
            >
              {show ? "Verberg" : "Toon"}
            </button>
          </div>

          <input
            className="input"
            type={show ? "text" : "password"}
            placeholder="Herhaal nieuw wachtwoord"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            style={{ marginTop: 10 }}
          />

          {pass && pass2 && !same && (
            <div style={{ color: "#9a3412", marginTop: 6, fontSize: 14 }}>
              Wachtwoorden komen niet overeen.
            </div>
          )}

          <button
            className="btn"
            type="submit"
            disabled={!canSubmit}
            style={{ width: "100%", marginTop: 12, opacity: canSubmit ? 1 : 0.7 }}
          >
            {pending ? "Opslaan..." : "Wachtwoord opslaan"}
          </button>

          <div style={{ marginTop: 12, textAlign: "center" }}>
            <Link className="btn btn-outline" to="/login">Terug naar inloggen</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
