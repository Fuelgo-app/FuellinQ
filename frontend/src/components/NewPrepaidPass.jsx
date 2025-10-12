// src/components/NewPrepaidPass.jsx
import React, { useState } from "react";

/* --- API helper (valt terug op :3001) --- */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || "";

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body ?? {}),
    credentials: "include",
  });

  let data = null;
  try {
    const ct = res.headers.get("content-type") || "";
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch {
    // negeer parse error, val terug op status
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data.error) ||
      (typeof data === "string" && data) ||
      `POST ${path} failed (${res.status})`;
    throw new Error(msg);
  }
  return data ?? {};
}

/**
 * Props:
 * - onCreated?: () => void  // optioneel, na succesvol aanmaken
 */
export default function NewPrepaidPass({ onCreated }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function createCard() {
    if (busy) return;
    setMsg("");
    setErr("");

    const name = (label || "").trim();
    if (!name) {
      setErr("Geef een label op (bijv. ‘Werk’ of ‘Privé’).");
      return;
    }
    if (!getToken()) {
      setErr("Je bent niet ingelogd. Log in en probeer opnieuw.");
      return;
    }

    try {
      setBusy(true);
      await apiPost("/api/cards", { label: name });
      setLabel("");
      setMsg("Prepaid tankpas aangemaakt ✔");
      onCreated?.();
    } catch (e) {
      setErr(e?.message || "Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      createCard();
    }
  }

  return (
    <section className="np-card" aria-live="polite">
      <style>{`
        .np-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 8px 24px rgba(2,6,23,.06); padding:18px; }
        .np-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
        .np-title { margin:0; font-size:20px; font-weight:900; color:#0b3654; }
        .np-promo { display:inline-flex; gap:8px; align-items:center; }
        .np-old { text-decoration:line-through; color:#64748b; font-weight:800; }
        .np-now { background:#dcfce7; color:#166534; border:1px solid #86efac; font-weight:900; padding:4px 10px; border-radius:999px; }

        .np-body { display:grid; grid-template-columns: 320px 1fr; gap:18px; align-items:center; }
        .np-cardimg-wrap { aspect-ratio: 1.58 / 1; border-radius:18px; overflow:hidden; border:1px solid #e5e7eb; background:#f8fafc; display:grid; place-items:center; }
        .np-cardimg { width:100%; height:100%; object-fit:cover; display:block; }

        .np-list { margin:0; padding-left:18px; color:#475569; line-height:1.5; }
        .np-list li { margin:4px 0; }
        .np-form { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
        .np-input, .np-btn { height:44px; border-radius:12px; border:1px solid #e5e7eb; padding:0 12px; }
        .np-input { min-width:260px; flex:1; }
        .np-btn { background:#2563eb; color:#fff; font-weight:900; cursor:pointer; border-color:#2563eb; }
        .np-btn[disabled]{ opacity:.65; cursor:not-allowed; }

        .np-note { color:#64748b; font-size:12px; margin-top:8px; }
        .np-msg { margin-top:10px; color:#065f46; font-weight:700; background:#ecfdf5; border:1px solid #a7f3d0; padding:8px 10px; border-radius:10px; }
        .np-err { margin-top:10px; color:#7f1d1d; font-weight:700; background:#fef2f2; border:1px solid #fecaca; padding:8px 10px; border-radius:10px; }

        @media (max-width: 860px){ .np-body { grid-template-columns: 1fr; } }
      `}</style>

      <div className="np-head">
        <h3 className="np-title">Nieuwe prepaid tankpas</h3>
        <div className="np-promo" aria-label="Introductieprijs">
          <span className="np-old" aria-hidden>€ 9,99</span>
          <span className="np-now">nu tijdelijk € 4,99</span>
        </div>
      </div>

      <div className="np-body">
        <div className="np-cardimg-wrap">
          <img
            className="np-cardimg"
            src="/assets/fuellinq-card.png"
            alt="FuellinQ Prepaid Tankpas"
            loading="lazy"
          />
        </div>

        <div>
          <ul className="np-list">
            <li>Direct te gebruiken in Apple Wallet of Google Wallet.</li>
            <li>Ideaal voor proefgebruik of losse bestuurders.</li>
            <li>Volledige transactie-overzichten en btw-rapportage.</li>
          </ul>

          <div className="np-form">
            <input
              className="np-input"
              placeholder="Label (bijv. Werk / Privé)"
              value={label}
              onChange={(e)=>setLabel(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Paslabel"
              disabled={busy}
            />
            <button
              className="np-btn"
              onClick={createCard}
              disabled={busy || !label.trim()}
            >
              {busy ? "Bezig..." : "Activeer voor € 4,99"}
            </button>
          </div>

          <div className="np-note">Introductieprijs. Normaal € 9,99 eenmalig. Geen verborgen kosten.</div>
          {msg && <div className="np-msg">{msg}</div>}
          {err && <div className="np-err">{err}</div>}
        </div>
      </div>
    </section>
  );
}
