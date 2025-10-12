// backend/routes/co2.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const pool = require("../db/pool");

// ✅ Auth (uit jouw backend/routes/services/auth.js)
let requireAuth = (_req, _res, next) => next(); // fallback no-op (dev/tests)
try {
  ({ requireAuth } = require("./services/auth"));
} catch {}

// ────────────────────────────────────────────────────────────
// RDW / Socrata client
// Dataset-ids:
// - m9d7-ebf2  : Voertuigen
// - 8ys7-d773  : Brandstof
// ────────────────────────────────────────────────────────────
const RDW = axios.create({
  baseURL: "https://opendata.rdw.nl/resource",
  timeout: Number(process.env.RDW_TIMEOUT_MS || 3500),
  headers: process.env.RDW_APP_TOKEN ? { "X-App-Token": process.env.RDW_APP_TOKEN } : {},
});

// ───────────────── Helpers ─────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normPlate(p) {
  return String(p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function mapFuel(rdwb) {
  const s = String(rdwb || "").toLowerCase();
  if (s.includes("diesel")) return "Diesel";
  if (s.includes("elektr")) return "Elektrisch";
  if (s.includes("lpg")) return "LPG";
  if (s.includes("cng")) return "CNG";
  if (s.includes("lng")) return "LNG";
  if (s.includes("waterstof") || s.includes("h2")) return "Waterstof";
  return "Benzine";
}
function toISODate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string" && DATE_RE.test(d)) return new Date(d + "T00:00:00Z").toISOString();
  const asDate = new Date(d);
  return Number.isNaN(asDate.getTime()) ? null : asDate.toISOString();
}
function isElectric(fuel) {
  return String(fuel || "").toLowerCase().includes("elektr");
}

// ───────────────── Ensure tables/columns/indexen (idempotent) ─────────────────
async function ensureCo2Tables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rdw_cache (
      plate TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      fetched_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS odometer_logs (
      id serial PRIMARY KEY,
      vehicle_id INT NOT NULL,
      reading_km NUMERIC NOT NULL,
      at_time timestamptz NOT NULL,
      source TEXT DEFAULT 'manual'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fuel_transactions (
      id serial PRIMARY KEY,
      vehicle_id INT NOT NULL,
      fuel_type TEXT NOT NULL,
      liters NUMERIC NOT NULL,
      amount_eur NUMERIC,
      at_time timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emission_factors (
      fuel_type TEXT PRIMARY KEY,
      kg_co2_per_liter NUMERIC NOT NULL
    );
  `);

  // Defaults/seed
  await pool.query(`
    INSERT INTO emission_factors (fuel_type, kg_co2_per_liter) VALUES
      ('Benzine', 2.31),
      ('Diesel', 2.64),
      ('LPG', 1.66),
      ('CNG', 2.74),
      ('LNG', 2.75)
    ON CONFLICT (fuel_type) DO NOTHING;
  `);

  // Vehicles uitbreiden indien nodig
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS fuel_primary TEXT;`);
  await pool.query(`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS wltp_g_per_km INT;`);

  // Indexen voor performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_odometer_vehicle_time ON odometer_logs (vehicle_id, at_time);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fuel_vehicle_time ON fuel_transactions (vehicle_id, at_time);`);
}
ensureCo2Tables().catch((e) => console.error("ensureCo2Tables failed:", e));

// ───────────────── Cache helpers (rdw_cache) ─────────────────
const CACHE_TTL_MIN = Number(process.env.RDW_CACHE_TTL_MIN || 1440);

async function readRdwCache(plate) {
  const { rows } = await pool.query(
    `SELECT payload
       FROM rdw_cache
      WHERE plate=$1
        AND fetched_at > now() - ($2 || ' minutes')::interval
      LIMIT 1`,
    [plate, CACHE_TTL_MIN]
  );
  return rows[0]?.payload || null;
}
async function writeRdwCache(plate, payload) {
  await pool.query(
    `INSERT INTO rdw_cache (plate, payload, fetched_at)
     VALUES ($1,$2,now())
     ON CONFLICT (plate) DO UPDATE
       SET payload = EXCLUDED.payload,
           fetched_at = EXCLUDED.fetched_at`,
    [plate, payload]
  );
}

// ───────────────── RDW lookup (voertuig + brandstof + CO2) ─────────────────
async function rdwLookup(plate) {
  const veh = await RDW.get(`/m9d7-ebf2.json`, { params: { kenteken: plate, $limit: 1 } }).then((r) => r.data);
  const v = Array.isArray(veh) && veh[0] ? veh[0] : null;
  if (!v) return null;

  const fuels = await RDW.get(`/8ys7-d773.json`, { params: { kenteken: plate, $limit: 5 } })
    .then((r) => r.data)
    .catch(() => []);
  let fuel_primary = null;
  if (Array.isArray(fuels) && fuels.length) {
    const f1 = fuels.find((f) => String(f.brandstof_volgnummer || "") === "1") || fuels[0];
    fuel_primary = mapFuel(f1.brandstof_omschrijving || f1.brandstofsoort || f1.brandstof || "");
  }

  const co2Candidates = [
    v.wltp_co2_uitstoot_gecombineerd,
    v.co2_uitstoot_gecombineerd,
    v.co2_uitstoot_gewogen,
  ];
  let wltp_g_per_km = null;
  for (const c of co2Candidates) {
    if (c != null && c !== "") {
      const n = parseInt(String(c).replace(/[^0-9]/g, ""), 10);
      if (Number.isFinite(n) && n > 0) {
        wltp_g_per_km = n;
        break;
      }
    }
  }

  return {
    plate,
    license_plate: plate,
    make: v.merk || null,
    model: v.handelsbenaming || null,
    fuel_primary: fuel_primary || "Benzine",
    wltp_g_per_km: wltp_g_per_km || null,
  };
}

// ────────────────────────────────────────────────────────────
// PUBLIC: POST /api/co2/vehicle/lookup
// body: { license_plate: "K-123-XY" }
// Flow: cache → RDW → cache → upsert in vehicles → return vehicle_id
// ────────────────────────────────────────────────────────────
router.post("/vehicle/lookup", async (req, res) => {
  try {
    const raw = req.body?.license_plate || "";
    const plate = normPlate(raw);
    if (!plate) return res.status(400).json({ error: "missing_license_plate" });

    let data = await readRdwCache(plate);
    if (!data) {
      try {
        data = await rdwLookup(plate);
        if (data) await writeRdwCache(plate, data);
      } catch (e) {
        console.warn("RDW lookup error:", e?.message || e);
      }
    }

    if (!data) {
      data = { plate, license_plate: plate, make: null, model: null, fuel_primary: "Benzine", wltp_g_per_km: null };
    }

    let vehicleId = null;
    const found = await pool.query(`SELECT id FROM vehicles WHERE UPPER(plate)=UPPER($1) LIMIT 1`, [plate]);
    if (found.rows[0]) {
      vehicleId = found.rows[0].id;
      await pool.query(
        `UPDATE vehicles
            SET fuel_primary = COALESCE($2, fuel_primary),
                wltp_g_per_km = COALESCE($3, wltp_g_per_km)
          WHERE id = $1`,
        [vehicleId, data.fuel_primary, data.wltp_g_per_km]
      );
    } else {
      const ins = await pool.query(
        `INSERT INTO vehicles (company_id, plate, label, limit_daily, geofence_required, fuel_primary, wltp_g_per_km)
         VALUES (NULL, $1, $2, 0, FALSE, $3, $4)
         RETURNING id`,
        [plate, [data.make, data.model].filter(Boolean).join(" ") || "", data.fuel_primary, data.wltp_g_per_km]
      );
      vehicleId = ins.rows[0].id;
    }

    return res.json({
      ok: true,
      rdw: data,
      vehicle_id: vehicleId,
      source: data.make || data.model ? "rdw" : "fallback",
    });
  } catch (e) {
    console.error("lookup error:", e);
    res.status(500).json({ error: "lookup_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// PUBLIC by default (kan achter auth als je wilt):
// POST /api/co2/webhook/transaction
// body: { vehicle_id, fuel_type, liters, amount_eur?, at_time? }
// ────────────────────────────────────────────────────────────
router.post("/webhook/transaction", async (req, res) => {
  try {
    const { vehicle_id, fuel_type, liters, amount_eur, at_time } = req.body || {};
    const vid = Number(vehicle_id);
    const l = Number(liters);
    const amt = amount_eur != null ? Number(amount_eur) : null;
    const atISO = toISODate(at_time) || new Date().toISOString();
    if (!vid || !l || !fuel_type) return res.status(400).json({ error: "bad_input" });

    const ins = await pool.query(
      `INSERT INTO fuel_transactions (vehicle_id, fuel_type, liters, amount_eur, at_time)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, vehicle_id, fuel_type, liters, amount_eur, at_time`,
      [vid, String(fuel_type), l, amt, atISO]
    );
    res.json({ ok: true, tx: ins.rows[0] });
  } catch (e) {
    console.error("tx error:", e);
    res.status(500).json({ error: "tx_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// PRIVATE vanaf hier
// ────────────────────────────────────────────────────────────
router.use(requireAuth);

// ────────────────────────────────────────────────────────────
// POST /api/co2/vehicle/:id/odometer
// body: { reading_km, at_time }
// ────────────────────────────────────────────────────────────
router.post("/vehicle/:id/odometer", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reading = Number(req.body?.reading_km);
    const atISO = toISODate(req.body?.at_time) || new Date().toISOString();
    if (!id || !Number.isFinite(reading)) return res.status(400).json({ error: "bad_input" });

    const ins = await pool.query(
      `INSERT INTO odometer_logs (vehicle_id, reading_km, at_time, source)
       VALUES ($1,$2,$3,'manual')
       RETURNING id, vehicle_id, reading_km, at_time`,
      [id, reading, atISO]
    );
    res.json({ ok: true, log: ins.rows[0] });
  } catch (e) {
    console.error("odometer error:", e);
    res.status(500).json({ error: "odometer_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/factors  (emissiefactoren bekijken)
// ────────────────────────────────────────────────────────────
router.get("/factors", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT fuel_type, kg_co2_per_liter FROM emission_factors ORDER BY fuel_type`);
    res.json(rows);
  } catch (e) {
    console.error("factors error:", e);
    res.status(500).json({ error: "factors_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/vehicle/:id/preview
// Vergelijkt WLTP vs liters×factor (EV => 0)
// ────────────────────────────────────────────────────────────
router.get("/vehicle/:id/preview", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;

    const { rows: vehRows } = await pool.query(
      `SELECT fuel_primary, wltp_g_per_km FROM vehicles WHERE id=$1`,
      [id]
    );
    if (!vehRows.length) return res.status(404).json({ error: "vehicle_not_found" });
    const veh = vehRows[0];
    const isEV = isElectric(veh.fuel_primary);

    // km-range
    const kmParams = [id];
    let kmWhere = "vehicle_id=$1";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT reading_km, at_time
         FROM odometer_logs
        WHERE ${kmWhere}
        ORDER BY at_time ASC`,
      kmParams
    );

    let km_total = 0;
    if (kmRows.length >= 2) {
      km_total = Number(kmRows[kmRows.length - 1].reading_km) - Number(kmRows[0].reading_km);
      if (km_total < 0) km_total = 0;
    }

    // liters-range
    const fuelParams = [id];
    let fuelWhere = "vehicle_id=$1";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: fuelRows } = await pool.query(
      `SELECT fuel_type, liters, amount_eur, at_time
         FROM fuel_transactions
        WHERE ${fuelWhere}
        ORDER BY at_time ASC`,
      fuelParams
    );
    const liters_total = fuelRows.reduce((s, r) => s + Number(r.liters || 0), 0);

    // WLTP
    let wltpKg = null;
    if (veh.wltp_g_per_km != null && km_total > 0) {
      wltpKg = Math.round((Number(veh.wltp_g_per_km) * km_total)) / 1000;
    }

    // Factor
    let factorKg = 0;
    if (!isEV) {
      const lastFuel = (fuelRows[fuelRows.length - 1]?.fuel_type) || veh.fuel_primary || "Benzine";
      const ef = await pool.query(
        `SELECT kg_co2_per_liter FROM emission_factors WHERE fuel_type=$1`,
        [lastFuel]
      );
      const kgPerL = Number(ef.rows[0]?.kg_co2_per_liter ?? 2.31);
      factorKg = Number((liters_total * kgPerL).toFixed(3));
    }

    res.json({
      ok: true,
      vehicle_id: id,
      from, to,
      km_total,
      liters_total: Number(liters_total.toFixed(2)),
      methods: {
        electric: isEV ? { kg_co2_total: 0 } : null,
        wltp: wltpKg != null ? { g_per_km: veh.wltp_g_per_km, kg_co2_total: wltpKg } : null,
        fuel_factor: { kg_co2_total: factorKg },
      },
      series: { odometer: kmRows, fuel: fuelRows },
    });
  } catch (e) {
    console.error("preview error:", e);
    res.status(500).json({ error: "preview_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/vehicle/:id/report
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&price_per_ton=25
// Returns: km, liters, kg CO2, avg g/km, offset + series
// ────────────────────────────────────────────────────────────
router.get("/vehicle/:id/report", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;
    const pricePerTon = Number(req.query.price_per_ton ?? 20);

    const { rows: vehRows } = await pool.query(
      `SELECT fuel_primary, wltp_g_per_km FROM vehicles WHERE id=$1`,
      [id]
    );
    if (!vehRows.length) return res.status(404).json({ error: "vehicle_not_found" });
    const veh = vehRows[0];
    const fuelPrimary = veh.fuel_primary || "Benzine";
    const wltp = veh.wltp_g_per_km;

    // km-range
    const kmParams = [id];
    let kmWhere = "vehicle_id=$1";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT reading_km, at_time
         FROM odometer_logs
        WHERE ${kmWhere}
        ORDER BY at_time ASC`,
      kmParams
    );

    let km_total = 0;
    if (kmRows.length >= 2) {
      km_total = Number(kmRows[kmRows.length - 1].reading_km) - Number(kmRows[0].reading_km);
      if (km_total < 0) km_total = 0;
    }

    // liters-range
    const fuelParams = [id];
    let fuelWhere = "vehicle_id=$1";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: fuelRows } = await pool.query(
      `SELECT fuel_type, liters, at_time
         FROM fuel_transactions
        WHERE ${fuelWhere}
        ORDER BY at_time ASC`,
      fuelParams
    );
    const liters_total = fuelRows.reduce((s, r) => s + Number(r.liters || 0), 0);

    // Emissieberekening
    let kg_co2_total = null;
    let method = null;

    if (wltp != null && km_total > 0) {
      kg_co2_total = Math.round((Number(wltp) * km_total)) / 1000; // g → kg
      method = "wltp";
    } else {
      const lastFuel = (fuelRows[fuelRows.length - 1]?.fuel_type) || fuelPrimary || "Benzine";
      const ef = await pool.query(`SELECT kg_co2_per_liter FROM emission_factors WHERE fuel_type=$1`, [lastFuel]);
      const kg_per_l = Number(ef.rows[0]?.kg_co2_per_liter ?? 2.31);
      kg_co2_total = Number((liters_total * kg_per_l).toFixed(3));
      method = "fuel_factor";
    }

    if (isElectric(veh.fuel_primary)) {
      kg_co2_total = 0;
      method = "electric";
    }

    const avg_g_per_km = km_total > 0 ? Math.round((kg_co2_total * 1000) / km_total) : null;

    // 💶 Compensation (indicatief)
    const tons = kg_co2_total / 1000;
    const offset_cost_eur = Number((tons * pricePerTon).toFixed(2));

    res.json({
      ok: true,
      vehicle_id: id,
      method,
      from, to,
      km_total,
      liters_total: Number(liters_total.toFixed(2)),
      kg_co2_total,
      avg_g_per_km,
      offset: { tons: Number(tons.toFixed(3)), price_per_ton: pricePerTon, estimated_cost_eur: offset_cost_eur },
      series: { odometer: kmRows, fuel: fuelRows },
    });
  } catch (e) {
    console.error("report error:", e);
    res.status(500).json({ error: "report_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/vehicle/:id/monthly
// Query: ?months=12 (of ?from=YYYY-MM-DD&to=YYYY-MM-DD)
// Output: per maand: km, liters, kg_co2, method, avg_g_per_km
// ────────────────────────────────────────────────────────────
router.get("/vehicle/:id/monthly", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    const months = Math.min(Math.max(Number(req.query.months || 12), 1), 60);
    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;

    const { rows: vehRows } = await pool.query(
      `SELECT fuel_primary, wltp_g_per_km FROM vehicles WHERE id=$1`,
      [id]
    );
    if (!vehRows.length) return res.status(404).json({ error: "vehicle_not_found" });
    const veh = vehRows[0];
    const fuelPrimary = veh.fuel_primary || "Benzine";
    const isEV = isElectric(fuelPrimary);

    // Odometer per maand
    const kmParams = [id];
    let kmWhere = "vehicle_id=$1";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT date_trunc('month', at_time)::date AS m,
              (max(reading_km) - min(reading_km))::numeric AS km
         FROM odometer_logs
        WHERE ${kmWhere}
        GROUP BY 1
        ORDER BY 1 ASC`,
      kmParams
    );

    // Liters per maand
    const fuelParams = [id];
    let fuelWhere = "vehicle_id=$1";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: literRows } = await pool.query(
      `SELECT date_trunc('month', at_time)::date AS m,
              SUM(liters)::numeric AS liters
         FROM fuel_transactions
        WHERE ${fuelWhere}
        GROUP BY 1
        ORDER BY 1 ASC`,
      fuelParams
    );

    // Grid
    const series = new Map();
    const add = (d, obj) => series.set(String(d), { ...(series.get(String(d)) || { m: d, km: 0, liters: 0 }), ...obj });

    if (!from && !to) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 - months, 1));
      for (let i = 0; i < months; i++) {
        const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
        add(dt.toISOString().slice(0, 10), {});
      }
    }

    kmRows.forEach(r => add(r.m.toISOString().slice(0,10), { km: Number(r.km || 0) }));
    literRows.forEach(r => add(r.m.toISOString().slice(0,10), { liters: Number(r.liters || 0) }));

    // Factor
    let kgPerL = 2.31;
    if (!isEV) {
      const ef = await pool.query(`SELECT kg_co2_per_liter FROM emission_factors WHERE fuel_type=$1`, [fuelPrimary]);
      kgPerL = Number(ef.rows[0]?.kg_co2_per_liter ?? kgPerL);
    }

    const rows = Array.from(series.values())
      .sort((a,b)=>a.m.localeCompare(b.m))
      .map(r => {
        const km = Number(r.km || 0);
        const liters = Number(r.liters || 0);
        let kg = 0;
        let method = "fuel_factor";
        if (isEV) {
          kg = 0; method = "electric";
        } else if (veh.wltp_g_per_km != null && km > 0) {
          kg = Math.round((Number(veh.wltp_g_per_km) * km)) / 1000; // g → kg
          method = "wltp";
        } else {
          kg = Number((liters * kgPerL).toFixed(3));
          method = "fuel_factor";
        }
        const avg = km > 0 ? Math.round((kg * 1000) / km) : null;
        return { month: r.m, km, liters, kg_co2: kg, method, avg_g_per_km: avg };
      });

    const total_km = rows.reduce((s,r)=>s + (r.km||0), 0);
    const total_l = rows.reduce((s,r)=>s + (r.liters||0), 0);
    const total_kg = rows.reduce((s,r)=>s + (r.kg_co2||0), 0);

    res.json({
      ok:true,
      vehicle_id:id,
      fuel_primary:fuelPrimary,
      months:rows.length,
      rows,
      totals:{
        km: Number(total_km.toFixed(0)),
        liters: Number(total_l.toFixed(2)),
        kg_co2: Number(total_kg.toFixed(3)),
      }
    });
  } catch (e) {
    console.error("monthly error:", e);
    res.status(500).json({ error: "monthly_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/vehicle/:id/report.csv
// Zelfde input als /report — levert CSV voor export/compensatie
// ────────────────────────────────────────────────────────────
router.get("/vehicle/:id/report.csv", async (req, res) => {
  try {
    // Herbereken compact (zelfde logica als /report)
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "bad_id" });

    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;
    const pricePerTon = Number(req.query.price_per_ton ?? 20);

    // Vehicle
    const { rows: vehRows } = await pool.query(
      `SELECT fuel_primary, wltp_g_per_km FROM vehicles WHERE id=$1`,
      [id]
    );
    if (!vehRows.length) return res.status(404).json({ error: "vehicle_not_found" });
    const veh = vehRows[0];
    const fuelPrimary = veh.fuel_primary || "Benzine";

    // km
    const kmParams = [id];
    let kmWhere = "vehicle_id=$1";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT reading_km, at_time
         FROM odometer_logs
        WHERE ${kmWhere}
        ORDER BY at_time ASC`,
      kmParams
    );
    let km_total = 0;
    if (kmRows.length >= 2) {
      km_total = Number(kmRows[kmRows.length - 1].reading_km) - Number(kmRows[0].reading_km);
      if (km_total < 0) km_total = 0;
    }

    // liters
    const fuelParams = [id];
    let fuelWhere = "vehicle_id=$1";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: fuelRows } = await pool.query(
      `SELECT fuel_type, liters, at_time
         FROM fuel_transactions
        WHERE ${fuelWhere}
        ORDER BY at_time ASC`,
      fuelParams
    );
    const liters_total = fuelRows.reduce((s, r) => s + Number(r.liters || 0), 0);

    // emissie
    let kg_co2_total = null;
    let method = null;
    if (!isElectric(veh.fuel_primary) && (veh.wltp_g_per_km != null && km_total > 0)) {
      kg_co2_total = Math.round((Number(veh.wltp_g_per_km) * km_total)) / 1000;
      method = "wltp";
    } else if (isElectric(veh.fuel_primary)) {
      kg_co2_total = 0; method = "electric";
    } else {
      const lastFuel = (fuelRows[fuelRows.length - 1]?.fuel_type) || fuelPrimary || "Benzine";
      const ef = await pool.query(`SELECT kg_co2_per_liter FROM emission_factors WHERE fuel_type=$1`, [lastFuel]);
      const kg_per_l = Number(ef.rows[0]?.kg_co2_per_liter ?? 2.31);
      kg_co2_total = Number((liters_total * kg_per_l).toFixed(3));
      method = "fuel_factor";
    }
    const avg_g_per_km = km_total > 0 ? Math.round((kg_co2_total * 1000) / km_total) : null;
    const tons = kg_co2_total / 1000;
    const offset_cost_eur = Number((tons * pricePerTon).toFixed(2));

    const lines = [
      "vehicle_id,from,to,method,km_total,liters_total,kg_co2_total,avg_g_per_km,offset_tons,price_per_ton,offset_cost_eur",
      [
        id,
        from || "",
        to || "",
        method,
        km_total ?? "",
        Number(liters_total.toFixed(2)),
        kg_co2_total ?? "",
        avg_g_per_km ?? "",
        Number(tons.toFixed(3)),
        pricePerTon,
        offset_cost_eur,
      ].join(","),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="vehicle_${id}_co2_report.csv"`);
    res.send(lines.join("\n"));
  } catch (e) {
    console.error("csv error:", e);
    res.status(500).json({ error: "csv_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// Company helpers
// ────────────────────────────────────────────────────────────
async function getCompanyVehicles(companyId) {
  const { rows } = await pool.query(
    `SELECT id, fuel_primary, wltp_g_per_km
       FROM vehicles
      WHERE company_id = $1
      ORDER BY id ASC`,
    [companyId]
  );
  return rows;
}
async function factorForFuel(fuelType) {
  const ef = await pool.query(
    `SELECT kg_co2_per_liter FROM emission_factors WHERE fuel_type=$1`,
    [fuelType || "Benzine"]
  );
  return Number(ef.rows[0]?.kg_co2_per_liter ?? 2.31);
}

// ────────────────────────────────────────────────────────────
// GET /api/co2/company/:companyId/report
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&price_per_ton=25
// ────────────────────────────────────────────────────────────
router.get("/company/:companyId/report", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId) return res.status(400).json({ error: "bad_company_id" });

    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;
    const pricePerTon = Number(req.query.price_per_ton ?? 20);

    const vehs = await getCompanyVehicles(companyId);
    if (!vehs.length) {
      return res.json({
        ok:true, company_id:companyId, vehicles:0, from, to,
        km_total:0, liters_total:0, kg_co2_total:0, avg_g_per_km:null,
        offset:{ tons:0, price_per_ton:pricePerTon, estimated_cost_eur:0 }
      });
    }

    const ids = vehs.map(v => v.id);

    // km per vehicle (delta min/max)
    const kmParams = [ids];
    let kmWhere = "vehicle_id = ANY($1)";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT vehicle_id, MIN(reading_km)::numeric AS km_min, MAX(reading_km)::numeric AS km_max
         FROM odometer_logs
        WHERE ${kmWhere}
        GROUP BY vehicle_id`,
      kmParams
    );
    const kmByVid = new Map();
    kmRows.forEach(r => {
      const delta = Math.max(0, Number(r.km_max || 0) - Number(r.km_min || 0));
      kmByVid.set(Number(r.vehicle_id), delta);
    });

    // liters per vehicle
    const fuelParams = [ids];
    let fuelWhere = "vehicle_id = ANY($1)";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: fuelRows } = await pool.query(
      `SELECT vehicle_id, SUM(liters)::numeric AS liters
         FROM fuel_transactions
        WHERE ${fuelWhere}
        GROUP BY vehicle_id`,
      fuelParams
    );
    const litersByVid = new Map();
    fuelRows.forEach(r => litersByVid.set(Number(r.vehicle_id), Number(r.liters || 0)));

    // Preload factors
    const uniqueFuels = new Set(vehs.map(v => v.fuel_primary || "Benzine"));
    const factorMap = new Map();
    for (const f of uniqueFuels) factorMap.set(f, await factorForFuel(f));

    // totals
    let sumKm = 0, sumLiters = 0, sumKg = 0;
    for (const v of vehs) {
      const km = Number(kmByVid.get(v.id) || 0);
      const liters = Number(litersByVid.get(v.id) || 0);
      let kg = 0;
      if (isElectric(v.fuel_primary)) {
        kg = 0;
      } else if (v.wltp_g_per_km != null && km > 0) {
        kg = Math.round((Number(v.wltp_g_per_km) * km)) / 1000;
      } else {
        const kgPerL = factorMap.get(v.fuel_primary || "Benzine") ?? 2.31;
        kg = Number((liters * kgPerL).toFixed(3));
      }
      sumKm += km; sumLiters += liters; sumKg += kg;
    }

    const avg_g_per_km = sumKm > 0 ? Math.round((sumKg * 1000) / sumKm) : null;
    const tons = sumKg / 1000;
    const offset_cost_eur = Number((tons * pricePerTon).toFixed(2));

    res.json({
      ok: true,
      company_id: companyId,
      vehicles: vehs.length,
      from, to,
      km_total: Number(sumKm.toFixed(0)),
      liters_total: Number(sumLiters.toFixed(2)),
      kg_co2_total: Number(sumKg.toFixed(3)),
      avg_g_per_km,
      offset: { tons: Number(tons.toFixed(3)), price_per_ton: pricePerTon, estimated_cost_eur: offset_cost_eur },
    });
  } catch (e) {
    console.error("company report error:", e);
    res.status(500).json({ error: "company_report_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/company/:companyId/monthly
// Query: ?months=12 (of ?from=YYYY-MM-DD&to=YYYY-MM-DD)
// Output: per maand: km, liters, kg_co2, avg_g_per_km (sum over voertuigen)
// ────────────────────────────────────────────────────────────
router.get("/company/:companyId/monthly", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId) return res.status(400).json({ error: "bad_company_id" });

    const months = Math.min(Math.max(Number(req.query.months || 12), 1), 60);
    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;

    const vehs = await getCompanyVehicles(companyId);
    if (!vehs.length) {
      return res.json({ ok:true, company_id:companyId, months:0, rows:[], totals:{ km:0, liters:0, kg_co2:0 } });
    }

    const ids = vehs.map(v => v.id);
    const vehById = new Map(vehs.map(v => [v.id, v]));

    // km per vehicle-month
    const kmParams = [ids];
    let kmWhere = "vehicle_id = ANY($1)";
    if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
    if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
    const { rows: kmRows } = await pool.query(
      `SELECT vehicle_id,
              date_trunc('month', at_time)::date AS m,
              (max(reading_km) - min(reading_km))::numeric AS km
         FROM odometer_logs
        WHERE ${kmWhere}
        GROUP BY vehicle_id, 2
        ORDER BY 2 ASC`,
      kmParams
    );

    // liters per vehicle-month
    const fuelParams = [ids];
    let fuelWhere = "vehicle_id = ANY($1)";
    if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
    if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
    const { rows: literRows } = await pool.query(
      `SELECT vehicle_id,
              date_trunc('month', at_time)::date AS m,
              SUM(liters)::numeric AS liters
         FROM fuel_transactions
        WHERE ${fuelWhere}
        GROUP BY vehicle_id, 2
        ORDER BY 2 ASC`,
      fuelParams
    );

    // matrix (vid|month) → {km, liters}
    const vm = new Map();
    const key = (vid, m) => `${vid}|${m}`;
    const setVM = (vid, m, p) => vm.set(key(vid, m), { ...(vm.get(key(vid, m)) || { km:0, liters:0 }), ...p });

    kmRows.forEach(r => setVM(Number(r.vehicle_id), r.m.toISOString().slice(0,10), { km:Number(r.km||0) }));
    literRows.forEach(r => setVM(Number(r.vehicle_id), r.m.toISOString().slice(0,10), { liters:Number(r.liters||0) }));

    // grid maanden
    const monthsGrid = new Set();
    if (!from && !to) {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 - months, 1));
      for (let i = 0; i < months; i++) {
        const dt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0,10);
        monthsGrid.add(dt);
      }
    } else {
      [...vm.keys()].forEach(k => monthsGrid.add(k.split("|")[1]));
    }

    // Preload factors per fuel
    const uniqueFuels = new Set(vehs.map(v => v.fuel_primary || "Benzine"));
    const factorMap = new Map();
    for (const f of uniqueFuels) factorMap.set(f, await factorForFuel(f));

    // per maand optellen
    const perMonth = new Map(); // month -> { km, liters, kg }
    const addMonth = (m, km, liters, kg) => {
      const prev = perMonth.get(m) || { km:0, liters:0, kg:0 };
      perMonth.set(m, { km: prev.km + km, liters: prev.liters + liters, kg: prev.kg + kg });
    };

    for (const [k2, cell] of vm.entries()) {
      const [vidStr, m] = k2.split("|");
      const vid = Number(vidStr);
      const v = vehById.get(vid);
      const km = Number(cell.km || 0);
      const liters = Number(cell.liters || 0);

      let kg = 0;
      if (isElectric(v.fuel_primary)) {
        kg = 0;
      } else if (v.wltp_g_per_km != null && km > 0) {
        kg = Math.round((Number(v.wltp_g_per_km) * km)) / 1000;
      } else {
        const kgPerL = factorMap.get(v.fuel_primary || "Benzine") ?? 2.31;
        kg = Number((liters * kgPerL).toFixed(3));
      }
      addMonth(m, km, liters, kg);
    }

    // vul lege maanden met 0
    for (const m of monthsGrid) {
      if (!perMonth.has(m)) perMonth.set(m, { km:0, liters:0, kg:0 });
    }

    const rows = [...perMonth.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([m, v]) => {
        const avg = v.km > 0 ? Math.round((v.kg * 1000) / v.km) : null;
        return { month: m, km: Number(v.km.toFixed(0)), liters: Number(v.liters.toFixed(2)), kg_co2: Number(v.kg.toFixed(3)), avg_g_per_km: avg };
      });

    const total_km = rows.reduce((s,r)=>s + (r.km||0), 0);
    const total_l = rows.reduce((s,r)=>s + (r.liters||0), 0);
    const total_kg = rows.reduce((s,r)=>s + (r.kg_co2||0), 0);

    res.json({
      ok: true,
      company_id: companyId,
      months: rows.length,
      rows,
      totals: {
        km: Number(total_km.toFixed(0)),
        liters: Number(total_l.toFixed(2)),
        kg_co2: Number(total_kg.toFixed(3)),
      }
    });
  } catch (e) {
    console.error("company monthly error:", e);
    res.status(500).json({ error: "company_monthly_failed" });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/co2/company/:companyId/report.csv
// CSV export van company report
// ────────────────────────────────────────────────────────────
router.get("/company/:companyId/report.csv", async (req, res) => {
  try {
    const companyId = Number(req.params.companyId);
    if (!companyId) return res.status(400).json({ error: "bad_company_id" });

    const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : null;
    const to   = req.query.to   && DATE_RE.test(req.query.to)   ? req.query.to   : null;
    const pricePerTon = Number(req.query.price_per_ton ?? 20);

    const vehs = await getCompanyVehicles(companyId);
    const ids = vehs.map(v => v.id);

    let sumKm = 0, sumLiters = 0, sumKg = 0;

    if (ids.length) {
      const kmParams = [ids];
      let kmWhere = "vehicle_id = ANY($1)";
      if (from) { kmParams.push(from); kmWhere += ` AND at_time::date >= $${kmParams.length}`; }
      if (to)   { kmParams.push(to);   kmWhere += ` AND at_time::date <= $${kmParams.length}`; }
      const { rows: kmRows } = await pool.query(
        `SELECT vehicle_id, MIN(reading_km)::numeric AS km_min, MAX(reading_km)::numeric AS km_max
           FROM odometer_logs
          WHERE ${kmWhere}
          GROUP BY vehicle_id`,
        kmParams
      );
      const kmByVid = new Map();
      kmRows.forEach(r => {
        const delta = Math.max(0, Number(r.km_max || 0) - Number(r.km_min || 0));
        kmByVid.set(Number(r.vehicle_id), delta);
      });

      const fuelParams = [ids];
      let fuelWhere = "vehicle_id = ANY($1)";
      if (from) { fuelParams.push(from); fuelWhere += ` AND at_time::date >= $${fuelParams.length}`; }
      if (to)   { fuelParams.push(to);   fuelWhere += ` AND at_time::date <= $${fuelParams.length}`; }
      const { rows: fuelRows } = await pool.query(
        `SELECT vehicle_id, SUM(liters)::numeric AS liters
           FROM fuel_transactions
          WHERE ${fuelWhere}
          GROUP BY vehicle_id`,
        fuelParams
      );
      const litersByVid = new Map();
      fuelRows.forEach(r => litersByVid.set(Number(r.vehicle_id), Number(r.liters || 0)));

      // preload factors
      const uniqueFuels = new Set(vehs.map(v => v.fuel_primary || "Benzine"));
      const factorMap = new Map();
      for (const f of uniqueFuels) factorMap.set(f, await factorForFuel(f));

      for (const v of vehs) {
        const km = Number(kmByVid.get(v.id) || 0);
        const liters = Number(litersByVid.get(v.id) || 0);
        let kg = 0;
        if (isElectric(v.fuel_primary)) {
          kg = 0;
        } else if (v.wltp_g_per_km != null && km > 0) {
          kg = Math.round((Number(v.wltp_g_per_km) * km)) / 1000;
        } else {
          const kgPerL = factorMap.get(v.fuel_primary || "Benzine") ?? 2.31;
          kg = Number((liters * kgPerL).toFixed(3));
        }
        sumKm += km; sumLiters += liters; sumKg += kg;
      }
    }

    const avg_g_per_km = sumKm > 0 ? Math.round((sumKg * 1000) / sumKm) : null;
    const tons = sumKg / 1000;
    const offset_cost_eur = Number((tons * pricePerTon).toFixed(2));

    const header = "company_id,from,to,vehicles,km_total,liters_total,kg_co2_total,avg_g_per_km,offset_tons,price_per_ton,offset_cost_eur";
    const row = [
      companyId,
      from || "",
      to || "",
      vehs.length,
      Number(sumKm.toFixed(0)),
      Number(sumLiters.toFixed(2)),
      Number(sumKg.toFixed(3)),
      avg_g_per_km ?? "",
      Number(tons.toFixed(3)),
      pricePerTon,
      offset_cost_eur
    ].join(",");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="company_${companyId}_co2_report.csv"`);
    res.send([header, row].join("\n"));
  } catch (e) {
    console.error("company csv error:", e);
    res.status(500).json({ error: "company_csv_failed" });
  }
});

module.exports = router;
