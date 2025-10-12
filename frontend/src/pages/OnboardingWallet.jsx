import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* --- helpers (.env) --- */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || "";

/* --- mini fetch helpers met Abort support --- */
async function apiGet(path, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    signal,
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await r.json().catch(() => ({})) : await r.text().catch(() => "");
  if (!r.ok) throw new Error((data && data.error) || `GET ${path} failed (${r.status})`);
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
  if (!r.ok) throw new Error((data && data.error) || `POST ${path} failed (${r.status})`);
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
  const { isApple, isAndroid } = usePlatform();

  const [status, setStatus] = useState({ linked: false, bank: null });
  const [activeCard, setActiveCard] = useState(null); // {id,label,last4,...}
  const [links, setLinks] = useState({ appleUrl: "", googleUrl: "", genericUrl: "" });

  const [busy, setBusy] = useState(false);     // algemene “bezig”
  const [issuing, setIssuing] = useState(false);
  const [err, setErr] = useState("");

  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);

  /* ---------- helpers ---------- */
  const isReady = status.linked && !!activeCard?.id;
  const masked = activeCard?.last4 ? `**** **** **** ${String(activeCard.last4).padStart(4, "•")}` : "—";

  function clearPoll() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  /* 1) Poll bankstatus totdat linked, pauzeer wanneer tabblad verborgen is */
  useEffect(() => {
    mountedRef.current = true;
    const ctrl = new AbortController();

    const pollOnce = async () => {
      try {
        const d = await apiGet("/api/bank/status", ctrl.signal);
        if (!mountedRef.current) return;
        setStatus({ linked: !!d.linked, bank: d.bank || null });
        if (d.linked) clearPoll();
      } catch {
        // stil falen — we proberen later opnieuw
      }
    };

    const startPolling = () => {
      clearPoll();
      pollOnce(); // immediate
      pollTimerRef.current = setInterval(pollOnce, 2500);
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && !status.linked) startPolling();
      if (document.visibilityState === "hidden") clearPoll();
    };

    startPolling();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mountedRef.current = false;
      clearPoll();
      document.removeEventListener("visibilitychange", onVis);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* 3) (optioneel) haal direct demo/universele link op na koppeling */
  useEffect(() => {
    if (!status.linked || !activeCard?.id || links.genericUrl) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const r = await apiPost("/api/wallet/pass", {}, ctrl.signal);
        if (!mountedRef.current) return;
        setLinks((p) => ({ ...p, genericUrl: r?.url || r?.appleUrl || r?.googleUrl || "" }));
      } catch {
        // niet fataal
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.linked, activeCard?.id]);

  /* ---------- button handlers ---------- */
  const addApple = useMemo(
    () => async () => {
      if (!activeCard?.id || busy) return;
      try {
        setBusy(true); setErr("");
        const r = await apiPost(`/api/wallet/apple/${activeCard.id}`, {});
        const url = r?.url || r?.appleUrl || "";
        if (url) {
          setLinks((p) => ({ ...p, appleUrl: url }));
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

  return (
    <div className="container" style={{ maxWidth: 920, marginTop: 28 }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>
        Voeg je digitale tankpas toe aan je Wallet
      </h1>

      <p style={{ color: "#475569", marginBottom: 18 }}>
        {!status.linked && <>We koppelen je bank (<b>{status.bank?.toUpperCase?.() || "… wachten op koppeling"}</b>). Dit kan enkele seconden duren…</>}
        {status.linked && !isReady && <>Bank <b>{status.bank?.toUpperCase?.()}</b> is gekoppeld. Je pas wordt aangemaakt…</>}
        {isReady && <>Bank <b>{status.bank?.toUpperCase?.()}</b> is gekoppeld. Je pas is klaar om toe te voegen.</>}
      </p>

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

          <div style={{ display: "grid", gap: 12 }}>
            <button
              className="btn"
              onClick={primaryCtaAction}
              disabled={!isReady || busy}
              style={{
                background: isReady ? (isApple ? "#000" : "#fff") : "#cbd5e1",
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

            {/* Secondary CTA toont de andere wallet-optie */}
            <button
              className="btn btn-outline"
              onClick={isApple ? addGoogle : addApple}
              disabled={!isReady || busy}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "12px 16px",
                fontWeight: 800,
                background: "#fff",
                color: "#111827",
                opacity: isReady ? 1 : 0.6,
              }}
            >
              {isApple ? "➤ Voeg toe aan Google Wallet" : " Voeg toe aan Apple Wallet"}
            </button>

            <button
              className="btn"
              onClick={addGeneric}
              disabled={!status.linked || busy}
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

            <div style={{ fontSize: 13, color: "#64748b" }}>
              Problemen? Zie de <Link to="/faq">FAQ</Link> of neem <Link to="/contact">contact</Link> op.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Link
                to="/app"
                className="btn"
                style={{ background: "#2563eb", color: "#fff", borderRadius: 10, padding: "10px 14px", fontWeight: 800 }}
              >
                Naar dashboard
              </Link>
              <Link to="/" className="btn btn-outline">Later doen</Link>
            </div>
          </div>
        </div>
      </div>

      <ul style={{ marginTop: 18, color: "#475569", lineHeight: 1.6 }}>
        <li>📍 Zie tankstations, prijzen en acties in de buurt.</li>
        <li>💳 Betaal contactloos met je digitale tankpas.</li>
        <li>📈 Direct inzicht in transacties & kortingen.</li>
      </ul>

      {/* Debug mini-blokje (optioneel zichtbaar houden) */}
      <div style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>
        <div>API_BASE: <code>{API_BASE}</code></div>
        {links.genericUrl && <div>Laatste wallet-link: <code>{links.genericUrl}</code></div>}
      </div>
    </div>
  );
}
