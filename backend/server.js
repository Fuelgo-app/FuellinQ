// server.js — FuellinQ backend MVP (CommonJS)

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { randomUUID } = require("crypto");

// ── Core
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");

// ── DB pool
const pool = require("./db/pool");

// ── Exports / mail
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

// ── Routers (raw imports)
const partnerRouter = require("./routes/partner");
const co2Routes = require("./routes/co2");
let stationsRouter = null;
try { stationsRouter = require("./routes/stations"); } catch { stationsRouter = null; }
let rdwRoutes = null;
try { rdwRoutes = require("./routes/rdw"); } catch { rdwRoutes = null; }
// Optionele routes index (met nieuwe guards)
let routesIndex = null;
try { routesIndex = require("./routes"); } catch { routesIndex = null; }

// ───────────────── App & config ─────────────────
const app = express();
const PORT = Number(process.env.PORT || 3001);
const WEB_BASE_URL = (process.env.WEB_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

// ───────────────── Crash-safety ─────────────────
process.on("unhandledRejection", (err) => console.error("UnhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("UncaughtException:", err));

// ───────────────── Proxy trust ─────────────────
app.set("trust proxy", true);

// ───────────────── CORS ─────────────────
const { URL } = require("url");
const RAW_CORS = process.env.CORS_ORIGIN || WEB_BASE_URL; // CSV of single
const ALLOWED_ORIGINS = RAW_CORS.split(",").map((s) => s.trim()).filter(Boolean);

const corsOrigin = (origin, cb) => {
  if (!origin) return cb(null, true); // curl, native apps
  try {
    const o = new URL(origin);
    const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(o.hostname);
    if (isLocalhost) return cb(null, true);
    for (const allowed of ALLOWED_ORIGINS) {
      const w = new URL(allowed);
      const match = o.protocol === w.protocol && o.hostname === w.hostname && (w.port ? o.port === w.port : true);
      if (match) return cb(null, true);
    }
    return cb(null, false);
  } catch {
    return cb(null, false);
  }
};

// ─────────────── Health / DB info (publiek) ───────────────
app.get("/_health", async (_req, res) => {
  try { const r = await pool.query("select 1 as db"); res.json({ ok: true, db: r.rows[0].db === 1 }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.get("/_dbinfo", async (_req, res) => {
  const q = `
    select table_name, coalesce(s.reltuples::bigint,0) as approx_rows
    from information_schema.tables t
    left join pg_class s on s.relname=t.table_name
    where t.table_schema='public' and t.table_type='BASE TABLE'
    order by 1;`;
  try { const { rows } = await pool.query(q); res.json({ ok: true, tables: rows }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
// Extra DB–gezondheidscheck met nette hints
app.get("/health/db", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT now() AS now, current_database() AS db, current_user AS user;"
    );
    res.json({ ok: true, ...rows[0] });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e?.message || String(e),
      hint:
        "Check DATABASE_URL/PGSSLMODE en of de DB bereikbaar is. Zie backend/db/pool.js logs.",
    });
  }
});

// ───────────────── Stripe (optioneel) ─────────────────
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

/* ===========================================================
   Stripe webhook heeft RAW body nodig (vóór express.json)
=========================================================== */
if (stripe) {
  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Stripe signature verify failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const customerId = session.customer || null;
          const subscriptionId = session.subscription || null;
          const companyId = Number(session.metadata?.company_id || 0);
          if (companyId) {
            await pool.query(
              `UPDATE companies
                 SET stripe_customer_id=$1,
                     stripe_subscription_id=$2,
                     stripe_subscription_status=$3,
                     plan_price_id=COALESCE(plan_price_id,$4)
               WHERE id=$5`,
              [customerId, subscriptionId, "active", process.env.STRIPE_FIXED_PRICE_ID || null, companyId]
            );

            if (process.env.STRIPE_METERED_PRICE_ID && subscriptionId) {
              const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
              const hasMetered = sub.items.data.some((it) => it.price?.id === process.env.STRIPE_METERED_PRICE_ID);
              if (!hasMetered) {
                const created = await stripe.subscriptionItems.create({
                  subscription: subscriptionId,
                  price: process.env.STRIPE_METERED_PRICE_ID,
                });
                await pool.query(
                  `UPDATE companies
                      SET stripe_metered_price_id=$1,
                          stripe_metered_item_id=$2
                    WHERE id=$3`,
                  [process.env.STRIPE_METERED_PRICE_ID, created.id, companyId]
                );
              }
            }
          }
          break;
        }
        case "customer.subscription.updated":
        case "customer.subscription.created":
        case "customer.subscription.deleted":
        case "customer.subscription.paused":
        case "customer.subscription.resumed": {
          const sub = event.data.object;
          await pool.query(
            `UPDATE companies
                SET stripe_subscription_status=$1
              WHERE stripe_subscription_id=$2`,
            [sub.status, sub.id]
          );
          break;
        }
        default:
          break;
      }
      res.json({ received: true });
    } catch (e) {
      console.error("Webhook handling error:", e);
      res.status(500).send("handler_error");
    }
  });
}

// ───────────────── Parsers & common middleware ─────────────────
// LET OP: pas ná de Stripe-raw-body:
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser()); // ← voor guards met cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ───────────────── Public statics ─────────────────
const UPLOAD_DIR = path.join(__dirname, "uploads");
const OFFER_DIR = path.join(UPLOAD_DIR, "offers");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OFFER_DIR, { recursive: true });

app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    },
  })
);

// Optioneel: wallet-pass demo files
const WALLET_DIR = path.join(__dirname, "public", "wallet-pass");
if (fs.existsSync(WALLET_DIR)) {
  app.use("/wallet-pass", express.static(WALLET_DIR, { maxAge: "1d" }));
}
// Demo assets
app.use("/offers", express.static(path.join(__dirname, "public", "offers"), { maxAge: "1d" }));

// ───────────────── Multer (uploads) ─────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base =
      path
        .basename(file.originalname, ext)
        .replace(/[^a-z0-9_-]/gi, "_")
        .slice(0, 40) || "file";
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(/^(image\/(png|jpe?g|webp|gif|svg\+xml|heic)|video\/mp4)$/i.test(file.mimetype) ? null : new Error("unsupported_type")),
});

// ───────────────── JWT helpers ─────────────────
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, stationId: user.station_id || null },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "7d" }
  );
}
function getUserId(req) { return req.user?.userId; }

/* =============== AUTH MIDDLEWARE: allowlist (public) + JWT/cookie (private) =============== */
function isPublicPath(pathname) {
  return (
    // Partner public
    /^\/api\/partner\/public(\/.*)?$/.test(pathname) ||
    /^\/api\/partner\/utils\/geocode(\/.*)?$/.test(pathname) ||
    /^\/api\/partner\/address-lookup(\/.*)?$/.test(pathname) ||
    /^\/api\/partner\/geocode(\/.*)?$/.test(pathname) ||
    /^\/api\/partner\/health$/.test(pathname) ||
    // Stripe webhook
    /^\/webhooks\/stripe(\/.*)?$/.test(pathname) ||
    // Uploads
    /^\/uploads(\/.*)?$/.test(pathname) ||
    // CO₂ public
    /^\/api\/co2\/vehicle\/lookup$/.test(pathname) ||
    /^\/api\/co2\/webhook\/transaction$/.test(pathname) ||
    /^\/api\/co2\/vehicle\/[^/]+\/report$/.test(pathname) ||
    /^\/api\/co2\/vehicle\/\d+\/preview$/.test(pathname) ||
    // RDW (optioneel)
    /^\/api\/rdw(\/.*)?$/.test(pathname) ||
    // Misc public
    /^\/health$/.test(pathname) ||
    /^\/api\/ping$/.test(pathname) ||
    /^\/api\/loyalty$/.test(pathname)
  );
}
function maybeAuth(req, res, next) {
  if (req.method === "OPTIONS") return next();
  const pathOnly = (req.originalUrl || "").split("?")[0];
  if (isPublicPath(pathOnly)) return next();

  // 1) Bearer token
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret"); return next(); }
    catch { return res.status(401).json({ error: "invalid_token" }); }
  }
  // 2) HttpOnly cookie (bijv. "token")
  const cookieToken = req.cookies?.token;
  if (cookieToken) {
    try { req.user = jwt.verify(cookieToken, process.env.JWT_SECRET || "devsecret"); return next(); }
    catch { return res.status(401).json({ error: "invalid_token" }); }
  }
  return res.status(401).json({ error: "missing_token" });
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}

// ───────────────── Helpers ─────────────────
async function ensureCompanyId(userId, fallbackName = "Mijn Bedrijf") {
  const u = await pool.query("SELECT company_id FROM users WHERE id=$1", [userId]);
  let companyId = u.rows[0]?.company_id || null;
  if (!companyId) {
    const c = await pool.query("INSERT INTO companies(name) VALUES ($1) RETURNING id", [fallbackName]);
    companyId = c.rows[0].id;
    await pool.query("UPDATE users SET company_id=$1 WHERE id=$2", [companyId, userId]);
  }
  return companyId;
}
async function findUserByEmail(email) {
  const q = await pool.query(
    `SELECT id, company_id, email, password_hash, role, first_name, last_name
       FROM users
      WHERE lower(email)=lower($1)
      LIMIT 1`,
    [email]
  );
  return q.rows[0] || null;
}
function generateLast4() { return String(Math.floor(1000 + Math.random() * 9000)); }
function _tokenFrom(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "anon";
}

// ───────────────── RDW (Socrata) helper (voor inline endpoints) ─────────────────
const RDW_BASE = (process.env.RDW_BASE_URL || "https://opendata.rdw.nl/resource").replace(/\/+$/, "");
const RDW_APP_TOKEN = process.env.RDW_APP_TOKEN || process.env.RDW_API_TOKEN || "";
const _fetch = global.fetch || (async (...args) => { const { default: f } = await import("node-fetch"); return f(...args); });
async function fetchJson(url, { qs = null, headers = {}, timeoutMs = 8000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const qstr =
      qs && Object.keys(qs).length
        ? "?" + Object.entries(qs).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
        : "";
    const res = await _fetch(url + qstr, {
      method: "GET",
      headers: { Accept: "application/json", ...(RDW_APP_TOKEN ? { "X-App-Token": RDW_APP_TOKEN } : {}), ...headers },
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}
async function rdwDataset(datasetId, qs) { return fetchJson(`${RDW_BASE}/${datasetId}.json`, { qs }); }
function cleanPlate(p) { return String(p || "").toUpperCase().replace(/[^0-9A-Z]/g, ""); }

// ───────────────── Publieke basic routes ─────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", message: "Backend draait goed 🚀" }));
app.get("/api/ping", (_req, res) => res.json({ pong: true, ts: Date.now() }));
app.get("/api/partner/health", (_req, res) => res.json({ ok: true, service: "partner", ts: Date.now() }));
app.get("/api/loyalty", (_req, res) => res.json({ points: 0, tier: "bronze" }));

// ───────────────── Auth (publiek) ─────────────────
// (Bestaand inline auth blijft beschikbaar; je nieuwe routes/services/auth.js kan hiernaast bestaan)
app.post(["/auth/register", "/register"], async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_fields" });
    const exists = await findUserByEmail(email);
    if (exists) return res.status(409).json({ error: "email_in_use" });

    const c = await pool.query("INSERT INTO companies(name) VALUES ($1) RETURNING id", ["Mijn Bedrijf"]);
    const companyId = c.rows[0].id;

    const hash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `INSERT INTO users (company_id,email,password_hash,role,first_name,last_name)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, company_id, email, role, first_name, last_name`,
      [companyId, email, hash, "user", first_name || "", last_name || ""]
    );
    const user = ins.rows[0];
    const token = signToken(user);
    // Voor cookie-based auth kun je ook een httpOnly cookie zetten:
    // res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*3600*1000 });
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.post(["/auth/login", "/login"], async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_fields" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid_login" });
    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok) return res.status(401).json({ error: "invalid_login" });
    const token = signToken(user);
    delete user.password_hash;

    // Indien gewenst cookie-modus:
    // res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7*24*3600*1000 });

    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.get("/me", (req, res) => {
  try {
    const h = req.headers.authorization || "";
    if (!h.startsWith("Bearer ")) return res.status(401).json({ error: "missing_token" });
    const payload = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
    pool
      .query(
        `SELECT id, company_id, email, role, first_name, last_name
           FROM users WHERE id=$1`,
        [payload.userId]
      )
      .then((q) => {
        const user = q.rows[0];
        if (!user) return res.status(404).json({ error: "not_found" });
        res.json({ user });
      })
      .catch((e) => {
        console.error(e);
        res.status(500).json({ error: "server_error" });
      });
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
});

/* ============ /api paths: auth-gated met allowlist uitzonderingen ============ */
app.use("/api", maybeAuth);

// ───────────────── CO₂ routes (router + inline RDW endpoints) ─────────────────

// Inline publieke RDW endpoints
app.get("/api/co2/vehicle/lookup", async (req, res) => {
  try {
    const plate = cleanPlate(req.query.plate);
    if (!plate) return res.status(400).json({ error: "missing_plate" });

    const voertuigen = await rdwDataset("m9d7-ebf2", { kenteken: plate, $limit: 1 });
    if (!voertuigen.length) return res.status(404).json({ error: "not_found", plate });

    const v = voertuigen[0];
    let brandstof = null;
    try {
      const fuels = await rdwDataset("8ys7-d773", { kenteken: plate, $limit: 1 });
      brandstof = fuels[0]?.brandstof_omschrijving || null;
    } catch (_) {}

    const resp = {
      id: plate,
      plate,
      merk: v.merk || null,
      handelsbenaming: v.handelsbenaming || null,
      voertuigsoort: v.voertuigsoort || null,
      eerste_toelating: v.datum_eerste_toelating || null,
      zuinigheidslabel: v.zuinigheidslabel || null,
      brandstof: brandstof,
    };
    if (!RDW_APP_TOKEN) resp.warning = "RDW_APP_TOKEN ontbreekt; gebruik een Socrata App Token voor stabiele limieten.";
    res.json(resp);
  } catch (e) {
    console.error("rdw lookup error:", e);
    res.status(502).json({ error: "rdw_unavailable" });
  }
});

app.get("/api/co2/vehicle/:plate/report", async (req, res) => {
  try {
    const plate = cleanPlate(req.params.plate);
    if (!plate) return res.status(400).json({ error: "missing_plate" });

    const voertuigen = await rdwDataset("m9d7-ebf2", { kenteken: plate, $limit: 1 });
    if (!voertuigen.length) return res.status(404).json({ error: "not_found", plate });
    const v = voertuigen[0];

    let brandstof = null;
    try {
      const fuels = await rdwDataset("8ys7-d773", { kenteken: plate, $limit: 1 });
      brandstof = fuels[0]?.brandstof_omschrijving || null;
    } catch (_) {}

    const year = v.datum_eerste_toelating ? v.datum_eerste_toelating.slice(0, 4) : null;

    res.json({
      plate,
      summary: {
        merk: v.merk || null,
        type: v.handelsbenaming || null,
        bouwjaar: year,
        brandstof: brandstof,
        voertuigsoort: v.voertuigsoort || null,
      },
      rdw_raw: { voertuig: v },
    });
  } catch (e) {
    console.error("rdw report error:", e);
    res.status(502).json({ error: "rdw_unavailable" });
  }
});

// ───────────────── Ensure tables (idempotent) ─────────────────
async function ensureCmsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_pages (
      company_id INT REFERENCES companies(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT,
      body TEXT,
      media_url TEXT,
      updated_at timestamptz DEFAULT now(),
      PRIMARY KEY (company_id, slug)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_footer (
      company_id INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      links JSONB DEFAULT '{}'::jsonb,
      updated_at timestamptz DEFAULT now()
    );
  `);
}
async function ensureCoreTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id serial PRIMARY KEY,
      company_id INT REFERENCES companies(id) ON DELETE SET NULL,
      plate TEXT NOT NULL,
      label TEXT DEFAULT '',
      limit_daily INTEGER DEFAULT 0,
      geofence_required BOOLEAN DEFAULT FALSE,
      created_at timestamptz DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      id serial PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      last4 TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT FALSE,
      status TEXT DEFAULT 'active',
      card_ref TEXT,
      issued_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_card_per_user
      ON cards(user_id) WHERE active = TRUE;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id serial PRIMARY KEY,
      number TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'open',
      created_at timestamptz DEFAULT now()
    );
  `);
}
async function ensureTransactionExportView() {
  await pool.query(`
    CREATE OR REPLACE VIEW v_transaction_export AS
    SELECT
      t.id,
      t.user_id,
      t.created_at::date AS datum,
      COALESCE(t.merchant,'') AS station,
      COALESCE(t.description,'') AS omschrijving,
      t.category,
      COALESCE(t.vat_rate,21) AS vat_rate,
      ROUND(t.amount::numeric, 2) AS bedrag_incl,
      ROUND((t.amount * (COALESCE(t.vat_rate,21)/(100+COALESCE(t.vat_rate,21)))), 2) AS btw,
      ROUND((t.amount - (t.amount * (COALESCE(t.vat_rate,21)/(100+COALESCE(t.vat_rate,21))))), 2) AS bedrag_excl
    FROM transactions t;
  `);
}
ensureCmsTables().catch((e) => console.error("ensureCmsTables failed:", e));
ensureCoreTables().catch((e) => console.error("ensureCoreTables failed:", e));
ensureTransactionExportView().catch((e) => console.error("ensureTransactionExportView failed:", e));

/* ───────────────── Router normalizer + veilige mounts ───────────────── */
function asRouter(mod) {
  if (!mod) return null;
  if (typeof mod === "function") return mod;                          // module.exports = router
  if (mod.router && typeof mod.router === "function") return mod.router; // module.exports = { router }
  if (mod.default && typeof mod.default === "function") return mod.default; // ESM default
  return null;
}

// Debug logging: zie wat er binnenkomt (1x bij start)
console.log("partnerRouter:", typeof partnerRouter, partnerRouter && Object.keys(partnerRouter));
console.log("co2Routes:", typeof co2Routes, co2Routes && Object.keys(co2Routes));
console.log("stationsRouter:", typeof stationsRouter, stationsRouter && Object.keys(stationsRouter));
console.log("rdwRoutes:", typeof rdwRoutes, rdwRoutes && Object.keys(rdwRoutes));
console.log("routesIndex:", typeof routesIndex, routesIndex && Object.keys(routesIndex));

// Partner & Stations routers
const partnerR = asRouter(partnerRouter);
if (partnerR) app.use("/api/partner", partnerR); else console.warn("⚠️ routes/partner export is geen Router (skip)");

const stationsR = asRouter(stationsRouter);
if (stationsR) app.use("/api", stationsR);
else if (stationsRouter) console.warn("⚠️ routes/stations export is geen Router (skip)");

// CO₂ router
const co2R = asRouter(co2Routes);
if (co2R) app.use("/api/co2", co2R);
else if (co2Routes) console.warn("⚠️ routes/co2 export is geen Router (skip)");

// RDW router (optioneel)
const rdwR = asRouter(rdwRoutes);
if (rdwR) app.use("/api/rdw", rdwR);
else if (rdwRoutes) console.warn("⚠️ routes/rdw export is geen Router (skip)");

// Routes index met guards (indien aanwezig)
const routesR = asRouter(routesIndex);
if (routesR) app.use("/api", routesR);

// ================== Vehicles API (sample) ==================
app.get("/api/vehicles", async (_req, res) => {
  const q = await pool.query(
    `SELECT id, plate, label, limit_daily as "limitDaily", geofence_required as "geofenceRequired"
       FROM vehicles
      ORDER BY id DESC`
  );
  res.json(q.rows);
});
app.post("/api/vehicles", async (req, res) => {
  const { plate, label, limitDaily = 0, geofenceRequired = false } = req.body || {};
  if (!plate) return res.status(400).json({ error: "missing_plate" });
  const ins = await pool.query(
    `INSERT INTO vehicles (company_id, plate, label, limit_daily, geofence_required)
     VALUES (null, $1, $2, $3, $4)
     RETURNING id, plate, label, limit_daily as "limitDaily", geofence_required as "geofenceRequired"`,
    [plate, label || "", Number(limitDaily) || 0, !!geofenceRequired]
  );
  res.status(201).json(ins.rows[0]);
});
app.put("/api/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { label, limitDaily = 0, geofenceRequired = false } = req.body || {};
    const { rowCount, rows } = await pool.query(
      `UPDATE vehicles
          SET label=$1, limit_daily=$2, geofence_required=$3
        WHERE id=$4
      RETURNING id, plate, label, limit_daily as "limitDaily", geofence_required as "geofenceRequired"`,
      [label || "", Number(limitDaily) || 0, !!geofenceRequired, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "update_failed" });
  }
});
app.delete("/api/vehicles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query("DELETE FROM vehicles WHERE id=$1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "delete_failed" });
  }
});

/* ================== Wallet/Cards ================== */
app.get("/api/cards", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      "SELECT id, label, last4, active FROM cards WHERE user_id=$1 ORDER BY id",
      [userId]
    );
    res.json({ cards: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Kon passen niet ophalen" });
  }
});
app.post("/api/cards", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { label } = req.body || {};
    if (!label) return res.status(400).json({ error: "missing_label" });

    const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS n FROM cards WHERE user_id=$1", [userId]);
    const isFirst = (cnt[0]?.n || 0) === 0;
    const last4 = generateLast4();

    const { rows } = await pool.query(
      `INSERT INTO cards (user_id, label, last4, active)
       VALUES ($1,$2,$3,$4)
       RETURNING id, label, last4, active`,
      [userId, label, last4, isFirst]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Toevoegen mislukt" });
  }
});
app.post("/api/cards/select", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { cardId } = req.body || {};
    if (!cardId) return res.status(400).json({ error: "cardId ontbreekt" });
    await pool.query("UPDATE cards SET active=FALSE WHERE user_id=$1", [userId]);
    const { rowCount } = await pool.query("UPDATE cards SET active=TRUE WHERE user_id=$1 AND id=$2", [userId, cardId]);
    if (rowCount === 0) return res.status(404).json({ error: "Pas niet gevonden" });
    res.json({ ok: true, active_card_id: Number(cardId) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Kon actieve pas niet wijzigen" });
  }
});
app.delete("/api/cards/:id", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { rows: wasActive } = await pool.query("SELECT active FROM cards WHERE user_id=$1 AND id=$2", [userId, id]);
    if (wasActive.length === 0) return res.status(404).json({ error: "Pas niet gevonden" });
    await pool.query("DELETE FROM cards WHERE user_id=$1 AND id=$2", [userId, id]);
    if (wasActive[0].active) {
      await pool.query(
        `
        WITH latest AS (
          SELECT id FROM cards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1
        )
        UPDATE cards SET active=TRUE
          WHERE user_id=$1 AND id=(SELECT id FROM latest)
      `,
        [userId]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Verwijderen mislukt" });
  }
});

/* ================== Branding / Admin ================== */
app.get("/api/brand", async (req, res) => {
  try {
    const u = await pool.query("SELECT company_id FROM users WHERE id=$1", [getUserId(req)]);
    const companyId = u.rows[0]?.company_id || null;
    if (!companyId) return res.json({});
    const q = await pool.query(
      `SELECT company_id, brand_name, logo_url, primary_color, secondary_color, font_family
         FROM company_settings
        WHERE company_id=$1`,
      [companyId]
    );
    res.json(q.rows[0] || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    let u = await pool.query("SELECT id, company_id FROM users WHERE id=$1", [getUserId(req)]);
    let companyId = u.rows[0]?.company_id || null;
    if (!companyId) {
      const companyName = req.body?.brand_name || "Mijn Bedrijf";
      const c = await pool.query("INSERT INTO companies(name) VALUES ($1) RETURNING id", [companyName]);
      companyId = c.rows[0].id;
      await pool.query("UPDATE users SET company_id=$1 WHERE id=$2", [companyId, getUserId(req)]);
    }

    const { brand_name, logo_url, primary_color, secondary_color, font_family } = req.body || {};
    const up = await pool.query(
      `INSERT INTO company_settings (company_id, brand_name, logo_url, primary_color, secondary_color, font_family)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (company_id) DO UPDATE
         SET brand_name=EXCLUDED.brand_name,
             logo_url=EXCLUDED.logo_url,
             primary_color=EXCLUDED.primary_color,
             secondary_color=EXCLUDED.secondary_color,
             font_family=EXCLUDED.font_family,
             updated_at=now()
       RETURNING company_id, brand_name, logo_url, primary_color, secondary_color, font_family`,
      [companyId, brand_name || null, logo_url || null, primary_color || null, secondary_color || null, font_family || null]
    );
    res.json({ ok: true, settings: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

/* ================== CMS: Pages & Footer ================== */
app.get("/api/pages/:slug", async (req, res) => {
  try {
    const slug = (req.params.slug || "").toLowerCase();
    const companyId = await ensureCompanyId(getUserId(req));
    const q = await pool.query(
      `SELECT slug, title, body, media_url
         FROM company_pages
        WHERE company_id=$1 AND slug=$2`,
      [companyId, slug]
    );
    res.json(q.rows[0] || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.put("/api/admin/pages/:slug", requireAdmin, async (req, res) => {
  try {
    const slug = (req.params.slug || "").toLowerCase();
    const companyId = await ensureCompanyId(getUserId(req), req.body?.title || "Mijn Bedrijf");
    const { title, body, media_url } = req.body || {};
    const up = await pool.query(
      `INSERT INTO company_pages (company_id, slug, title, body, media_url)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (company_id, slug) DO UPDATE
         SET title=EXCLUDED.title,
             body=EXCLUDED.body,
             media_url=EXCLUDED.media_url,
             updated_at=now()
       RETURNING slug, title, body, media_url`,
      [companyId, slug, title || null, body || null, media_url || null]
    );
    res.json({ ok: true, page: up.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Upload (admin) + preflight
app.options("/api/admin/upload", cors());
app.post("/api/admin/upload", requireAdmin, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "file_too_large" });
      return res.status(400).json({ error: err.message || "upload_failed" });
    }
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url, name: req.file.originalname, size: req.file.size, type: req.file.mimetype });
  });
});

app.get("/api/footer", async (req, res) => {
  try {
    const companyId = await ensureCompanyId(getUserId(req));
    const q = await pool.query("SELECT links FROM company_footer WHERE company_id=$1", [companyId]);
    res.json(q.rows[0]?.links || {});
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.put("/api/admin/footer", requireAdmin, async (req, res) => {
  try {
    const companyId = await ensureCompanyId(getUserId(req));
    const links = req.body?.links || {};
    const up = await pool.query(
      `INSERT INTO company_footer (company_id, links)
       VALUES ($1,$2::jsonb)
       ON CONFLICT (company_id) DO UPDATE
         SET links=EXCLUDED.links,
             updated_at=now()
       RETURNING links`,
      [companyId, JSON.stringify(links)]
    );
    res.json({ ok: true, links: up.rows[0].links });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

/* ================== Onboarding MOCK ================== */
const _onbSessions = new Map();
function isBankLinked(req) {
  const token = _tokenFrom(req);
  const s = _onbSessions.get(token);
  return !!s?.linked;
}
app.post("/api/bank/link", (req, res) => {
  const token = _tokenFrom(req);
  const bank = (req.body?.bank || "").toLowerCase();
  if (!bank) return res.status(400).json({ error: "Bank ontbreekt" });
  _onbSessions.set(token, { bank, startedAt: Date.now(), linked: false });
  setTimeout(() => {
    const s = _onbSessions.get(token);
    if (s && !s.linked) _onbSessions.set(token, { ...s, linked: true, linkedAt: Date.now() });
  }, 5000);
  res.json({ started: true, bank });
});
app.get("/api/bank/status", (req, res) => {
  const s = _onbSessions.get(_tokenFrom(req));
  res.json({ linked: !!s?.linked, bank: s?.bank || null });
});
// Wallet pass links
app.post("/api/wallet/pass", (req, res) => {
  const s = _onbSessions.get(_tokenFrom(req));
  if (!s || !s.linked) return res.status(400).json({ error: "bank_not_linked" });
  const url = `${WEB_BASE_URL}/wallet-pass/demo.pkpass`;
  res.json({ url, appleUrl: url, googleUrl: `${WEB_BASE_URL}/wallet-pass/google-demo` });
});
app.post("/api/wallet/apple/:cardId", (req, res) => {
  const { cardId } = req.params;
  const url = `${WEB_BASE_URL}/wallet/add/apple?c=${encodeURIComponent(cardId)}`;
  res.json({ url });
});
app.post("/api/wallet/google/:cardId", (req, res) => {
  const { cardId } = req.params;
  const url = `${WEB_BASE_URL}/wallet/add/google?c=${encodeURIComponent(cardId)}`;
  res.json({ url });
});
app.delete("/api/mock/reset", (req, res) => {
  _onbSessions.delete(_tokenFrom(req));
  res.json({ ok: true });
});

/* ================== Invoices API ================== */
app.get("/api/invoices", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, number, amount_cents, status, to_char(created_at, 'YYYY-MM-DD') as date
         FROM invoices
        ORDER BY created_at DESC`
    );
    const invoices = rows.map((r) => ({ ...r, amount: r.amount_cents }));
    res.json({ invoices });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fetch_invoices_failed" });
  }
});

/* ================== Billing endpoints ================== */
function clampAmountCents(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 2500;
  return Math.max(100, Math.min(Math.round(n), 50000));
}
app.post("/api/billing/checkout", async (req, res) => {
  try {
    if (!stripe) {
      return res.json({ ok: true, url: `${WEB_BASE_URL}/app/checkout-demo?mode=sub` });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card", "ideal"],
      line_items: [{ price: process.env.STRIPE_FIXED_PRICE_ID, quantity: 1 }],
      metadata: { company_id: String(await ensureCompanyId(getUserId(req))) },
      success_url: `${WEB_BASE_URL}/app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${WEB_BASE_URL}/app/cancel`,
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    console.error("billing/checkout error:", e);
    res.status(500).json({ error: "checkout_failed" });
  }
});
app.post("/api/billing/portal", async (req, res) => {
  try {
    if (!stripe) return res.json({ ok: true, url: `${WEB_BASE_URL}/app/billing-portal-demo` });
    const companyId = await ensureCompanyId(getUserId(req));
    const { rows } = await pool.query("SELECT stripe_customer_id FROM companies WHERE id=$1", [companyId]);
    const customer = rows[0]?.stripe_customer_id;
    if (!customer) return res.json({ ok: true, url: `${WEB_BASE_URL}/app/billing-portal-demo` });
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${WEB_BASE_URL}/app/settings`,
    });
    res.json({ ok: true, url: session.url });
  } catch (e) {
    console.error("billing/portal error:", e);
    res.status(500).json({ error: "portal_failed" });
  }
});
app.post("/api/billing/usage", async (_req, res) => { res.json({ ok: true }); });

/* ================== Transactions — list/summary/export/email ================== */
function _vatFromGross(gross, vatRate) {
  const g = Number(gross || 0), r = Number(vatRate || 0);
  if (!g || !r) return 0;
  return Number((g * (r / (100 + r))).toFixed(2));
}
function _r2(n) { return Math.round(Number(n || 0) * 100) / 100; }

app.get("/api/transactions/list", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      `SELECT id,
              created_at::date AS date,
              COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS description,
              category,
              COALESCE(vat_rate,21) AS vat_rate,
              amount::numeric AS amount_incl
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1000`,
      [userId]
    );
    const items = rows.map((r) => {
      const vat = _vatFromGross(r.amount_incl, r.vat_rate);
      return {
        id: r.id,
        date: r.date,
        station: r.station,
        description: r.description,
        category: r.category,
        vat_rate: Number(r.vat_rate),
        amount_incl: Number(r.amount_incl),
        vat: vat,
        amount_excl: Number((Number(r.amount_incl) - vat).toFixed(2)),
      };
    });
    res.json({ items });
  } catch (e) {
    console.error("transactions/list", e);
    res.status(500).json({ error: "list_failed" });
  }
});

app.get("/api/transactions/summary", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      `SELECT category,
              SUM(amount)::numeric AS total_gross,
              SUM(amount * (COALESCE(vat_rate,21)/(100+COALESCE(vat_rate,21))))::numeric AS total_vat
         FROM transactions
        WHERE user_id = $1
        GROUP BY category`,
      [userId]
    );
    const fuel = rows.find((r) => r.category === "fuel") || { total_gross: 0, total_vat: 0 };
    const shop = rows.find((r) => r.category === "shop") || { total_gross: 0, total_vat: 0 };
    const grand_gross = _r2(Number(fuel.total_gross || 0) + Number(shop.total_gross || 0));
    const grand_vat = _r2(Number(fuel.total_vat || 0) + Number(shop.total_vat || 0));
    res.json({
      fuel: { total_gross: _r2(fuel.total_gross || 0), total_vat: _r2(fuel.total_vat || 0) },
      shop: { total_gross: _r2(shop.total_gross || 0), total_vat: _r2(shop.total_vat || 0) },
      grand: { total_gross: grand_gross, total_vat: grand_vat },
    });
  } catch (e) {
    console.error("transactions/summary", e);
    res.status(500).json({ error: "summary_failed" });
  }
});

app.get("/api/transactions/export.csv", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { from, to } = req.query;
    const params = [userId];
    let where = "WHERE user_id = $1";
    if (from) { params.push(from); where += ` AND created_at::date >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND created_at::date <= $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT created_at::date AS datum,
              COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving,
              category,
              COALESCE(vat_rate,21) AS vat_rate,
              amount::numeric AS bedrag_incl
         FROM transactions
        ${where}
        ORDER BY created_at DESC
        LIMIT 5000`,
      params
    );

    const header = ["Datum", "Station", "Omschrijving", "Categorie", "BTW%", "Bedrag (incl)", "BTW", "Bedrag (excl)"];
    const lines = [header.join(";")];
    rows.forEach((r) => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = _r2(Number(r.bedrag_incl) - btw);
      lines.push(
        [
          r.datum,
          String(r.station).replaceAll(";", ","),
          String(r.omschrijving).replaceAll(";", ","),
          r.category || "",
          r.vat_rate,
          _r2(r.bedrag_incl),
          btw,
          excl,
        ].join(";")
      );
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fuellinq-transacties.csv"');
    res.send(lines.join("\n"));
  } catch (e) {
    console.error("transactions/export.csv", e);
    res.status(500).json({ error: "csv_failed" });
  }
});

app.get("/api/transactions/export.xlsx", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { from, to } = req.query;
    const params = [userId];
    let where = "WHERE user_id = $1";
    if (from) { params.push(from); where += ` AND created_at::date >= $${params.length}`; }
    if (to)   { params.push(to);   where += ` AND created_at::date <= $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT created_at::date AS datum,
              COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving,
              category,
              COALESCE(vat_rate,21) AS vat_rate,
              amount::numeric AS bedrag_incl
         FROM transactions
        ${where}
        ORDER BY created_at DESC
        LIMIT 5000`,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Transacties");
    ws.columns = [
      { header: "Datum", key: "datum", width: 12 },
      { header: "Station", key: "station", width: 24 },
      { header: "Omschrijving", key: "omschrijving", width: 34 },
      { header: "Categorie", key: "category", width: 12 },
      { header: "BTW%", key: "vat_rate", width: 8 },
      { header: "Bedrag (incl)", key: "bedrag_incl", width: 16 },
      { header: "BTW", key: "btw", width: 12 },
      { header: "Bedrag (excl)", key: "bedrag_excl", width: 16 },
    ];
    rows.forEach((r) => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = Math.round((Number(r.bedrag_incl) - btw) * 100) / 100;
      ws.addRow({
        datum: r.datum,
        station: r.station,
        omschrijving: r.omschrijving,
        category: r.category,
        vat_rate: Number(r.vat_rate),
        bedrag_incl: Math.round(Number(r.bedrag_incl) * 100) / 100,
        btw,
        bedrag_excl: excl,
      });
    });

    const n = ws.rowCount;
    if (n >= 2) {
      ws.addRow({});
      ws.addRow({});
      const base = n + 2;
      ws.getCell(`F${base}`).value = "Totaal (incl)";
      ws.getCell(`G${base}`).value = "BTW totaal";
      ws.getCell(`H${base}`).value = "Totaal (excl)";
      ws.getCell(`F${base + 1}`).value = { formula: `SUM(F2:F${n})` };
      ws.getCell(`G${base + 1}`).value = { formula: `SUM(G2:G${n})` };
      ws.getCell(`H${base + 1}`).value = { formula: `SUM(H2:H${n})` };
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="fuellinq-transacties.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    console.error("transactions/export.xlsx", e);
    res.status(500).json({ error: "xlsx_failed" });
  }
});

app.post("/api/transactions/email", async (req, res) => {
  try {
    const userId = getUserId(req);
    const toEmail = req.body?.to || req.user?.email || process.env.EXPORT_FROM_EMAIL || process.env.SMTP_USER;

    const { rows } = await pool.query(
      `SELECT created_at::date AS datum,
              COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving,
              category,
              COALESCE(vat_rate,21) AS vat_rate,
              amount::numeric AS bedrag_incl
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5000`,
      [userId]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Transacties");
    ws.columns = [
      { header: "Datum", key: "datum", width: 12 },
      { header: "Station", key: "station", width: 24 },
      { header: "Omschrijving", key: "omschrijving", width: 34 },
      { header: "Categorie", key: "category", width: 12 },
      { header: "BTW%", key: "vat_rate", width: 8 },
      { header: "Bedrag (incl)", key: "bedrag_incl", width: 16 },
      { header: "BTW", key: "btw", width: 12 },
      { header: "Bedrag (excl)", key: "bedrag_excl", width: 16 },
    ];
    rows.forEach((r) => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = _r2(Number(r.bedrag_incl) - btw);
      ws.addRow({
        datum: r.datum,
        station: r.station,
        omschrijving: r.omschrijving,
        category: r.category,
        vat_rate: Number(r.vat_rate),
        bedrag_incl: _r2(r.bedrag_incl),
        btw,
        bedrag_excl: excl,
      });
    });

    const buf = await wb.xlsx.writeBuffer();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.verify();
    await transporter.sendMail({
      from: `"${process.env.EXPORT_FROM_NAME || "FuellinQ"}" <${process.env.EXPORT_FROM_EMAIL || process.env.SMTP_USER}>`,
      to: toEmail,
      subject: "FuellinQ – Transactie export",
      text: "In de bijlage vind je je transactieoverzicht (Excel).",
      attachments: [{ filename: "fuellinq-transacties.xlsx", content: buf }],
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("transactions/email", e);
    res.status(500).json({ error: "email_failed", message: e.message });
  }
});

/* ================== Wallet: issue/active ================== */
app.post("/api/cards/issue", async (req, res) => {
  try {
    if (!isBankLinked(req)) {
      return res.status(400).json({ error: "bank_not_linked" });
    }
    const userId = getUserId(req);
    const label = (req.body?.label || "").trim() || "Mijn tankpas";
    const cardRef = randomUUID();
    const last4 = generateLast4();

    const { rows: cnt } = await pool.query("SELECT COUNT(*)::int AS n FROM cards WHERE user_id=$1", [userId]);
    const isFirst = (cnt[0]?.n || 0) === 0;

    const { rows } = await pool.query(
      `INSERT INTO cards (user_id, label, last4, active, status, card_ref, issued_at)
       VALUES ($1,$2,$3,$4,'active',$5, now())
       RETURNING id, label, last4, active, status, card_ref, issued_at`,
      [userId, label, last4, isFirst, cardRef]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "issue_failed" });
  }
});
app.get("/api/cards/active", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      `SELECT id, label, last4, active, status, card_ref, issued_at
         FROM cards
        WHERE user_id=$1 AND active=true
        LIMIT 1`,
      [userId]
    );
    res.json(rows[0] || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "active_card_failed" });
  }
});

// --- DB ping (publiek) ---
app.get("/db/ping", async (_req, res) => {
  try {
    const r = await pool.query("SELECT now() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) {
    console.error("db/ping failed:", e);
    res.status(500).json({ ok: false, error: e.code || e.message });
  }
});

// ─────────────── 404 & error fallback ───────────────
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "server_error" });
});

// ───────────────── Start (robuust) ─────────────────
function printRoutes(p) {
  console.log(`✅ FuellinQ backend running on http://localhost:${p}`);
  console.log(`🌍 Frontend: ${WEB_BASE_URL}`);
  console.log(`CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log("Publiek: /health, /health/db, /db/ping, /api/ping, /api/partner/health, /api/loyalty, /uploads/*, /webhooks/stripe");
  console.log("Publiek (allowlist): /api/partner/public/*, /api/partner/utils/geocode, /api/partner/address-lookup, /api/partner/geocode");
  console.log("Publiek (CO2): /api/co2/vehicle/lookup, /api/co2/vehicle/:plate/report, /api/co2/webhook/transaction");
  if (rdwRoutes) console.log("Publiek (RDW): /api/rdw/*");
  console.log("Partner: /api/partner/* (public + private; private = JWT/cookie guards)");
  console.log("API: /api/vehicles, /api/cards, /api/invoices, /api/transactions/*, /api/stations/*");
  console.log("Wallet: /api/cards/active, /api/cards/issue, /api/wallet/*");
  console.log("CMS/Branding/Admin: /api/brand, /api/admin/*, /api/pages/:slug, /api/footer");
  console.log("Billing/Webhooks: /api/billing/*, /webhooks/stripe");
  if (!RDW_APP_TOKEN) {
    console.log("⚠️ RDW_APP_TOKEN ontbreekt – requests werken, maar met strengere limieten. Zet RDW_APP_TOKEN in .env voor productie.");
  }
}

function start(port = PORT) {
  const server = app.listen(port, () => printRoutes(port));
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      const next = port + 1;
      console.warn(`Port ${port} in use, retry op ${next}...`);
      setTimeout(() => start(next), 250);
    } else {
      console.error("Server listen error:", err);
      process.exit(1);
    }
  });
}

// Alleen luisteren als dit bestand direct wordt uitgevoerd
if (require.main === module) { start(); }

module.exports = app;
