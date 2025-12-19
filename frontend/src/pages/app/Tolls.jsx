// src/pages/Toll.jsx
import React, { useMemo, useState } from "react";

/* Kleine inline iconen (SVG) zodat we geen libs nodig hebben */
const IconDownload = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" />
    <path d="M7 10l5 5 5-5M12 15V3" strokeWidth="2" />
  </svg>
);
const IconInfo = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" strokeWidth="2" />
    <path d="M12 16v-4M12 8h.01" strokeWidth="2" />
  </svg>
);

/* Demo-data (later vervangen door API) */
const MOCK = [
  { id: "T-2401", route: "A1 Eemnes → Deventer",   date: "12 okt 2025", amount: 4.60, status: "Betaald" },
  { id: "T-2402", route: "Kiltunnel Dordrecht",     date: "16 okt 2025", amount: 2.10, status: "Openstaand" },
  { id: "T-2403", route: "Westerscheldetunnel",     date: "20 okt 2025", amount: 5.00, status: "In behandeling" },
  { id: "T-2391", route: "A9 Gaasperdammerweg",     date: "05 okt 2025", amount: 8.75, status: "Herinnering" },
];

const STATUS_STYLES = {
  Openstaand:        "bg-orange-100 text-orange-700",
  "In behandeling":  "bg-blue-100 text-blue-700",
  Betaald:           "bg-green-100 text-green-700",
  Herinnering:       "bg-red-100 text-red-700",
};

export default function TollPage() {
  const [filter, setFilter] = useState("Alle");

  const totals = useMemo(() => ({
    open:   MOCK.filter(x => x.status === "Openstaand").reduce((s,x)=>s+x.amount,0),
    paid:   MOCK.filter(x => x.status === "Betaald").reduce((s,x)=>s+x.amount,0),
    proc:   MOCK.filter(x => x.status === "In behandeling").reduce((s,x)=>s+x.amount,0),
    warn:   MOCK.filter(x => x.status === "Herinnering").reduce((s,x)=>s+x.amount,0),
  }), []);

  const rows = useMemo(
    () => (filter === "Alle" ? MOCK : MOCK.filter(x => x.status === filter)),
    [filter]
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header + uitleg */}
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Tolbetalingen</h1>
        <p className="text-gray-600">
          Met FuelLinq worden tolwegen, bruggen en tunnels automatisch herkend en aan je account
          gekoppeld. Op deze pagina vind je een compleet overzicht van je tolritten, inclusief
          status, datum, traject en bedrag.
        </p>
        <p className="text-gray-500 mt-1">
          Je kunt hier facturen downloaden, openstaande posten betalen en herinneringen inzien.
        </p>
      </header>

      {/* Status-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Openstaand" value={`€ ${totals.open.toFixed(2)}`} hint="Nog te betalen" />
        <StatCard label="Betaald" value={`€ ${totals.paid.toFixed(2)}`} hint="Afgerond" />
        <StatCard label="In behandeling" value={`€ ${totals.proc.toFixed(2)}`} hint="Verwerking tolbeheer" />
        <StatCard label="Herinnering / Boete" value={`€ ${totals.warn.toFixed(2)}`} hint="Actie vereist" />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {["Alle","Openstaand","In behandeling","Betaald","Herinnering"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              "px-3 py-1.5 text-sm rounded-full border " +
              (filter===s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <TH>Datum</TH>
              <TH>Traject</TH>
              <TH>Referentie</TH>
              <TH>Bedrag</TH>
              <TH>Status</TH>
              <th className="px-6 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <TD>{r.date}</TD>
                <TD>{r.route}</TD>
                <TD className="font-mono text-xs text-gray-600">{r.id}</TD>
                <TD>€ {r.amount.toFixed(2)}</TD>
                <TD>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                    {r.status}
                  </span>
                </TD>
                <td className="px-6 py-3 text-right">
                  <button className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <IconDownload /> Download
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Geen resultaten voor deze filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800">
        <IconInfo />
        <div className="text-sm">
          <p>
            Openstaande ritten kun je straks direct betalen via je FuelLinq-wallet. Je
            volledige tolhistorie exporteer je als <strong>PDF</strong> of <strong>Excel</strong>.
          </p>
          <p className="mt-1">
            Tip: voeg je kenteken en automatische incasso toe om herinneringen en boetes te voorkomen.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Kleine UI helpers (Tailwind) */
function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl shadow-sm bg-white border border-gray-100 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{hint}</p>
    </div>
  );
}
function TH({ children }) {
  return <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500">{children}</th>;
}
function TD({ children }) {
  return <td className="px-6 py-3 text-sm text-gray-700">{children}</td>;
}
