import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { listStations, createStation, updateStation } from "../../api/partner.js";

export default function StationsPage() {
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({ title: "", address_line1: "", postcode: "", city: "", country: "NL" });
  const [saving, setSaving] = useState(false);

  async function load() {
    const s = await listStations();
    setStations(s || []);
  }
  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function addStation(e) {
    e?.preventDefault?.();
    if (!form.title) return alert("Naam is verplicht");
    setSaving(true);
    try {
      await createStation(form);
      setForm({ title: "", address_line1: "", postcode: "", city: "", country: "NL" });
      await load();
    } catch (e) {
      alert("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container">
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        <aside className="card" style={{ padding: 12, borderRadius: 16 }}>
          <div style={{ fontWeight: 800, margin: "4px 0 8px" }}>Partner Portal</div>
          <div style={{ display: "grid", gap: 8 }}>
            <NavLink className="nav-link" to="/partner/prices">⛽ Prijzen</NavLink>
            <NavLink className="nav-link" to="/partner/offers">🏷️ Acties & deals</NavLink>
            <NavLink className="nav-link" to="/partner/stations">🏪 Tankstations</NavLink>
            <NavLink className="nav-link" to="/partner/settings">⚙️ Instellingen</NavLink>
          </div>
        </aside>

        <section>
          <h1>Tankstations</h1>

          <div className="card" style={{ padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Nieuw station</h3>
            <form onSubmit={addStation} style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <input className="input" placeholder="Naam" value={form.title} onChange={(e)=>set("title", e.target.value)} />
              <input className="input" placeholder="Adres" value={form.address_line1} onChange={(e)=>set("address_line1", e.target.value)} />
              <input className="input" placeholder="Postcode" value={form.postcode} onChange={(e)=>set("postcode", e.target.value)} />
              <input className="input" placeholder="Plaats" value={form.city} onChange={(e)=>set("city", e.target.value)} />
              <input className="input" placeholder="Land (bv NL)" value={form.country} onChange={(e)=>set("country", e.target.value)} />
              <div>
                <button className="btn btn-primary" disabled={saving} type="submit">{saving? "Opslaan…" : "Opslaan"}</button>
              </div>
            </form>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Jouw stations</h3>
            {stations.length === 0 && <div className="muted">Nog geen stations.</div>}
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
              {stations.map((s) => (
                <div key={s.id} className="card" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{s.title}</div>
                  <div className="muted">{[s.address_line1, s.postcode, s.city].filter(Boolean).join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
