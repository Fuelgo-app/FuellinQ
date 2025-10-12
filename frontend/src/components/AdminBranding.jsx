// src/components/AdminBranding.jsx
import React, { useEffect, useState } from "react";
import { DEFAULT_BRAND, setBrand, getBrand } from "../lib/brand";

/**
 * AdminBranding
 * - Kleuren + LOGO beheren
 * - Slaat op in localStorage + past direct toe via setBrand()
 * - "Reset" zet alles terug naar defaults
 */
export default function AdminBranding() {
  const [brand, setForm] = useState(DEFAULT_BRAND);
  const [saving, setSaving] = useState(false);

  // helpers
  const set = (key, val) => setForm((b) => ({ ...b, [key]: val }));
  const hex = (v) => {
    if (!v) return v;
    const t = v.trim();
    return t.startsWith("#") ? t : `#${t}`;
  };

  // laad bestaande branding (incl. logo_url)
  useEffect(() => {
    try {
      setForm(getBrand());
    } catch {
      setForm(DEFAULT_BRAND);
    }
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      // setBrand schrijft naar localStorage en roept applyBrand()
      setBrand(brand);
      alert("Branding opgeslagen en toegepast ✅");
    } catch (e) {
      alert("Opslaan mislukt: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setBrand(DEFAULT_BRAND);
    setForm(DEFAULT_BRAND);
    alert("Branding teruggezet naar standaard ✅");
  };

  /** Upload -> sla logo als data URL in brand.logo_url (werkt zonder server) */
  const onUploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Kies een afbeeldingsbestand.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      set("logo_url", reader.result); // data:image/png;base64,...
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    set("logo_url", "");
  };

  const logoPreview =
    brand.logo_url && brand.logo_url.trim().length > 0
      ? brand.logo_url
      : "/logo-fuellinq.png"; // fallback

  return (
    <div className="card p-4" style={{ borderRadius: 16 }}>
      <h3 style={{ marginTop: 0 }}>Thema & Branding</h3>
      <p className="muted" style={{ marginTop: 4 }}>
        Pas kleuren en je bedrijfslogo aan. Klik <b>Opslaan</b> om toe te passen.
      </p>

      {/* LOGO */}
      <div
        className="card"
        style={{
          display: "grid",
          gap: 12,
          padding: 12,
          marginTop: 12,
          borderRadius: 12,
          border: "1px solid var(--border,#e5e7eb)",
          background: "var(--surface,#fff)",
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--brand-primary,#0b3654)" }}>
          Logo
        </div>

        <div className="grid" style={{ gap: 12, gridTemplateColumns: "1fr 220px" }}>
          <div>
            <Field label="Logo URL">
              <input
                type="url"
                value={brand.logo_url || ""}
                onChange={(e) => set("logo_url", e.target.value.trim())}
                placeholder="/assets/brand/logo.png of https://…"
                className="input"
                style={{ height: 40 }}
              />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
              <label className="btn btn-outline" style={{ cursor: "pointer" }}>
                Afbeelding uploaden
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUploadLogo}
                  style={{ display: "none" }}
                />
              </label>
              <button className="btn btn-outline" onClick={clearLogo}>
                Verwijder logo
              </button>
            </div>

            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Tip: zet je logo ook in <code>/public/assets/brand/logo.png</code> en vul
              <code> /assets/brand/logo.png</code> in. Cache-issues? Voeg
              <code> ?v=1</code> toe.
            </div>
          </div>

          <div
            className="card"
            style={{
              borderRadius: 12,
              border: "1px solid var(--border,#e5e7eb)",
              padding: 12,
              display: "grid",
              placeItems: "center",
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Preview</div>
            <img
              src={logoPreview}
              alt="Logo preview"
              style={{ height: 48, width: "auto", display: "block", borderRadius: 8 }}
              onError={(e) => {
                e.currentTarget.src = "/logo-fuellinq.png";
              }}
            />
          </div>
        </div>
      </div>

      {/* KLEUREN */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <Field label="Primair (links/buttons)">
          <ColorInput value={brand.primary} onChange={(v) => set("primary", hex(v))} />
        </Field>

        <Field label="Secundair (accent/cijfers)">
          <ColorInput value={brand.secondary} onChange={(v) => set("secondary", hex(v))} />
        </Field>

        <Field label="Tegel achtergrond">
          <ColorInput value={brand.cardBg} onChange={(v) => set("cardBg", hex(v))} />
        </Field>

        <Field label="Tegel tekst">
          <ColorInput value={brand.cardText} onChange={(v) => set("cardText", hex(v))} />
        </Field>

        <Field label="Sidebar achtergrond">
          <ColorInput value={brand.sidebarBg} onChange={(v) => set("sidebarBg", hex(v))} />
        </Field>

        <Field label="Sidebar tekst">
          <ColorInput value={brand.sidebarText} onChange={(v) => set("sidebarText", hex(v))} />
        </Field>

        <Field label="Button achtergrond">
          <ColorInput value={brand.buttonBg} onChange={(v) => set("buttonBg", hex(v))} />
        </Field>

        <Field label="Button tekst">
          <ColorInput value={brand.buttonText} onChange={(v) => set("buttonText", hex(v))} />
        </Field>

        <Field label="Pagina achtergrond">
          <ColorInput value={brand.bg} onChange={(v) => set("bg", hex(v))} />
        </Field>

        <Field label="Body tekstkleur">
          <ColorInput value={brand.text} onChange={(v) => set("text", hex(v))} />
        </Field>

        <Field label="Muted (subteksten)">
          <ColorInput value={brand.muted} onChange={(v) => set("muted", hex(v))} />
        </Field>
      </div>

      {/* Actieknoppen */}
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          className="btn"
          style={{ padding: "10px 16px", borderRadius: 12 }}
          onClick={save}
          disabled={saving}
        >
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
        <button
          className="btn btn-outline"
          style={{ padding: "10px 16px", borderRadius: 12 }}
          onClick={reset}
        >
          Reset naar standaard
        </button>
      </div>

      {/* Mini live-preview */}
      <div style={{ marginTop: 24 }}>
        <h4 style={{ margin: "0 0 12px 0" }}>Voorbeeld</h4>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
          {/* Sidebar voorbeeld */}
          <div
            style={{
              background: brand.sidebarBg,
              color: brand.sidebarText,
              borderRadius: 12,
              padding: 12,
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Sidebar</div>
            <div className="muted" style={{ color: brand.sidebarText, opacity: 0.8 }}>
              Link • Link • Link
            </div>
          </div>

          {/* Tegels + knop voorbeeld */}
          <div>
            <div
              className="cards-grid"
              style={{
                marginBottom: 12,
                display: "grid",
                gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                gap: 12,
              }}
            >
              {[
                ["Voertuigen", 1],
                ["Passen", 1],
                ["Openstaande facturen", 2],
              ].map(([title, n]) => (
                <div
                  key={title}
                  className="dashboard-card"
                  style={{
                    background: brand.cardBg,
                    color: brand.cardText,
                    border: "1px solid rgba(0,0,0,.06)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <h4 style={{ margin: 0, color: brand.cardText }}>{title}</h4>
                  <div
                    className="card-number"
                    style={{
                      marginTop: 6,
                      color: brand.secondary,
                      fontWeight: 800,
                      fontSize: "1.6rem",
                    }}
                  >
                    {n}
                  </div>
                  <div className="card-sub" style={{ opacity: 0.85 }}>
                    Voorbeeld
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn"
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                background: brand.buttonBg || brand.primary,
                color: brand.buttonText || "#fff",
                border: "1px solid transparent",
                fontWeight: 800,
              }}
              type="button"
            >
              Primaire knop (voorbeeld)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Kleine helper subcomponents ---------- */

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 14, opacity: 0.9 }}>{label}</span>
      {children}
    </label>
  );
}

function ColorInput({ value, onChange }) {
  const onVal = (e) => onChange(e?.target ? e.target.value : e);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="color"
        value={value}
        onChange={onVal}
        style={{ width: 40, height: 32, border: "1px solid #ddd", borderRadius: 6 }}
      />
      <input
        type="text"
        value={value}
        onChange={onVal}
        placeholder="#000000"
        className="input"
        style={{ height: 40 }}
      />
    </div>
  );
}
