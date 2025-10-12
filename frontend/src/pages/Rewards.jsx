// src/pages/Rewards.jsx
import React, { useEffect, useMemo, useState } from "react";

/* --- API helpers (valt terug op 3001 als VITE_API_URL ontbreekt) --- */
const RAW_API = (import.meta.env?.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");
const getToken = () => (typeof localStorage !== "undefined" ? localStorage.getItem("token") : "");

async function apiGet(path, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken() || ""}` },
    signal,
    credentials: "include",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `GET ${path} failed (${r.status})`);
  return data;
}
async function apiPost(path, body, signal) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() || ""}` },
    body: JSON.stringify(body ?? {}),
    signal,
    credentials: "include",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `POST ${path} failed (${r.status})`);
  return data;
}

/* --- Fallback mock data --- */
function mockData() {
  return {
    summary: {
      points: 820,
      tier: "Silver",
      tierProgress: 0.62,
      nextTier: "Gold",
      pointsToNext: 180,
      monthEarned: 240,
      monthRedeemed: 100,
      vouchers: [
        { id: "fuel-5", title: "€5 brandstofkorting", cost: 500, badge: "Populair" },
        { id: "shop-2", title: "€2 shoptegoed", cost: 250 },
        { id: "coffee", title: "Gratis koffie", cost: 150 },
        { id: "wash-25", title: "25% autowas-korting", cost: 300 },
      ],
      challenges: [
        { id: "wk-chal", title: "3x tanken deze week", progress: 2, goal: 3, reward: "+120 punten" },
        { id: "eco-chal", title: "Eco-tank (E10/B7)", progress: 1, goal: 2, reward: "+60 punten" },
      ],
      referralsLeft: 3,
      inviteCode: "INVITE-7QX3",
    },
    history: [
      { id: "h1", date: "2025-10-01", type: "earn", title: "Tanken bij Shell – €73,69", points: +74 },
      { id: "h2", date: "2025-09-28", type: "earn", title: "Shop aankoop – Red Bull x2", points: +8 },
      { id: "h3", date: "2025-09-25", type: "redeem", title: "Ingeleverd: Gratis koffie", points: -150 },
      { id: "h4", date: "2025-09-20", type: "earn", title: "Tanken bij Total – €42,00", points: +42 },
    ],
  };
}

/* --- Formatters --- */
const fmt = {
  pct: (n) => `${Math.max(0, Math.min(100, Math.round((n || 0) * 100)))}%`,
};

export default function RewardsPage() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const inviteCode = summary?.inviteCode || "INVITE-7QX3";
  const vouchers = useMemo(() => summary?.vouchers ?? [], [summary]);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [s, h] = await Promise.all([
          apiGet("/api/rewards/summary", ctrl.signal),
          apiGet("/api/rewards/history", ctrl.signal),
        ]);
        setSummary(s);
        setHistory(h || []);
      } catch (e) {
        // fallback: mock
        const m = mockData();
        setSummary(m.summary);
        setHistory(m.history);
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, []);

  async function redeem(voucherId) {
    if (!summary) return;
    const v = vouchers.find((x) => x.id === voucherId);
    if (!v) return;

    const afford = (summary.points || 0) >= v.cost;
    if (!afford) return;

    // Optimistic update
    const prevSummary = summary;
    const prevHistory = history;

    const newSummary = {
      ...summary,
      points: (summary.points || 0) - v.cost,
      monthRedeemed: (summary.monthRedeemed || 0) + v.cost,
    };
    const newHistory = [
      { id: `redeem-${Date.now()}`, date: new Date().toISOString().slice(0, 10), type: "redeem", title: `Ingeleverd: ${v.title}`, points: -v.cost },
      ...history,
    ];

    setBusy(true);
    setSummary(newSummary);
    setHistory(newHistory);
    setError("");

    try {
      await apiPost("/api/rewards/redeem", { voucherId }, undefined);
      // eventueel server-respons verwerken (bijv. nieuwe points / voucher code)
    } catch (e) {
      // rollback
      setSummary(prevSummary);
      setHistory(prevHistory);
      setError(e?.message || "Inwisselen mislukt. Probeer het later nog eens.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary && loading) {
    return (
      <div className="rw">
        <Skeleton />
      </div>
    );
  }
  if (!summary) return null;

  return (
    <div className="rw">
      <style>{styles}</style>

      {/* Header */}
      <div className="card h">
        <h2 className="title">Punten & Rewards</h2>
        <div className="sub">Spaar punten bij elke tank- of shoptransactie. Ruil ze in voor korting, koffie of waspassen.</div>

        <div className="balance" role="status" aria-live="polite">
          <div className="pts">{summary.points} punten</div>
          <div className="tier">
            <span className={`badge ${summary.tier?.toLowerCase()}`}>{summary.tier}</span>
            <span className="sub">
              naar <b>{summary.nextTier}</b>: {summary.pointsToNext} punten
            </span>
          </div>
        </div>

        <div className="progress" aria-label="Voortgang naar volgend level">
          <div className="bar">
            <span style={{ width: fmt.pct(summary.tierProgress) }} />
          </div>
          <div className="pmeta">
            <span>Huidige level</span>
            <span>
              {fmt.pct(summary.tierProgress)} richting {summary.nextTier}
            </span>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="label">Deze maand verdiend</div>
            <div className="value">{summary.monthEarned} pt</div>
          </div>
          <div className="kpi">
            <div className="label">Deze maand ingeleverd</div>
            <div className="value">{summary.monthRedeemed} pt</div>
          </div>
          <div className="kpi">
            <div className="label">Gem. punten per tankbeurt</div>
            <div className="value">{Math.max(1, Math.round((summary.monthEarned || 0) / 3))} pt</div>
          </div>
          <div className="kpi">
            <div className="label">Referral over</div>
            <div className="value">{summary.referralsLeft} invite(s)</div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="alert error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {/* Main grid */}
      <div className="row" style={{ marginTop: 16 }}>
        <div className="grid">
          {/* Vouchers */}
          <div className="card h">
            <h3 style={{ margin: 0 }}>Inwisselen</h3>
            <div className="vouchers" style={{ marginTop: 12 }}>
              {(vouchers.length ? vouchers : []).map((v) => {
                const afford = (summary.points || 0) >= v.cost;
                return (
                  <div key={v.id} className="voucher" aria-live="polite">
                    <div>
                      <h4 style={{ margin: 0 }}>{v.title}</h4>
                      <div className="chips" style={{ marginTop: 6 }}>
                        {!!v.badge && <span className="chip">{v.badge}</span>}
                        <span className="chip">
                          Kosten: <b className="cost">{v.cost} pt</b>
                        </span>
                      </div>
                    </div>
                    <button
                      className={`btn ${afford ? "btn-primary" : ""}`}
                      disabled={!afford || busy}
                      onClick={() => redeem(v.id)}
                      aria-disabled={!afford || busy}
                    >
                      {afford ? (busy ? "Bezig..." : "Inwisselen") : "Onvoldoende punten"}
                    </button>
                  </div>
                );
              })}
              {!vouchers.length && <div className="sub">Geen vouchers beschikbaar.</div>}
            </div>
          </div>

          {/* Challenges */}
          <div className="card h">
            <h3 style={{ margin: 0 }}>Challenges</h3>
            <div className="chals" style={{ marginTop: 12 }}>
              {(summary.challenges || []).map((c) => {
                const pct = Math.min(1, (c.progress || 0) / (c.goal || 1));
                return (
                  <div key={c.id} className="chal">
                    <div className="top">
                      <div>
                        <strong>{c.title}</strong>
                        <br />
                        <small className="sub">
                          {c.progress}/{c.goal} voltooid
                        </small>
                      </div>
                      <div className="reward">{c.reward}</div>
                    </div>
                    <div className="progress" style={{ marginTop: 8 }}>
                      <div className="bar">
                        <span style={{ width: fmt.pct(pct) }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {!(summary.challenges || []).length && <div className="sub">Momenteel geen challenges.</div>}
            </div>
          </div>

          {/* Referral */}
          <div className="card h">
            <div className="refer">
              <div className="refer-left">
                <strong>Vriend uitnodigen</strong>
                <div className="sub">Verdien +200 punten per succesvolle aanmelding</div>
              </div>
              <div className="code" aria-label="Invite code">
                {inviteCode}
              </div>
              <button
                className="btn"
                onClick={() => navigator.clipboard?.writeText(inviteCode)}
                title="Kopieer code"
              >
                Kopieer code
              </button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="card h">
          <h3 style={{ marginTop: 0 }}>Activiteit</h3>
          <div className="tablewrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Omschrijving</th>
                  <th className="num">Punten</th>
                </tr>
              </thead>
              <tbody>
                {(!history || history.length === 0) && !loading ? (
                  <tr>
                    <td colSpan={3} style={{ padding: 16, color: "var(--muted,#6b7280)" }}>
                      Nog geen activiteit.
                    </td>
                  </tr>
                ) : (
                  (history || []).map((h) => (
                    <tr key={h.id}>
                      <td>{h.date}</td>
                      <td>{h.title}</td>
                      <td className={`num ${h.points >= 0 ? "pts-pos" : "pts-neg"}`}>{h.points > 0 ? `+${h.points}` : h.points}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="sub" style={{ marginTop: 8 }}>
            Tip: bij tanken verdien je ±1 punt per €1 (shop 0.5 pt/€); acties en challenges geven extra.
          </div>
        </div>
      </div>
    </div>
  );
}

/* --- Loading skeleton --- */
function Skeleton() {
  return (
    <>
      <style>{`
        .s{background:linear-gradient(90deg,#f3f4f6,#e5e7eb,#f3f4f6);background-size:200% 100%;animation:sload 1.2s infinite}
        @keyframes sload{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
      <div className="card h">
        <div className="s" style={{ height: 20, width: 180, borderRadius: 6 }} />
        <div className="s" style={{ height: 28, width: 260, borderRadius: 6, marginTop: 12 }} />
        <div className="s" style={{ height: 12, width: "100%", borderRadius: 999, marginTop: 12 }} />
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <div className="grid">
          <div className="card h">
            <div className="s" style={{ height: 22, width: 160, borderRadius: 6 }} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginTop: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="s" style={{ height: 70, borderRadius: 12 }} />
              ))}
            </div>
          </div>
          <div className="card h">
            <div className="s" style={{ height: 22, width: 160, borderRadius: 6 }} />
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="s" style={{ height: 60, borderRadius: 12 }} />
              ))}
            </div>
          </div>
          <div className="card h">
            <div className="s" style={{ height: 60, borderRadius: 12 }} />
          </div>
        </div>
        <div className="card h">
          <div className="s" style={{ height: 22, width: 160, borderRadius: 6 }} />
          <div className="s" style={{ height: 200, borderRadius: 12, marginTop: 12 }} />
        </div>
      </div>
    </>
  );
}

/* --- Styles --- */
const styles = `
.rw { max-width:1080px; margin:0 auto; }

/* Cards op SURFACE (licht), nooit op card-bg (donker thema) */
.card{
  background: var(--surface,#fff);
  color: var(--text,#0f172a);
  border: 1px solid var(--border,#e5e7eb);
  border-radius: var(--card-radius,16px);
  box-shadow: var(--shadow,0 8px 24px rgba(2,6,23,.06));
}
.h { padding:16px; }
.row { display:grid; grid-template-columns:1.2fr .8fr; gap:16px; }

.title { margin:0; font-size:22px; font-weight:800; }
.sub { color: var(--muted,#64748b); font-size:13px; margin-top:2px; }

.balance { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pts { font-size:32px; font-weight:900; color: var(--brand-primary,#0b3654); }
.tier { display:flex; gap:8px; align-items:center; }
.badge {
  padding:4px 10px; border-radius:999px; font-size:12px; font-weight:800;
  background: var(--brand-secondary,#f58220); color:#fff;
}
.badge.silver { background: linear-gradient(90deg,#cbd5e1,#94a3b8); color:#0b3654; }
.badge.gold   { background: linear-gradient(90deg,#fde68a,#f59e0b); color:#7c2d12; }
.badge.bronze { background: linear-gradient(90deg,#e2b08d,#b87333); color:#4a2800; }

.progress { margin-top:10px; }
.bar{ height:12px; border-radius:999px; background: var(--border,#e5e7eb); overflow:hidden; }
.bar>span{ display:block; height:100%; width:0; background: var(--brand-primary,#0b3654); transition:width .5s; }
.pmeta{ display:flex; justify-content:space-between; margin-top:6px; font-size:12px; color: var(--muted,#64748b); }

/* KPI tegels */
.kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:12px; }
.kpi{ background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); border-radius:14px; padding:14px; }
.kpi .label{ font-size:12px; color: var(--muted,#64748b); }
.kpi .value{ font-size:20px; font-weight:800; margin-top:2px; color: var(--brand-primary,#0b3654); }

/* Vouchers */
.grid{ display:grid; grid-template-columns:1fr; gap:16px; }
.vouchers{ display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.voucher{
  background: var(--surface,#fff);
  border:1px dashed var(--border,#cbd5e1);
  border-radius:14px; padding:14px;
  display:flex; gap:10px; align-items:center; justify-content:space-between;
}
.voucher h4{ margin:0; font-size:15px; }
.chips{ display:flex; gap:6px; }
.chip{
  font-size:11px; padding:3px 8px; border-radius:999px;
  background: var(--chip-bg,#eef2ff); color: var(--chip-text,#3730a3);
  border: 1px solid var(--chip-border,transparent);
}
.cost{ font-weight:800; color: var(--text,#111827); }

/* Buttons */
.btn{
  height:34px; padding:0 12px; border-radius: var(--btn-radius,10px);
  border:1px solid var(--border,#e5e7eb);
  background: var(--chip-bg,#fff); color: var(--text,#0f172a);
  font-weight:700; cursor:pointer;
}
.btn-primary{ background: var(--btn-bg,var(--brand-primary,#0b3654)); color: var(--btn-text,#fff); border-color:transparent; }
.btn:disabled{ opacity:.6; cursor:not-allowed; }

/* Challenges */
.chals{ display:grid; gap:10px; }
.chal{ background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); border-radius:14px; padding:12px; }
.chal .top{ display:flex; justify-content:space-between; align-items:center; gap:10px; }
.chal .reward{
  font-size:12px; padding:3px 8px; border-radius:999px;
  background: var(--success-bg,#f0fdf4); color: var(--success-text,#166534); font-weight:800;
}
.chal .bar{ height:8px; }

/* Referral */
.refer{ display:flex; gap:12px; align-items:center; justify-content:space-between; }
.refer-left{ min-width: 0; }
.code{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  background:#0b1220; color:#fff; padding:6px 10px; border-radius:8px; letter-spacing:.5px;
}

/* Tabel */
.tablewrap{ overflow:auto; border:1px solid var(--border,#e5e7eb); border-radius:12px; }
table{ width:100%; border-collapse:separate; border-spacing:0; }
thead th{
  position:sticky; top:0;
  background: var(--surface,#fff);
  color:#475569; text-align:left; padding:10px 12px;
  border-bottom:1px solid var(--border,#e5e7eb); font-size:13px;
}
tbody td{ padding:10px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; }
tbody tr:nth-child(even){ background:#fcfcfd; }
.num{ text-align:right; white-space:nowrap; }
.pts-pos{ color: var(--success-text,#166534); font-weight:700; }
.pts-neg{ color: var(--danger-text,#991b1b); font-weight:700; }

/* Alerts */
.alert{ padding:10px 12px; border-radius:10px; border:1px solid; }
.alert.error{ background:#fef2f2; color:#7f1d1d; border-color:#fecaca; }

@media (max-width: 900px){
  .row{ grid-template-columns:1fr; }
  .kpis{ grid-template-columns:1fr 1fr; }
  .vouchers{ grid-template-columns:1fr; }
}
`;
