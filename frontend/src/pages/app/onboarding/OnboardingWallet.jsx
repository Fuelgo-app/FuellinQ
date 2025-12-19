// src/pages/app/onboarding/OnboardingWallet.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/* --- helpers (.env) --- */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || "";

/* --- mini fetch helpers met status in error --- */
async function apiGet(path, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    signal,
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await r.json().catch(() => ({})) : await r.text().catch(() => "");
  if (!r.ok) {
    const err = new Error((data && (data.error || data.message)) || `GET ${path} failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return data;
}
async function apiPost(path, body, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(body ?? {}),
    signal,
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await r.json().catch(() => ({})) : await r.text().catch(() => "");
  if (!r.ok) {
    const err = new Error((data && (data.error || data.message)) || `POST ${path} failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return data;
}

/* --- platform detectie (heuristisch) --- */
function usePlatform() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isApple =
    /iPhone|iPad|iPod|Macintosh/.test(ua) ||
    (typeof window !== "undefined" && !!window.ApplePaySession);
  const isAndroid = /Android/.test(ua);
  return { isApple, isAndroid };
}

export default function OnboardingWallet() {
  const { isApple } = usePlatform();
  const { state } = useLocation();         // { skipped?, info? } vanuit vorige stap
  const navigate = useNavigate();

  const [status, setStatus] = useState({ linked: false, bank: null });
  const [activeCard, setActiveCard] = useState(null); // {id,label,last4,...}
  const [links, setLinks] = useState({ appleUrl: "", googleUrl: "", genericUrl: "" });

  const [busy, setBusy] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [err, setErr] = useState("");
  const [skipped, setSkipped] = useState(!!state?.skipped || !!state?.info);
  const [walletAdded, setWalletAdded] = useState(false);

  const mountedRef = useRef(true);
  const pollTimerRef = useRef(null);

  /* ---------- helpers ---------- */
  const isReady = status.linked && !!activeCard?.id;
  const masked = activeCard?.last4 ? `**** **** **** ${String(activeCard.last4).padStart(4, "•")}` : "—";

  function clearPoll() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  /* 1) Poll bankstatus (NIET wanneer overgeslagen) met backoff via setTimeout */
  useEffect(() => {
    mountedRef.current = true;
    const ctrl = new AbortController();

    if (skipped) return () => ctrl.abort();

    let delay = 2500;          // start snel
    const maxDelay = 30000;    // cap 30s

    const pollOnce = async () => {
      try {
        const d = await apiGet("/api/bank/status", ctrl.signal);
        if (!mountedRef.current) return;
        setStatus({ linked: !!d.linked, bank: d.bank || null });
        delay = 2500; // reset backoff
        if (d.linked) {
          clearPoll();
          return;
        }
      } catch (e) {
        // 404 = geen endpoint → ga in 'skipped' modus
        if (e?.status === 404) {
          if (mountedRef.current) setSkipped(true);
          clearPoll();
          return;
        }
        // backoff bij tijdelijke fouten
        delay = Math.min(maxDelay, delay + 3000);
      }
      // plan volgende tik
      pollTimerRef.current = setTimeout(pollOnce, delay);
    };

    pollOnce();

    return () => {
      mountedRef.current = false;
      clearPoll();
      ctrl.abort();
    };
  }, [skipped]);

  /* 1b) Banknaam persistent houden (voor OnboardingDone fallback) */
  useEffect(() => {
    if (status.bank) {
      try { localStorage.setItem("fuellinq_bank", String(status.bank).toUpperCase()); } catch {}
    }
  }, [status.bank]);

  /* 2) Wanneer linked => haal/maak actieve pas (eenmalig) */
  useEffect(() => {
    if (!status.linked) return;

    const ctrl = new AbortController();
    (async () => {
      try {
        setErr("");
        // a) check of er al een actieve pas is
        let card = null;
        try {
          card = await apiGet("/api/cards/active", ctrl.signal);
        } catch {
          // geen actieve pas
        }
        // b) zo niet → issue er één
        if (!card || !card.id) {
          setIssuing(true);
          card = await apiPost("/api/cards/issue", { label: "Mijn tankpas" }, ctrl.signal);
        }
        if (!mountedRef.current) return;
        setActiveCard(card || null);
      } catch (e) {
        if (!mountedRef.current) return;
        setErr(e.message || "Kon (actieve) pas niet ophalen/uitgeven.");
      } finally {
        if (mountedRef.current) setIssuing(false);
      }
    })();

    return () => ctrl.abort();
  }, [status.linked]);

  /* 3) (optioneel) haal demo/universele link op na koppeling */
  useEffect(() => {
    if (!status.linked || !activeCard?.id || links.genericUrl) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await apiPost("/api/wallet/pass", {}, ctrl.signal);
        if (!mountedRef.current) return;
        const url = r?.url || r?.appleUrl || r?.googleUrl || "";
        if (url) {
          setLinks((p) => ({ ...p, genericUrl: url }));
          setWalletAdded(true);
        }
      } catch {
        // niet fataal
      }
    })();
    return () => ctrl.abort();
  }, [status.linked, activeCard?.id, links.genericUrl]);

  /* ---------- wallet actions ---------- */
  const addApple = useMemo(
    () => async () => {
      if (!activeCard?.id || busy) return;
      try {
        setBusy(true); setErr("");
        const r = await apiPost(`/api/wallet/apple/${activeCard.id}`, {});
        const url = r?.url || r?.appleUrl || "";
        if (url) {
          setLinks((p) => ({ ...p, appleUrl: url }));
          setWalletAdded(true);
          window.location.href = url;
        } else {
          setErr("Geen Apple Wallet-URL ontvangen.");
        }
      } catch (e) {
        setErr(e.message || "Apple Wallet nog niet geconfigureerd (demo).");
      } finally {
        setBusy(false);
      }
    },
    [activeCard?.id, busy]
  );

  const addGoogle = useMemo(
    () => async () => {
      if (!activeCard?.id || busy) return;
      try {
        setBusy(true); setErr("");
        const r = await apiPost(`/api/wallet/google/${activeCard.id}`, {});
        const url = r?.url || r?.googleUrl || "";
        if (url) {
          setLinks((p) => ({ ...p, googleUrl: url }));
          setWalletAdded(true);
          window.location.href = url;
        } else {
          setErr("Geen Google Wallet-URL ontvangen.");
        }
      } catch (e) {
        setErr(e.message || "Google Wallet nog niet geconfigureerd (demo).");
      } finally {
        setBusy(false);
      }
    },
    [activeCard?.id, busy]
  );

  const addGeneric = useMemo(
    () => async () => {
      if (busy) return;
      try {
        setBusy(true); setErr("");
        const r = await apiPost(`/api/wallet/pass`, { cardId: activeCard?.id || null });
        const url = r?.url || r?.appleUrl || r?.googleUrl || "";
        if (url) {
          setLinks((p) => ({ ...p, genericUrl: url }));
          setWalletAdded(true);
          window.location.href = url;
        } else {
          setErr("Geen wallet-link ontvangen.");
        }
      } catch (e) {
        setErr(e.message || "Wallet-pass ophalen mislukt (demo).");
      } finally {
        setBusy(false);
      }
    },
    [activeCard?.id, busy]
  );

  /* ---------- UI ---------- */
  const primaryCtaLabel = isApple ? " Voeg toe aan Apple Wallet" : "➤ Voeg toe aan Google Wallet";
  const primaryCtaAction = isApple ? addApple : addGoogle;

  function goDone() {
    navigate("/onboarding/done", {
      replace: true,
      state: { bank: status.bank, walletAdded },
    });
  }

  return (
    <div className="container" style={{ maxWidth: 920, marginTop: 28 }}>
      {/* Stepper */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
        <span className="badge" style={{ background:"#22c55e", color:"#fff", padding:"4px 10px", borderRadius:999 }}>Stap 1/3 · Account</span>
        <span className="badge" style={{ background:"#22c55e", color:"#fff", padding:"4px 10px", borderRadius:999 }}>Stap 2/3 · Bank</span>
        <span className="badge" style={{ background:"#2563eb", color:"#fff", padding:"4px 10px", borderRadius:999 }}>Stap 3/3 · Wallet</span>
      </div>

      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
        Voeg je digitale tankpas toe aan je Wallet
      </h1>

      {/* Banner als iemand bank heeft overgeslagen of via state.info kwam */}
      {(skipped || state?.info) && (
        <div
          style={{
            background: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: 10,
            padding: "12px 16px",
            marginBottom: 16,
            color: "#9a3412",
            fontWeight: 500,
          }}
        >
          {state?.info || "Je hebt de bankkoppeling overgeslagen. Je kunt dit later alsnog doen in je dashboard."}
        </div>
      )}

      {!skipped && (
        <p style={{ color: "#475569", marginBottom: 18 }}>
          {!status.linked && <>We koppelen je bank (<b>{status.bank?.toUpperCase?.() || "… wachten op koppeling"}</b>). Dit kan even duren…</>}
          {status.linked && !isReady && <>Bank <b>{status.bank?.toUpperCase?.()}</b> is gekoppeld. Je pas wordt aangemaakt…</>}
          {isReady && <>Bank <b>{status.bank?.toUpperCase?.()}</b> is gekoppeld. Je pas is klaar om toe te voegen.</>}
        </p>
      )}

      <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 18, borderRadius: 16 }}>
        {/* Visual */}
        <div style={{ display: "grid", placeItems: "center" }}>
          <img
            src="/assets/fuellinq-card.png"
            alt="FuellinQ digitale tankpas"
            style={{ width: "100%", maxWidth: 360, borderRadius: 16, boxShadow: "0 10px 30px rgba(2,6,23,.15)" }}
            loading="lazy"
          />
        </div>

        {/* Actions */}
        <div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
              {activeCard?.label || "Digitale tankpas"}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {isReady ? masked : issuing ? "Pas aan het uitgeven…" : "—"}
            </div>
          </div>

          {/* Wallet CTA's */}
          <div style={{ display: "grid", gap: 12 }}>
            <button
              className="btn"
              onClick={primaryCtaAction}
              disabled={skipped || !isReady || busy}
              style={{
                background: !skipped && isReady ? (isApple ? "#000" : "#fff") : "#cbd5e1",
                color: isApple ? "#fff" : "#111827",
                border: isApple ? "none" : "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {primaryCtaLabel}
            </button>

            <button
              className="btn btn-outline"
              onClick={isApple ? addGoogle : addApple}
              disabled={skipped || !isReady || busy}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 800,
                background: "#fff",
                color: "#111827",
                opacity: !skipped && isReady ? 1 : 0.6,
              }}
            >
              {isApple ? "➤ Voeg toe aan Google Wallet" : " Voeg toe aan Apple Wallet"}
            </button>

            <button
              className="btn"
              onClick={addGeneric}
              disabled={skipped || busy || (!status.linked && !isReady)}
              style={{
                background: "#2563eb",
                color: "#fff",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 800,
              }}
            >
              (Demo) Universele wallet-link
            </button>

            {busy && <div style={{ color: "#64748b" }}>Bezig…</div>}
            {err && <div style={{ color: "#b91c1c", fontWeight: 600 }}>{err}</div>}

            {/* Doorgaan naar einde onboarding */}
            <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
              <button
                className="btn"
                onClick={goDone}
                style={{ background: "#16a34a", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}
              >
                Doorgaan
              </button>
              <Link
                to="/app"
                className="btn btn-outline"
                style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontWeight: 800, background: "#fff" }}
              >
                Naar dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ul style={{ marginTop: 18, color: "#475569", lineHeight: 1.6 }}>
        <li>📍 Zie tankstations, prijzen en acties in de buurt.</li>
        <li>💳 Betaal contactloos met je digitale tankpas.</li>
        <li>📈 Direct inzicht in transacties & kortingen.</li>
      </ul>

      {/* Debug mini-blokje */}
      <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
        <div>API_BASE: <code>{API_BASE}</code></div>
        {links.genericUrl && <div>Laatste wallet-link: <code>{links.genericUrl}</code></div>}
      </div>
    </div>
  );
}
