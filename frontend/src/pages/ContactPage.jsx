// src/pages/ContactPage.jsx
import React, { useMemo, useState } from "react";

function CopyChip({ value, ariaLabel = "Kopieer", small }) {
  const [ok, setOk] = useState(false);
  async function doCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      setTimeout(() => setOk(false), 1400);
    } catch {}
  }
  return (
    <button
      type="button"
      onClick={doCopy}
      aria-label={ariaLabel}
      title={ok ? "Gekopieerd!" : "Kopieer"}
      style={{
        border: "1px solid #e5e7eb",
        background: ok ? "#ecfdf5" : "#fff",
        color: ok ? "#065f46" : "#0f172a",
        borderRadius: 999,
        padding: small ? "4px 8px" : "6px 10px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        boxShadow: "0 1px 2px rgba(2,6,23,.04)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {ok ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <rect x="2" y="2" width="13" height="13" rx="2" />
          </>
        )}
      </svg>
      {ok ? "Gekopieerd" : "Kopieer"}
    </button>
  );
}

function Row({ label, children, mono, link }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "140px 1fr auto",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderTop: "1px solid #f1f5f9",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 14 }}>{label}</div>
      <div
        style={{
          fontWeight: link ? 600 : 500,
          color: link ? "var(--brand-primary, #0b3654)" : "#0f172a",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
          letterSpacing: mono ? "0.01em" : undefined,
          wordBreak: "break-word",
        }}
      >
        {children}
      </div>
      <div>{/* plek voor actions (kopieer) via children-siblings */}</div>
    </div>
  );
}

export default function ContactPage() {
  const COMPANY = {
    name: "Fuellinq B.V.",
    phone: "+31 6 1621771",
    email: "info@fuellinq.app",
    iban: "NL11 INGB 0008 7856 94",
    kvk: "73275786",
    vat: "NL002348726B70",
    addressLine: "Soestdijk",
    addressFull: "Soestdijk, Nederland",
    site: typeof window !== "undefined" ? window.location.origin : "https://fuellinq.app",
  };

  const mapsQuery = encodeURIComponent(COMPANY.addressFull || COMPANY.addressLine || "Soestdijk");
  const mapsEmbed = `https://www.google.com/maps?q=${mapsQuery}&z=13&output=embed`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const waLink = useMemo(() => {
    const digits = COMPANY.phone.replace(/[^\d]/g, "");
    const intl = digits.startsWith("00") ? digits.slice(2) : digits;
    const withCC = intl.startsWith("31") ? intl : `31${intl}`;
    return `https://wa.me/${withCC}`;
  }, [COMPANY.phone]);

  function onSubmit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const subject = encodeURIComponent(`[Contact] ${fd.get("topic") || "Vraag via website"}`);
    const body = encodeURIComponent(
      `Naam: ${fd.get("name")}\nE-mail: ${fd.get("email")}\nOnderwerp: ${fd.get("topic")}\n\nBericht:\n${fd.get("message")}`
    );
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
  }

  return (
    <>
      {/* Intro */}
      <div className="card p-4 mb-3" style={{ borderRadius: 16 }}>
        <h2 style={{ margin: 0, color: "var(--brand-primary, #0b3654)" }}>Contact</h2>
        <p className="muted" style={{ marginTop: 8 }}>
          We helpen je graag verder. Neem direct contact op of laat een bericht achter.
        </p>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <a className="btn btn-outline" href={`tel:${COMPANY.phone.replace(/\s+/g, "")}`}>📞 Bellen</a>
          <a className="btn btn-outline" href={`mailto:${COMPANY.email}`}>✉️ E-mail</a>
          <a className="btn btn-outline" href={waLink} target="_blank" rel="noreferrer">💬 WhatsApp</a>
          <a className="btn" href={mapsLink} target="_blank" rel="noreferrer">📍 Route</a>
        </div>
      </div>

      {/* Map + Gegevens + Form */}
      <div className="grid" style={{ gap: 16, gridTemplateColumns: "1.2fr .8fr" }}>
        {/* Kaart */}
        <div className="card p-0" style={{ borderRadius: 16, overflow: "hidden" }}>
          <div
            style={{
              padding: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontWeight: 700, color: "var(--brand-primary, #0b3654)" }}>Locatie</div>
            <a className="muted" href={mapsLink} target="_blank" rel="noreferrer">
              Open in Maps ↗
            </a>
          </div>
          <iframe
            title="Locatie"
            src={mapsEmbed}
            style={{ width: "100%", height: 360, border: 0, display: "block" }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Formulier */}
        <div className="card p-4" style={{ borderRadius: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: "var(--brand-primary, #0b3654)" }}>
            Stuur een bericht
          </div>
          <form onSubmit={onSubmit}>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Naam</span>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Jouw naam"
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", width: "100%" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>E-mail</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="jij@bedrijf.nl"
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", width: "100%" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Onderwerp</span>
                <input
                  name="topic"
                  type="text"
                  placeholder="Waarmee kunnen we helpen?"
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", width: "100%" }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Bericht</span>
                <textarea
                  name="message"
                  rows={6}
                  required
                  placeholder="Vertel kort wat je zoekt of waar je tegenaan loopt…"
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", width: "100%", resize: "vertical" }}
                />
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="submit" className="btn">Verstuur</button>
                <span className="muted" style={{ fontSize: 12 }}>Reactie meestal binnen 1–2 werkdagen.</span>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Gegevens (strak uitgelijnd, met copy-chips) */}
      <div className="card p-4" style={{ borderRadius: 16, marginTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Contact */}
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--brand-primary, #0b3654)" }}>
              Contactgegevens
            </div>

            {/* Tel */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "10px 0" }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>Telefoon</div>
              <a
                href={`tel:${COMPANY.phone.replace(/\s+/g, "")}`}
                style={{ fontWeight: 600, color: "var(--brand-primary, #0b3654)" }}
              >
                {COMPANY.phone}
              </a>
              <CopyChip value={COMPANY.phone} small ariaLabel="Kopieer telefoonnummer" />
            </div>

            {/* Email */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>E-mail</div>
              <a href={`mailto:${COMPANY.email}`} style={{ fontWeight: 600, color: "var(--brand-primary, #0b3654)" }}>
                {COMPANY.email}
              </a>
              <CopyChip value={COMPANY.email} small ariaLabel="Kopieer e-mailadres" />
            </div>
          </div>

          {/* Bedrijf */}
          <div>
            <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--brand-primary, #0b3654)" }}>
              Bedrijfsgegevens
            </div>

            {/* Naam */}
            <Row label="Naam">{COMPANY.name}</Row>

            {/* IBAN */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>IBAN</div>
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  letterSpacing: "0.02em",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
              >
                {COMPANY.iban}
              </div>
              <CopyChip value={COMPANY.iban.replace(/\s/g, "")} small ariaLabel="Kopieer IBAN" />
            </div>

            {/* KvK */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>KvK-nummer</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontWeight: 600 }}>
                {COMPANY.kvk}
              </div>
              <CopyChip value={COMPANY.kvk} small ariaLabel="Kopieer KvK" />
            </div>

            {/* BTW */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr auto", gap: 12, padding: "10px 0", borderTop: "1px solid #f1f5f9" }}>
              <div style={{ color: "#64748b", fontSize: 14 }}>BTW-nummer</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontWeight: 600 }}>
                {COMPANY.vat}
              </div>
              <CopyChip value={COMPANY.vat} small ariaLabel="Kopieer BTW-nummer" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
