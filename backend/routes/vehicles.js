// backend/routes/vehicles.js — voertuigen + assign (DB-schema aligned)
// CommonJS + Postgres pool
const express = require("express");
const router = express.Router();
const pool = require("../db/pool");

// Optionele Klaviyo service
let klaviyo = null;
try {
  klaviyo = require("../services/klaviyo");
} catch (_) {
  /* optional */
}

function getOwnerId(req) {
  // jouw server.js payload: req.user.userId (integer)
  // dev fallback
  const id = req.user?.userId;
  return Number.isFinite(Number(id)) ? Number(id) : 1;
}

const normPlate = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// Helper: map DB row -> frontend shape (oude API velden)
function mapVehicleRow(r) {
  if (!r) return r;
  return {
    id: r.id,
    owner_id: r.owner_id,
    plate: r.plate,
    label: r.label ?? "",
    // frontend verwacht "brand" etc:
    brand: r.brand ?? "",
    model: r.model ?? "",
    color: r.color ?? "",
    year: r.year ?? null,
    fuel_type: r.fuel_type ?? "",
    co2_g_km: r.co2_g_km ?? null,
    consumption_l_100km: r.consumption_l_100km ?? null,
    power_kw: r.power_kw ?? null,
    engine_cc: r.engine_cc ?? null,
    limitDaily: r.limitDaily ?? 0,
    geofenceRequired: !!r.geofenceRequired,
    assigned_user_email: r.assigned_user_email ?? "",
    assigned_user_name: r.assigned_user_name ?? "",
    created_at: r.created_at,
  };
}

/* ───────────────────── GET lijst (eigen voertuigen) ───────────────────── */
router.get("/", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);

    const { rows } = await pool.query(
      `
      SELECT
        id,
        owner_id,
        plate,
        COALESCE(label,'') AS label,

        -- DB: make -> API: brand
        COALESCE(make,'')  AS brand,
        COALESCE(model,'') AS model,

        -- deze bestaan niet in jouw vehicles table (nu), dus placeholders:
        ''::text  AS color,
        NULL::int AS year,

        -- DB: fuel_primary -> API: fuel_type
        COALESCE(fuel_primary,'') AS fuel_type,

        -- DB: wltp_g_per_km -> API: co2_g_km
        wltp_g_per_km AS co2_g_km,

        -- bestaan niet -> placeholders:
        NULL::numeric AS consumption_l_100km,
        NULL::numeric AS power_kw,
        NULL::numeric AS engine_cc,

        limit_daily AS "limitDaily",
        geofence_required AS "geofenceRequired",

        COALESCE(assigned_user_email,'') AS assigned_user_email,
        COALESCE(assigned_user_name,'')  AS assigned_user_name,

        created_at
      FROM vehicles
      WHERE owner_id = $1
      ORDER BY created_at DESC
      `,
      [ownerId]
    );

    res.json({ items: rows.map(mapVehicleRow) });
  } catch (e) {
    console.error("vehicles.list", e);
    res.status(500).json({ error: "list_failed" });
  }
});

/* ───────────────────── POST nieuw voertuig ─────────────────────
   Verwacht minimaal: plate
   (Frontend kan brand/fuel_type/co2_g_km sturen → wij mappen naar make/fuel_primary/wltp_g_per_km)
──────────────────────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const b = req.body || {};
    const plate = normPlate(b.plate);
    if (!plate) return res.status(400).json({ error: "missing_plate" });

    // Let op: jouw DB heeft UNIQUE(license_plate). We zetten die gelijk aan plate.
    // DB-kolommen: make, model, fuel_primary, wltp_g_per_km, limit_daily, geofence_required
    const { rows } = await pool.query(
      `
      INSERT INTO vehicles (
        owner_id,
        plate,
        license_plate,
        label,
        make,
        model,
        fuel_primary,
        wltp_g_per_km,
        limit_daily,
        geofence_required
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING
        id,
        owner_id,
        plate,
        COALESCE(label,'') AS label,
        COALESCE(make,'')  AS brand,
        COALESCE(model,'') AS model,
        ''::text  AS color,
        NULL::int AS year,
        COALESCE(fuel_primary,'') AS fuel_type,
        wltp_g_per_km AS co2_g_km,
        NULL::numeric AS consumption_l_100km,
        NULL::numeric AS power_kw,
        NULL::numeric AS engine_cc,
        limit_daily AS "limitDaily",
        geofence_required AS "geofenceRequired",
        COALESCE(assigned_user_email,'') AS assigned_user_email,
        COALESCE(assigned_user_name,'')  AS assigned_user_name,
        created_at
      `,
      [
        ownerId,
        plate,
        plate,
        b.label || "",
        b.brand || "",         // -> make
        b.model || "",
        b.fuel_type || "",     // -> fuel_primary
        b.co2_g_km ?? null,    // -> wltp_g_per_km
        Number(b.limitDaily) || 0,
        !!b.geofenceRequired,
      ]
    );

    res.status(201).json(mapVehicleRow(rows[0]));
  } catch (e) {
    // unieke license_plate kan clashen → geef nette error
    const msg = String(e?.message || "");
    if (msg.includes("uniq_vehicles_license_plate")) {
      return res.status(409).json({ error: "plate_already_exists" });
    }
    console.error("vehicles.create", e);
    res.status(500).json({ error: "create_failed" });
  }
});

/* ───────────────────── PUT update (label/limiet/geofence) ───────────────────── */
router.put("/:id", async (req, res) => {
  try {
    const ownerId = getOwnerId(req);
    const id = Number(req.params.id);
    const b = req.body || {};

    const { rowCount, rows } = await pool.query(
      `
      UPDATE vehicles
         SET label = COALESCE($1, label),
             limit_daily = COALESCE($2, limit_daily),
             geofence_required = COALESCE($3, geofence_required)
       WHERE id = $4 AND owner_id = $5
       RETURNING
         id,
         owner_id,
         plate,
         COALESCE(label,'') AS label,
         COALESCE(make,'')  AS brand,
         COALESCE(model,'') AS model,
         ''::text  AS color,
         NULL::int AS year,
         COALESCE(fuel_primary,'') AS fuel_type,
         wltp_g_per_km AS co2_g_km,
         NULL::numeric AS consumption_l_100km,
         NULL::numeric AS power_kw,
         NULL::numeric AS engine_cc,
         limit_daily AS "limitDaily",
         geofence_required AS "geofenceRequired",
         COALESCE(assigned_user_email,'') AS assigned_user_email,
         COALESCE(assigned_user_name,'')  AS assigned_user_name,
         created_at
      `,
      [
        b.label ?? null,
        b.limitDaily !== undefined ? Number(b.limitDaily) : null,
        b.geofenceRequired !== undefined ? !!b.geofenceRequired : null,
        id,
        ownerId,
      ]
    );

    if (!rowCount) return res.status(404).json({ error: "not_found" });
    res.json(mapVehicleRow(rows[0]));
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

    const { rowCount } = await pool.query(
      "DELETE FROM vehicles WHERE id=$1 AND owner_id=$2",
      [id, ownerId]
    );

    if (!rowCount) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) {
    console.error("vehicles.delete", e);
    res.status(500).json({ error: "delete_failed" });
  }
});

/* ───────────────────── POST /assign ─────────────────────
   Body: { vehicleId OR plate, email, name }
   Vereist DB-kolommen: assigned_user_email, assigned_user_name
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

    await pool.query(
      `
      UPDATE vehicles
         SET assigned_user_email=$1,
             assigned_user_name=$2,
             updated_at=now()
       WHERE id=$3 AND owner_id=$4
      `,
      [email, name || null, row.id, ownerId]
    );

    // Optioneel: Klaviyo
    if (klaviyo?.subscribeUser) {
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

    if (klaviyo?.trackEvent) {
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
