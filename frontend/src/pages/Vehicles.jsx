// src/pages/Vehicles.jsx
import React from "react";
import { apiFetch } from "@/api/base";

// === Pas deze paden aan jouw backend aan (alleen hier nodig) ===
const API = {
  list:      "/api/partner/vehicles",                 // GET  ?q=&limit=&offset=
  create:    "/api/partner/vehicles",                 // POST {plate, nickname, metadata?}
  remove:    (id) => `/api/partner/vehicles/${id}`,   // DELETE
  setDefault:(id) => `/api/partner/vehicles/${id}/default`, // POST {}
  rdwLookup: (plate) => `/api/rdw/lookup?plate=${encodeURIComponent(plate)}`, // GET
};

// --- helpers ---
function nlPlateFormat(s) {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/(.{2,4})(?=.)/g, "$1-")                 // grove visuele formatter
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function cls(...xs) { return xs.filter(Boolean).join(" "); }

// --- hoofdcomponent ---
export default function VehiclesPage() {
  const [tab, setTab] = React.useState("list");       // 'list' | 'add' | 'import'
  const [items, setItems] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [pageSize] = React.useState(10);
  const [total, setTotal] = React.useState(0);

  // add form
  const [plateRaw, setPlateRaw] = React.useState("");
  const [nickname, setNickname] = React.useState("");
  const [rdw, setRdw] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const plate = React.useMemo(() => nlPlateFormat(plateRaw), [plateRaw]);

  React.useEffect(() => { fetchList(); }, [page, pageSize]); // initial + paginate

  async function fetchList(opts = {}) {
    try {
      setLoading(true); setError("");
      const p = new URLSearchParams();
      if (query) p.set("q", query.trim());
      p.set("limit", String(pageSize));
      p.set("offset", String(page * pageSize));
      const data = await apiFetch(`${API.list}?${p.toString()}`);
      // verwacht vorm: { items: [...], total: 123 } — pas desnoods aan
      setItems(data.items ?? data ?? []);
      setTotal(data.total ?? (data.items?.length ?? 0));
    } catch (e) {
      setError(e.message || "Kon voertuigen niet ophalen.");
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e) {
    e.preventDefault();
    setPage(0);
    await fetchList();
  }

  async function lookupRdw() {
    if (!plate) return;
    try {
      setError("");
      const data = await apiFetch(API.rdwLookup(plate.replace(/-/g, "")));
      setRdw(data || null);
    } catch (e) {
      setRdw(null);
      setError("RDW-lookup mislukt of kenteken onbekend.");
    }
  }

  async function addVehicle(e) {
    e.preventDefault();
    if (!plate) { setError("Vul een geldig kenteken in."); return; }
    setAdding(true); setError("");
    try {
      const body = {
        plate: plate.replace(/-/g, ""),
        nickname: nickname.trim() || undefined,
        rdw: rdw || undefined, // handig om te bewaren op backend (optioneel)
      };
      await apiFetch(API.create, { method: "POST", body: JSON.stringify(body) });
      // reset
      setPlateRaw(""); setNickname(""); setRdw(null);
      setTab("list");
      setPage(0);
      fetchList();
    } catch (e) {
      setError(e.message || "Toevoegen mislukt.");
    } finally {
      setAdding(false);
    }
  }

  async function removeVehicle(id) {
    if (!id) return;
    const ok = confirm("Voertuig verwijderen?");
    if (!ok) return;
    try {
      await apiFetch(API.remove(id), { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      setError(e.message || "Verwijderen mislukt.");
    }
  }

  async function makeDefault(id) {
    try {
      await apiFetch(API.setDefault(id), { method: "POST" });
      // optimistic update: precies één default = true
      setItems((xs) => xs.map((x) => ({ ...x, is_default: x.id === id })));
    } catch (e) {
      setError(e.message || "Kon standaard voertuig niet instellen.");
    }
  }

  const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <div className="container">
      <div className="card">
        <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h1 className="mb-3" style={{ margin: 0 }}>Voertuigen</h1>
          <div className="tabs" style={{ display: "flex", gap: 8 }}>
            <button
              className={cls("btn", tab === "list" && "btn--primary")}
              onClick={() => setTab("list")}
            >Overzicht</button>
            <button
              className={cls("btn", tab === "add" && "btn--primary")}
              onClick={() => setTab("add")}
            >Toevoegen</button>
            {/* Optioneel: bulk import */}
            {/* <button className={cls("btn", tab === "import" && "btn--primary")} onClick={() => setTab("import")}>CSV import</button> */}
          </div>
        </div>

        {error && (
          <div className="p-4" style={{ color: "#b91c1c", background:"#fff0f0", borderTop:"1px solid var(--border)" }}>
            {error}
          </div>
        )}

        {tab === "list" && (
          <div className="p-4">
            <form onSubmit={onSearch} style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input
                className="input"
                placeholder="Zoek op kenteken of naam…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex:1 }}
              />
              <button className="btn" type="submit">Zoeken</button>
              <button className="btn" type="button" onClick={() => { setQuery(""); setPage(0); fetchList(); }}>Reset</button>
            </form>

            <div className="responsive-table">
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ textAlign:"left", borderBottom:"1px solid var(--border)" }}>
                    <th style={{ padding:"8px" }}>Kenteken</th>
                    <th style={{ padding:"8px" }}>Naam</th>
                    <th style={{ padding:"8px" }}>Merk/Type</th>
                    <th style={{ padding:"8px" }}>Brandstof</th>
                    <th style={{ padding:"8px" }}>Standaard</th>
                    <th style={{ padding:"8px", width:140 }}>Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} style={{ padding:"12px" }}>Laden…</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding:"12px" }}>Geen voertuigen gevonden.</td></tr>
                  ) : items.map((v) => (
                    <tr key={v.id} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"8px", fontWeight:600 }}>{formatPlateCell(v.plate)}</td>
                      <td style={{ padding:"8px" }}>{v.nickname || "—"}</td>
                      <td style={{ padding:"8px" }}>
                        {v.make || v.merk || v.rdw?.merk || "—"}{" "}
                        {v.model || v.type || v.rdw?.handelsbenaming ? ` ${v.model || v.type || v.rdw?.handelsbenaming}` : ""}
                      </td>
                      <td style={{ padding:"8px" }}>{v.fuel || v.brandstof || v.rdw?.brandstof_verbruik?.brandstof_omschrijving || "—"}</td>
                      <td style={{ padding:"8px" }}>
                        {v.is_default ? <span className="badge">Ja</span> : "Nee"}
                      </td>
                      <td style={{ padding:"8px", display:"flex", gap:6 }}>
                        {!v.is_default && (
                          <button className="btn btn--ghost" onClick={() => makeDefault(v.id)}>Standaard</button>
                        )}
                        <button className="btn btn--danger" onClick={() => removeVehicle(v.id)}>Verwijder</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4" style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ fontSize:12, color:"var(--muted)" }}>
                Totaal: {total} • Pagina {page + 1} / {Math.max(1, maxPage + 1)}
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn" disabled={page <= 0} onClick={() => setPage(0)}>« Eerste</button>
                <button className="btn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹ Vorige</button>
                <button className="btn" disabled={page >= maxPage} onClick={() => setPage((p) => Math.min(maxPage, p + 1))}>Volgende ›</button>
                <button className="btn" disabled={page >= maxPage} onClick={() => setPage(maxPage)}>Laatste »</button>
              </div>
            </div>
          </div>
        )}

        {tab === "add" && (
          <div className="p-4">
            <form onSubmit={addVehicle} style={{ display:"grid", gap:12, maxWidth:520 }}>
              <label className="mb-1">
                <div>Kenteken (NL)</div>
                <input
                  className="input"
                  value={plateRaw}
                  onChange={(e) => { setPlateRaw(e.target.value); setRdw(null); }}
                  placeholder="XX-99-YY"
                  autoFocus
                />
              </label>

              <div style={{ display:"flex", gap:8 }}>
                <button type="button" className="btn" onClick={lookupRdw} disabled={!plate}>
                  RDW-gegevens ophalen
                </button>
                {rdw ? <span className="badge">Gevonden</span> : <span style={{ color:"var(--muted)", alignSelf:"center" }}>Nog niets opgehaald</span>}
              </div>

              {rdw && (
                <div className="card" style={{ border:"1px solid var(--border)" }}>
                  <div className="p-4">
                    <strong>RDW</strong>
                    <div style={{ fontSize:14, color:"var(--muted)" }}>
                      {rdw.merk || rdw.make || "—"} {rdw.handelsbenaming || rdw.model || ""}
                      {" • "}
                      {rdw.kenteken || plate}
                      {rdw.brandstof_omschrijving ? ` • ${rdw.brandstof_omschrijving}` : ""}
                      {rdw.eerste_toelating ? ` • ET: ${rdw.eerste_toelating}` : ""}
                    </div>
                  </div>
                </div>
              )}

              <label className="mb-1">
                <div>Naam / bijnaam (optioneel)</div>
                <input
                  className="input"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Bijv. Werkbus"
                />
              </label>

              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn--primary" type="submit" disabled={adding}>
                  {adding ? "Toevoegen…" : "Toevoegen"}
                </button>
                <button className="btn btn--ghost" type="button" onClick={() => setTab("list")}>Annuleren</button>
              </div>
            </form>
          </div>
        )}

        {tab === "import" && (
          <div className="p-4">
            <p>CSV-import (optioneel) kan later geactiveerd worden.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- kleine view helpers ---
function formatPlateCell(plate) {
  if (!plate) return "—";
  const p = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  // toon met streepjes
  return nlPlatePretty(p);
}
function nlPlatePretty(p) {
  // eenvoudige pretty-print: XX99YY -> XX-99-YY (houdt geen rekening met ALLE varianten)
  return p.replace(/(.{2,4})(?=.)/g, "$1-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
