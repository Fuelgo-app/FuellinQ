// src/components/CO2Widget.jsx
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "@/api/base.js";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

/**
 * Props:
 *  - scope: "vehicle" | "company"   (verplicht)
 *  - id: string|number              (verplicht)
 *  - months?: number                (default 6)
 *  - pricePerTon?: number           (default 20)
 *  - compact?: boolean              (default false)
 *  - to?: string | (() => void)     (optioneel; click-through)
 *  - className?: string
 */

const getToken = () => localStorage.getItem("token") || "";
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export default function CO2Widget({
  scope = "vehicle",
  id,
  months = 6,
  pricePerTon = 20,
  compact = false,
  to,
  className = "",
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [error, setError] = useState("");

  const valid = (scope === "vehicle" || scope === "company") && id != null && String(id).trim() !== "";

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [r, m] = await Promise.all([
          fetch(`${API_BASE}/api/co2/${scope}/${id}/report?price_per_ton=${pricePerTon}`, { headers: authHeaders() })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || `report ${res.status}`);
              return data;
            }),
          fetch(`${API_BASE}/api/co2/${scope}/${id}/monthly?months=${months}`, { headers: authHeaders() })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || `monthly ${res.status}`);
              return data;
            }),
        ]);
        if (!alive) return;
        setReport(r);
        setMonthly(m);
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [scope, id, months, pricePerTon, valid]);

  const { spark, trendPct } = useMemo(() => {
    const rows = monthly?.rows || [];
    const s = rows.map((x, i) => ({ i, month: x.month, kg: Number(x.kg_co2 || 0) }));
    const l = s.length;
    const last = l ? s[l - 1].kg : null;
    const prev = l > 1 ? s[l - 2].kg : null;
    const pct = prev > 0 ? ((last - prev) / prev) * 100 : (prev === 0 && last > 0 ? 100 : null);
    return { spark: s, trendPct: pct };
  }, [monthly]);

  const fmtNum = (n, dec = 0) => {
    const v = Number(n ?? 0);
    return Number.isFinite(v)
      ? v.toLocaleString("nl-NL", { minimumFractionDigits: dec, maximumFractionDigits: dec })
      : "–";
  };
  const euro = (n) => (typeof n === "number" ? n : Number(n || 0)).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

  const methodLabel = (() => {
    const m = report?.method;
    if (!m) return null;
    if (m === "electric") return "Elektrisch";
    if (m === "wltp") return "WLTP";
    if (m === "fuel_factor") return "Factor";
    return m;
  })();

  const Wrapper = ({ children }) => {
    const clickable = !!to;
    const onClick = () => {
      if (!to) return;
      if (typeof to === "function") return to();
      // default: navigeer met dezelfde filters mee
      window.location.assign(to);
    };
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${clickable ? "cursor-pointer hover:bg-white/10" : ""} ${className}`}
        onClick={onClick}
      >
        {children}
      </div>
    );
  };

  if (!valid) {
    return (
      <Wrapper>
        <div className="text-sm opacity-70">Kies een geldig {scope === "vehicle" ? "vehicleId" : "companyId"}.</div>
      </Wrapper>
    );
  }

  if (loading) {
    return (
      <Wrapper>
        <div className="animate-pulse grid grid-cols-3 gap-3">
          <div className="h-16 rounded-xl bg-white/10" />
          <div className="h-16 rounded-xl bg-white/10" />
          <div className="h-16 rounded-xl bg-white/10" />
          <div className="col-span-3 h-14 mt-3 rounded-xl bg-white/10" />
        </div>
      </Wrapper>
    );
  }

  if (error) {
    return (
      <Wrapper>
        <div className="text-sm text-red-400">Fout: {error}</div>
      </Wrapper>
    );
  }

  if (!report) {
    return <Wrapper><div className="text-sm opacity-70">Geen data.</div></Wrapper>;
  }

  // ---- Compact variant ----
  if (compact) {
    return (
      <Wrapper>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm opacity-70">
            CO₂ – {scope === "vehicle" ? "Voertuig" : "Bedrijf"} #{id}
          </div>
          <div className="flex items-center gap-2">
            {methodLabel ? <Badge tone="info" title={methodLabel} /> : null}
            {typeof trendPct === "number" ? (
              <Badge
                tone={trendPct >= 0 ? "warn" : "ok"}
                title={`${trendPct >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(trendPct), 1)}%`}
              />
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <KPI title="CO₂ (kg)" value={fmtNum(report.kg_co2_total)} />
          <KPI title="g/km" value={report.avg_g_per_km != null ? fmtNum(report.avg_g_per_km) : "–"} />
          <KPI title="km" value={fmtNum(report.km_total)} />
        </div>

        <div className="mt-3 h-14">
          <ResponsiveContainer>
            <LineChart data={spark}>
              <Tooltip labelFormatter={(i) => spark?.[i]?.month || ""} formatter={(v) => [`${fmtNum(v, 0)} kg`, "CO₂"]} />
              <Line type="monotone" dataKey="kg" dot={false} name="CO₂ (kg)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Wrapper>
    );
  }

  // ---- Standaard variant ----
  return (
    <Wrapper>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm opacity-70">
          CO₂ – {scope === "vehicle" ? "Voertuig" : "Bedrijf"} #{id}
        </div>
        <div className="flex items-center gap-2">
          {methodLabel ? <Badge tone="info" title={methodLabel} /> : null}
          {typeof trendPct === "number" ? (
            <Badge
              tone={trendPct >= 0 ? "warn" : "ok"}
              title={`${trendPct >= 0 ? "▲" : "▼"} ${fmtNum(Math.abs(trendPct), 1)}% vs vorige mnd`}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPI title="Kilometers" value={fmtNum(report.km_total)} />
        <KPI
          title="CO₂ (kg)"
          value={fmtNum(report.kg_co2_total)}
          sub={
            report.offset
              ? `~ ${fmtNum(report.offset.tons, 3)} t • ${euro(report.offset.estimated_cost_eur)}`
              : (methodLabel ? `methode: ${methodLabel}` : "")
          }
        />
        <KPI title="Gem. g/km" value={report.avg_g_per_km != null ? fmtNum(report.avg_g_per_km) : "–"} />
      </div>

      <div className="mt-3 h-18">
        <ResponsiveContainer>
          <LineChart data={spark}>
            <Tooltip labelFormatter={(i) => spark?.[i]?.month || ""} formatter={(v) => [`${fmtNum(v, 0)} kg`, "CO₂"]} />
            <Line type="monotone" dataKey="kg" dot={false} name="CO₂ (kg)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 text-[11px] opacity-60">
        {monthly?.months ? `${monthly.months} maand(en)` : ""} • {report.from || "–"} t/m {report.to || "–"}
        {report?.offset ? ` • prijs: €${fmtNum(pricePerTon)} / ton` : ""}
      </div>
    </Wrapper>
  );
}

function KPI({ title, value, sub }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold leading-tight">{value}</div>
      {sub ? <div className="text-[11px] opacity-60 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Badge({ title, tone = "info" }) {
  const tones = {
    info: "bg-blue-600/20 text-blue-200 border-blue-500/40",
    ok: "bg-green-600/20 text-green-200 border-green-500/40",
    warn: "bg-amber-600/20 text-amber-200 border-amber-500/40",
  };
  return (
    <span className={`text-[11px] px-2 py-1 rounded-full border ${tones[tone] || tones.info}`}>
      {title}
    </span>
  );
}
