// src/pages/EUAgenda.jsx — FuellinQ EU Green Deal (hard-scoped)
import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const HERO_IMG = "/assets/fuellinq-eu-hero-v2.png";

/** Kleine donut-grafiek voor CO₂-kaart */
function Donut({ pct = 72, size = 180, stroke = 16 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);

  return (
    <svg className="eu-donut" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g transform={`translate(${size / 2} ${size / 2})`}>
        <circle r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          r={r}
          fill="none"
          stroke="var(--brand-primary,#2f68ff)"  /* ✅ match merk-kleur */
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90)"
        />
      </g>
    </svg>
  );
}

export default function EUAgendaPage() {
  useEffect(() => {
    document.title = "EU Green Deal & Digital Mobility | FuellinQ";
  }, []);

  return (
    <main id="eu-agenda" className="bg-slate-50 text-slate-900">
      {/* ===== Alleen binnen #eu-agenda ===== */}
      <style>{`
        #eu-agenda * { box-sizing: border-box; }

        /* Kill-switch tegen UI-kit grijze panelen e.d. */
        #eu-agenda .card,
        #eu-agenda .collapse,
        #eu-agenda .panel,
        #eu-agenda .box,
        #eu-agenda .divider,
        #eu-agenda .list-row,
        #eu-agenda .row,
        #eu-agenda [class*="collapse"],
        #eu-agenda [class*="panel"],
        #eu-agenda [class*="divider"] { all: unset !important; }
        #eu-agenda hr { display:none !important; }

        /* Layout via utility classes */
        #eu-agenda .grid { display:grid !important; }
        #eu-agenda .gap-6 { gap:1.5rem !important; }
        #eu-agenda .gap-8 { gap:2rem !important; }

        /* Soft cards (zoals ontwerp) */
        #eu-agenda .soft-card{
          background:#fff !important;
          border:1px solid rgb(226 232 240) !important;
          border-radius:1rem !important;
          box-shadow:0 1px 2px rgba(0,0,0,.05) !important;
        }
        #eu-agenda .soft-card:hover{ box-shadow:0 8px 24px rgba(15,23,42,.08) !important; }

        /* Hero copy en buttons op blauw */
        #eu-agenda .hero-copy, #eu-agenda .hero-copy * { color:#fff !important; }

        /* Hero/CTA buttons — gedeelde basis */
        #eu-agenda .btn-hero{
          display:inline-flex; align-items:center; justify-content:center;
          gap:.5rem; border-radius:9999px; padding:.85rem 1.1rem;
          font-weight:700; text-decoration:none; transition:all .2s ease;
          box-shadow:0 1px 2px rgba(2,6,23,.06);
        }
        /* Witte knop (donkere tekst) */
        #eu-agenda .btn-white{
          background:#fff !important; color:#0f172a !important; border:1px solid rgba(2,6,23,.06);
        }
        #eu-agenda .btn-white:hover{ filter:brightness(.98); box-shadow:0 8px 24px rgba(2,6,23,.10); }

        /* Ghost (voor de hero op blauw: witte tekst + lichte border) */
        #eu-agenda .btn-ghost{
          background:transparent !important; color:#fff !important; border:1px solid rgba(255,255,255,.45) !important;
        }
        #eu-agenda .btn-ghost:hover{ background:rgba(255,255,255,.06) !important; }

        /* ✅ Ghost donkere variant (voor CTA op witte achtergrond) */
        #eu-agenda .btn-ghost--dark{
          background:#fff !important;
          color: var(--text, #0f172a) !important;
          -webkit-text-fill-color: var(--text, #0f172a) !important;
          border:1px solid var(--border, #e5e7eb) !important;
        }
        #eu-agenda .btn-ghost--dark:hover{
          color: var(--accent, #0b3654) !important;
          -webkit-text-fill-color: var(--accent, #0b3654) !important;
          border-color: var(--accent, #0b3654) !important;
          background: var(--bg, #f8fafc) !important;
        }

        #eu-agenda .hero-min { min-height:560px !important; }
        @media (min-width:1024px){ #eu-agenda .hero-min{ min-height:640px !important; } }

        /* Icon/typo fixes */
        #eu-agenda svg { width:24px !important; height:24px !important; display:inline-block; }
        #eu-agenda h1,#eu-agenda h2,#eu-agenda h3,#eu-agenda h4 { margin:0 !important; }

        /* Secties schoon */
        #eu-agenda section { border:0 !important; background:transparent !important; }

        /* ===== Features hard-scope ===== */
        #eu-agenda #features .grid {
          grid-template-columns: repeat(4, minmax(0,1fr)) !important;
          gap: 40px !important;
        }
        @media (max-width: 1024px){
          #eu-agenda #features .grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
        @media (max-width: 640px){
          #eu-agenda #features .grid { grid-template-columns: 1fr !important; }
        }
        #eu-agenda #features .feature-icon svg { width:56px !important; height:56px !important; }

        /* === CO2 unified card === */
        #eu-agenda .co2-card{
          border:1px solid #e5e7eb; border-radius:16px; padding:16px;
          background: linear-gradient(180deg,#ffffff 0%, #f8fbff 100%);
          box-shadow: 0 6px 20px rgba(2,6,23,.06);
        }
        #eu-agenda .co2-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        #eu-agenda .co2-title{ font-weight:800; color:#0b3654; }
        #eu-agenda .badge-ghost{
          font-size:12px; padding:4px 10px; border-radius:999px;
          background:#eff6ff; color:#1e40af; font-weight:800; border:1px solid #dbeafe;
        }
        #eu-agenda .co2-body{ display:grid; grid-template-columns: 1fr 1.2fr; gap:16px; align-items:center; }
        @media (max-width: 880px){ #eu-agenda .co2-body{ grid-template-columns:1fr; } }
        #eu-agenda .co2-hero{ position:relative; display:grid; place-items:center; padding:10px; border-radius:14px; border:1px solid #e5e7eb; background:#fff; }
        #eu-agenda .donut-wrap{ width:180px; height:180px; display:grid; place-items:center; }
        #eu-agenda .co2-hero-num{ position:absolute; text-align:center; font-weight:900; font-size:32px; color:#0f172a; }
        #eu-agenda .co2-hero-sub{ position:absolute; margin-top:64px; font-size:12px; color:#64748b; }
        #eu-agenda .co2-right{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        #eu-agenda .metric{ border:1px solid #e5e7eb; border-radius:14px; background:#fff; padding:14px; text-align:center; }
        #eu-agenda .metric-label{ font-size:12px; color:#64748b; margin-bottom:4px; }
        #eu-agenda .metric-value{ font-weight:900; font-size:22px; color:#0f172a; }
        #eu-agenda .metric-value .unit{ font-size:12px; font-weight:700; color:#64748b; margin-left:2px; }
        #eu-agenda .co2-bottom{ margin-top:14px; display:grid; grid-template-columns:1.2fr .8fr; gap:12px; }
        @media (max-width: 880px){ #eu-agenda .co2-bottom{ grid-template-columns:1fr; } }
        #eu-agenda .pill{ border:1px dashed #d1d5db; background:#fff; border-radius:12px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; }
        #eu-agenda .pill .label{ font-size:12px; color:#64748b; }
        #eu-agenda .pill .value{ font-weight:800; color:#0f172a; }
        #eu-agenda .co2-foot{ font-size:12px; color:#64748b; margin-top:8px; }

        /* Timeline */
        #eu-agenda .roadmap .timeline{ position:relative; margin-top:24px; }
        #eu-agenda .timeline-line{ position:absolute; left:0; right:0; top:28px; height:2px; background:#e5e7eb; }
        #eu-agenda .milestones{ display:flex; justify-content:space-between; gap:10px; position:relative; }
        #eu-agenda .ms{ text-align:center; }
        #eu-agenda .ms .dot{ width:12px; height:12px; background:#0b3654; border-radius:9999px; display:inline-block; }
        #eu-agenda .ms .year{ font-weight:800; color:#0b3654; margin-top:8px; }
        #eu-agenda .ms .title{ color:#274F73; font-size:14px; }

        /* Blauwe band-edges voor features sectie */
        #eu-agenda .band-edge{ position:absolute; left:0; right:0; height:28px; }
        #eu-agenda .band-edge.top{ top:-28px; background:linear-gradient(180deg, rgba(12,74,110,.10), transparent); }
        #eu-agenda .band-edge.bottom{ bottom:-28px; background:linear-gradient(0deg, rgba(12,74,110,.10), transparent); }
      `}</style>

      {/* ================= HERO ================= */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundImage: `url(${HERO_IMG})`, backgroundSize: "cover", backgroundPosition: "right center" }}
      >
        {/* Fallback image (SEO/lazy-safe) */}
        <img src={HERO_IMG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover z-0" />
        {/* Blauwe overlay */}
        <div
          className="absolute inset-0 z-10"
          style={{
            background:
              "linear-gradient(90deg, rgba(4,68,120,.92) 0%, rgba(4,68,120,.88) 42%, rgba(4,68,120,.55) 62%, rgba(4,68,120,0) 82%)",
          }}
        />
        {/* Tekst */}
        <div className="relative z-20 max-w-6xl mx-auto px-6 md:px-10 lg:px-16 pt-8 md:pt-10">
          <div className="hero-min py-16 md:py-24 lg:py-28 flex items-center">
            <div className="hero-copy max-w-3xl">
              <span className="inline-block text-xs tracking-widest uppercase mb-3 px-2 py-1 bg-white/10 backdrop-blur rounded-full">
                EU Green Deal · Digital Mobility
              </span>

              <h1 className="text-3xl md:text-5xl font-semibold leading-tight">
                FuellinQ helpt bedrijven voldoen aan de EU Green Deal
              </h1>

              <p className="mt-4 text-lg opacity-90">
                Eén platform voor tanken, laden en data. Realtime CO₂-inzicht,
                privacy-by-design en klaar voor EUDI Wallet. Interoperabel met Europese dataplatformen.
              </p>

              {/* ✅ Hero buttons — echte routes */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/demo" className="btn-white btn-hero">Bekijk demo</Link>
                <Link to="/greendeal" className="btn-ghost btn-hero">Meer over onze Green Deal visie</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section id="features" className="bg-[#ECF3FB] relative">
        <div className="band-edge top" />
        <div className="band-edge bottom" />
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14">
          <h2 className="text-[26px] md:text-[32px] leading-tight font-semibold text-[#0B3654] text-center">
            Wat betekent de EU Green Deal voor mobiliteit?
          </h2>

          <div className="grid md:grid-cols-4 gap-10 mt-10 text-center">
            <div>
              <div className="feature-icon mx-auto text-sky-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M7 18a4 4 0 1 1 0-8 5 5 0 0 1 9.5-1.5A4.5 4.5 0 1 1 19 18H7z"/>
                </svg>
              </div>
              <div className="mt-3 text-[18px] font-semibold text-[#123A5C]">Minder CO₂-uitstoot</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#274F73] max-w-[240px] mx-auto">
                Meet emissies per tank- en laadsessie in één dashboard.
              </p>
            </div>

            <div>
              <div className="feature-icon mx-auto text-sky-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
                </svg>
              </div>
              <div className="mt-3 text-[18px] font-semibold text-[#123A5C]">Meer elektrisch rijden</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#274F73] max-w-[240px] mx-auto">
                Koppel voertuigen en bestuurders aan een EU digitale ID (wallet-proof).
              </p>
            </div>

            <div>
              <div className="feature-icon mx-auto text-sky-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="6" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="12" r="2"/>
                  <path d="M8 12h4M14 8l-2 2m2 2l-2-2"/>
                </svg>
              </div>
              <div className="mt-3 text-[18px] font-semibold text-[#123A5C]">Digitale interoperabiliteit</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#274F73] max-w-[240px] mx-auto">
                Veilige koppelingen met Europese dataplatformen (Data Spaces).
              </p>
            </div>

            <div>
              <div className="feature-icon mx-auto text-sky-700">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="M3 10h18M6 14h4"/>
                </svg>
              </div>
              <div className="mt-3 text-[18px] font-semibold text-[#123A5C]">Slimmere betaal- & datastromen</div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#274F73] max-w-[240px] mx-auto">
                Volledig AVG-conform — één factuur voor tanken én laden.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= PRAKTIJK + CO2 KAART ================= */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14">
          <h3 className="text-xl md:text-2xl font-semibold text-slate-900">EU-termen vertaald naar jouw praktijk</h3>
          <p className="mt-2 text-slate-600 max-w-3xl">
            We spreken de taal van Brussel, maar bouwen voor ondernemers. Zo koppel je
            duurzaamheidsbeleid direct aan meetbare resultaten.
          </p>

          <div className="grid md:grid-cols-2 gap-10 mt-10 items-start">
            {/* Checklist */}
            <ul className="space-y-3 text-slate-800">
              {[
                "Efficiënt wagenparkbeheer",
                "Minder brandstofverspilling",
                "Volautomatische CO₂-rapportages",
                "Eén platform voor tanken, laden en administratie",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 text-emerald-600">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>

            {/* CO2-kaart — unified look */}
            <div className="co2-card">
              <div className="co2-head">
                <div className="co2-title">CO₂-overzicht</div>
                <span className="badge-ghost">Privacy-by-Design</span>
              </div>

              <div className="co2-body">
                {/* Donut + centraal percentage */}
                <div className="co2-hero">
                  <div className="donut-wrap">
                    <Donut pct={72} size={180} stroke={16} />
                  </div>
                  <div className="co2-hero-num">72%</div>
                  <div className="co2-hero-sub">EV aandeel</div>
                </div>

                {/* Metrics rechts in dezelfde kaart */}
                <div className="co2-right">
                  <div className="metric">
                    <div className="metric-label">EV</div>
                    <div className="metric-value">72<span className="unit">+</span></div>
                  </div>
                  <div className="metric">
                    <div className="metric-label">Fuel</div>
                    <div className="metric-value">33<span className="unit">%</span></div>
                  </div>
                </div>
              </div>

              {/* Onderste rij — onderdeel van dezelfde kaart */}
              <div className="co2-bottom">
                <div className="pill">
                  <span className="label">Bespaarde kosten</span>
                  <span className="value">€ 1.240</span>
                </div>
                <div className="pill">
                  <span className="label">Trend</span>
                  <span className="value" style={{ color:"#059669" }}>↓ −12%</span>
                </div>
              </div>

              <p className="co2-foot">Dashboard-preview — echte data in je eigen account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TIMELINE ================= */}
      <section id="roadmap" className="roadmap">
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-14">
          <h3 className="text-xl md:text-2xl font-semibold text-center text-[#0B3654]">
            Hoe FuellinQ aansluit op de EU Green Deal roadmap (2025–2035)
          </h3>

          <div className="timeline">
            <div className="timeline-line" />
            <div className="milestones">
              {[
                ["2025", "EUDI Wallet integratie"],
                ["2026", "CO₂-rapportage-automatisering"],
                ["2028", "Europese Data Spaces koppeling"],
                ["2030", "Net-zero fleet compliance"],
              ].map(([year, title]) => (
                <div key={year} className="ms">
                  <span className="dot" />
                  <div className="year">{year}</div>
                  <div className="title">{title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-16 py-16 text-center">
          <h3 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Bereid jouw bedrijf vandaag voor op de Green Deal.
          </h3>
          <p className="mt-2 text-slate-600 max-w-2xl mx-auto">
            Start met een gratis demo, of ontdek onze API’s om tanken, laden en CO₂-inzichten te integreren.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/demo" className="btn-white btn-hero rounded-xl px-5 py-3 font-medium">
              Vraag een demo aan
            </Link>
            <a href="/api" className="btn-ghost--dark btn-hero rounded-xl px-5 py-3 font-medium">
              Bekijk API-documentatie
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
