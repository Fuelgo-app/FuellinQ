// src/pages/OnboardingBank.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/api/base";

// Eenvoudige helper om (optioneel) een Klaviyo event te sturen via jouw backend.
// Foutjes mogen nooit de flow blokkeren.
async function sendKlEvent({ email, event, properties }) {
  try {
    await apiFetch("/api/klaviyo/event", {
      method: "POST",
      body: JSON.stringify({ email, event, properties }),
    });
  } catch {}
}

const BANKS = [
  { id: "abn",   name: "ABN AMRO",     logo: "/banks/abnamro.svg" },
  { id: "ing",   name: "ING",          logo: "/banks/ing.svg" },
  { id: "rabo",  name: "Rabobank",     logo: "/banks/rabobank.svg" },
  { id: "sns",   name: "SNS",          logo: "/banks/snsbank.svg" },
  { id: "bunq",  name: "bunq",         logo: "/banks/bunq.svg" },
  { id: "knab",  name: "Knab",         logo: "/banks/knabbank.svg" },
  { id: "triod", name: "Triodos Bank", logo: "/banks/triodosbank.svg" },
  { id: "regio", name: "RegioBank",    logo: "/banks/regiobank.svg" },
];

export default function OnboardingBank() {
  const [searchParams] = useSearchParams();
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [focusIndex, setFocus]  = useState(0);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Current user (voor event email)
  const user = useMemo(() => {
    try {
      return JSON.parse(
        localStorage.getItem("user") || sessionStorage.getItem("user") || "null"
      );
    } catch {
      return null;
    }
  }, []);

  // Preselect via ?bank=ing
  useEffect(() => {
    const preset = (searchParams.get("bank") || "").toLowerCase();
    if (preset && BANKS.some(b => b.id === preset)) {
      setSelected(preset);
      const idx = BANKS.findIndex(b => b.id === preset);
      if (idx >= 0) setFocus(idx);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BANKS;
    return BANKS.filter(
      b => b.id.includes(q) || b.name.toLowerCase().includes(q)
    );
  }, [query]);

  // Grid keyboard support
  function onKeyDown(e) {
    if (!filtered.length) return;
    const cols = Math.max(1, Math.floor((listRef.current?.clientWidth || 600) / 240));
    if (["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) e.preventDefault();
    if (e.key === "ArrowRight") setFocus(i => Math.min(i + 1, filtered.length - 1));
    if (e.key === "ArrowLeft")  setFocus(i => Math.max(i - 1, 0));
    if (e.key === "ArrowDown")  setFocus(i => Math.min(i + cols, filtered.length - 1));
    if (e.key === "ArrowUp")    setFocus(i => Math.max(i - cols, 0));
    if (e.key === "Enter" && filtered[focusIndex]) setSelected(filtered[focusIndex].id);
  }

  async function continueNext() {
    if (!selected || loading) return;
    setError("");
    setLoading(true);
    try {
      // Event: gekozen bank (best-effort)
      await sendKlEvent({
        email: user?.email,
        event: "Onboarding: Bank Selected",
        properties: { bank: selected },
      });

      // Backend call — mag redirect/linked/pending geven; anders gaan we toch door.
      const res = await apiFetch("/api/bank/link", {
        method: "POST",
        body: JSON.stringify({ bank: selected }),
      }).catch(() => ({})); // tolerant

      if (res?.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      if (res?.status === "linked" || res?.linked === true || res?.pending) {
        navigate("/onboarding/wallet", {
          replace: true,
          state: { info: res?.pending ? "Bankkoppeling in behandeling." : undefined },
        });
        return;
      }
      navigate("/onboarding/wallet", { replace: true });
    } catch (e) {
      setError(e?.message || "Er ging iets mis bij het koppelen.");
    } finally {
      setLoading(false);
    }
  }

  async function skipBank() {
    await sendKlEvent({
      email: user?.email,
      event: "Onboarding: Bank Skipped",
      properties: { step: "bank" },
    });
    navigate("/onboarding/wallet", { replace: true, state: { info: "Je kunt later altijd je bank koppelen via Instellingen." } });
  }

  return (
    <div className="container" style={{ maxWidth: 920, marginTop: 28 }}>
      {/* Stepper */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
        <span className="badge" style={{ background:"#22c55e", color:"#fff", padding:"4px 10px", borderRadius:999 }}>Stap 1/3 · Account</span>
        <span className="badge" style={{ background:"#2563eb", color:"#fff", padding:"4px 10px", borderRadius:999 }}>Stap 2/3 · Bank koppelen</span>
        <span className="badge" style={{ background:"#e5e7eb", color:"#111827", padding:"4px 10px", borderRadius:999 }}>Stap 3/3 · Wallet</span>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Koppel je bankrekening</h1>
      <p style={{ color: "#475569", marginBottom: 16 }}>
        Kies je bank om je rekening veilig te koppelen. Wil je dit later doen? Kies dan <b>Overslaan</b>.
      </p>

      <div className="card" style={{ padding:16, borderRadius:16, border:"1px solid #e5e7eb", boxShadow:"0 8px 24px rgba(2,6,23,0.06)" }}>
        {/* Zoekveld */}
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="bank-zoek" style={{ display:"block", fontSize:12, color:"#6b7280", marginBottom:6 }}>
            Zoeken op naam of afkorting
          </label>
          <input
            id="bank-zoek"
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Bijv. ING, Rabobank, bunq…"
            onKeyDown={onKeyDown}
            style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e5e7eb", outline:"none" }}
          />
        </div>

        {/* Grid */}
        <div
          ref={listRef}
          style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:12 }}
          role="listbox"
          aria-label="Kies je bank"
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          {filtered.map((b, idx) => {
            const active = selected === b.id;
            const focused = idx === focusIndex;
            return (
              <button
                key={b.id}
                role="option"
                aria-selected={active}
                onClick={() => { setSelected(b.id); setFocus(idx); }}
                className="bank-tile"
                tabIndex={focused ? 0 : -1}
                style={{
                  display:"flex", alignItems:"center", justifyContent:"center",
                  gap:12, height:84, borderRadius:14,
                  border: active ? "2px solid #2563eb" : "1px solid #e5e7eb",
                  outline: focused ? "2px solid rgba(37,99,235,.5)" : "none",
                  background:"#fff", cursor:"pointer",
                  boxShadow: active ? "0 6px 18px rgba(37,99,235,.20)" : "0 1px 2px rgba(0,0,0,.04)"
                }}
              >
                <img
                  src={b.logo}
                  alt={b.name}
                  style={{ height:34, width:"auto", objectFit:"contain", display:"block" }}
                  loading="lazy"
                  onError={(e)=>{ e.currentTarget.style.display="none"; }}
                />
                <span style={{ fontWeight: 700, color:"#0f172a" }}>{b.name}</span>
              </button>
            );
          })}
          {!filtered.length && (
            <div style={{ padding:12, color:"#6b7280" }}>
              Geen resultaten voor “{query}”.
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, marginTop:16, justifyContent:"space-between", alignItems:"center" }}>
          <Link to="/auth?mode=signup" className="btn btn-outline" style={{
            textDecoration:"none", border:"1px solid #e5e7eb",
            padding:"10px 14px", borderRadius:10, color:"#111827",
            fontWeight:700, background:"#fff",
          }}>
            ← Terug
          </Link>

          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button type="button" className="btn btn-outline" onClick={skipBank}>Overslaan</button>
            {loading && (
              <span aria-live="polite" style={{ fontSize:12, color:"#6b7280" }}>
                Bezig met koppelen…
              </span>
            )}
            <button
              onClick={continueNext}
              disabled={!selected || loading}
              className="btn"
              style={{
                background: (!selected || loading) ? "#cbd5e1" : "#2563eb",
                color:"#fff", padding:"10px 16px", borderRadius:10,
                fontWeight:800, border:0, cursor: (!selected || loading) ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Koppelen…" : "Doorgaan"}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" style={{ marginTop:10, color:"#b91c1c", fontWeight:600 }}>
            {error}
          </div>
        )}

        <div style={{ fontSize:12, color:"#6b7280", marginTop:10 }}>
          🔒 Het koppelen gebeurt via een beveiligde verbinding met je bank.
        </div>
      </div>
    </div>
  );
}
