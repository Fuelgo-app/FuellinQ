import React from "react";

export default function GreenDealPage() {
  const Pill = ({ children }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--brand-blue,#2f68ff)",
        background: "rgba(47,104,255,.08)",
        border: "1px solid rgba(47,104,255,.18)",
      }}
    >
      {children}
    </span>
  );

  const Block = ({ children, style = {} }) => (
    <section
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "40px 16px",
        ...style,
      }}
    >
      {children}
    </section>
  );

  const Card = ({ icon, title, text }) => (
    <div
      style={{
        border: "1px solid var(--border,#e5e7eb)",
        borderRadius: 16,
        background: "#fff",
        padding: 20,
        boxShadow: "0 6px 20px rgba(2,6,23,0.05)",
      }}
    >
      <div style={{ fontSize: 26 }}>{icon}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>{title}</div>
      <p style={{ color: "var(--muted,#6b7280)", fontSize: 14, marginTop: 6 }}>
        {text}
      </p>
    </div>
  );

  const Btn = ({ href, outline, children }) => (
    <a
      href={href}
      className={outline ? "btn btn-outline" : "btn"}
      style={{
        borderRadius: 999, // echte pill look zoals je screenshot
        padding: "12px 22px",
        backdropFilter: outline ? "saturate(120%) blur(2px)" : "none",
      }}
    >
      {children}
    </a>
  );

  return (
    <div
      style={{
        background:
          "radial-gradient(1200px 600px at 15% -10%, rgba(47,104,255,0.06), transparent), radial-gradient(900px 500px at 100% 20%, rgba(245,130,32,0.06), transparent)",
      }}
    >
      {/* HERO VISUAL */}
      <section
        style={{
          position: "relative",
          minHeight: 420,
          display: "grid",
          alignItems: "center",
          isolation: "isolate",
        }}
      >
        {/* Background image */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url('/assets/greendeal-hero.jpg'), linear-gradient(120deg,#0f355c,#0b2742)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "saturate(105%) contrast(102%)",
            zIndex: -3,
          }}
        />
        {/* Darken + vignette */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(1200px 800px at 10% 10%, rgba(0,0,0,.25), transparent), linear-gradient(to right, rgba(0,0,0,.55), rgba(0,0,0,.25))",
            zIndex: -2,
          }}
        />
        {/* Subtle border glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)",
            zIndex: -1,
          }}
        />

        <Block style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 16,
              maxWidth: 760,
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>EU Green Deal</Pill>
              <Pill>Digital Mobility</Pill>
              <Pill>EUDI Wallet</Pill>
            </div>

            <h1
              style={{
                fontSize: 44,
                lineHeight: 1.1,
                fontWeight: 800,
                margin: 0,
                textShadow: "0 2px 22px rgba(0,0,0,.25)",
              }}
            >
              FuellinQ helpt bedrijven voldoen aan de EU Green Deal
            </h1>

            <p
              style={{
                margin: 0,
                fontSize: 18,
                color: "rgba(255,255,255,.9)",
                textShadow: "0 1px 12px rgba(0,0,0,.25)",
              }}
            >
              Eén platform voor tanken, laden en data. Realtime CO₂-inzicht,
              privacy-by-design en klaar voor EUDI Wallet. Interoperabel met
              Europese dataplatformen.
            </p>

            {/* CTA row */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <Btn href="/demo">Bekijk demo</Btn>
              <Btn href="/contact" outline>Plan een gesprek</Btn>
            </div>
          </div>
        </Block>
      </section>

      {/* 3 PILARS */}
      <Block style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
          Drie pijlers van digitale duurzaamheid
        </h2>
        <p
          style={{
            color: "var(--muted,#6b7280)",
            fontSize: 15,
            marginBottom: 32,
          }}
        >
          Technologie en compliance gaan hand in hand. Zo helpt FuellinQ bedrijven
          hun klimaatdoelen te halen.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          <Card
            icon="🌍"
            title="Realtime CO₂-inzicht"
            text="We berekenen uitstoot op basis van transactiedata. Dit vormt de basis voor ESG-rapportages en duurzaamheids­doelen."
          />
          <Card
            icon="🔒"
            title="Privacy-by-Design"
            text="Data is end-to-end beveiligd, gedeeld op basis van toestemming en voldoet aan de AVG en Europese datastrategie."
          />
          <Card
            icon="🪪"
            title="EUDI-Wallet compatibel"
            text="Klaar voor de Europese digitale identiteit zodat bedrijven en voertuigen zichzelf digitaal kunnen verifiëren."
          />
        </div>
      </Block>

      {/* TIMELINE */}
      <Block>
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          Van pilot naar volledige compliance
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 12,
          }}
        >
          <Card icon="🚗" title="1. Data activeren" text="Tank- en laaddata worden gekoppeld aan CO₂-emissies via standaard EU-factoren." />
          <Card icon="📊" title="2. Rapporteren & delen" text="Realtime dashboards tonen verbruik en uitstoot per voertuig, medewerker of locatie." />
          <Card icon="🌱" title="3. Duurzame groei" text="Gebruik inzichten voor compensatie, vergroening en rapportages — alles in één platform." />
        </div>
      </Block>

      {/* PARTNERS */}
      <Block style={{ paddingTop: 24 }}>
        <div
          style={{
            background: "white",
            borderRadius: 20,
            padding: "28px 24px",
            boxShadow: "0 12px 28px rgba(2,6,23,.06)",
            textAlign: "center",
          }}
        >
          <h3 style={{ fontSize: 20, fontWeight: 700 }}>
            Samen richting een CO₂-neutrale toekomst
          </h3>
          <p
            style={{
              color: "var(--muted,#6b7280)",
              fontSize: 15,
              maxWidth: 640,
              margin: "8px auto 18px",
            }}
          >
            FuellinQ werkt samen met partners binnen de Europese Data Spaces en
            Green Deal-initiatieven om mobiliteit slimmer en groener te maken.
          </p>
          <img
            src="/assets/partner-logos.png"
            alt="EU, EUDI, Mobility Data Space logos"
            style={{ width: "100%", maxWidth: 480, margin: "0 auto", opacity: 0.9 }}
          />
        </div>
      </Block>

      {/* CTA */}
      <Block style={{ textAlign: "center", paddingBottom: 80 }}>
        <h3 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
          Maak jouw organisatie klaar voor de EU Green Deal
        </h3>
        <p style={{ color: "var(--muted,#6b7280)", fontSize: 15, marginBottom: 24 }}>
          Ontdek hoe FuellinQ helpt met digitale compliance, CO₂-inzicht en realtime energiedata.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Btn href="/demo">Bekijk demo</Btn>
          <Btn href="/contact" outline>Neem contact op</Btn>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted,#6b7280)" }}>
          *Geen verplichtingen · pilot-vriendelijk
        </div>
      </Block>
    </div>
  );
}
