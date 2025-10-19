// server.js — FuellinQ backend (CommonJS, met allowlist guard)

require("dotenv").config();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { randomUUID } = require("crypto");

// Core
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const cookieParser = require("cookie-parser");

// DB pool
const pool = require("./db/pool");

// Exports / mail
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");

// Routers
const partnerRouter = require("./routes/partner");
const co2Routes = require("./routes/co2");
let stationsRouter = null;
try { stationsRouter = require("./routes/stations"); } catch { stationsRouter = null; }
let rdwRoutes = null;
try { rdwRoutes = require("./routes/rdw"); } catch { rdwRoutes = null; }
let routesIndex = null;
try { routesIndex = require("./routes"); } catch { routesIndex = null; }

// ───────────────── App & config ─────────────────
const app = express();
const PORT = Number(process.env.PORT || 3000);
const WEB_BASE_URL = (process.env.WEB_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

// ─────────────── Auth/Cookie config uit .env ───────────────
const SECURE_COOKIES = String(process.env.SECURE_COOKIES || "false") === "true";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // bv ".fuellinq.app" in prod
const COOKIE_PATH = process.env.COOKIE_PATH || "/";
const COOKIE_SAMESITE = (process.env.COOKIE_SAMESITE || (SECURE_COOKIES ? "None" : "Lax"));
const COOKIE_NAME = process.env.COOKIE_NAME || "token"; // naam voor access cookie

function cookieOptions() {
  const opts = {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: COOKIE_SAMESITE, // "None" vereist Secure=true (prod)
    path: COOKIE_PATH,
  };
  if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
  return opts;
}
function setAuthCookie(res, token) {
  try { res.cookie(COOKIE_NAME, token, cookieOptions()); } catch (e) { console.error("Set-Cookie failed:", e); }
}
function clearAuthCookie(res) {
  try {
    const opts = { ...cookieOptions(), maxAge: 0 };
    res.clearCookie(COOKIE_NAME, opts);
    res.clearCookie("accessToken", opts);
    res.clearCookie("token", opts);
  } catch (e) { console.error("Clear-Cookie failed:", e); }
}

// CORS allowlist uit env (komma-gescheiden) + veilige defaults
const ENV_ORIGINS = String(process.env.CORS_ORIGIN || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(new Set([
  ...ENV_ORIGINS,
  "https://fuellinq.app",
  "https://www.fuellinq.app",
  "http://localhost:5173",
]));

// Crash-safety
process.on("unhandledRejection", (err) => console.error("UnhandledRejection:", err));
process.on("uncaughtException", (err) => console.error("UncaughtException:", err));

// Nodig voor secure cookies achter proxy (Railway/Netlify)
app.set("trust proxy", true);

// ─────────────── CORS & cookies (BOVEN ALLES) ───────────────
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // tools zonder Origin (curl/Postman)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS not allowed for origin: " + origin));
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"],
}));
app.use(cookieParser());

// ─────────────── Stripe webhook (RAW body) ───────────────
const Stripe = require("stripe");
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

if (stripe) {
  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
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
              `UPDATE companies SET stripe_subscription_status=$1 WHERE stripe_subscription_id=$2`,
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
    } catch (err) {
      console.error("Stripe signature verify failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
}

// ─────────────── Parsers (ná Stripe raw) ───────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────── Health / DB info (publiek) ───────────────
app.get("/_health", async (_req, res) => {
  try {
    const r = await pool.query("select 1 as db");
    res.json({ ok: true, db: r.rows[0].db === 1 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/health/db", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT now() AS now, current_database() AS db, current_user AS user;");
    res.json({ ok: true, ...rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});
app.get("/api/ping", (_req, res) => res.json({ pong: true, ts: Date.now() }));

// Debug headers
app.get("/__debug/headers", (req, res) => {
  res.json({ auth: req.headers.authorization || null });
});

// ─────────────── Static (publiek) ───────────────
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=604800, immutable"); },
}));
const WALLET_DIR = path.join(__dirname, "public", "wallet-pass");
if (fs.existsSync(WALLET_DIR)) app.use("/wallet-pass", express.static(WALLET_DIR, { maxAge: "1d" }));
app.use("/offers", express.static(path.join(__dirname, "public", "offers"), { maxAge: "1d" }));

// ─────────────── Multer (uploads) ───────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "_").slice(0, 40) || "file";
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    cb(/^(image\/(png|jpe?g|webp|gif|svg\+xml|heic)|video\/mp4)$/i.test(file.mimetype) ? null : new Error("unsupported_type")),
});

// ─────────────── JWT helpers ───────────────
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, stationId: user.station_id || null },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
function getUserId(req) { return req.user?.userId; }
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}

/* ─────────────── AUTH (publiek) ─────────────── */

// Login & Register (publiek)
app.post(["/auth/register", "/api/auth/register", "/register", "/api/register"], async (req, res) => {
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
    const user  = ins.rows[0];
    const token = signToken(user);
    setAuthCookie(res, token);                 // HttpOnly cookie
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

app.post(["/auth/login", "/api/auth/login", "/login", "/api/login"], async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_fields" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid_login" });
    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok)  return res.status(401).json({ error: "invalid_login" });

    const token = signToken(user);
    delete user.password_hash;
    setAuthCookie(res, token);                 // HttpOnly cookie
    res.json({ token, user });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "server_error" });
  }
});

// Extra publieke auth-routes
app.use("/api/auth", require("./routes/auth"));

app.get("/api/auth/whoami", (req, res) => {
  res.json({
    hasAuthHeader: !!(req.headers.authorization || "").startsWith("Bearer "),
    cookieTokenPresent: !!req.cookies?.[COOKIE_NAME] || !!req.cookies?.accessToken || !!req.cookies?.token,
    cookieName: COOKIE_NAME,
  });
});

app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/* ─────────────── Allowlist + guard (NA publieke mounts) ─────────────── */

function isPublicPath(p) {
  const pathOnly = (String(p || "").split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return (
    // ALLE varianten van auth, incl. whoami/logout
    /^\/(?:api\/)?auth(?:\/.*)?$/i.test(pathOnly) ||

    // webhooks + statics + health
    /^\/webhooks\/stripe(?:\/.*)?$/i.test(pathOnly) ||
    /^\/uploads(?:\/.*)?$/i.test(pathOnly) ||
    /^\/(?:_health|health(?:\/db)?)$/i.test(pathOnly) ||
    /^\/api\/ping$/i.test(pathOnly) ||

    // CO2 & RDW publiek (zoals je eerder had)
    /^\/api\/co2\/vehicle\/lookup$/i.test(pathOnly) ||
    /^\/api\/co2\/vehicle\/[^/]+\/report$/i.test(pathOnly) ||
    /^\/api\/rdw(?:\/.*)?$/i.test(pathOnly) ||
    /^\/api\/partner\/health$/i.test(pathOnly)
  );
}

function authMaybe(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const fullA = req.originalUrl || "";
  const fullB = (req.baseUrl || "") + (req.path || "");
  if (isPublicPath(fullA) || isPublicPath(fullB)) return next();

  // Bearer header
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try { req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret"); return next(); }
    catch { return res.status(401).json({ error: "invalid_token" }); }
  }

  // HttpOnly cookie(s)
  const cookieToken = req.cookies?.[COOKIE_NAME] || req.cookies?.accessToken || req.cookies?.token;
  if (cookieToken) {
    try { req.user = jwt.verify(cookieToken, process.env.JWT_SECRET || "devsecret"); return next(); }
    catch { return res.status(401).json({ error: "invalid_token" }); }
  }

  // Mini-debug: laat exact zien wat er misgaat als we tóch hier komen
  console.warn("GUARD 401", {
    method: req.method,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    path: req.path,
  });

  return res.status(401).json({ error: "missing_token" });
}

// ❗ Monteer de guard NA alle publieke mounts hierboven
app.use("/api", authMaybe);

// ─────────────── RDW helper ───────────────
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

// ─────────────── Inline CO₂ endpoints (publiek via allowlist) ───────────────
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
    if (!RDW_APP_TOKEN) resp.warning = "RDW_APP_TOKEN ontbreekt; gebruik een Socrata App Token.";
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

// ─────────────── Routers monteren ───────────────
function asRouter(mod) {
  if (!mod) return null;
  if (typeof mod === "function") return mod;
  if (mod.router && typeof mod.router === "function") return mod.router;
  if (mod.default && typeof mod.default === "function") return mod.default;
  return null;
}
console.log("CORS allowlist:", ALLOWED_ORIGINS.join(", "));
console.log("partnerRouter:", typeof partnerRouter);
console.log("co2Routes:", typeof co2Routes);
console.log("stationsRouter:", typeof stationsRouter);
console.log("rdwRoutes:", typeof rdwRoutes);
console.log("routesIndex:", typeof routesIndex);

const partnerR = asRouter(partnerRouter);
if (partnerR) app.use("/api/partner", partnerR); else console.warn("⚠️ routes/partner export is geen Router (skip)");

const stationsR = asRouter(stationsRouter);
if (stationsR) app.use("/api", stationsR);
else if (stationsRouter) console.warn("⚠️ routes/stations export is geen Router (skip)");

const co2R = asRouter(co2Routes);
if (co2R) app.use("/api/co2", co2R);

const rdwR = asRouter(rdwRoutes);
if (rdwR) app.use("/api/rdw", rdwR);

const routesR = asRouter(routesIndex);
if (routesR) app.use("/api", routesR);

// ================== Voorbeeld API (beschermd door guard) ==================
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
    const last4 = String(Math.floor(1000 + Math.random() * 9000));

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
        `WITH latest AS (SELECT id FROM cards WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1)
         UPDATE cards SET active=TRUE WHERE user_id=$1 AND id=(SELECT id FROM latest)`,
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
         FROM company_settings WHERE company_id=$1`,
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

/* ================== Invoices & Transactions ================== */
function _vatFromGross(gross, vatRate) {
  const g = Number(gross || 0), r = Number(vatRate || 0);
  if (!g || !r) return 0;
  return Number((g * (r / (100 + r))).toFixed(2));
}
function _r2(n) { return Math.round(Number(n || 0) * 100) / 100; }

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

app.get("/api/transactions/list", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      `SELECT id, created_at::date AS date, COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS description, category,
              COALESCE(vat_rate,21) AS vat_rate, amount::numeric AS amount_incl
         FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1000`,
      [userId]
    );
    const items = rows.map((r) => {
      const vat = _vatFromGross(r.amount_incl, r.vat_rate);
      return {
        id: r.id, date: r.date, station: r.station, description: r.description,
        category: r.category, vat_rate: Number(r.vat_rate),
        amount_incl: Number(r.amount_incl), vat,
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
      `SELECT created_at::date AS datum, COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving, category,
              COALESCE(vat_rate,21) AS vat_rate, amount::numeric AS bedrag_incl
         FROM transactions
        ${where}
        ORDER BY created_at DESC
        LIMIT 5000`,
      params
    );

    const header = ["Datum","Station","Omschrijving","Categorie","BTW%","Bedrag (incl)","BTW","Bedrag (excl)"];
    const lines = [header.join(";")];
    rows.forEach((r) => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = _r2(Number(r.bedrag_incl) - btw);
      lines.push([r.datum, String(r.station).replaceAll(";",","), String(r.omschrijving).replaceAll(";",","), r.category || "", r.vat_rate, _r2(r.bedrag_incl), btw, excl].join(";"));
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
      `SELECT created_at::date AS datum, COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving, category,
              COALESCE(vat_rate,21) AS vat_rate, amount::numeric AS bedrag_incl
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
        datum: r.datum, station: r.station, omschrijving: r.omschrijving, category: r.category,
        vat_rate: Number(r.vat_rate), bedrag_incl: Math.round(Number(r.bedrag_incl) * 100) / 100,
        btw, bedrag_excl: excl,
      });
    });

    const n = ws.rowCount;
    if (n >= 2) {
      ws.addRow({}); ws.addRow({});
      const base = n + 2;
      ws.getCell(`F${base}`).value = "Totaal (incl)";
      ws.getCell(`G${base}`).value = "BTW totaal";
      ws.getCell(`H${base}`).value = "Totaal (excl)";
      ws.getCell(`F${base + 1}`).value = { formula: `SUM(F2:F${n})` };
      ws.getCell(`G${base + 1}`).value = { formula: `SUM(G2:G${n})` };
      ws.getCell(`H${base + 1}`).value = { formula: `SUM(H2:H${n})` };
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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
      `SELECT created_at::date AS datum, COALESCE(merchant,'') AS station,
              COALESCE(description,'') AS omschrijving, category,
              COALESCE(vat_rate,21) AS vat_rate, amount::numeric AS bedrag_incl
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
        datum: r.datum, station: r.station, omschrijving: r.omschrijving, category: r.category,
        vat_rate: Number(r.vat_rate), bedrag_incl: _r2(r.bedrag_incl), btw, bedrag_excl: excl,
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

// 404 & error fallback
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "server_error" });
});

// Start
function printRoutes(p) {
  console.log(`✅ FuellinQ backend running on http://localhost:${p}`);
  console.log(`🌍 Frontend: ${WEB_BASE_URL}`);
  console.log(`CORS origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log("Publiek: /health, /health/db, /_health, /db/ping, /api/ping, /uploads/*, /webhooks/stripe");
  console.log("Auth publiek: /auth/*, /api/auth/*, /api/auth/whoami, /api/auth/logout");
  console.log("CO2 publiek: /api/co2/vehicle/lookup, /api/co2/vehicle/:plate/report");
  if (rdwRoutes) console.log("Publiek (RDW): /api/rdw/*");
  console.log("Partner: /api/partner/*");
  console.log("Beschermd: overige /api/* (vehicles/cards/invoices/transactions/pages/admin etc.)");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ FuellinQ backend running on :${PORT}`);
  printRoutes(PORT);
});

module.exports = app;

// ───────── Helpers onderaan ─────────
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
function _tokenFrom(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "anon";
}
