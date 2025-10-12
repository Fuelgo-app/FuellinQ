// src/pages/DemoPage.jsx
import React from "react";

export default function DemoPage() {
  const [audience, setAudience] = React.useState("business"); // "business" | "station"
  const [faq, setFaq] = React.useState(null);

  const S = {
    section: {
      maxWidth: "1120px",
      margin: "0 auto",
      padding: "24px 16px",
    },
    h1: { fontSize: "40px", lineHeight: "1.1", fontWeight: 800, margin: 0 },
    h2: { fontSize: "28px", lineHeight: "1.2", fontWeight: 800, margin: 0 },
    h3: { fontSize: "18px", fontWeight: 700, margin: "0 0 6px" },
    p: { color: "var(--muted,#6b7280)", margin: "8px 0 0" },
    grid: (cols, gap = 16) => ({
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
      gap,
    }),
    card: {
      border: "1px solid var(--border,#e5e7eb)",
      borderRadius: 16,
      background: "#fff",
      boxShadow: "0 6px 20px rgba(2,6,23,0.06)",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      color: "var(--brand-blue,#2f68ff)",
      background: "rgba(47,104,255,.08)",
      border: "1px solid rgba(47,104,255,.18)",
    },
    tab: (active) => ({
      padding: "8px 14px",
      borderRadius: 12,
      border: "1px solid var(--border,#e5e7eb)",
      background: active ? "var(--accent,#0b3654)" : "#fff",
      color: active ? "#fff" : "inherit",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    }),
    kpi: {
      border: "1px solid var(--border,#e5e7eb)",
      borderRadius: 16,
      background: "#fff",
      textAlign: "center",
      padding: 16,
    },
  };

  const Btn = ({ href = "#", variant = "solid", children }) => (
    <a
      href={href}
      className={variant === "solid" ? "btn" : "btn btn-outline"}
      style={{ borderRadius: 12, padding: "10px 16px" }}
    >
      {children}
    </a>
  );

  const KPI = ({ value, label }) => (
    <div style={S.kpi}>
      <div style={{ fontSize: 28, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 13, color: "var(--muted,#6b7280)" }}>{label}</div>
    </div>
  );

  const Feature = ({ icon, title, text }) => (
    <div style={{ ...S.card, padding: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ fontSize: 22 }}>{icon}</div>
        <div>
          <div style={S.h3}>{title}</div>
          <p style={{ ...S.p, marginTop: 4 }}>{text}</p>
        </div>
      </div>
    </div>
  );

  const Step = ({ n, title, text }) => (
    <div style={{ position: "relative", paddingLeft: 44 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "var(--accent,#0b3654)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
        }}
      >
        {n}
      </div>
      <div style={{ fontWeight: 700 }}>{title}</div>
      <p style={{ ...S.p, marginTop: 6 }}>{text}</p>
    </div>
  );

  // --- PAGE ---
  return (
    <div
      style={{
        background:
          "radial-gradient(1200px 600px at 15% -10%, rgba(47,104,255,0.08), transparent), radial-gradient(900px 500px at 100% 20%, rgba(245,130,32,0.08), transparent)",
      }}
    >
      {/* HERO */}
      <section style={{ ...S.section, paddingTop: 32, paddingBottom: 32 }}>
        <div
          style={{
            ...S.grid(2, 24),
            alignItems: "center",
          }}
        >
          {/* Left */}
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", color: "var(--muted,#6b7280)", letterSpacing: 0.6, marginBottom: 8 }}>
              Live demo · Digital Mobility
            </div>
            <h1 style={S.h1}>
              Zie in <span style={{ color: "var(--brand-blue,#2f68ff)" }}>60 seconden</span> hoe FuellinQ tanken, laden en CO₂-rapportage samenbrengt
            </h1>
            <p style={{ ...S.p, marginTop: 12 }}>
              Eén platform voor betalingen, realtime CO₂-inzicht en interoperabele data — klaar voor EUDI Wallet en de Europese Green Deal.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <Btn href="/signup" variant="solid">Vraag demo-account aan</Btn>
              <Btn href="/greendeal" variant="outline">Onze Green Deal visie</Btn>
            </div>

            {/* KPI strip */}
            <div style={{ ...S.grid(3, 12), marginTop: 18 }}>
              <KPI value="60s" label="Onboarding binnen" />
              <KPI value="100%" label="AVG & privacy-by-design" />
              <KPI value="EU-ready" label="EUDI Wallet & Data Spaces" />
            </div>
          </div>

          {/* Right: video card */}
          <div style={{ ...S.card, overflow: "hidden" }}>
            <div
              style={{
                aspectRatio: "16 / 9",
                background: "linear-gradient(135deg,#eef2f7,#e6ebf5)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <button
                aria-label="Play demo"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  border: "none",
                  background: "var(--brand-blue,#2f68ff)",
                  color: "#fff",
                  fontSize: 28,
                  cursor: "pointer",
                  boxShadow: "0 12px 28px rgba(47,104,255,.35)",
                }}
              >
                ▶
              </button>
            </div>
            <div style={{ padding: 12, fontSize: 12, color: "var(--muted,#6b7280)" }}>
              Tip: vervang dit blok door je echte mp4/YouTube/Loom embed.
            </div>
          </div>
        </div>
      </section>

      {/* AUDIENCE SWITCH */}
      <section style={{ ...S.section, paddingTop: 0 }}>
        <div style={{ ...S.card, padding: 16, backdropFilter: "saturate(120%) blur(2px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: "var(--muted,#6b7280)" }}>Toon demo voor:</span>
            <button style={S.tab(audience === "business")} onClick={() => setAudience("business")}>
              Bedrijven / Fleet
            </button>
            <button style={S.tab(audience === "station")} onClick={() => setAudience("station")}>
              Tankstations / Partners
            </button>
          </div>

          {audience === "business" ? (
            <div style={S.grid(3, 14)}>
              <Feature icon="📊" title="CO₂-dashboard" text="Realtime uitstoot op basis van tank- en laadsessies, met export naar ESG-rapportage." />
              <Feature icon="💳" title="Wallet & passen" text="Digitale (prepaid) passen met limieten, regels en live notificaties." />
              <Feature icon="🔗" title="Integraties" text="Koppelingen met facturatie, HR en wagenpark-tools." />
            </div>
          ) : (
            <div style={S.grid(3, 14)}>
              <Feature icon="⛽" title="Live prijzen & aanbiedingen" text="Publiceer prijzen en acties. Wij pushen ze naar app en web — jij houdt de controle." />
              <Feature icon="🧾" title="Betalingen & settlements" text="Snelle, transparante afhandeling met duidelijke overzichten per locatie." />
              <Feature icon="🚀" title="Meer klanten, minder frictie" text="Bereik FuellinQ-gebruikers in de buurt en verhoog conversie via wallet-prompts." />
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ ...S.section, paddingTop: 38 }}>
        <h2 style={{ ...S.h2, textAlign: "center" }}>Hoe werkt FuellinQ?</h2>
        <p style={{ ...S.p, textAlign: "center", marginTop: 8 }}>
          Binnen 3 stappen live. Schaalbaar van ZZP tot enterprise-fleet.
        </p>
        <div style={{ ...S.grid(3, 24), marginTop: 18 }}>
          <Step n="1" title="Account & verificatie" text="Bedrijfsverificatie, rollen/limieten en (prepaid) kaarten instellen." />
          <Step n="2" title="Koppel locaties & data" text="Tank- en laadpunten koppelen (API/partner). Data stroomt realtime." />
          <Step n="3" title="Rapporteer & automatiseer" text="ESG/CO₂-exports, facturen koppelen, alerts en boekingsregels." />
        </div>
      </section>

      {/* TRUST */}
      <section style={{ ...S.section, paddingTop: 10 }}>
        <div style={S.grid(4, 14)}>
          {[
            ["🔒", "Privacy-by-design", "AVG & dataminimalisatie"],
            ["🪪", "EUDI-ready", "Wallet & verifieerbare data"],
            ["🔗", "Interoperabel", "EU data spaces / APIs"],
            ["⚙️", "Schaalbaar", "Van pilot naar productie"],
          ].map(([icon, title, sub], i) => (
            <div key={i} style={{ ...S.card, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: "var(--muted,#6b7280)" }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ ...S.section, paddingTop: 28 }}>
        <div style={S.grid(3, 14)}>
          {[
            { role: "Fleet Manager", t: "“Binnen 2 weken live en eindelijk grip op laadsessies + CO₂.”" },
            { role: "Station Owner", t: "“Aanbiedingen pushen is simpel en levert direct extra traffic op.”" },
            { role: "Finance Lead", t: "“Exports en facturen sluiten nu wél op elkaar aan.”" },
          ].map((it, i) => (
            <div key={i} style={{ ...S.card, padding: 16 }}>
              <div style={{ fontSize: 14, color: "var(--muted,#6b7280)" }}>{it.t}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{it.role}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ ...S.section, paddingTop: 28 }}>
        <div style={{ ...S.card, padding: 18 }}>
          <h3 style={S.h3}>Veelgestelde vragen</h3>
          {[
            ["Werkt FuellinQ met bestaande tank- of laadpassen?", "Ja. We integreren bestaande providers of je gebruikt onze (prepaid) wallet-passen. Beide kan."],
            ["Hoe wordt CO₂ berekend?", "We mappen brandstof- en laadinformatie op gestandaardiseerde emissiefactoren en tonen dit realtime in dashboards en export."],
            ["Is dit geschikt voor kleine bedrijven?", "Zeker. Start binnen enkele minuten met 1–5 voertuigen en schaal door."],
            ["Hoe zit het met privacy?", "Privacy-by-design, AVG-conform. Alleen minimaal benodigde data; jij houdt controle."],
          ].map(([q, a], i) => (
            <div key={i} style={{ borderTop: i ? "1px solid var(--border,#e5e7eb)" : "none" }}>
              <button
                onClick={() => setFaq(faq === i ? null : i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontWeight: 600,
                }}
              >
                <span>{q}</span>
                <span style={{ transform: faq === i ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
              </button>
              {faq === i && <p style={{ ...S.p, paddingBottom: 12 }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ ...S.section, paddingTop: 28, paddingBottom: 40, textAlign: "center" }}>
        <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Klaar om het in actie te zien?</h3>
        <p style={{ ...S.p, marginTop: 8 }}>
          Vraag een demo-account aan of plan een korte call met ons team.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
          <Btn href="/signup" variant="solid">Start demo-account</Btn>
          <Btn href="/contact" variant="outline">Plan een gesprek</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--muted,#6b7280)", marginTop: 8 }}>
          *Geen verplichtingen · pilot-vriendelijk
        </div>
      </section>
    </div>
  );
}
