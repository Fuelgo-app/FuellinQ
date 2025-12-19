// src/pages/partner/OffersEdit.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import PartnerLayout from "../../components/PartnerLayout.jsx";
import { API_BASE } from "../../api/partner.js";

/* ====== Auth + fetch helpers ====== */
function authHeaders(extra = {}) {
  const token = localStorage.getItem("token") || "";
  return { Authorization: `Bearer ${token}`, ...(extra || {}) };
}
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

/* ====== UI helpers ====== */
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
const btnGhost = {
  background: "#fff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  fontSize: 14,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 600,
};
const btnDanger = {
  background: "#fff",
  color: "#b91c1c",
  border: "1px solid #fecaca",
  borderRadius: 10,
  fontSize: 14,
  padding: "10px 12px",
  cursor: "pointer",
  fontWeight: 700,
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
const okStyle = {
  marginTop: 8,
  marginBottom: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #bbf7d0",
  background: "#ecfdf5",
  color: "#065f46",
  fontSize: 14,
};

function Card({ title, right, children, style }) {
  return (
    <div
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          {title ? <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{title}</h3> : <span />}
          {right ?? null}
        </div>
      )}
      {children}
    </div>
  );
}

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}
function humanDT(dt) {
  try {
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("nl-NL");
  } catch { return dt; }
}

/* ====== Component ====== */
export default function OffersEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [stations, setStations] = useState([]);
  const [form, setForm] = useState({
    station_id: "",
    title: "",
    subtitle: "",
    price: "",
    compare_at_price: "",
    badge: "",
    image_url: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  function setField(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  // Load stations + current offer
  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErr(""); setOkMsg("");
      try {
        const [stResp, offerResp] = await Promise.all([
          apiJson("/api/partner/stations").catch(() => []),
          apiJson(`/api/partner/offers/${id}`),
        ]);

        if (!mounted) return;

        const stList = Array.isArray(stResp) ? stResp : (stResp?.stations || stResp?.rows || []);
        setStations(stList || []);

        // Normalize incoming offer to form state
        const o = offerResp || {};
        setForm({
          station_id: o.station_id ?? "",
          title: o.title ?? "",
          subtitle: o.subtitle ?? "",
          price: o.price ?? "",
          compare_at_price: o.compare_at_price ?? "",
          badge: o.badge ?? "",
          image_url: o.image_url ?? "",
          starts_at: normalizeForInputDateTime(o.starts_at),
          ends_at: normalizeForInputDateTime(o.ends_at),
          is_active: o.is_active !== false,
        });
      } catch (e) {
        setErr(e.message || "Kon aanbieding niet laden");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => { mounted = false; };
  }, [id]);

  const preview = useMemo(() => ({
    ...form,
    price_fmt: formatMoney(form.price),
    compare_fmt: formatMoney(form.compare_at_price),
  }), [form]);

  async function handleSave(e) {
    e?.preventDefault?.();
    setErr(""); setOkMsg("");

    if (!form.title.trim()) {
      setErr("Titel is verplicht.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        station_id: form.station_id ? Number(form.station_id) : null,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        price: form.price === "" ? null : Number(form.price),
        compare_at_price: form.compare_at_price === "" ? null : Number(form.compare_at_price),
        badge: form.badge.trim() || null,
        image_url: form.image_url.trim() || null,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        is_active: !!form.is_active,
      };
      await apiJson(`/api/partner/offers/${id}`, { method: "PUT", body: payload });
      setOkMsg("Wijzigingen opgeslagen ✅");
    } catch (e2) {
      setErr(e2.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Weet je zeker dat je deze aanbieding wilt verwijderen?")) return;
    setErr(""); setOkMsg(""); setDeleting(true);
    try {
      await apiJson(`/api/partner/offers/${id}`, { method: "DELETE" });
      navigate("/partner/offers");
    } catch (e2) {
      setErr(e2.message || "Verwijderen mislukt");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PartnerLayout title="Aanbieding bewerken">
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px 12px 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Aanbieding bewerken</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/partner/offers" style={btnGhost}>Terug</Link>
            <button onClick={handleSave} disabled={saving || loading} style={btnPrimary}>
              {saving ? "Opslaan…" : "Opslaan"}
            </button>
            <button onClick={handleDelete} disabled={deleting || loading} style={btnDanger}>
              {deleting ? "Verwijderen…" : "Verwijderen"}
            </button>
          </div>
        </div>

        {err && <div style={alertStyle}>{err}</div>}
        {okMsg && <div style={okStyle}>{okMsg}</div>}

        {loading ? (
          <Card><div>Gegevens laden…</div></Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
            {/* Form */}
            <Card title="Gegevens">
              <form onSubmit={handleSave}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {/* Station (optioneel) */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
                      Station (optioneel)
                    </label>
                    <select
                      value={form.station_id ?? ""}
                      onChange={(e) => setField("station_id", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">— alle / niet specifiek —</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || `Station ${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div /> {/* spacer */}

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
                      Titel *
                    </label>
                    <input
                      value={form.title}
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
                      value={form.subtitle}
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
                      value={form.price}
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
                      value={form.compare_at_price}
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
                      value={form.badge}
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
                      value={form.image_url}
                      onChange={(e) => setField("image_url", e.target.value)}
                      placeholder="/offers/redbull-2pack.png of https://…"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#374151", marginBottom: 4 }}>
                      Start datum/tijd
                    </label>
                    <input
                      type="datetime-local"
                      value={form.starts_at}
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
                      value={form.ends_at}
                      onChange={(e) => setField("ends_at", e.target.value)}
                      style={inputStyle}
                    />
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) => setField("is_active", e.target.checked)}
                    />
                    <span style={{ fontSize: 14 }}>Actief</span>
                  </label>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button type="submit" disabled={saving || loading} style={btnPrimary}>
                    {saving ? "Opslaan…" : "Opslaan"}
                  </button>
                  <Link to="/partner/offers" style={btnGhost}>Annuleren</Link>
                </div>
              </form>
            </Card>

            {/* Preview */}
            <Card title="Preview">
              <div style={{ display: "grid", gap: 10 }}>
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
                  {preview.image_url ? (
                    <img
                      src={preview.image_url}
                      alt={preview.title || "Preview"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  ) : (
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>Geen afbeelding</div>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  {preview.price_fmt && (
                    <div style={{ fontSize: 20, fontWeight: 800 }}>€{preview.price_fmt}</div>
                  )}
                  {preview.compare_fmt && (
                    <div style={{ fontSize: 14, color: "#6b7280", textDecoration: "line-through" }}>
                      €{preview.compare_fmt}
                    </div>
                  )}
                  {preview.badge && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        fontWeight: 700,
                        marginLeft: "auto",
                      }}
                    >
                      {preview.badge}
                    </span>
                  )}
                </div>

                {preview.title && <div style={{ fontWeight: 800 }}>{preview.title}</div>}
                {preview.subtitle && <div style={{ color: "#4b5563", fontSize: 14 }}>{preview.subtitle}</div>}

                {(preview.starts_at || preview.ends_at) && (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {preview.starts_at ? `Start: ${humanDT(preview.starts_at)}` : null}
                    {preview.starts_at && preview.ends_at ? " • " : null}
                    {preview.ends_at ? `Eind: ${humanDT(preview.ends_at)}` : null}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}

/* ====== helpers ====== */
// Converteer ISO met seconden naar "YYYY-MM-DDTHH:mm" voor <input type="datetime-local">
function normalizeForInputDateTime(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}
