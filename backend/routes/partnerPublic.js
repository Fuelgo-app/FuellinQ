// routes/partnerPublic.js
const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// Health
router.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

/**
 * GET /api/partner/public/stations
 * Query:
 *  - q: string (filter op name/city)
 *  - limit: number (default 100, max 1000)
 *  - lat,lng: numbers (optioneel; sorteert op afstand)
 *  - radiusKm: number (optioneel; filter op straal als lat/lng is meegegeven)
 */
router.get("/stations", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    let limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);

    const hasGeo =
      req.query.lat !== undefined &&
      req.query.lng !== undefined &&
      !Number.isNaN(Number(req.query.lat)) &&
      !Number.isNaN(Number(req.query.lng));

    const lat = hasGeo ? Number(req.query.lat) : null;
    const lng = hasGeo ? Number(req.query.lng) : null;
    const radiusKm = hasGeo && req.query.radiusKm ? Math.max(0, Number(req.query.radiusKm)) : null;

    // Check of kolom 'active' bestaat
    const { rows: colRows } = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_name='stations' AND column_name='active'
       ) AS has_active`
    );
    const hasActive = !!colRows[0]?.has_active;

    const params = [];
    let where = "WHERE 1=1";

    if (hasActive) {
      where += " AND COALESCE(active, TRUE) IS TRUE";
    }

    if (q) {
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
      where += ` AND (LOWER(COALESCE(name,'')) LIKE $${params.length - 1} OR LOWER(COALESCE(city,'')) LIKE $${params.length})`;
    }

    let order = "ORDER BY name ASC";
    let distanceSql = "NULL::float AS distance_km";

    if (hasGeo) {
      params.push(lat, lng, lat);
      const a = params.length - 2; // $a=lat, $a+1=lng, $a+2=lat
      distanceSql = `
        (6371 * acos(
          least(1, greatest(-1,
            cos(($${a} * pi() / 180)) * cos((COALESCE(lat,0) * pi() / 180)) *
            cos((COALESCE(lng,0) * pi() / 180) - ($${a + 1} * pi() / 180)) +
            sin(($${a + 2} * pi() / 180)) * sin((COALESCE(lat,0) * pi() / 180))
          ))
        ))::float AS distance_km
      `;
      order = "ORDER BY distance_km ASC, name ASC";
    }

    // Zonder radius filter
    let sql = `
      SELECT id,
             COALESCE(name,'') AS name,
             COALESCE(city,'') AS city,
             COALESCE(lat,0)::float AS lat,
             COALESCE(lng,0)::float AS lng,
             ${distanceSql}
        FROM stations
        ${where}
        ${order}
        LIMIT ${limit}
    `;

    // Als radiusKm is gezet + geo aanwezig → filter in outer select
    if (hasGeo && radiusKm && radiusKm > 0) {
      const inner = `
        SELECT id, COALESCE(name,'') AS name, COALESCE(city,'') AS city,
               COALESCE(lat,0)::float AS lat, COALESCE(lng,0)::float AS lng,
               ${distanceSql}
          FROM stations
          ${where}
          ${order}
          LIMIT ${limit}
      `;
      const { rows } = await pool.query(
        `WITH s AS (${inner})
         SELECT * FROM s WHERE distance_km <= $1
         ORDER BY distance_km ASC, name ASC
         LIMIT ${limit}`,
        [radiusKm, ...params]
      );
      return res.json({ stations: rows });
    }

    const { rows } = await pool.query(sql, params);
    return res.json({ stations: rows });
  } catch (err) {
    console.warn("partner/public/stations error:", err?.message);
    return res.json({ stations: [] });
  }
});

module.exports = router;
