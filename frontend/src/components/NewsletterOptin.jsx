// src/components/NewsletterOptin.jsx
import React, { useState } from "react";
import { klSubscribe, klIdentify } from "@/lib/klaviyo";

export default function NewsletterOptin({ compact = false }) {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true); setMsg("");
    try {
      await klSubscribe({ email, consent: "email", properties: { source: "footer-optin" } });
      klIdentify({ email });
      setOk(true);
      setMsg("Thanks! Je staat op de lijst ✅");
      setEmail("");
    } catch (err) {
      setMsg(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="email"
        required
        placeholder="jouw@email.nl"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
        style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
      />
      <button disabled={loading} style={{ padding: "10px 14px", borderRadius: 10 }}>
        {loading ? "Moment…" : "Inschrijven"}
      </button>
      {msg && <span style={{ marginLeft: 8, fontSize: 12 }}>{msg}</span>}
      {compact && ok && <span>✅</span>}
    </form>
  );
}
