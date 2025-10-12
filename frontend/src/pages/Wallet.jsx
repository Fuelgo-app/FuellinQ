// src/pages/Wallet.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, API_BASE } from "@/api/base.js";

/* ---------------- Auth fetch wrapper ---------------- */
const getToken = () => localStorage.getItem("token") || "";

async function authFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return apiFetch(path, { ...opts, headers });
}
const apiGet    = (p)        => authFetch(p);
const apiPost   = (p, body)  => authFetch(p, { method: "POST", body: JSON.stringify(body ?? {}) });
const apiDelete = (p)        => authFetch(p, { method: "DELETE" });

/* ---------------- Kleine helpers ---------------- */
function last4From(card) {
  if (!card) return "";
  if (card.last4) return String(card.last4);
  if (card.masked_pan) return String(card.masked_pan).slice(-4);
  return "";
}
function displayLabel(card, idx) {
  return card?.label || card?.alias || `Pas #${(idx ?? 0) + 1}`;
}
function statusBadge(status) {
  const s = (status || "").toLowerCase();
  if (!s || s === "active") return null;
  const map = {
    blocked: { bg: "#fee2e2", fg: "#991b1b", text: "geblokkeerd" },
    paused:  { bg: "#fef9c3", fg: "#854d0e", text: "gepauzeerd" },
    pending: { bg: "#e0e7ff", fg: "#3730a3", text: "in behandeling" },
  };
  const m = map[s] || { bg: "#e5e7eb", fg: "#374151", text: s };
  return (
    <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 999, background: m.bg, color: m.fg }}>
      {m.text}
    </span>
  );
}

/* ============ Nieuwe prepaid tankpas (promokaart) ============ */
function NewPrepaidPass({ onCreated }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState("");

  async function createCard() {
    try {
      setBusy(true); setMsg("");
      const name = (label || "Prepaid tankpas").trim();
      await apiPost("/api/cards", { label: name });
      setLabel("");
      setMsg("Prepaid tankpas aangemaakt ✔");
      onCreated?.();
      document.getElementById("my-cards")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      setMsg(e.message || "Aanmaken mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="np-card" style={{ borderRadius: 16, marginBottom: 16 }}>
      <style>{`
        .np-card { background:#fff; border:1px solid #e5e7eb; box-shadow:0 8px 24px rgba(2,6,23,.06); padding:18px; }
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
        .np-msg { margin-top:10px; color:#0b3654; font-weight:700; }
        @media (max-width: 860px){ .np-body { grid-template-columns: 1fr; } }
      `}</style>

      <div className="np-head">
        <h3 className="np-title">Nieuwe prepaid tankpas</h3>
        <div className="np-promo">
          <span className="np-old">€ 9,99</span>
          <span className="np-now">nu tijdelijk € 4,99</span>
        </div>
      </div>

      <div className="np-body">
        <div className="np-cardimg-wrap">
          <img className="np-cardimg" src="/assets/fuellinq-card.png" alt="FuellinQ Prepaid Tankpas" loading="lazy" />
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
            />
            <button className="np-btn" onClick={createCard} disabled={busy}>
              {busy ? "Bezig..." : "Activeer voor € 4,99"}
            </button>
          </div>

          <div className="np-note">Introductieprijs. Normaal € 9,99 eenmalig. Geen verborgen kosten.</div>
          {msg && <div className="np-msg">{msg}</div>}
        </div>
      </div>
    </section>
  );
}

/* ===================== Pagina ===================== */
export default function WalletPage() {
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [activeCardId, setActiveCardId] = useState(null); // echte active uit /api/cards/active
  const [activeCard, setActiveCard] = useState(null);     // volledige kaart
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Tip voor debug: zie waartegen je praat
  // console.debug("API_BASE", API_BASE);

  /* (a) laad actieve pas expliciet */
  async function loadActive() {
    try {
      const data = await apiGet("/api/cards/active"); // verwacht object of null
      const id = data?.id ?? data?.card_id ?? null;
      setActiveCardId(id || null);
      setActiveCard(id ? data : null);
      return id;
    } catch {
      setActiveCardId(null);
      setActiveCard(null);
      return null;
    }
  }

  async function loadList() {
    const data = await apiGet("/api/cards").catch(() => ({ cards: [] }));
    const list = Array.isArray(data) ? data : (data?.cards || []);
    setCards(list);
    return list;
  }

  async function load() {
    try {
      setLoading(true);
      setMsg("");
      const list = await loadList();
      const activeId = await loadActive();
      if (!selectedCardId) {
        if (activeId) setSelectedCardId(String(activeId));
        else if (list.length > 0) setSelectedCardId(String(list[0].id));
      }
    } catch (e) {
      setMsg(e.message || "Kon passen niet ophalen");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  /* ---- Memo: actief kaart object uit lijst (fallback) ---- */
  const activeFromList = useMemo(
    () => cards.find(c => String(c.id) === String(activeCardId)) || null,
    [cards, activeCardId]
  );
  const effectiveActive = activeCard || activeFromList || null;

  /* ---- Acties ---- */
  async function makeActive(cardId) {
    if (!cardId) return alert("Kies eerst een pas.");
    try {
      setMsg("");
      await apiPost("/api/cards/select", { cardId }); // server zet actief
      await Promise.all([loadActive(), loadList()]);   // resync
      setMsg("Actieve pas gewijzigd");
    } catch (e) {
      setMsg(e.message || "Kon actieve pas niet wijzigen");
    }
  }

  async function removeCard(cardId) {
    if (!cardId) return;
    if (!window.confirm("Weet je zeker dat je deze pas wilt verwijderen?")) return;
    try {
      setMsg("");
      await apiDelete(`/api/cards/${cardId}`);
      await load();
      setMsg("Pas verwijderd");
    } catch (e) {
      setMsg(e.message || "Verwijderen mislukt");
    }
  }

  async function addApple(cardId) {
    if (!cardId) return alert("Kies eerst een pas.");
    try {
      const res = await apiPost(`/api/wallet/apple/${cardId}`, {});
      if (res?.url) window.location.href = res.url;
      else setMsg("Apple Wallet verzoek verzonden (geen URL terug).");
    } catch (e) {
      setMsg(e.message || "Apple Wallet nog niet geconfigureerd (demo).");
    }
  }

  async function addGoogle(cardId) {
    if (!cardId) return alert("Kies eerst een pas.");
    try {
      const res = await apiPost(`/api/wallet/google/${cardId}`, {});
      if (res?.url) window.location.href = res.url;
      else setMsg("Google Wallet verzoek verzonden (geen URL terug).");
    } catch (e) {
      setMsg(e.message || "Google Wallet nog niet geconfigureerd (demo).");
    }
  }

  async function addGeneric(cardId) {
    if (!cardId) return alert("Kies eerst een pas.");
    try {
      const res = await apiPost("/api/wallet/pass", { cardId });
      const url = res?.url || res?.appleUrl || res?.googleUrl || "";
      if (url) window.location.href = url;
      else setMsg("Geen wallet-link ontvangen.");
    } catch (e) {
      setMsg(e.message || "Wallet-pass ophalen mislukt (demo).");
    }
  }

  return (
    <div className="container" style={{ maxWidth: 980, margin: "0 auto" }}>
      {/* Intro */}
      <div className="card p-3" style={{ borderRadius: 16, margin: "16px 0" }}>
        <h1 style={{ margin: 0, color: "var(--brand-primary,#0b3654)" }}>Wallet & Passen</h1>
        <p className="muted" style={{ marginTop: 6 }}>
          Voeg je digitale tankpas toe aan <b>Apple Wallet</b> of <b>Google Wallet</b>.
          Je kunt ook een <b>prepaid pas</b> activeren of je <b>actieve pas wisselen</b>.
        </p>
        <div className="muted" style={{ fontSize: 12 }}>
          <code>API_BASE: {API_BASE}</code>
        </div>
      </div>

      {/* Actieve pas sectie */}
      <div className="card p-4" style={{ borderRadius: 16, marginBottom: 16, border: "2px solid #2563eb", background: "#eff6ff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#1e40af" }}>Actieve pas</div>
            {effectiveActive ? (
              <>
                <div style={{ fontWeight: 700 }}>
                  {displayLabel(effectiveActive)}
                  <span style={{
                    fontSize: 12, padding: "2px 8px", background: "#1e40af", color: "#fff",
                    borderRadius: 999, marginLeft: 8
                  }}>actief</span>
                  {statusBadge(effectiveActive.status)}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {last4From(effectiveActive) ? `**** **** **** ${last4From(effectiveActive)}` :
                    effectiveActive.plate ? `Kenteken: ${effectiveActive.plate}` : "—"}
                </div>
              </>
            ) : (
              <div className="muted">Nog geen actieve pas gekozen.</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-outline" onClick={() => effectiveActive && addApple(effectiveActive.id)} disabled={!effectiveActive}> Wallet</button>
            <button className="btn btn-outline" onClick={() => effectiveActive && addGoogle(effectiveActive.id)} disabled={!effectiveActive}>Google Wallet</button>
            <button className="btn" onClick={() => effectiveActive && addGeneric(effectiveActive.id)} disabled={!effectiveActive}>(Demo) Link</button>
          </div>
        </div>
      </div>

      {/* Meldingen */}
      {msg && (
        <div className="card p-3" style={{ borderRadius: 14, background: "#fff7ed", borderColor: "#fdba74", marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {/* Apple & Google zijde */}
      <div className="grid grid-2" style={{ gap: 16, marginBottom: 16 }}>
        {/* Apple */}
        <div className="card p-4" style={{ borderRadius: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Apple Wallet</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            iPhone of Apple Watch {effectiveActive ? <em>(gebruikt standaard: {displayLabel(effectiveActive)})</em> : null}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>Kies pas</label>
            <select
              className="input"
              value={selectedCardId || ""}
              onChange={(e) => setSelectedCardId(e.target.value || null)}
            >
              {cards.length === 0 && <option value="">— geen passen —</option>}
              {cards.map((c, i) => (
                <option key={c.id} value={String(c.id)}>
                  {displayLabel(c, i)}{last4From(c) ? ` •••• ${last4From(c)}` : ""}{String(activeCardId) === String(c.id) ? " (actief)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-outline" onClick={() => addApple(selectedCardId)} disabled={!selectedCardId}>
               Toevoegen aan Apple Wallet
            </button>
            <button className="btn" onClick={() => addGeneric(selectedCardId)} disabled={!selectedCardId}>
              (Demo) Universele link
            </button>
          </div>
        </div>

        {/* Google */}
        <div className="card p-4" style={{ borderRadius: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Google Wallet</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            Android of WearOS {effectiveActive ? <em>(gebruikt standaard: {displayLabel(effectiveActive)})</em> : null}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>Kies pas</label>
            <select
              className="input"
              value={selectedCardId || ""}
              onChange={(e) => setSelectedCardId(e.target.value || null)}
            >
              {cards.length === 0 && <option value="">— geen passen —</option>}
              {cards.map((c, i) => (
                <option key={c.id} value={String(c.id)}>
                  {displayLabel(c, i)}{last4From(c) ? ` •••• ${last4From(c)}` : ""}{String(activeCardId) === String(c.id) ? " (actief)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-outline" onClick={() => addGoogle(selectedCardId)} disabled={!selectedCardId}>
              G Toevoegen aan Google Wallet
            </button>
            <button className="btn" onClick={() => addGeneric(selectedCardId)} disabled={!selectedCardId}>
              (Demo) Universele link
            </button>
          </div>
        </div>
      </div>

      {/* 🎯 Nieuwe prepaid tankpas (PROMO) */}
      <NewPrepaidPass onCreated={load} />

      {/* Lijst (beheer + wisselen/verwijderen) */}
      <div id="my-cards" className="card p-4" style={{ borderRadius: 16 }}>
        <div style={{ fontWeight: 800, color: "var(--brand-primary,#0b3654)", marginBottom: 8 }}>Mijn passen</div>

        {loading ? (
          <div className="muted">Laden…</div>
        ) : cards.length === 0 ? (
          <div className="muted">Nog geen passen. Activeer eerst jouw prepaid pas hierboven.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {cards.map((c, i) => {
              const isActive = String(activeCardId) === String(c.id) || c.active || c.is_active;
              const notActive = !isActive;
              return (
                <div
                  key={c.id || i}
                  className="card p-3"
                  style={{
                    borderRadius: 12,
                    border: isActive ? "2px solid #2563eb" : "1px solid #e5e7eb",
                    background: isActive ? "#eff6ff" : "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {displayLabel(c, i)}
                        {isActive && (
                          <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 999, background: "#1e40af", color: "#fff" }}>
                            actief
                          </span>
                        )}
                        {statusBadge(c.status)}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {last4From(c)
                          ? `**** **** **** ${last4From(c)}`
                          : c.plate
                          ? `Kenteken: ${c.plate}`
                          : "—"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {notActive && (
                        <button className="btn" onClick={() => makeActive(c.id)}>
                          Maak actief
                        </button>
                      )}
                      <button className="btn btn-outline" onClick={() => addApple(c.id)}> Wallet</button>
                      <button className="btn btn-outline" onClick={() => addGoogle(c.id)}>Google Wallet</button>
                      <button className="btn" onClick={() => addGeneric(c.id)}>(Demo) Link</button>
                      <button className="btn btn-outline" onClick={() => removeCard(c.id)}>Verwijderen</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAQ */}
      <div style={{ height: 16 }} />
      <div className="card p-4" style={{ borderRadius: 16 }}>
        <div style={{ fontWeight: 800, color: "var(--brand-primary,#0b3654)", marginBottom: 8 }}>Veelgestelde vragen</div>
        <details style={{ marginBottom: 6 }}>
          <summary><b>Hoe werkt de digitale tankpas?</b></summary>
          <div className="muted">Je voegt de pas toe aan Apple Wallet of Google Wallet. Bij partners scan je de pas en reken je af via je account.</div>
        </details>
        <details style={{ marginBottom: 6 }}>
          <summary><b>Wat als de wallet-link niet werkt?</b></summary>
          <div className="muted">Controleer of je op iOS (voor .pkpass) of Android (Google Wallet) zit. Bij problemen: probeer opnieuw of neem contact op.</div>
        </details>
      </div>
    </div>
  );
}
