const express = require("express");
const router = express.Router();
const { randomUUID } = require("crypto");
const pool = require("../db/pool");
const tollProvider = require("../services/tollProvider");

function requireAuth(req, res, next) {
  // ga uit van req.user gezet door je bestaande auth-middleware
  if (!req.user) return res.status(401).json({ error: "unauthorized" });
  next();
}

router.get("/zones", async (req, res) => {
  const zones = await tollProvider.listZones();
  res.json({ zones });
});

router.post("/detect", requireAuth, async (req, res) => {
  const { lng, lat, vehicleId, ts } = req.body || {};
  if (typeof lng !== "number" || typeof lat !== "number") {
    return res.status(400).json({ error: "missing_coordinates" });
  }
  const match = await tollProvider.matchPositionToZone(lng, lat);
  if (!match) return res.json({ matched: false });

  const z = match.zone;
  const id = randomUUID();
  const userId = req.user.id;

  // check dup (zelfde zone binnen 30 min)
  const dup = await pool.query(
    `SELECT id FROM toll_sessions
     WHERE user_id=$1 AND zone_id=$2 AND detected_at > now() - interval '30 minutes'`,
    [userId, z.id]
  );
  if (dup.rowCount) return res.json({ matched: true, duplicate: true });

  const status = process.env.TOLL_AUTOPAY === "true" ? "paid" : "pending";
  await pool.query(
    `INSERT INTO toll_sessions (id, user_id, zone_id, zone_name, country, price, currency, detected_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, now()),$9)`,
    [id, userId, z.id, z.name, z.country, z.price, z.currency || "EUR", ts, status]
  );

  res.json({ matched: true, sessionId: id, autopay: status === "paid" });
});

router.post("/pay", requireAuth, async (req, res) => {
  const { sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: "missing_sessionId" });

  const { rows } = await pool.query(
    `SELECT * FROM toll_sessions WHERE id=$1 AND user_id=$2`,
    [sessionId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "not_found" });
  const s = rows[0];
  if (s.status === "paid") return res.json({ ok: true, status: "paid" });

  // TODO: wallet/stripe integratie; nu meteen paid zetten
  await pool.query(`UPDATE toll_sessions SET status='paid' WHERE id=$1`, [sessionId]);
  res.json({ ok: true, status: "paid" });
});

router.get("/history", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, zone_name, country, price, currency, detected_at, status
     FROM toll_sessions
     WHERE user_id=$1
     ORDER BY detected_at DESC LIMIT 200`,
    [req.user.id]
  );
  res.json({ items: rows });
});

module.exports = router;
