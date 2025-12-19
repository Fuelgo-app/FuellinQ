// src/pages/partner/OffersPage.jsx
// (componentnaam PartnerOffers – prima om zo te laten)
import React, { useEffect, useMemo, useState } from "react";
import PartnerLayout from "../../components/PartnerLayout.jsx";
import { API_BASE } from "../../api/partner.js"; // alleen voor base URL

/* ====== Auth headers (zelfde patroon als StationsPage) ====== */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return {
    Authorization: `Bearer ${token}`,
    ...(extra || {}),
  };
}

/* ====== Kleine fetch helper ====== */
async function apiJson(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `${method} ${path} failed`);
  return data;
}

/* ====== Types & helpers ====== */
const emptyOffer = {
  title: "",
  subtitle: "",
  price: "",
  compare_at_price: "",
  badge: "",
  image_url: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

function statusPill(active) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${active ? "#10b981" : "#e5e7eb"}`,
        background: active ? "rgba(16,185,129,.08)" : "#fff",
        color: active ? "#065f46" : "#111827",
        fontWeight: 600,
      }}
    >
      {active ? "Actief" : "Gepauzeerd"}
    </span>
  );
}

/* ====== Re-usable Card (zelfde look & feel als PartnerPortal) ====== */
function Card({ title, right, children, style }) {
  return (
    <div
      className="partner-card"
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 16px rgba(2,6,23,.06)",
        ...style,
      }}
    >
      {(title || right) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          {title ? (
            <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{title}</h3>
          ) : (
            <span />
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

/* ====== Formulier component ====== */
function OfferForm({ value, onChange, onSubmit, onCancel, saving }) {
  const v = value || emptyOffer;

  function setField(k, val) {
    onChange({ ...v, [k]: val });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Titel
          </label>
          <input
            value={v.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Bijv. 2x Red Bull voor €3,99"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Subtitel (kort)
          </label>
          <input
            value={v.subtitle}
            onChange={(e) => setField("subtitle", e.target.value)}
            placeholder="Bijv. Alleen deze week"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Prijs (nu)
          </label>
          <input
            value={v.price}
            onChange={(e) => setField("price", e.target.value)}
            placeholder="3.99"
            inputMode="decimal"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Vergelijkprijs (was)
          </label>
          <input
            value={v.compare_at_price}
            onChange={(e) => setField("compare_at_price", e.target.value)}
            placeholder="5.00"
            inputMode="decimal"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Badge (optioneel)
          </label>
          <input
            value={v.badge}
            onChange={(e) => setField("badge", e.target.value)}
            placeholder="NIEUW • DEAL • 2-PACK"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Afbeelding URL
          </label>
          <input
            value={v.image_url}
            onChange={(e) => setField("image_url", e.target.value)}
            placeholder="/assets/offers/redbull-2pack.png of https://…"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Start datum/tijd
          </label>
          <input
            type="datetime-local"
            value={v.starts_at}
            onChange={(e) => setField("starts_at", e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
            Eind datum/tijd
          </label>
          <input
            type="datetime-local"
            value={v.ends_at}
            onChange={(e) => setField("ends_at", e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="is_active"
            type="checkbox"
            checked={!!v.is_active}
            onChange={(e) => setField("is_active", e.target.checked)}
          />
          <label htmlFor="is_active" style={{ fontSize: 14 }}>Actief</label>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" disabled={saving} style={btnPrimary}>
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} style={btnGhost}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

/* ====== Hoofdpagina ====== */
export default function PartnerOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [editing, setEditing] = useState(null); // nieuw of bestaand record
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  async function fetchOffers() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiJson(`/api/partner/offers`);
      setOffers(Array.isArray(data) ? data : data?.rows || []);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Kon aanbiedingen niet laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOffers();
  }, []);

  const filtered = useMemo(() => {
    let rows = offers || [];
    if (onlyActive) rows = rows.filter((r) => r.is_active !== false);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      rows = rows.filter((r) =>
        [r.title, r.subtitle, r.badge]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(t))
      );
    }
    return rows;
  }, [offers, q, onlyActive]);

  /* ====== CRUD ====== */
  async function saveOffer() {
    if (!editing) return;
    setSaving(true);
    setErr("");
    try {
      const payload = {
        title: editing.title?.trim(),
        subtitle: editing.subtitle?.trim(),
        price: editing.price === "" ? null : Number(editing.price),
        compare_at_price:
          editing.compare_at_price === "" ? null : Number(editing.compare_at_price),
        badge: editing.badge?.trim() || null,
        image_url: editing.image_url?.trim() || null,
        starts_at: editing.starts_at || null,
        ends_at: editing.ends_at || null,
        is_active: !!editing.is_active,
      };

      if (editing.id) {
        await apiJson(`/api/partner/offers/${editing.id}`, {
          method: "PUT",
          body: payload,
        });
      } else {
        await apiJson(`/api/partner/offers`, { method: "POST", body: payload });
      }
      await fetchOffers();
      setEditing(null);
    } catch (e) {
      console.error(e);
      setErr(e.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function removeOffer(id) {
    if (!id) return;
    setDeletingId(id);
    setErr("");
    try {
      await apiJson(`/api/partner/offers/${id}`, { method: "DELETE" });
      await fetchOffers();
    } catch (e) {
      console.error(e);
      setErr(e.message || "Verwijderen mislukt");
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleActive(row) {
    try {
      await apiJson(`/api/partner/offers/${row.id}`, {
        method: "PUT",
        body: { is_active: !row.is_active },
      });
      setOffers((prev) =>
        prev.map((o) => (o.id === row.id ? { ...o, is_active: !row.is_active } : o))
      );
    } catch (e) {
      console.error(e);
      setErr(e.message || "Kon status niet wijzigen");
    }
  }

  return (
    <PartnerLayout title="Aanbiedingen">
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 12px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Aanbiedingen</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setEditing({ ...emptyOffer })}
              style={btnPrimary}
            >
              + Nieuwe aanbieding
            </button>
          </div>
        </div>

        {/* Filters / zoek */}
        <Card
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op titel, badge…"
                style={{ ...inputStyle, width: 260 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                Alleen actieve
              </label>
            </div>
          }
        >
          <div style={{ color: "#4b5563", fontSize: 14 }}>
            Beheer je shop- en shopfloor-deals. Voeg een afbeelding toe (URL),
            stel prijzen en geldigheid in en schakel ze aan/uit. Tip: zet je assets in
            <code style={codeStyle}> /public/offers/…</code> of een CDN-link.
          </div>
        </Card>

        {/* Lijst */}
        {err && (
          <div style={alertStyle}>
            {err}
          </div>
        )}

        {loading ? (
          <Card><div>Bezig met laden…</div></Card>
        ) : filtered.length === 0 ? (
          <Card><div>Geen aanbiedingen gevonden.</div></Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
              marginTop: 12,
            }}
          >
            {filtered.map((row) => (
              <Card
                key={row.id || row.title}
                right={statusPill(row.is_active !== false)}
                style={{ overflow: "hidden" }}
                title={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {row.title || "Zonder titel"}
                  </span>
                }
              >
                <div style={{ display: "grid", gap: 10 }}>
                  {/* Afbeelding */}
                  {row.image_url ? (
                    <div
                      style={{
                        borderRadius: 12,
                        overflow: "hidden",
                        border: "1px solid #f1f5f9",
                        background: "#fafafa",
                        aspectRatio: "16/9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={row.image_url}
                        alt={row.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1px dashed #e5e7eb",
                        background: "#fafafa",
                        height: 140,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9ca3af",
                        fontSize: 13,
                      }}
                    >
                      Geen afbeelding
                    </div>
                  )}

                  {/* Pricing / meta */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {row.price !== null && row.price !== undefined && row.price !== "" && (
                      <div style={{ fontSize: 20, fontWeight: 800 }}>
                        €{formatMoney(row.price)}
                      </div>
                    )}
                    {row.compare_at_price && (
                      <div style={{ fontSize: 14, color: "#6b7280", textDecoration: "line-through" }}>
                        €{formatMoney(row.compare_at_price)}
                      </div>
                    )}
                    {row.badge && (
                      <span style={{ ...pillStyle, marginLeft: "auto" }}>{row.badge}</span>
                    )}
                  </div>

                  {row.subtitle && (
                    <div style={{ color: "#4b5563", fontSize: 14 }}>{row.subtitle}</div>
                  )}

                  {/* Geldigheid */}
                  {(row.starts_at || row.ends_at) && (
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {row.starts_at ? `Start: ${humanDT(row.starts_at)}` : null}
                      {row.starts_at && row.ends_at ? " • " : null}
                      {row.ends_at ? `Eind: ${humanDT(row.ends_at)}` : null}
                    </div>
                  )}

                  {/* Acties */}
                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => setEditing({ ...row })}
                      style={btnSecondary}
                    >
                      Bewerken
                    </button>
                    <button
                      onClick={() => toggleActive(row)}
                      style={btnGhost}
                      title={row.is_active ? "Pauzeren" : "Activeren"}
                    >
                      {row.is_active ? "Pauzeren" : "Activeren"}
                    </button>
                    <button
                      onClick={() => {
                        if (!row.id) return;
                        if (confirm("Weet je zeker dat je deze aanbieding wilt verwijderen?")) {
                          removeOffer(row.id);
                        }
                      }}
                      style={{ ...btnDanger, marginLeft: "auto", opacity: deletingId === row.id ? 0.6 : 1 }}
                      disabled={deletingId === row.id}
                    >
                      {deletingId === row.id ? "Verwijderen…" : "Verwijderen"}
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Drawer / Modal voor create/edit (simpel inline) */}
        {editing && (
          <div style={modalWrap}>
            <div style={modalCard}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {editing.id ? "Aanbieding bewerken" : "Nieuwe aanbieding"}
                </h3>
                <button onClick={() => setEditing(null)} style={btnGhostSmall}>Sluiten</button>
              </div>
              <OfferForm
                value={editing}
                onChange={setEditing}
                onSubmit={saveOffer}
                onCancel={() => setEditing(null)}
                saving={saving}
              />
            </div>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}

/* ====== Styles ====== */
const inputStyle = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 12px",
  outline: "none",
  fontSize: 14,
};

const btnPrimary = {
  background: "#111827",
  color: "#fff",
  border: "1px solid #111827",
  borderRadius: 10,
  fontSize: 14,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};
const btnSecondary = {
  background: "#fff",
  color: "#111827",
  border: "1px solid #111827",
  borderRadius: 10,
  fontSize: 14,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};
const btnGhost = {
  background: "#fff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 14,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 600,
};
const btnGhostSmall = { ...btnGhost, padding: "6px 10px", fontSize: 13 };
const btnDanger = {
  background: "#fff",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: 10,
  fontSize: 14,
  padding: "8px 12px",
  cursor: "pointer",
  fontWeight: 700,
};

const pillStyle = {
  fontSize: 11,
  padding: "2px 8px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontWeight: 700,
};

const codeStyle = {
  marginLeft: 6,
  padding: "2px 6px",
  borderRadius: 6,
  border: "1px solid #e5e7eb",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  background: "#f8fafc",
  fontSize: 12,
};

const alertStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#991b1b",
  fontSize: 14,
};

/* Modal */
const modalWrap = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 50,
};
const modalCard = {
  width: "min(920px, 100%)",
  background: "#fff",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  boxShadow: "0 20px 60px rgba(2,6,23,.35)",
  padding: 16,
};

/* ====== util ====== */
function humanDT(dt) {
  try {
    // accepteert ISO string of 'YYYY-MM-DDTHH:mm'
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("nl-NL");
  } catch {
    return dt;
  }
}
