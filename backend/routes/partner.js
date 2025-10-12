// backend/routes/partner.js
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");
const pool = require("../db/pool");

/* ───────────────── fetch polyfill ───────────────── */
const _fetch =
  global.fetch ||
  (async (...args) => {
    const { default: f } = await import("node-fetch");
    return f(...args);
  });

async function fetchJsonSafe(url, opts = {}, timeoutMs = 7000) {
  // veilige fetch: nooit throwen op non-2xx; op error => null
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await _fetch(url, { ...opts, signal: ctl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/* ───────────────── Helpers (paths & urls) ───────────────── */
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
const OFFER_DIR = path.join(UPLOAD_DIR, "offers");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OFFER_DIR, { recursive: true });

function publicBase(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "http").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}
function toPublicUrl(req, relPath) {
  const clean = relPath.startsWith("/uploads/") ? relPath : `/uploads/${relPath.replace(/^\/+/, "")}`;
  return `${publicBase(req)}${clean}`;
}
function isDataUrl(u) {
  return typeof u === "string" && /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(u);
}
function isUploadsPath(u) {
  return typeof u === "string" && /^\/?uploads\//.test(u);
}
function isHttpUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}
function randomName(ext = "") {
  return `${crypto.randomBytes(16).toString("hex")}${ext ? `.${ext.replace(/^\./, "")}` : ""}`;
}
function extFromMime(mime) {
  if (!mime) return "";
  const m = String(mime).toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("avif")) return "avif";
  if (m.includes("gif")) return "gif";
  return "";
}

/* ───────────────── Ensure tables ───────────────── */
async function ensurePartnerTables() {
  await pool.query(`ALTER TABLE IF EXISTS fuel_prices DROP COLUMN IF EXISTS price_cents;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stations (
      id              serial PRIMARY KEY,
      owner_user_id   int,
      title           text,
      name            text,
      address_line1   text,
      address_line2   text,
      postcode        text,
      city            text,
      country         text,
      lat             numeric(10,6),
      lng             numeric(10,6),
      created_at      timestamptz DEFAULT now(),
      updated_at      timestamptz DEFAULT now()
    );
  `);

  await pool.query(`
    ALTER TABLE stations
      ADD COLUMN IF NOT EXISTS owner_user_id int,
      ADD COLUMN IF NOT EXISTS title         text,
      ADD COLUMN IF NOT EXISTS name          text,
      ADD COLUMN IF NOT EXISTS address_line1 text,
      ADD COLUMN IF NOT EXISTS address_line2 text,
      ADD COLUMN IF NOT EXISTS postcode      text,
      ADD COLUMN IF NOT EXISTS city          text,
      ADD COLUMN IF NOT EXISTS country       text,
      ADD COLUMN IF NOT EXISTS lat           numeric(10,6),
      ADD COLUMN IF NOT EXISTS lng           numeric(10,6),
      ADD COLUMN IF NOT EXISTS created_at    timestamptz DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();
  `);

  await pool.query(`
    UPDATE stations
       SET name  = COALESCE(NULLIF(name,''), title),
           title = COALESCE(NULLIF(title,''), name)
     WHERE (name IS NULL OR name='') OR (title IS NULL OR title='');
  `);

  await pool.query(`
    UPDATE stations
       SET title = COALESCE(NULLIF(title,''), address_line1, CONCAT('Station ', id)::text)
     WHERE title IS NULL OR title = '';
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_stations_owner ON stations(owner_user_id);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel_prices (
      id          serial PRIMARY KEY,
      station_id  int     NOT NULL,
      fuel_type   text    NOT NULL,
      price_eur_l numeric(10,3) NOT NULL,
      updated_at  timestamptz DEFAULT now(),
      created_at  timestamptz DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS station_offers (
      id           serial PRIMARY KEY,
      station_id   int     NOT NULL,
      title        text    NOT NULL,
      body         text    DEFAULT '',
      badge        text,
      status       text DEFAULT 'draft',
      weekdays     int[] DEFAULT '{}',
      image_url    text,
      starts_at    timestamptz DEFAULT now(),
      ends_at      timestamptz,
      template_key text,
      created_at   timestamptz DEFAULT now(),
      updated_at   timestamptz DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_fuel_prices_station_type_created
      ON fuel_prices (station_id, fuel_type, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_station_offers_station_created
      ON station_offers (station_id, created_at DESC);
  `);
}
ensurePartnerTables().catch(console.error);

/* ───────────────── Helpers (parse) ───────────────── */
const parseNumber = (n) => (Number.isFinite(Number(n)) ? Number(n) : null);
const parseFuel = (v) => (v == null ? null : String(v).trim().toLowerCase());
const normZip = (z) => String(z || "").replace(/\s+/g, "").toUpperCase();

/* ───────────────── Health ───────────────── */
router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "partner",
    userId: req.user?.userId ?? null,
    stationId: req.user?.stationId ?? null,
    ts: Date.now(),
  });
});

/* ───────────────── Upload (multer) ───────────────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, OFFER_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || "").toLowerCase();
    const base = path
      .basename(file.originalname || "image", ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40) || "image";
    const stamp = Date.now();
    cb(null, `${base}-${stamp}${ext || ".bin"}`);
  },
});
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);
function fileFilter(_req, file, cb) {
  if (!ALLOWED.has(file.mimetype)) return cb(new Error("Alleen JPEG/PNG/WEBP/AVIF/GIF toegestaan"));
  cb(null, true);
}
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter,
});

// POST /api/partner/upload  (field: image)
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "no_file" });
    const url = toPublicUrl(req, `/uploads/offers/${req.file.filename}`);
    return res.status(201).json({
      ok: true,
      filename: req.file.filename,
      url,
      size: req.file.size,
      mime: req.file.mimetype || "application/octet-stream",
    });
  } catch (e) {
    console.error("POST /partner/upload error:", e);
    return res.status(500).json({ error: "upload_failed", message: e.message });
  }
});

/* ───────────────── Adres-helpers (PDOK → Nominatim) ───────────────── */
function parsePdokPoint(pointStr) {
  if (!pointStr) return { lat: null, lng: null };
  const m = /POINT\(\s*(-?\d+(\.\d+)?)\s+(-?\d+(\.\d+)?)\s*\)/.exec(pointStr);
  if (!m) return { lat: null, lng: null };
  return { lng: Number(m[1]), lat: Number(m[3]) };
}

/** Geocode NL (PDOK met fallback Nominatim). Werpt niet; geeft object of null. */
async function geocodeNL({ postcode, houseNumber, addition = "" }) {
  if (!postcode || !houseNumber) return null;

  const rawZip = normZip(postcode);
  const number = String(houseNumber).trim();
  const addNorm = String(addition || "").trim() || null;

  // === PDOK varianten ===
  const basePdok = "https://api.pdok.nl/bzk/locatieserver/search/v3/free";
  const pdokFields =
    "weergavenaam,straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,gemeentenaam,provincienaam,centroide_ll";

  async function tryPdok(params) {
    const u = new URL(basePdok);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const j = await fetchJsonSafe(u.toString(), { headers: { Accept: "application/json" } }, 6000);
    const d = j?.response?.docs?.[0];
    if (!d) return null;
    const { lat, lng } = parsePdokPoint(d.centroide_ll);
    return {
      ok: true,
      source: "pdok",
      display_name: d.weergavenaam || null,
      street: d.straatnaam || "",
      house_number: d.huisnummer ?? number,
      house_letter: d.huisletter ?? null,
      house_addition: d.huisnummertoevoeging ?? addNorm,
      postcode: d.postcode || rawZip,
      city: d.woonplaatsnaam || "",
      municipality: d.gemeentenaam || null,
      province: d.provincienaam || null,
      lat,
      lng,
    };
  }

  const pdok =
    (await tryPdok({ fq: `type:adres AND postcode:${rawZip} AND huisnummer:${number}`, fl: pdokFields, rows: "1" })) ||
    (await tryPdok({ fq: `postcode:${rawZip} AND huisnummer:${number}`, fl: pdokFields, rows: "1" })) ||
    (await tryPdok({ q: `${rawZip} ${number}`, fq: "type:adres", fl: pdokFields, rows: "1" }));

  if (pdok) return pdok;

  // === Nominatim fallback (alleen NL, exact dezelfde postcode) ===
  const nomHeaders = {
    Accept: "application/json",
    "User-Agent": "FuellinQ/AddressLookup (contact: support@fuellinq.app)",
  };
  async function runNom(u) {
    const arr = await fetchJsonSafe(u.toString(), { headers: nomHeaders }, 7000);
    if (!Array.isArray(arr) || !arr[0]) return null;
    const hit = arr.find((a) => a?.address?.postcode && normZip(a.address.postcode) === rawZip);
    if (!hit) return null;
    const ad = hit.address || {};
    return {
      ok: true,
      source: "nominatim",
      display_name: hit.display_name || null,
      street: ad.road || ad.pedestrian || ad.footway || ad.cycleway || "",
      house_number: ad.house_number || number,
      house_letter: null,
      house_addition: addNorm,
      postcode: ad.postcode || rawZip,
      city: ad.city || ad.town || ad.village || ad.hamlet || "",
      municipality: ad.municipality || null,
      province: ad.state || null,
      lat: hit.lat ? Number(hit.lat) : null,
      lng: hit.lon ? Number(hit.lon) : null,
    };
  }

  const nom1 = new URL("https://nominatim.openstreetmap.org/search");
  nom1.searchParams.set("format", "jsonv2");
  nom1.searchParams.set("countrycodes", "nl");
  nom1.searchParams.set("postalcode", rawZip);
  nom1.searchParams.set("street", `${number}`);
  nom1.searchParams.set("addressdetails", "1");
  nom1.searchParams.set("limit", "3");

  const nom2 = new URL("https://nominatim.openstreetmap.org/search");
  nom2.searchParams.set("format", "jsonv2");
  nom2.searchParams.set("q", `${rawZip} ${number}, Netherlands`);
  nom2.searchParams.set("addressdetails", "1");
  nom2.searchParams.set("limit", "3");

  const nom3 = new URL("https://nominatim.openstreetmap.org/search");
  nom3.searchParams.set("format", "jsonv2");
  nom3.searchParams.set("q", `${number} ${rawZip}, Netherlands`);
  nom3.searchParams.set("addressdetails", "1");
  nom3.searchParams.set("limit", "3");

  return (await runNom(nom1)) || (await runNom(nom2)) || (await runNom(nom3)) || null;
}

/* ───────────────── Address lookup routes ───────────────── */
router.get("/address-lookup", async (req, res) => {
  try {
    const postcode = String(req.query.zip || req.query.postcode || req.query.postal_code || "").trim();
    const number = String(req.query.number || req.query.huisnummer || req.query.house_number || "").trim();
    const addition = String(req.query.addition || req.query.toevoeging || "").trim();

    if (!postcode || !number) return res.status(400).json({ error: "missing_zip_or_number" });

    const result = await geocodeNL({ postcode, houseNumber: number, addition });
    if (result) return res.json(result);

    return res.status(404).json({ ok: false, error: "not_found" });
  } catch (e) {
    console.error("GET /partner/address-lookup error:", e);
    // blijf vriendelijk naar frontend: geef niet 500 op externe hapering
    return res.status(404).json({ ok: false, error: "not_found" });
  }
});

// Alias: /api/partner/geocode?zip=...&number=...
router.get("/geocode", async (req, res) => {
  try {
    const postcode = String(req.query.zip || req.query.postcode || req.query.postal_code || "").trim();
    const number = String(req.query.number || req.query.huisnummer || req.query.house_number || "").trim();
    const addition = String(req.query.addition || req.query.toevoeging || "").trim();
    if (!postcode || !number) return res.status(400).json({ error: "missing_zip_or_number" });
    const result = await geocodeNL({ postcode, houseNumber: number, addition });
    if (result) return res.json(result);
    return res.status(404).json({ ok: false, error: "not_found" });
  } catch (e) {
    console.error("GET /partner/geocode error:", e);
    return res.status(404).json({ ok: false, error: "not_found" });
  }
});

/* ───────────────── Stations ───────────────── */
// Lijst
router.get("/stations", async (req, res) => {
  try {
    const owner = parseNumber(req.user?.userId);
    const { rows } = await pool.query(
      `SELECT id, title, name, address_line1, address_line2, postcode, city, country, lat, lng, created_at, updated_at
         FROM stations
        WHERE ($1::int IS NULL OR owner_user_id = $1::int)
        ORDER BY created_at DESC`,
      [owner]
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /partner/stations error:", e);
    res.status(500).json({ error: "fetch_failed", message: e.message });
  }
});

// 🔎 stations in de buurt (Haversine)
router.get("/stations/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusKm = Number(req.query.radius_km || 10);
    const limit = Math.min(Number(req.query.limit || 50), 200);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "invalid_coordinates" });
    }

    const { rows } = await pool.query(
      `
      WITH params AS (
        SELECT $1::numeric AS lat, $2::numeric AS lng
      ),
      distances AS (
        SELECT s.*,
          (6371 * acos(
            cos(radians((SELECT lat FROM params)))
            * cos(radians(s.lat))
            * cos(radians(s.lng) - radians((SELECT lng FROM params)))
            + sin(radians((SELECT lat FROM params))) * sin(radians(s.lat))
          )) AS distance_km
        FROM stations s
        WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL
      )
      SELECT * FROM distances
      WHERE distance_km <= $3
      ORDER BY distance_km ASC
      LIMIT $4
      `,
      [lat, lng, radiusKm, limit]
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /partner/stations/nearby error:", e);
    res.status(500).json({ error: "nearby_failed", message: e.message });
  }
});

// Slim aanmaken o.b.v. postcode + huisnummer
router.post("/stations/smart-create", async (req, res) => {
  const T = (v) => (v ?? "").toString().trim();
  try {
    const owner = parseNumber(req.user?.userId);
    const postcode = T(req.body?.postcode || req.body?.postal_code);
    const number   = T(req.body?.number || req.body?.huisnummer || req.body?.house_number);
    const addition = T(req.body?.addition || req.body?.toevoeging);

    if (!postcode || !number) return res.status(400).json({ error: "missing_zip_or_number" });

    const g = await geocodeNL({ postcode, houseNumber: number, addition });
    if (!g) return res.status(404).json({ error: "address_not_found" });

    const title =
      T(req.body?.title) ||
      (g.street ? `${g.street} ${g.house_number}${g.house_addition ? ` ${g.house_addition}` : ""}` : "") ||
      g.display_name ||
      `Station ${postcode} ${number}`;

    const address_line1 = g.street
      ? `${g.street} ${g.house_number}${g.house_addition ? ` ${g.house_addition}` : ""}`
      : null;

    const sql = `
      INSERT INTO stations (owner_user_id, title, name, address_line1, address_line2, postcode, city, country, lat, lng)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, owner_user_id, title, name, address_line1, address_line2, postcode, city, country, lat, lng, created_at, updated_at
    `;
    const params = [
      owner, title, title, address_line1, null,
      g.postcode || postcode, g.city || null, "NL", g.lat, g.lng,
    ];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /partner/stations/smart-create error:", e);
    return res.status(500).json({ error: "insert_failed", message: e.message });
  }
});

// Handmatig aanmaken
router.post("/stations", async (req, res) => {
  const T = (v) => (v ?? "").toString().trim();
  try {
    const owner = parseNumber(req.user?.userId);
    const title = T(req.body?.title);
    const address_line1 = T(req.body?.address_line1 || req.body?.street) || null;
    const address_line2 = T(req.body?.address_line2) || null;
    const postcode = T(req.body?.postcode || req.body?.postal_code) || null;
    const city = T(req.body?.city) || null;
    const country = (T(req.body?.country) || "NL").toUpperCase();

    if (!title) return res.status(400).json({ error: "missing_title" });

    const sql = `
      INSERT INTO stations (owner_user_id, title, name, address_line1, address_line2, postcode, city, country, lat, lng)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL)
      RETURNING id, owner_user_id, title, name, address_line1, address_line2, postcode, city, country, lat, lng, created_at, updated_at
    `;
    const params = [owner, title, title, address_line1, address_line2, postcode, city, country];

    const { rows } = await pool.query(sql, params);
    return res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /partner/stations error:", e);
    return res.status(500).json({ error: "insert_failed", message: e.message });
  }
});

// Updaten (incl. handmatig lat/lng)
router.patch("/stations/:id", async (req, res) => {
  try {
    const owner = parseNumber(req.user?.userId);
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const set = [];
    const params = [];

    if (req.body?.title !== undefined) {
      params.push(req.body.title); set.push(`title = $${params.length}`);
      params.push(req.body.title); set.push(`name  = $${params.length}`);
    }

    ["address_line1", "address_line2", "postcode", "city", "country", "lat", "lng"].forEach((f) => {
      if (req.body?.[f] !== undefined) {
        params.push(req.body[f]);
        set.push(`${f} = $${params.length}`);
      }
    });

    if (!set.length) return res.status(400).json({ error: "nothing_to_update" });

    params.push(id);
    params.push(owner);

    const { rows } = await pool.query(
      `UPDATE stations SET ${set.join(", ")}, updated_at = now()
        WHERE id = $${params.length - 1}
          AND (owner_user_id = $${params.length} OR $${params.length} IS NULL)
      RETURNING id, title, name, address_line1, address_line2, postcode, city, country, lat, lng, created_at, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("PATCH /partner/stations/:id error:", e);
    res.status(500).json({ error: "update_failed", message: e.message });
  }
});

// Verrijk bestaand station o.b.v. postcode + huisnummer
router.patch("/stations/:id/address-from-zip", async (req, res) => {
  try {
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const postcode = String(req.body?.postcode || req.body?.postal_code || "").trim();
    const number = String(req.body?.number || req.body?.huisnummer || req.body?.house_number || "").trim();
    const addition = String(req.body?.addition || req.body?.toevoeging || "").trim();
    if (!postcode || !number) return res.status(400).json({ error: "missing_zip_or_number" });

    const g = await geocodeNL({ postcode, houseNumber: number, addition });
    if (!g) return res.status(404).json({ error: "address_not_found" });

    const address_line1 = g.street
      ? `${g.street} ${g.house_number}${g.house_addition ? ` ${g.house_addition}` : ""}`
      : null;

    const { rows } = await pool.query(
      `UPDATE stations
          SET address_line1 = $1,
              postcode      = $2,
              city          = $3,
              country       = $4,
              lat           = $5,
              lng           = $6,
              updated_at    = now()
        WHERE id = $7
      RETURNING id, title, name, address_line1, address_line2, postcode, city, country, lat, lng, created_at, updated_at`,
      [address_line1, g.postcode, g.city, "NL", g.lat, g.lng, id]
    );

    if (!rows.length) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("PATCH /partner/stations/:id/address-from-zip error:", e);
    res.status(500).json({ error: "update_failed", message: e.message });
  }
});

/* 🗑️ Verwijderen (incl. gerelateerde data) */
router.delete("/stations/:id", async (req, res) => {
  const id = parseNumber(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  const owner = parseNumber(req.user?.userId) || null;

  try {
    await pool.query("BEGIN");

    // children opruimen (als je geen FK ON DELETE CASCADE hebt)
    await pool.query("DELETE FROM fuel_prices WHERE station_id = $1", [id]);
    await pool.query("DELETE FROM station_offers WHERE station_id = $1", [id]);

    const params = owner ? [id, owner] : [id];
    const ownerClause = owner ? " AND (owner_user_id = $2 OR $2 IS NULL)" : "";

    const del = await pool.query(
      `DELETE FROM stations WHERE id = $1${ownerClause} RETURNING id`,
      params
    );

    await pool.query("COMMIT");

    if (del.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true, id });
  } catch (e) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("DELETE /partner/stations/:id error:", e);
    res.status(500).json({ error: "delete_failed", message: e.message });
  }
});

/* ───────────────── Brandstofprijzen ───────────────── */
router.post("/fuel-prices", async (req, res) => {
  try {
    const stationId = parseNumber(req.body?.station_id);
    const fuelType = parseFuel(req.body?.fuel_type);
    const priceEurL = parseNumber(req.body?.price_eur_l);

    if (!stationId || !fuelType || priceEurL == null) {
      return res.status(400).json({ error: "missing_fields", need: ["station_id", "fuel_type", "price_eur_l"] });
    }
    if (priceEurL <= 0 || priceEurL > 10) {
      return res.status(400).json({ error: "invalid_price_range", hint: "verwacht €/L, bv. 1.999" });
    }

    const { rows } = await pool.query(
      `INSERT INTO fuel_prices (station_id, fuel_type, price_eur_l)
       VALUES ($1,$2,$3)
       RETURNING id, station_id, fuel_type, price_eur_l, created_at`,
      [stationId, fuelType, priceEurL]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("POST /partner/fuel-prices error:", e);
    res.status(500).json({ error: "insert_failed", message: e.message });
  }
});

router.get("/fuel-prices", async (req, res) => {
  try {
    const isLatest = String(req.query?.latest) === "true";
    const stationId = req.query?.station_id ? parseNumber(req.query.station_id) : null;
    const fuelTypeQ = req.query?.fuel_type ? parseFuel(req.query.fuel_type) : null;

    const params = [];
    let where = "1=1";
    if (stationId) { params.push(stationId); where += ` AND station_id = $${params.length}`; }
    if (fuelTypeQ) { params.push(fuelTypeQ); where += ` AND fuel_type  = $${params.length}`; }

    if (isLatest) {
      const { rows } = await pool.query(
        `
        SELECT fp.id, fp.station_id, fp.fuel_type, fp.price_eur_l, fp.created_at
          FROM fuel_prices fp
          JOIN (
                SELECT station_id, fuel_type, MAX(created_at) AS max_created
                  FROM fuel_prices
                 WHERE ${where}
                 GROUP BY station_id, fuel_type
               ) m
            ON m.station_id = fp.station_id
           AND m.fuel_type  = fp.fuel_type
           AND m.max_created = fp.created_at
         ORDER BY fp.station_id, fp.fuel_type
        `,
        params
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `
      SELECT id, station_id, fuel_type, price_eur_l, created_at
        FROM fuel_prices
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 100
      `,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /partner/fuel-prices error:", e);
    res.status(500).json({ error: "fetch_failed", message: e.message });
  }
});

/* ───────────────── Offers ───────────────── */
function normalizeImageUrl(req, imageUrl) {
  if (!imageUrl) return null;

  if (isDataUrl(imageUrl)) {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i.exec(imageUrl);
    if (!m) return null;
    const mime = m[1];
    const buf = Buffer.from(m[2], "base64");
    const ext = extFromMime(mime) || "bin";
    const filename = randomName(ext);
    fs.writeFileSync(path.join(OFFER_DIR, filename), buf);
    return toPublicUrl(req, `/uploads/offers/${filename}`);
  }

  if (isUploadsPath(imageUrl)) {
    const rel = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
    return toPublicUrl(req, rel);
  }

  if (isHttpUrl(imageUrl)) return imageUrl;

  const filename = randomName();
  fs.writeFileSync(path.join(OFFER_DIR, filename), imageUrl);
  return toPublicUrl(req, `/uploads/offers/${filename}`);
}

router.get("/offers", async (req, res) => {
  try {
    const stationId = req.query?.station_id ? parseNumber(req.query.station_id) : null;
    const status = req.query?.status ? String(req.query.status).toLowerCase() : null;
    const onlyNow = String(req.query?.only_current) === "true";

    const params = [];
    let where = "1=1";
    if (stationId) { params.push(stationId); where += ` AND station_id = $${params.length}`; }
    if (status && status !== "all") { params.push(status); where += ` AND status = $${params.length}`; }
    if (onlyNow) { where += ` AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now())`; }

    const { rows } = await pool.query(
      `
      SELECT id, station_id, title, body, badge, status, weekdays, image_url, template_key,
             starts_at, ends_at, created_at, updated_at
        FROM station_offers
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT 200
      `,
      params
    );

    const fixed = rows.map((r) => ({
      ...r,
      image_url: r.image_url && isUploadsPath(r.image_url)
        ? toPublicUrl(req, r.image_url.startsWith("/") ? r.image_url : `/${r.image_url}`)
        : r.image_url,
    }));

    res.json(fixed);
  } catch (e) {
    console.error("GET /partner/offers error:", e);
    res.status(500).json({ error: "fetch_failed", message: e.message });
  }
});

router.post("/offers", async (req, res) => {
  try {
    const title     = (req.body?.title ?? "").toString().trim();
    const body      = (req.body?.body  ?? "").toString();
    const stationId = parseNumber(req.body?.station_id);
    const startsAt  = req.body?.starts_at || null;
    const endsAt    = req.body?.ends_at   || null;
    const badge     = req.body?.badge || null;
    const status    = (req.body?.status || "draft").toString().toLowerCase();
    const weekdays  = Array.isArray(req.body?.weekdays) ? req.body.weekdays : [];
    const imageUrl  = normalizeImageUrl(req, req.body?.image_url || null);
    const template  = req.body?.template_key || null;

    if (!title || !stationId) {
      return res.status(400).json({ error: "missing_fields", need: ["title", "station_id"] });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO station_offers (title, body, station_id, starts_at, ends_at, badge, status, weekdays, image_url, template_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, station_id, title, body, badge, status, weekdays, image_url, template_key, starts_at, ends_at, created_at, updated_at
      `,
      [title, body, stationId, startsAt, endsAt, badge, status, weekdays, imageUrl, template]
    );

    const out = rows[0];
    out.image_url = out.image_url && isUploadsPath(out.image_url) ? toPublicUrl(req, out.image_url) : out.image_url;

    res.status(201).json(out);
  } catch (e) {
    console.error("POST /partner/offers error:", e);
    res.status(500).json({ error: "insert_failed", message: e.message });
  }
});

router.patch("/offers/:id", async (req, res) => {
  try {
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const fields = ["title","body","badge","status","weekdays","image_url","starts_at","ends_at","station_id","template_key"];
    const set = [];
    const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) {
        let val = req.body[f];
        if (f === "image_url") val = normalizeImageUrl(req, val);
        params.push(val);
        set.push(`${f} = $${params.length}`);
      }
    }
    if (!set.length) return res.status(400).json({ error: "nothing_to_update" });

    params.push(id);

    const { rows } = await pool.query(
      `UPDATE station_offers SET ${set.join(", ")}, updated_at = now()
        WHERE id = $${params.length}
      RETURNING id, station_id, title, body, badge, status, weekdays, image_url, template_key, starts_at, ends_at, created_at, updated_at`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: "not_found" });

    const out = rows[0];
    out.image_url = out.image_url && isUploadsPath(out.image_url) ? toPublicUrl(req, out.image_url) : out.image_url;

    res.json(out);
  } catch (e) {
    console.error("PATCH /partner/offers/:id error:", e);
    res.status(500).json({ error: "update_failed", message: e.message });
  }
});

router.post("/offers/:id/toggle", async (req, res) => {
  try {
    const id = parseNumber(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const { rows: curRows } = await pool.query(`SELECT status FROM station_offers WHERE id = $1`, [id]);
    if (!curRows.length) return res.status(404).json({ error: "not_found" });
    const cur = curRows[0].status || "draft";
    const next = (cur === "active" || cur === "published") ? "paused" : "active";

    const { rows } = await pool.query(
      `UPDATE station_offers SET status = $1, updated_at = now() WHERE id = $2
       RETURNING id, station_id, title, body, badge, status, weekdays, image_url, template_key, starts_at, ends_at, created_at, updated_at`,
      [next, id]
    );

    const out = rows[0];
    out.image_url = out.image_url && isUploadsPath(out.image_url) ? toPublicUrl(req, out.image_url) : out.image_url;

    res.json(out);
  } catch (e) {
    console.error("POST /partner/offers/:id/toggle error:", e);
    res.status(500).json({ error: "toggle_failed", message: e.message });
  }
});

/* ========= PUBLIC FEEDS (stations + offers) ========= */
function offerActiveWhere(alias = "o") {
  return `
    (${alias}.status = 'active' OR ${alias}.status = 'published')
    AND (${alias}.starts_at IS NULL OR ${alias}.starts_at <= now())
    AND (${alias}.ends_at   IS NULL OR ${alias}.ends_at   >= now())
  `;
}

/** Alle stations met laatste prijzen en top 3 actieve offers */
router.get("/public/stations", async (req, res) => {
  try {
    const { limit = 100 } = req.query || {};
    const q = (req.query.q || "").toString().trim();

    const params = [];
    const whereParts = ["s.owner_user_id IS NOT NULL"]; // alleen partner-stations

    if (q) {
      params.push(`%${q}%`);
      whereParts.push(
        `(s.title ILIKE $${params.length} OR s.city ILIKE $${params.length} OR s.postcode ILIKE $${params.length})`
      );
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    params.push(Math.min(Number(limit) || 100, 500));
    const limitParamIdx = params.length;

    const sql = `
      WITH latest_prices AS (
        SELECT fp.station_id, fp.fuel_type, fp.price_eur_l
        FROM fuel_prices fp
        JOIN (
          SELECT station_id, fuel_type, MAX(created_at) AS max_created
          FROM fuel_prices
          GROUP BY station_id, fuel_type
        ) m
          ON m.station_id = fp.station_id
         AND m.fuel_type  = fp.fuel_type
         AND m.max_created = fp.created_at
      ),
      prices_per_station AS (
        SELECT station_id,
               json_agg(
                 json_build_object('fuel_type', fuel_type, 'price_eur_l', price_eur_l)
                 ORDER BY fuel_type
               ) AS prices
        FROM latest_prices
        GROUP BY station_id
      ),
      active_offers AS (
        SELECT o.*
        FROM station_offers o
        WHERE ${offerActiveWhere("o")}
      ),
      top_offers AS (
        SELECT station_id,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', id,
                     'title', title,
                     'badge', badge,
                     'image_url', image_url,
                     'starts_at', starts_at,
                     'ends_at', ends_at
                   )
                   ORDER BY created_at DESC
                 ) FILTER (WHERE TRUE),
               '[]'::json) AS offers
        FROM active_offers
        GROUP BY station_id
      )
      SELECT
        s.id, s.title,
        s.address_line1 AS street,
        s.postcode, s.city, s.country,
        s.lat, s.lng,
        COALESCE(pr.prices, '[]'::json) AS prices,
        COALESCE(of.offers, '[]'::json) AS offers
      FROM stations s
      LEFT JOIN prices_per_station pr ON pr.station_id = s.id
      LEFT JOIN (
        SELECT station_id,
               (SELECT json_agg(elem) FROM (
                  SELECT elem
                  FROM json_array_elements(offers) AS elem
                  LIMIT 3
               ) t) AS offers
        FROM top_offers
      ) of ON of.station_id = s.id
      ${whereSql}
      ORDER BY s.created_at DESC
      LIMIT $${limitParamIdx}
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /partner/public/stations error:", e);
    res.status(500).json({ error: "public_feed_failed", message: e.message });
  }
});

module.exports = router;
