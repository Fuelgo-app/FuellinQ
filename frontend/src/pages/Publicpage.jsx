// src/pages/PublicPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";

/* ✅ Banner (Vite-safe) */
const bannerUrl = new URL("../assets/fuellinq-banner.png", import.meta.url).href;

/* ✅ API-base consistent met je andere chats: VITE_API_URL → fallback :3001 */
const RAW_API = (import.meta.env.VITE_API_URL ?? "").trim();
const API_BASE = (RAW_API && RAW_API !== "/" ? RAW_API : "http://localhost:3001").replace(/\/+$/, "");

/* ---------- Kleine UI helpers (inline styles zodat het werkt zonder extra CSS) ---------- */
const styles = {
  container: { maxWidth: 1120, margin: "16px auto", padding: 16 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 2px 10px rgba(0,0,0,.03)",
  },
  kpiH3: { margin: "0 0 6px", fontSize: 16 },
  kpiBig: { display: "block", fontSize: 28, fontWeight: 700, lineHeight: 1.1 },
  kpiSub: { margin: "6px 0 0", color: "#6b7280", fontSize: 13 },
  banner: {
    width: "100%",
    maxWidth: 1200,
    height: 300, // ontworpen als 1920×300
    objectFit: "cover",
    objectPosition: "right center",
    borderRadius: 12,
    display: "block",
    margin: "0 auto 16px",
    boxShadow: "0 6px 24px rgba(0,0,0,.10)",
  },
  title: { margin: "0 0 8px" },
  bodyPre: { whiteSpace: "pre-wrap", marginTop: 8 },
  media: { maxWidth: "100%", borderRadius: 12, marginTop: 12, display: "block" },
  skel: {
    height: 18,
    background: "linear-gradient(90deg,#f2f4f7,#e9edf3,#f2f4f7)",
    backgroundSize: "200% 100%",
    animation: "sh 1.2s ease-in-out infinite",
    borderRadius: 8,
    margin: "6px 0",
  },
};

/* ---------- KPI Cards ---------- */
function OverviewCards({ vehicles = 1, passes = 1, openInvoices = 2 }) {
  return (
    <div style={styles.grid}>
      <div style={styles.card}>
        <h3 style={styles.kpiH3}>Voertuigen</h3>
        <span style={styles.kpiBig}>{vehicles}</span>
        <p style={styles.kpiSub}>Actief geregistreerd</p>
      </div>
      <div style={styles.card}>
        <h3 style={styles.kpiH3}>Passen</h3>
        <span style={styles.kpiBig}>{passes}</span>
        <p style={styles.kpiSub}>In wallet / beheer</p>
      </div>
      <div style={styles.card}>
        <h3 style={styles.kpiH3}>Openstaande facturen</h3>
        <span style={styles.kpiBig}>{openInvoices}</span>
        <p style={styles.kpiSub}>Nog te betalen</p>
      </div>
    </div>
  );
}

/* ---------- Loading skeleton ---------- */
function LoadingCard() {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.skel, width: "25%" }} />
      <div style={{ ...styles.skel, width: "80%" }} />
      <div style={{ ...styles.skel, width: "90%" }} />
      <div style={{ ...styles.skel, width: "70%" }} />
    </div>
  );
}

/* ---------- Public Page ---------- */
export default function PublicPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const [page, setPage] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // Query flags (bv. ?noBanner=1)
  const q = useMemo(() => new URLSearchParams(search), [search]);
  const noBanner = q.get("noBanner") === "1";

  useEffect(() => {
    if (!slug) return;
    const ac = new AbortController();

    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await fetch(`${API_BASE}/api/site-pages?slug=${encodeURIComponent(slug)}`, {
          signal: ac.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          if (res.status === 404) throw new Error("Pagina niet gevonden (404)");
          throw new Error(`Fout ${res.status} — ${res.statusText}`);
        }
        const data = await res.json().catch(() => ({}));
        const p = Array.isArray(data) ? data[0] : (data?.page || data);
        setPage(p || null);
      } catch (e) {
        if (e.name !== "AbortError") setErr(e.message || "Kon pagina niet laden");
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [slug]);

  // Title/SEO
  useEffect(() => {
    const t = page?.title || (slug ? String(slug) : "Pagina");
    document.title = `FuellinQ — ${t}`;
  }, [page, slug]);

  if (err) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, color: "crimson" }}>Fout: {err}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        {!noBanner && <img src={bannerUrl} alt="" style={styles.banner} />}
        <LoadingCard />
      </div>
    );
  }

  if (!page) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>Geen inhoud gevonden.</div>
      </div>
    );
  }

  const title = page.title || slug;
  const bodyText = page.content_md ?? page.body ?? ""; // platte tekst of markdown-achtige string
  const bodyHtml = page.content_html; // optioneel: door backend gerenderde HTML
  const mayRenderHtml = page.render_html === true || typeof bodyHtml === "string";

  // “Overzicht” layout automatisch herkennen
  const isOverview = useMemo(() => {
    const s = (slug || "").toLowerCase();
    const t = (title || "").toLowerCase();
    return s.includes("overzicht") || t.includes("overzicht") || page?.layout === "overview";
  }, [slug, title, page?.layout]);

  // Stats (optioneel uit API)
  const vehicles = page?.stats?.vehicles ?? 1;
  const passes = page?.stats?.passes ?? 1;
  const openInvoices = page?.stats?.open_invoices ?? 2;

  // Media: string of array
  const medias = useMemo(() => {
    if (!page?.media_url) return [];
    return Array.isArray(page.media_url) ? page.media_url : [page.media_url];
  }, [page?.media_url]);

  return (
    <div style={styles.container}>
      {!noBanner && (
        <img
          src={bannerUrl}
          alt="Betalen met FuellinQ bij de pomp"
          style={styles.banner}
        />
      )}

      {isOverview && (
        <OverviewCards vehicles={vehicles} passes={passes} openInvoices={openInvoices} />
      )}

      <div style={styles.card}>
        <h2 style={styles.title}>{title}</h2>

        {/* Body: eerst veilig als tekst; als backend expliciet HTML levert, mag het ook als HTML */}
        {mayRenderHtml ? (
          <div
            // ⚠️ Alleen gebruiken als je de HTML vertrouwt (server-side gesaneerd)!
            dangerouslySetInnerHTML={{ __html: bodyHtml || "" }}
          />
        ) : (
          <div style={styles.bodyPre}>{bodyText}</div>
        )}

        {/* Media (meerdere items ondersteund) */}
        {medias.map((m, i) =>
          typeof m === "string" && m.toLowerCase().endsWith(".mp4") ? (
            <video key={`mv-${i}`} src={m} controls style={styles.media} />
          ) : (
            <img key={`mi-${i}`} src={typeof m === "string" ? m : m?.url} alt="" style={styles.media} />
          )
        )}
      </div>
    </div>
  );
}
