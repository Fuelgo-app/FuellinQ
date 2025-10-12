// routes/stations.js
const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

/* Helpers */
function isAdmin(req) {
  return req.user?.role === "admin";
}
function canAccessStation(req, row) {
  if (!row) return false;
  if (isAdmin(req)) return true;
  return row.owner_user_id === req.user?.userId;
}
function sanitizeStationBody(body = {}) {
  return {
    title:        (body.title || "").trim(),
    brand:        (body.brand || "").trim() || null,
    logo_url:     (body.logo_url || "").trim() || null,
    street:       (body.street || body.address || "").trim() || null,
    house_number: (body.house_number || body.housenumber || "").trim() || null,
    postcode:     (body.postcode || body.zip || "").trim() || null,
    city:         (body.city || "").trim() || null,
    country:      (body.country || body.land || "").trim() || "NL",
    lat:          body.lat != null ? Number(body.lat) : null,
    lng:          body.lng != null ? Number(body.lng) : null,
  };
}

/* ------------------------ PRIVATE (auth vereist via /api) ------------------------ */

/** Lijst met eigen stations (owner = ingelogde user) */
router.get("/stations", async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (!isAdmin(req)) {
      params.push(req.user.userId);
      where = "WHERE s.owner_user_id = $" + params.length;
    }
    const { rows } = await pool.query(
      `
      SELECT
        s.id, s.title, s.brand, s.logo_url,
        s.street, s.house_number, s.postcode, s.city, s.country,
        s.lat, s.lng,
        s.owner_user_id,
        coalesce(json_agg(DISTINCT sp ORDER BY sp.product) FILTER (WHERE sp.id IS NOT NULL), '[]') AS prices,
        coalesce(json_agg(DISTINCT o)  FILTER (WHERE o.id  IS NOT NULL), '[]') AS offers
      FROM stations s
      LEFT JOIN station_prices sp ON sp.station_id = s.id
      LEFT JOIN offers o ON o.station_id = s.id AND o.published = true
      ${where}
      GROUP BY s.id
      ORDER BY s.id DESC
      `,
      params
    );
    res.json({ stations: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "fetch_stations_failed" });
  }
});

/** Nieuw station */
router.post("/stations", async (req, res) => {
  try {
    const b = sanitizeStationBody(req.body);
    if (!b.title) return res.status(400).json({ error: "missing_title" });

    const { rows } = await pool.query(
      `
      INSERT INTO stations
        (title, brand, logo_url, street, house_number, postcode, city, country, lat, lng, owner_user_id)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id, title, brand, logo_url, street, house_number, postcode, city, country, lat, lng, owner_user_id
      `,
      [
        b.title, b.brand, b.logo_url, b.street, b.house_number, b.postcode,
        b.city, b.country, b.lat, b.lng, req.user.userId
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "create_station_failed" });
  }
});

/** Station bijwerken (opslaan) */
router.put("/stations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await pool.query("SELECT id, owner_user_id FROM stations WHERE id=$1", [id]);
    const row = cur.rows[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    if (!canAccessStation(req, row)) return res.status(403).json({ error: "forbidden" });

    const b = sanitizeStationBody(req.body);

    const { rows } = await pool.query(
      `
      UPDATE stations SET
        title=$1, brand=$2, logo_url=$3,
        street=$4, house_number=$5, postcode=$6, city=$7, country=$8,
        lat=$9, lng=$10, updated_at=now()
      WHERE id=$11
      RETURNING id, title, brand, logo_url, street, house_number, postcode, city, country, lat, lng, owner_user_id
      `,
      [
        b.title, b.brand, b.logo_url,
        b.street, b.house_number, b.postcode, b.city, b.country,
        b.lat, b.lng, id,
      ]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "update_station_failed" });
  }
});

/** Verwijderen */
router.delete("/stations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await pool.query("SELECT id, owner_user_id FROM stations WHERE id=$1", [id]);
    const row = cur.rows[0];
    if (!row) return res.status(404).json({ error: "not_found" });
    if (!canAccessStation(req, row)) return res.status(403).json({ error: "forbidden" });

    // cascade: prijzen & offers mee weg (FK ON DELETE CASCADE is nog beter)
    await pool.query("DELETE FROM station_prices WHERE station_id=$1", [id]);
    await pool.query("DELETE FROM offers         WHERE station_id=$1", [id]);
    await pool.query("DELETE FROM stations       WHERE id=$1", [id]);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "delete_station_failed" });
  }
});

/* ------------------------ PUBLIEK: feed ------------------------ */
/** Publieke lijst (geen auth nodig vóór dit bestand, maar server zet auth op /api; daarom onder partner router expose je meestal /api/partner/public) */
router.get("/partner/public/stations", async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase().trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const params = [limit];
    let where = "";
    if (q) {
      params.unshift(`%${q}%`, `%${q}%`);
      where = `WHERE lower(s.city) LIKE $1 OR lower(s.title) LIKE $2`;
      params.push(limit);
    }

    const { rows } = await pool.query(
      `
      WITH base AS (
        SELECT
          s.id, s.title, s.brand, s.logo_url,
          s.street, s.house_number, s.postcode, s.city, s.country,
          s.lat, s.lng
        FROM stations s
        ${where}
        ORDER BY s.id DESC
        LIMIT $${q ? 3 : 1}
      )
      SELECT
        b.*,
        coalesce(
          (SELECT json_agg(json_build_object('fuel_type', sp.product, 'price_eur_l', sp.price_cents/100.0) ORDER BY sp.product)
           FROM station_prices sp WHERE sp.station_id = b.id),
          '[]'
        ) AS prices,
        coalesce(
          (SELECT json_agg(json_build_object('id', o.id, 'title', o.title, 'badge', o.badge, 'image_url', o.image_url) ORDER BY o.id DESC)
           FROM offers o WHERE o.station_id = b.id AND o.published = true
          ),
          '[]'
        ) AS offers
      FROM base b;
      `,
      params
    );

    res.json({ stations: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "public_feed_failed" });
  }
});

module.exports = router;
