// backend/routes/vehicles.js — voertuigen + assign
// CommonJS + Postgres pool
const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// Optionele Klaviyo service (niet verplicht; slaat stil over als niet aanwezig)
let klaviyo = null;
try { klaviyo = require("../services/klaviyo"); } catch (_) { /* optional */ }

function getOwnerId(req) {
  // Gebruik echte auth payload van server.js → req.user.userId
  // Valt in dev terug op 1 als er nog geen auth is.
  return req.user?.userId || 1;
}
const normPlate = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ───────────────────── GET lijst (eigen voertuigen) ───────────────────── */
router.get("/", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const { rows } = await pool.query(
      `SELECT id, owner_id, plate, COALESCE(label,'') AS label,
              COALESCE(brand,'') AS brand, COALESCE(model,'') AS model,
              COALESCE(color,'') AS color, year,
              COALESCE(fuel_type,'') AS fuel_type,
              co2_g_km, consumption_l_100km, power_kw, engine_cc,
              limit_daily AS "limitDaily",
              geofence_required AS "geofenceRequired",
              COALESCE(assigned_user_email,'') AS assigned_user_email,
              COALESCE(assigned_user_name,'')  AS assigned_user_name,
              created_at
         FROM vehicles
        WHERE owner_id = $1
        ORDER BY created_at DESC`,
      [ownerId]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("vehicles.list", e);
    res.status(500).json({ error: "list_failed" });
  }
});

/* ───────────────────── POST nieuw voertuig ─────────────────────
   Verwacht minimaal: plate
   Optioneel: label, brand, model, color, year, fuel_type, co2_g_km, consumption_l_100km, power_kw, engine_cc
──────────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const b = req.body || {};
    const plate = normPlate(b.plate);
    if (!plate) return res.status(400).json({ error: "missing_plate" });

    const { rows } = await pool.query(
      `INSERT INTO vehicles (
          owner_id, plate, label, brand, model, color, year, fuel_type,
          co2_g_km, consumption_l_100km, power_kw, engine_cc, limit_daily, geofence_required
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, owner_id, plate, label, brand, model, color, year, fuel_type,
                  co2_g_km, consumption_l_100km, power_kw, engine_cc,
                  limit_daily AS "limitDaily", geofence_required AS "geofenceRequired",
                  assigned_user_email, assigned_user_name, created_at`,
      [
        ownerId, plate, b.label || null, b.brand || null, b.model || null, b.color || null,
        b.year || null, b.fuel_type || null,
        b.co2_g_km || null, b.consumption_l_100km || null, b.power_kw || null, b.engine_cc || null,
        Number(b.limitDaily) || 0, !!b.geofenceRequired
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("vehicles.create", e);
    res.status(500).json({ error: "create_failed" });
  }
});

/* ───────────────────── PUT update (label/limiet/geofence, etc.) ───────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const id = Number(req.params.id);
    const b = req.body || {};
    const { rowCount, rows } = await pool.query(
      `UPDATE vehicles
          SET label = COALESCE($1, label),
              limit_daily = COALESCE($2, limit_daily),
              geofence_required = COALESCE($3, geofence_required)
        WHERE id = $4 AND owner_id = $5
        RETURNING id, owner_id, plate, label, brand, model, color, year, fuel_type,
                  co2_g_km, consumption_l_100km, power_kw, engine_cc,
                  limit_daily AS "limitDaily", geofence_required AS "geofenceRequired",
                  assigned_user_email, assigned_user_name, created_at`,
      [b.label ?? null, (b.limitDaily !== undefined ? Number(b.limitDaily) : null), (b.geofenceRequired !== undefined ? !!b.geofenceRequired : null), id, ownerId]
    );
    if (!rowCount) return res.status(404).json({ error: "not_found" });
    res.json(rows[0]);
  } catch (e) {
    console.error("vehicles.update", e);
    res.status(500).json({ error: "update_failed" });
  }
});

/* ───────────────────── DELETE voertuig ───────────────────── */
router.delete("/:id", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const id = Number(req.params.id);
    const { rowCount } = await pool.query("DELETE FROM vehicles WHERE id=$1 AND owner_id=$2", [id, ownerId]);
    if (!rowCount) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("vehicles.delete", e);
    res.status(500).json({ error: "delete_failed" });
  }
});

/* ───────────────────── POST /assign ─────────────────────
   Koppelt een bestuurder aan een voertuig en (optioneel) triggert Klaviyo.
   Body: { vehicleId OR plate, email, name }
────────────────────────────────────────────────────────── */
router.post("/assign", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const { vehicleId, plate: rawPlate, email, name } = req.body || {};
    if (!email) return res.status(400).json({ error: "missing_email" });

    // Zoek target
    let row = null;
    if (vehicleId) {
      const q = await pool.query(
        `SELECT id, plate FROM vehicles WHERE id=$1 AND owner_id=$2`,
        [Number(vehicleId), ownerId]
      );
      row = q.rows[0] || null;
    } else if (rawPlate) {
      const q = await pool.query(
        `SELECT id, plate FROM vehicles WHERE plate=$1 AND owner_id=$2`,
        [normPlate(rawPlate), ownerId]
      );
      row = q.rows[0] || null;
    }
    if (!row) return res.status(404).json({ error: "vehicle_not_found" });

    // Update toewijzing
    await pool.query(
      `UPDATE vehicles
          SET assigned_user_email=$1, assigned_user_name=$2, updated_at=now()
        WHERE id=$3 AND owner_id=$4`,
      [email, name || null, row.id, ownerId]
    );

    // Optioneel: Klaviyo identify + event
    if (klaviyo && klaviyo.subscribeUser) {
      try {
        await klaviyo.subscribeUser({
          email,
          firstName: (name || "").split(" ")[0] || undefined,
          properties: { source: "FuelLinq Vehicle Assign" },
        });
      } catch (e) {
        console.warn("klaviyo.subscribeUser failed:", e?.response?.data || e?.message);
      }
    }
    if (klaviyo && klaviyo.trackEvent) {
      try {
        await klaviyo.trackEvent({
          eventName: "Vehicle Assigned",
          email,
          properties: { plate: row.plate, vehicle_id: row.id, ts: Date.now() },
        });
      } catch (e) {
        console.warn("klaviyo.trackEvent failed:", e?.response?.data || e?.message);
      }
    }

    res.json({ ok: true, vehicle_id: row.id, plate: row.plate, email, name: name || null });
  } catch (e) {
    console.error("vehicles.assign", e);
    res.status(500).json({ error: "assign_failed" });
  }
});

module.exports = router;
