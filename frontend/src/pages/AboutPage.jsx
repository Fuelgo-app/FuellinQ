// src/pages/AboutPage.jsx
import React from "react";
import { Link } from "react-router-dom";

const HERO_ABOUT = "/assets/about-hero.jpg"; // ⬅️ zet hier je foto (vrouw met telefoon)

export default function AboutPage() {
  const [audience, setAudience] = React.useState("consumer"); // consumer | business | partner
  const year = new Date().getFullYear();

  /* === kleine helpers === */
  const Section = ({ children, style }) => (
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 16px", ...style }}>
      {children}
    </section>
  );
  const Card = ({ children, style }) => (
    <div
      style={{
        border: "1px solid var(--border,#e5e7eb)",
        borderRadius: 16,
        background: "#fff",
        boxShadow: "0 6px 20px rgba(2,6,23,.06)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
  const Pill = ({ children }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(47,104,255,.18)",
        background: "rgba(47,104,255,.08)",
        color: "var(--brand-blue,#2f68ff)",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
  const Btn = ({ to, href, outline, children }) => {
    const base = {
      borderRadius: 12,
      padding: "12px 18px",
      fontWeight: 800,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
    };
    const style = outline
      ? { ...base, background: "transparent", border: "1px solid var(--border,#e5e7eb)", color: "inherit" }
      : { ...base, background: "var(--brand-blue,#2f68ff)", color: "#fff", border: "1px solid transparent" };
    if (to) return <Link to={to} style={style}>{children}</Link>;
    return <a href={href || "#"} style={style}>{children}</a>;
  };

  const audienceBlocks = {
    consumer: [
      { icon: "📱", title: "Betaal aan de pomp met je telefoon", text: "Voeg je FuellinQ-pas toe aan Apple/Google Wallet en reken razendsnel af — zonder bonnetjes." },
      { icon: "💸", title: "Altijd inzicht & voordeel", text: "Transacties, prijzen en acties in de buurt. Spaar automatisch punten." },
      { icon: "🔔", title: "Slimme limieten & meldingen", text: "Stel limieten in en ontvang notificaties bij elke sessie." },
    ],
    business: [
      { icon: "📊", title: "CO₂-dashboard & export", text: "Realtime uitstoot per voertuig/medewerker — klaar voor ESG." },
      { icon: "💳", title: "Digitale (prepaid) passen", text: "Regels en limieten per pas; direct blokkeren mogelijk." },
      { icon: "🔗", title: "Integraties", text: "Facturatie, HR, wagenpark, boekhouding — minder administratie." },
    ],
    partner: [
      { icon: "⛽", title: "Stations in de spotlight", text: "Publiceer prijzen/acties en bereik FuellinQ-gebruikers in de buurt." },
      { icon: "🧾", title: "Transparante settlement", text: "Heldere overzichten en snelle uitbetaling per locatie/keten." },
      { icon: "🚀", title: "Zero-friction beleving", text: "Klaar voor EVC, EV-roaming en loyalty; jij houdt de controle." },
    ],
  };

  const renderAudienceCards = () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16 }}>
      {audienceBlocks[audience].map((f, i) => (
        <Card key={i}>
          <div style={{ fontSize: 24 }}>{f.icon}</div>
          <div style={{ fontWeight: 800, marginTop: 6 }}>{f.title}</div>
          <div style={{ color: "var(--muted,#6b7280)", fontSize: 14, marginTop: 6 }}>{f.text}</div>
        </Card>
      ))}
    </div>
  );

  return (
    <div
      style={{
        background:
          "radial-gradient(1000px 600px at 15% -10%, rgba(47,104,255,0.06), transparent), radial-gradient(900px 500px at 100% 20%, rgba(245,130,32,0.06), transparent)",
      }}
    >
      {/* ================= HERO IMAGE (volle breedte) ================= */}
      <section
        className="relative overflow-hidden"
        style={{ position: "relative", minHeight: 260 }}
      >
        <img
          src={HERO_ABOUT}
          alt="Contactloos betalen aan de pomp"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        {/* zachte onder-gradient + dunne scheidslijn */}
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0) 40%, rgba(255,255,255,.85) 75%, #fff 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, background: "rgba(0,0,0,.06)" }} />
      </section>

      {/* ================= HERO COPY + PROMISES ================= */}
      <Section style={{ paddingTop: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 24, alignItems: "start" }}>
          <div>
            <Pill>Over FuellinQ</Pill>
            <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 900, marginTop: 12 }}>
              Slimmer tanken en laden, <span style={{ color: "var(--brand-blue,#2f68ff)" }}>simpel betalen</span>
            </h1>
            <p style={{ marginTop: 12, color: "var(--muted,#6b7280)", fontSize: 16 }}>
              Geen bonnetjesstress of onduidelijke administratie: met onze <b>digitale tank- en laadpas</b> in Apple Wallet
              of Google Wallet reken je razendsnel af en heb je direct overzicht. Voor bedrijven bieden we CO₂-inzicht en
              automatisering. Stations bereiken moeiteloos meer klanten met acties en live prijzen.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <Btn to="/signup">Account aanmaken</Btn>
              <Btn to="/demo" outline>Bekijk demo</Btn>
            </div>
          </div>

          <Card style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Onze beloften</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {[
                ["🔒 Betrouwbaarheid", "Altijd veilig betalen — met dezelfde zekerheid als je bankpas."],
                ["⚡ Efficiëntie", "Minder gedoe, minder papier. In één tik klaar bij pomp of laadpaal."],
                ["🔎 Transparantie", "Realtime inzicht in transacties, prijzen en kortingen in de app."],
                ["🌱 Toekomstgericht", "Klaar voor EUDI Wallet & CO₂-rapportage (EU Green Deal)."],
              ].map(([k, v]) => (
                <li key={k} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 10, alignItems: "start" }}>
                  <span style={{ fontSize: 16, lineHeight: "28px" }}>{k.split(" ")[0]}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{k.replace(/^[^ ]+\s/, "")}</div>
                    <div style={{ fontSize: 14, color: "var(--muted,#6b7280)" }}>{v}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {/* ================= AUDIENCE SWITCH ================= */}
      <Section style={{ paddingTop: 10 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "var(--muted,#6b7280)" }}>Toon informatie voor:</span>
            {[
              ["consumer", "Particulieren"],
              ["business", "Bedrijven / Fleet"],
              ["partner", "Stations / Partners"],
            ].map(([key, label]) => {
              const active = audience === key;
              return (
                <button
                  key={key}
                  onClick={() => setAudience(key)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border,#e5e7eb)",
                    background: active ? "var(--accent,#0b3654)" : "#fff",
                    color: active ? "#fff" : "inherit",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14 }}>{renderAudienceCards()}</div>
        </Card>
      </Section>

      {/* ================= HOW IT WORKS ================= */}
      <Section style={{ paddingTop: 28 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: "center" }}>Hoe werkt FuellinQ?</h2>
        <p style={{ color: "var(--muted,#6b7280)", fontSize: 15, textAlign: "center", marginTop: 6 }}>
          Binnen 3 stappen live — van ZZP tot enterprise.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginTop: 16 }}>
          {[
            ["1", "Download & verifieer", "Maak je account aan en voeg je betaalmethode toe."],
            ["2", "Wallet & regels", "Activeer je digitale pas, zet limieten en notificaties aan."],
            ["3", "Tanken / Laden", "Reken af en krijg realtime inzicht. Voor bedrijven: CO₂ en exports."],
          ].map(([n, t, d]) => (
            <Card key={n} style={{ position: "relative", paddingLeft: 48 }}>
              <div
                style={{
                  position: "absolute",
                  left: 16,
                  top: 16,
                  width: 28,
                  height: 28,
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
              <div style={{ fontWeight: 800 }}>{t}</div>
              <div style={{ color: "var(--muted,#6b7280)", fontSize: 14, marginTop: 6 }}>{d}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ================= TRUST STRIP ================= */}
      <Section style={{ paddingTop: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {[
            ["🔐", "Privacy-by-design"],
            ["🪪", "EUDI-ready"],
            ["🔗", "Interoperabel"],
            ["⚙️", "Schaalbaar"],
          ].map(([icon, label], i) => (
            <Card key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{label}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ================= TESTIMONIALS ================= */}
      <Section style={{ paddingTop: 20 }}>
        <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10 }}>Wat gebruikers zeggen</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {[
            { role: "ZZP’er", t: "“Geen bonnetjes meer. Alles staat netjes in de app.”" },
            { role: "Fleet Manager", t: "“Eindelijk 1 dashboard met CO₂ en kosten per voertuig.”" },
            { role: "Stationseigenaar", t: "“Acties pushen leverde merkbaar extra traffic op.”" },
          ].map((it, i) => (
            <Card key={i}>
              <div style={{ color: "var(--muted,#6b7280)" }}>{it.t}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{it.role}</div>
            </Card>
          ))}
        </div>
      </Section>

      {/* ================= FAQ ================= */}
      <Section style={{ paddingTop: 24 }}>
        <Card>
          <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Veelgestelde vragen</h3>
          <div>
            {[
              ["Werkt dit met mijn huidige bankpas?", "Ja. Je koppelt je bestaande betaalmethode. Voor bedrijven zijn er ook (prepaid) kaarten met limieten."],
              ["Wat kost FuellinQ?", "Voor particulieren is de app gratis. Bedrijfsfeatures (CO₂, exports, integraties) zijn beschikbaar in pakketten."],
              ["Is de app AVG-proof?", "Ja. Dataminimalisatie en delen op basis van toestemming. Privacy-by-design."],
              ["Kan ik dit als station gebruiken?", "Zeker. Publiceer prijzen/aanbiedingen en ontvang settlement-overzichten per locatie."],
            ].map(([q, a], i) => (
              <details key={i} style={{ borderTop: i ? "1px solid var(--border,#e5e7eb)" : "none", padding: "10px 0" }}>
                <summary style={{ cursor: "pointer", fontWeight: 700 }}>{q}</summary>
                <p style={{ margin: "6px 0 0", color: "var(--muted,#6b7280)" }}>{a}</p>
              </details>
            ))}
          </div>
        </Card>
      </Section>

      {/* ================= FINAL CTA ================= */}
      <Section style={{ textAlign: "center", paddingBottom: 60 }}>
        <h3 style={{ fontSize: 26, fontWeight: 900, marginBottom: 8 }}>
          Sluit je aan bij FuellinQ — {year} wordt jouw jaar van gemak
        </h3>
        <p style={{ color: "var(--muted,#6b7280)", maxWidth: 680, margin: "0 auto" }}>
          Start gratis als particulier, of plan een demo voor jouw organisatie of station.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
          <Btn to="/signup">Account aanmaken</Btn>
          <Btn to="/demo" outline>Plan een demo</Btn>
          <Btn to="/partner" outline>Partner worden</Btn>
        </div>
      </Section>
    </div>
  );
}
