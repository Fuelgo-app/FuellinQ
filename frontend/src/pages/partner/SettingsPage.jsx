// src/pages/partner/StationsPage.jsx
import React, { useEffect, useState } from "react";
import { API_BASE } from "../../api/partner"; // alleen voor base URL

/* ====== Kleine helpers (zonder afhankelijkheid van partner.js) ====== */
const token = () => localStorage.getItem("token") || "";

async function apiJson(path, opts = {}) {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || `${opts.method || "GET"} ${path} failed`);
  return data;
}

/* Back-end mapping:
   UI: {title, address, city, zip, country, latitude, longitude}
   API verwacht: {street, house_number?, postcode, city, country, lat, lng}
*/
function uiFromApi(row) {
  return {
    id: row.id,
    title: row.title || "",
    address:
      row.address ||                          // oude veldnaam (als die nog bestaat)
      [row.street, row.house_number].filter(Boolean).join(" ") || "",
    city: row.city || "",
    zip: row.zip || row.postcode || "",
    country: row.country || "NL",
    latitude: row.latitude ?? row.lat ?? "",
    longitude: row.longitude ?? row.lng ?? "",
  };
}

function apiFromUi(ui) {
  // simpele splits: “Ambachtsweg 12” → street="Ambachtsweg", house_number="12"
  let street = ui.address?.trim() || "";
  let house_number = null;
  const m = street.match(/^(.*\S)\s+(\d+[A-Za-z\-]*)$/);
  if (m) {
    street = m[1];
    house_number = m[2];
  }
  return {
    title: (ui.title || "").trim(),
    street: street || null,
    house_number,
    postcode: (ui.zip || "").trim() || null,
    city: (ui.city || "").trim() || null,
    country: (ui.country || "").trim() || "NL",
    lat: ui.latitude === "" ? null : Number(ui.latitude),
    lng: ui.longitude === "" ? null : Number(ui.longitude),
  };
}

/* ====== Pagina ====== */
export default function StationsPage() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // formulier state voor nieuw station
  const [form, setForm] = useState({
    title: "",
    address: "",
    city: "",
    zip: "",
    country: "NL",
    latitude: "",
    longitude: "",
  });
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function load() {
    setLoading(true);
    setMsg("");
    try {
      // eigen stations (auth)
      const j = await apiJson(`/api/stations`);
      const list = Array.isArray(j?.stations) ? j.stations : (Array.isArray(j) ? j : []);
      setStations(list.map(uiFromApi));
    } catch (e) {
      setMsg(e.message || "Kon stations niet laden");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const payload = apiFromUi(form);
      if (!payload.title) return setMsg("Geef een naam/titel op.");
      await apiJson(`/api/stations`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setForm({
        title: "",
        address: "",
        city: "",
        zip: "",
        country: "NL",
        latitude: "",
        longitude: "",
      });
      await load();
      setMsg("Station opgeslagen ✅");
    } catch (e2) {
      setMsg(e2.message || "Opslaan mislukt");
    }
  }

  async function saveInline(s) {
    try {
      const payload = apiFromUi(s);
      await apiJson(`/api/stations/${s.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setMsg("Bijgewerkt ✅");
    } catch (e) {
      setMsg(e.message || "Bijwerken mislukt");
    }
  }

  async function removeStation(id) {
    if (!confirm("Weet je zeker dat je dit station wil verwijderen?")) return;
    try {
      await apiJson(`/api/stations/${id}`, { method: "DELETE" });
      setStations((rows) => rows.filter((r) => r.id !== id));
      setMsg("Verwijderd ✅");
    } catch (e) {
      setMsg(e.message || "Verwijderen mislukt");
    }
  }

  return (
    <div className="container">
      <h1 style={{ margin: 0 }}>Tankstations</h1>

      {/* Nieuw station */}
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Nieuw station toevoegen</h3>
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="input" placeholder="Titel/Naam *"
              value={form.title} onChange={(e)=>set("title", e.target.value)} />
            <input className="input" placeholder="Adres (straat + nr)"
              value={form.address} onChange={(e)=>set("address", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <input className="input" placeholder="Plaats"
              value={form.city} onChange={(e)=>set("city", e.target.value)} />
            <input className="input" placeholder="Postcode"
              value={form.zip} onChange={(e)=>set("zip", e.target.value)} />
            <input className="input" placeholder="Land (bv. NL)"
              value={form.country} onChange={(e)=>set("country", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="input" placeholder="Latitude"
              value={form.latitude} onChange={(e)=>set("latitude", e.target.value)} />
            <input className="input" placeholder="Longitude"
              value={form.longitude} onChange={(e)=>set("longitude", e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit">Opslaan</button>
            {msg && <div className="muted" style={{ alignSelf:"center" }}>{msg}</div>}
          </div>
        </form>
      </div>

      {/* Lijst */}
      <div className="card" style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 style={{ marginTop: 0 }}>Mijn stations</h3>
          <button className="btn" onClick={load} disabled={loading}>Verversen</button>
        </div>

        {loading ? (
          <div className="p-4">Laden…</div>
        ) : stations.length === 0 ? (
          <div className="p-4 muted">Nog geen stations aangemaakt.</div>
        ) : (
          <div style={{ display:"grid", gap:12 }}>
            {stations.map((s) => (
              <div key={s.id} className="card" style={{ padding:12 }}>
                <div style={{ display:"grid", gap:8, gridTemplateColumns: "1fr 1fr", alignItems:"start" }}>
                  <label style={{ display:"grid", gap:6 }}>
                    <span className="muted">Titel</span>
                    <input className="input"
                      value={s.title}
                      onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, title: e.target.value} : x))} />
                  </label>
                  <label style={{ display:"grid", gap:6 }}>
                    <span className="muted">Adres (straat + nr)</span>
                    <input className="input"
                      value={s.address}
                      onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, address: e.target.value} : x))} />
                  </label>

                  <label style={{ display:"grid", gap:6 }}>
                    <span className="muted">Plaats</span>
                    <input className="input"
                      value={s.city}
                      onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, city: e.target.value} : x))} />
                  </label>
                  <label style={{ display:"grid", gap:6 }}>
                    <span className="muted">Postcode</span>
                    <input className="input"
                      value={s.zip}
                      onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, zip: e.target.value} : x))} />
                  </label>

                  <label style={{ display:"grid", gap:6 }}>
                    <span className="muted">Land</span>
                    <input className="input"
                      value={s.country}
                      onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, country: e.target.value} : x))} />
                  </label>

                  <div style={{ display:"grid", gap:6, gridTemplateColumns:"1fr 1fr" }}>
                    <label style={{ display:"grid", gap:6 }}>
                      <span className="muted">Lat</span>
                      <input className="input"
                        value={s.latitude}
                        onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, latitude: e.target.value} : x))} />
                    </label>
                    <label style={{ display:"grid", gap:6 }}>
                      <span className="muted">Lng</span>
                      <input className="input"
                        value={s.longitude}
                        onChange={(e)=>setStations(prev => prev.map(x => x.id===s.id ? {...x, longitude: e.target.value} : x))} />
                    </label>
                  </div>
                </div>

                <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
                  <button className="btn" onClick={()=>saveInline(stations.find(x=>x.id===s.id))}>Opslaan</button>
                  <button className="btn btn-outline" onClick={()=>removeStation(s.id)}>Verwijderen</button>
                  <div className="muted">ID: {s.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
