// frontend/src/pages/partner/OffersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import OfferCard from "../../components/OfferCard.jsx";
import {
  listOffers,
  listOfferTemplates,
  createOffer,
  updateOffer,
  toggleOffer,
  uploadImage, // optioneel; als je endpoint nog niet bestaat, laat je de uploadknop gewoon weg
} from "../../api/partner.js";

const WEEKDAYS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
const STATUSES = ["all", "active", "scheduled", "paused", "draft", "archived"];

function WeekdayChips({ value = [], onChange }) {
  const setToggle = (idx) => {
    const has = value.includes(idx);
    const next = has ? value.filter((v) => v !== idx) : [...value, idx];
    onChange?.(next.sort((a, b) => a - b));
  };
  return (
    <div className="chips" style={{ marginTop: 6 }}>
      {WEEKDAYS.map((l, i) => (
        <button
          key={i}
          type="button"
          className={`chip ${value.includes(i) ? "on" : ""}`}
          onClick={() => setToggle(i)}
          title={l}
        >
          {l[0]}
        </button>
      ))}
    </div>
  );
}

function EditorModal({ open, onClose, offer, onSave }) {
  const [form, setForm] = useState(offer || {});
  useEffect(() => setForm(offer || {}), [offer]);
  if (!open) return null;

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadImage(file);
      set("image_url", url);
    } catch (err) {
      alert("Upload mislukt: " + (err?.message || ""));
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.35)",
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="card card--white" style={{ maxWidth: 780, width: "100%", borderRadius: 18 }}>
        <div className="p-4" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Actie bewerken</h2>
            <button className="btn" onClick={onClose}>Sluiten</button>
          </div>

          <label className="row">
            <span>Titel</span>
            <input
              className="input"
              value={form.title || ""}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Titel van de actie"
            />
          </label>

          <label className="row">
            <span>Omschrijving</span>
            <textarea
              className="input"
              rows={4}
              value={form.body || ""}
              onChange={(e) => set("body", e.target.value)}
              placeholder="Beschrijving, voorwaarden, etc."
            />
          </label>

          <label className="row">
            <span>Badge</span>
            <input
              className="input"
              value={form.badge || ""}
              onChange={(e) => set("badge", e.target.value)}
              placeholder="Nieuw, Actie, 2ct korting…"
            />
          </label>

          <div className="row">
            <span>Afbeelding</span>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                className="input"
                value={form.image_url || ""}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://…"
              />
              {typeof uploadImage === "function" && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="file" accept="image/*" onChange={handleFile} />
                  {form.image_url && (
                    <img src={form.image_url} alt="" style={{ height: 48, borderRadius: 8 }} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="row">
            <span>Status</span>
            <select
              className="input"
              value={(form.status || "draft").toLowerCase()}
              onChange={(e) => set("status", e.target.value)}
            >
              <option value="draft">Concept</option>
              <option value="scheduled">Gepland</option>
              <option value="active">Actief</option>
              <option value="paused">Gepauzeerd</option>
              <option value="archived">Gearchiveerd</option>
            </select>
          </div>

          <div className="row">
            <span>Weekdagen</span>
            <WeekdayChips value={Array.isArray(form.weekdays) ? form.weekdays : []} onChange={(v) => set("weekdays", v)} />
          </div>

          <div className="row">
            <span>Periode</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input
                className="input"
                type="datetime-local"
                value={form.starts_at ? new Date(form.starts_at).toISOString().slice(0, 16) : ""}
                onChange={(e) => set("starts_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
              <input
                className="input"
                type="datetime-local"
                value={form.ends_at ? new Date(form.ends_at).toISOString().slice(0, 16) : ""}
                onChange={(e) => set("ends_at", e.target.value ? new Date(e.target.value).toISOString() : null)}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button className="btn" onClick={onClose}>Annuleren</button>
            <button
              className="btn btn-primary"
              onClick={() => onSave?.(form)}
            >
              Opslaan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OffersPage() {
  // Je kunt hier je echte station-lijst injecteren. Voor nu: simpele 1..3.
  const [stationId, setStationId] = useState(1);
  const [status, setStatus] = useState("all");
  const [onlyCurrent, setOnlyCurrent] = useState(false);

  const [offers, setOffers] = useState([]);
  const [templates, setTemplates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // huidig offer in modal
  const [modalOpen, setModalOpen] = useState(false);

  // laden
  async function load() {
    setLoading(true);
    try {
      const [o, t] = await Promise.all([
        listOffers({
          station_id: stationId,
          status: status === "all" ? undefined : status,
          only_current: onlyCurrent || undefined,
        }),
        listOfferTemplates().catch(() => []),
      ]);
      setOffers(o || []);
      setTemplates(t || []);
    } catch (e) {
      console.error(e);
      alert("Kon aanbiedingen niet laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, status, onlyCurrent]);

  // Nieuwe actie (leeg)
  function newOffer() {
    setEditing({
      station_id: stationId,
      title: "",
      body: "",
      badge: "",
      status: "draft",
      weekdays: [],
      starts_at: null,
      ends_at: null,
      image_url: "",
    });
    setModalOpen(true);
  }

  // Nieuwe actie vanuit sjabloon
  async function createFromTemplate(tpl) {
    if (!tpl) return;
    try {
      const created = await createOffer({
        station_id: stationId,
        title: tpl.title,
        body: tpl.body || "",
        image_url: tpl.image_url || null,
        badge: tpl.badge || null,
        status: "draft",
        template_key: tpl.template_key || null,
      });
      setEditing(created);
      setModalOpen(true);
      await load();
    } catch (e) {
      alert("Aanmaken vanuit sjabloon mislukt");
    }
  }

  // Opslaan vanuit modal: create of update
  async function save(form) {
    try {
      if (form.id) {
        const updated = await updateOffer(form.id, form);
        // vervang in lijst
        setOffers((list) => list.map((o) => (o.id === updated.id ? updated : o)));
      } else {
        const created = await createOffer(form);
        setOffers((list) => [created, ...list]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      alert("Opslaan mislukt");
    }
  }

  // Toggle status active<->paused
  async function onToggle(offer) {
    try {
      const updated = await toggleOffer(offer.id);
      setOffers((list) => list.map((o) => (o.id === updated.id ? updated : o)));
    } catch (e) {
      alert("Toggle mislukt");
    }
  }

  const filtered = useMemo(() => offers, [offers]);

  return (
    <div className="container">
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        {/* Sidebar (simpel) */}
        <aside className="card" style={{ padding: 12, borderRadius: 16 }}>
          <div style={{ fontWeight: 800, margin: "4px 0 8px" }}>Partner Portal</div>
          <div style={{ display: "grid", gap: 8 }}>
            <a className="nav-link" href="/partner/prices">⛽ Prijzen</a>
            <a className="nav-link active" href="/partner/offers">🏷️ Acties & deals</a>
            <a className="nav-link" href="/partner/settings">⚙️ Instellingen</a>
          </div>
        </aside>

        {/* Content */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 style={{ margin: 0 }}>Acties & Deals</h1>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={newOffer}>Nieuwe actie</button>

              <div className="btn">
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    const tpl = templates[idx];
                    if (tpl) createFromTemplate(tpl);
                    e.target.selectedIndex = 0; // reset label
                  }}
                  style={{ border: "none", background: "transparent", outline: "none" }}
                >
                  <option value="">+ Snel uit sjabloon…</option>
                  {templates.map((t, i) => (
                    <option key={t.template_key || i} value={i}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ padding: 12, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Station</span>
                <select
                  className="input"
                  value={stationId}
                  onChange={(e) => setStationId(Number(e.target.value))}
                  style={{ width: 140 }}
                >
                  <option value={1}>Station 1</option>
                  <option value={2}>Station 2</option>
                  <option value={3}>Station 3</option>
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Status</span>
                <select
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: 160 }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "Alle" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={!!onlyCurrent}
                  onChange={(e) => setOnlyCurrent(e.target.checked)}
                />
                Alleen nu geldig
              </label>

              <button className="btn" onClick={load}>Verversen</button>
            </div>
          </div>

          {/* Grid */}
          <div className="offer-grid" style={{ marginTop: 16 }}>
            {loading && <div className="card p-4">Laden…</div>}
            {!loading && filtered.length === 0 && (
              <div className="card p-4">Nog geen acties voor dit filter.</div>
            )}

            {!loading &&
              filtered.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onToggle={() => onToggle(offer)}
                  onEdit={() => {
                    setEditing(offer);
                    setModalOpen(true);
                  }}
                />
              ))}
          </div>
        </section>
      </div>

      <EditorModal
        open={modalOpen}
        offer={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </div>
  );
}
