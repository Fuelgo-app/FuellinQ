// server.js — FuellinQ backend (CommonJS, allowlist CORS + public router vóór guard)
require("dotenv").config();
const klaviyoRouter = require("./routes/klaviyo");
const path = require("path");
const fs = require("fs");

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");

const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");

// DB pool
const pool = require("./db/pool");

/* ───────────────── App & basisconfig ───────────────── */
const app = express();
const PORT = Number(process.env.PORT || 3000);
const WEB_BASE_URL = (process.env.WEB_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");

// cookies / auth flags
const SECURE_COOKIES   = String(process.env.SECURE_COOKIES || "false") === "true";
const COOKIE_DOMAIN    = process.env.COOKIE_DOMAIN || undefined; // bv ".fuellinq.app" in prod
const COOKIE_PATH      = process.env.COOKIE_PATH || "/";
const COOKIE_SAMESITE  = (process.env.COOKIE_SAMESITE || (SECURE_COOKIES ? "none" : "lax")).toLowerCase();
const COOKIE_NAME      = process.env.COOKIE_NAME || "token";
const COOKIE_MAX_AGE_DAYS = Number(process.env.COOKIE_MAX_AGE_DAYS || 7);
const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// achter Railway/edge proxies is dit nodig voor correcte cookies/SSL
app.set("trust proxy", 1);

/* ───────────────── CORS (BOVEN ALLES!) ───────────────── */
const RAW = String(process.env.CORS_ORIGIN || "");
const ALLOWED = RAW.split(",").map(s => s.trim()).filter(Boolean);

// veilige defaults
["https://fuellinq.app", "https://www.fuellinq.app", "http://localhost:5173"].forEach(v => {
  if (!ALLOWED.includes(v)) ALLOWED.push(v);
});

// optioneel wildcard voor alle Netlify subdomeinen (previews)
if (!ALLOWED.includes("*.netlify.app")) ALLOWED.push("*.netlify.app");

function originAllowed(origin) {
  if (!origin) return true; // curl/Postman
  try {
    const u = new URL(origin);
    const host = u.host; // jolly-cascaron-65b972.netlify.app
    const protoHost = `${u.protocol}//${u.host}`;
    return ALLOWED.some(rule => {
      if (rule.startsWith("*.")) {
        const domain = rule.slice(2); // netlify.app
        return host === domain || host.endsWith(`.${domain}`);
      }
      // exact protocol+host match
      return rule === protoHost;
    });
  } catch {
    return false;
  }
}

// CORS headers
app.use((req, res, next) => { res.setHeader("Vary", "Origin"); next(); });
app.use(cors({
  origin(origin, cb) {
    const ok = originAllowed(origin);
    if (!ok) console.warn("[CORS] blocked:", origin, "allowed:", ALLOWED);
    cb(null, ok);
  },
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With"],
}));
app.options("*", cors());
app.use(cookieParser());
app.use("/api/klaviyo", klaviyoRouter);
console.log("CORS allowlist:", ALLOWED.join(", "));

/* ───────────────── Cookie helpers ───────────────── */
function cookieOptions() {
  // Browsers weigeren SameSite=None zonder secure
  const secure = COOKIE_SAMESITE === "none" ? true : SECURE_COOKIES;
  const opts = {
    httpOnly: true,
    secure,
    sameSite: COOKIE_SAMESITE,     // 'lax' | 'strict' | 'none'
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE_MS,     // 7 dagen (default)
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

/* ───────────────── Health (zo vroeg mogelijk, zonder deps) ───────────────── */
app.get("/_health", (_req, res) => {
  res.type("application/json").status(200).send(JSON.stringify({
    ok: true, ts: Date.now(), uptime: process.uptime()
  }));
});
app.get("/api/_health", (_req, res) => res.redirect(307, "/_health"));

/* ───────────────── Stripe webhook (RAW body vóór parsers) ───────────────── */
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
            const s = event.data.object;
            const companyId = Number(s.metadata?.company_id || 0);
            if (companyId) {
              await pool.query(
                `UPDATE companies
                   SET stripe_customer_id=$1,
                       stripe_subscription_id=$2,
                       stripe_subscription_status=$3,
                       plan_price_id=COALESCE(plan_price_id,$4)
                 WHERE id=$5`,
                [s.customer || null, s.subscription || null, "active", process.env.STRIPE_FIXED_PRICE_ID || null, companyId]
              );
              if (process.env.STRIPE_METERED_PRICE_ID && s.subscription) {
                const sub = await stripe.subscriptions.retrieve(s.subscription, { expand: ["items.data.price"] });
                const hasMetered = sub.items.data.some(it => it.price?.id === process.env.STRIPE_METERED_PRICE_ID);
                if (!hasMetered) {
                  const created = await stripe.subscriptionItems.create({
                    subscription: s.subscription,
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

/* ───────────────── Parsers (ná Stripe RAW) ───────────────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// In backend/server.js — NA express.json() en cookieParser()
const klaviyo = require("./services/klaviyo");

// Health/test route
app.post("/api/test/klaviyo", async (req, res) => {
  try {
    const { email, firstName, event = "Wallet Confirmed" } = req.body || {};
    if (!email) return res.status(400).json({ error: "email ontbreekt" });

    const profile = await klaviyo.subscribeUser({
      email,
      firstName,
      properties: { source: "FuelLinq Test" },
    });

    const evt = await klaviyo.trackEvent({
      eventName: event,
      email,
      properties: { demo: true, time: Date.now() },
    });

    res.json({ ok: true, profile, event: evt });
  } catch (e) {
    console.error("/api/test/klaviyo error:", e?.response?.data || e?.message || e);
    res.status(500).json({ error: "Klaviyo test failed", detail: e?.response?.data || e?.message });
  }
});

/* ───────────────── RDW router (PUBLIC, vroeg mounten) ───────────────── */
(function mountRDW() {
  const tryPaths = [
    "./routes/rdw",
    path.join(__dirname, "routes/rdw"),
    path.join(__dirname, "backend/routes/rdw"), // fallback indien projectstructuur anders is
  ];
  let router = null, from = null, lastErr = null;
  for (const p of tryPaths) {
    try { router = require(p); from = p; break; }
    catch (e) { if (e.code !== "MODULE_NOT_FOUND") lastErr = e; }
  }
  if (router) {
    app.use("/api/rdw", router);
    console.log("🟢 RDW router mounted from", from, "→ /api/rdw (PUBLIC)");
  } else {
    console.warn("⚠️ RDW router niet gevonden op", tryPaths, lastErr ? `\nLast error: ${lastErr.message}` : "");
  }
})();

/* ───────────────── Publieke health/db debug ───────────────── */
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/health/db", async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT now() AS now, current_database() AS db, current_user AS user;");
    res.json({ ok: true, ...rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.get("/api/ping", (_req, res) => res.json({ pong: true, ts: Date.now() }));
app.get("/__debug/headers", (req, res) => res.json({ origin: req.headers.origin || null, auth: req.headers.authorization || null, cookies: Object.keys(req.cookies || {}) }));

/* ───────────────── Static (publiek) ───────────────── */
const UPLOAD_DIR = path.join(__dirname, "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR, {
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=604800, immutable"); },
}));
const WALLET_DIR = path.join(__dirname, "public", "wallet-pass");
if (fs.existsSync(WALLET_DIR)) app.use("/wallet-pass", express.static(WALLET_DIR, { maxAge: "1d" }));
if (fs.existsSync(path.join(__dirname, "public", "offers")))
  app.use("/offers", express.static(path.join(__dirname, "public", "offers"), { maxAge: "1d" }));

/* ───────────────── Toll & Parking (PUBLIC) ───────────────── */
const tollRoutes = safeRequire("./routes/toll");
if (tollRoutes) app.use("/api/toll", tollRoutes);

const parkingRoutes = safeRequire("./routes/parking");
if (parkingRoutes) {
  app.use("/api/parking", parkingRoutes);
  console.log("🟢 mounted ./routes/parking → /api/parking (PUBLIC)");
}

/* ───────────────── Multer (uploads) ───────────────── */
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
  fileFilter: (_req, file, cb) => {
    const ok = /^(image\/(png|jpe?g|webp|gif|svg\+xml|heic)|video\/mp4)$/i.test(file.mimetype);
    if (ok) return cb(null, true);
    return cb(new Error("unsupported_type"), false);
  },
});

/* ───────────────── JWT helpers ───────────────── */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, stationId: user.station_id || null, email: user.email },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}
function getUserId(req) { return req.user?.userId; }
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "forbidden" });
  next();
}

/* ───────────────── AUTH (publiek) ───────────────── */
app.post(["/auth/register","/api/auth/register","/register","/api/register"], async (req, res) => {
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
    setAuthCookie(res, token);
    res.json({ token, user });
  } catch (e) { console.error(e); res.status(500).json({ error: "server_error" }); }
});

app.post(["/auth/login","/api/auth/login","/login","/api/login"], async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_fields" });
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid_login" });
    const ok = await bcrypt.compare(password, user.password_hash || "");
    if (!ok)  return res.status(401).json({ error: "invalid_login" });

    const token = signToken(user);
    delete user.password_hash;
    setAuthCookie(res, token);
    res.json({ token, user });
  } catch (e) { console.error(e); res.status(500).json({ error: "server_error" }); }
});

// ✅ Echte whoami
app.get("/api/auth/whoami", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  // 1) Bearer
  try {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) {
      const user = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      return res.json({ ok: true, user });
    }
  } catch (_) {}

  // 2) Cookie
  const cookieToken =
    req.cookies?.[COOKIE_NAME] || req.cookies?.accessToken || req.cookies?.token;

  if (cookieToken) {
    try {
      const user = jwt.verify(cookieToken, process.env.JWT_SECRET || "devsecret");
      return res.json({ ok: true, user });
    } catch {
      return res.status(401).json({ error: "invalid_token" });
    }
  }

  return res.status(401).json({ error: "missing_token" });
});

app.post("/api/auth/logout", (req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

/* ───────────────── ✅ Publieke partner router vóór guard ───────────────── */
const partnerPublicMod = safeRequire("./routes/partnerPublic");
const partnerPublicRouter = pickRouter(partnerPublicMod);
if (partnerPublicRouter) {
  app.use("/api/partner/public", partnerPublicRouter);
  console.log("🟢 mounted ./routes/partnerPublic → /api/partner/public (PUBLIC)");
} else {
  // Fallback: iig stations (PUBLIC)
  app.get("/api/partner/public/stations", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, COALESCE(name,'') AS name, COALESCE(city,'') AS city,
                COALESCE(lat,0)::float AS lat, COALESCE(lng,0)::float AS lng
           FROM stations
           WHERE active IS TRUE
           ORDER BY name ASC
           LIMIT 1000`
      );
      res.json({ stations: rows });
    } catch (e) {
      console.warn("partner/public/stations fallback error:", e.message);
      res.json({ stations: [] });
    }
  });
  console.log("🟢 fallback route actief: GET /api/partner/public/stations (PUBLIC)");
}

/* ───────────────── Dynamische routers (beschermde en overige) ───────────────── */
function pickRouter(mod) {
  if (!mod) return null;
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.router === "function") return mod.router;
  if (mod && typeof mod.default === "function") return mod.default;
  return null;
}
function safeRequire(p) {
  try { return require(p); } catch (e) { if (e.code !== "MODULE_NOT_FOUND") console.warn(`⚠️  fout bij laden ${p}:`, e.message); return null; }
}

[
  { path: "/api/auth",    file: "./routes/auth" },
  { path: "/api/partner", file: "./routes/partner" },
  { path: "/api/co2",     file: "./routes/co2" },
  // RDW is al publiek en vroeg gemount, dus hier NIET nogmaals mounten
  { path: "/api",         file: "./routes/stations" },
  { path: "/api",         file: "./routes/index" },
].forEach(({ path, file }) => {
  const mod = safeRequire(file);
  const router = pickRouter(mod);
  if (router) {
    app.use(path, router);
    console.log(`🧩 mounted ${file} → ${path}`);
  } else if (mod === null) {
    console.warn(`↷ skip ${file} (bestaat niet)`);
  } else {
    console.warn(`⚠️  ${file} gevonden maar exporteert geen Router`);
  }
});

/* ───────────────── Guard (NA publieke mounts) ───────────────── */
function isPublicPath(p) {
  const pathOnly = (String(p || "").split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return (
    /^\/api\/test\/klaviyo$/i.test(pathOnly) ||
    /^\/(?:api\/)?auth(?:\/.*)?$/i.test(pathOnly) ||
    /^\/webhooks\/stripe(?:\/.*)?$/i.test(pathOnly) ||
    /^\/uploads(?:\/.*)?$/i.test(pathOnly) ||
    /^\/(?:_health|health(?:\/db)?)$/i.test(pathOnly) ||
    /^\/api\/ping$/i.test(pathOnly) ||
    /^\/api\/co2\/vehicle\/lookup$/i.test(pathOnly) ||
    /^\/api\/co2\/vehicle\/[^/]+\/report$/i.test(pathOnly) ||
    /^\/api\/rdw(?:\/.*)?$/i.test(pathOnly) ||
    /^\/api\/partner\/health$/i.test(pathOnly) ||
    /^\/api\/partner\/public(?:\/.*)?$/i.test(pathOnly) ||
    /^\/api\/parking(?:\/.*)?$/i.test(pathOnly) ||
    /^\/api\/toll(?:\/.*)?$/i.test(pathOnly)
  );
}

function authMaybe(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const fullA = req.originalUrl || "";
  const fullB = (req.baseUrl || "") + (req.path || "");
  const aPub = isPublicPath(fullA);
  const bPub = isPublicPath(fullB);
  if (aPub || bPub) return next();

  // 1) Probeer Bearer
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(h.slice(7), process.env.JWT_SECRET || "devsecret");
      return next();
    } catch (e) {
      console.warn("GUARD: invalid Bearer → probeer cookie", { fullA, fullB, reason: e?.message });
    }
  }

  // 2) Cookie
  const cookieToken = req.cookies?.[COOKIE_NAME] || req.cookies?.accessToken || req.cookies?.token;
  if (cookieToken) {
    try {
      req.user = jwt.verify(cookieToken, process.env.JWT_SECRET || "devsecret");
      return next();
    } catch {
      console.warn("GUARD 401 invalid cookie", { fullA, fullB, cookies: Object.keys(req.cookies || {}) });
      return res.status(401).json({ error: "invalid_token" });
    }
  }

  console.warn("GUARD 401", { method: req.method, fullA, fullB, aPub, bPub, cookies: Object.keys(req.cookies || {}) });
  return res.status(401).json({ error: "missing_token" });
}

// Guard activeren voor alles onder /api dat niet al eerder (publiek) is afgehandeld
app.use("/api", authMaybe);
app.use("/api/test", require("./routes/testKlaviyo"));

/* ───────────────── Vehicles (beschermd via aparte router) ───────────────── */
const vehiclesRouter = require("./routes/vehicles");
app.use("/api/vehicles", vehiclesRouter);

/* ───────────────── Cards/wallet (beschermd) ───────────────── */
app.get("/api/cards", async (req, res) => {
  try {
    const userId = getUserId(req);
    const { rows } = await pool.query(
      "SELECT id, label, last4, active FROM cards WHERE user_id=$1 ORDER BY id",
      [userId]
    );
    res.json({ cards: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: "Kon passen niet ophalen" }); }
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
  } catch (e) { console.error(e); res.status(500).json({ error: "Toevoegen mislukt" }); }
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
  } catch (e) { console.error(e); res.status(500).json({ error: "Kon actieve pas niet wijzigen" }); }
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
  } catch (e) { console.error(e); res.status(500).json({ error: "Verwijderen mislukt" }); }
});

/* ───────────────── Branding / Admin (beschermd) ───────────────── */
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
  } catch (e) { console.error(e); res.status(500).json({ error: "server_error" }); }
});

function _r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
function _vatFromGross(gross, vatRate) {
  const g = Number(gross || 0), r = Number(vatRate || 0);
  if (!g || !r) return 0;
  return Number((g * (r / (100 + r))).toFixed(2));
}

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
  } catch (e) { console.error(e); res.status(500).json({ error: "server_error" }); }
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

/* ───────────────── Invoices/Transactions (beschermd) ───────────────── */
app.get("/api/invoices", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, number, amount_cents, status, to_char(created_at, 'YYYY-MM-DD') as date
         FROM invoices
        ORDER BY created_at DESC`
    );
    const invoices = rows.map(r => ({ ...r, amount: r.amount_cents }));
    res.json({ invoices });
  } catch (e) { console.error(e); res.status(500).json({ error: "fetch_invoices_failed" }); }
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
    const items = rows.map(r => {
      const vat = _vatFromGross(r.amount_incl, r.vat_rate);
      return {
        id: r.id, date: r.date, station: r.station, description: r.description,
        category: r.category, vat_rate: Number(r.vat_rate),
        amount_incl: Number(r.amount_incl), vat,
        amount_excl: Number((Number(r.amount_incl) - vat).toFixed(2)),
      };
    });
    res.json({ items });
  } catch (e) { console.error("transactions/list", e); res.status(500).json({ error: "list_failed" }); }
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
    const fuel = rows.find(r => r.category === "fuel") || { total_gross: 0, total_vat: 0 };
    const shop = rows.find(r => r.category === "shop") || { total_gross: 0, total_vat: 0 };
    const grand_gross = _r2(Number(fuel.total_gross || 0) + Number(shop.total_gross || 0));
    const grand_vat = _r2(Number(fuel.total_vat || 0) + Number(shop.total_vat || 0));
    res.json({
      fuel: { total_gross: _r2(fuel.total_gross || 0), total_vat: _r2(fuel.total_vat || 0) },
      shop: { total_gross: _r2(shop.total_gross || 0), total_vat: _r2(shop.total_vat || 0) },
      grand: { total_gross: grand_gross, total_vat: grand_vat },
    });
  } catch (e) { console.error("transactions/summary", e); res.status(500).json({ error: "summary_failed" }); }
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
    rows.forEach(r => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = _r2(Number(r.bedrag_incl) - btw);
      lines.push([r.datum, String(r.station).replaceAll(";",","), String(r.omschrijving).replaceAll(";",","), r.category || "", r.vat_rate, _r2(r.bedrag_incl), btw, excl].join(";"));
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="fuellinq-transacties.csv"');
    res.send(lines.join("\n"));
  } catch (e) { console.error("transactions/export.csv", e); res.status(500).json({ error: "csv_failed" }); }
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
    rows.forEach(r => {
      const btw = _vatFromGross(r.bedrag_incl, r.vat_rate);
      const excl = _r2(Number(r.bedrag_incl) - btw);
      ws.addRow({
        datum: r.datum, station: r.station, omschrijving: r.omschrijving, category: r.category,
        vat_rate: Number(r.vat_rate), bedrag_incl: _r2(r.bedrag_incl), btw, bedrag_excl: excl,
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
  } catch (e) { console.error("transactions/export.xlsx", e); res.status(500).json({ error: "xlsx_failed" }); }
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
    rows.forEach(r => {
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
  } catch (e) { console.error("transactions/email", e); res.status(500).json({ error: "email_failed", message: e.message }); }
});

/* ───────────────── DB ping (publiek) ───────────────── */
app.get("/db/ping", async (_req, res) => {
  try {
    const r = await pool.query("SELECT now() as now");
    res.json({ ok: true, now: r.rows[0].now });
  } catch (e) { console.error("db/ping failed:", e); res.status(500).json({ ok: false, error: e.code || e.message }); }
});

/* ───────────────── 404 & error fallback ───────────────── */
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "server_error" });
});

/* ───────────────── Start server ───────────────── */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ FuellinQ backend running on :${PORT}`);
  console.log(`🌍 Frontend: ${WEB_BASE_URL}`);
  console.log(`CORS origins: ${ALLOWED.join(", ")}`);
  console.log("Publiek: /health, /health/db, /_health, /db/ping, /api/ping, /uploads/*, /webhooks/stripe, /api/rdw/*, /api/parking/*, /api/toll/*, /api/partner/public/*");
  console.log("Auth publiek: /auth/*, /api/auth/*, /api/auth/whoami, /api/auth/logout");
  console.log("CO2 publiek: /api/co2/vehicle/lookup, /api/co2/vehicle/:plate/report");
});

/* ───────────────── Helpers onderaan ───────────────── */
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
