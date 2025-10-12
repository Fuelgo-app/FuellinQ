// backend/db/pool.js (CommonJS)
const { Pool } = require("pg");
require("dotenv").config();

/* ───────── helpers ───────── */
function maskUrl(u = "") {
  try {
    const url = new URL(u);
    if (url.password) url.password = "***";
    return url.toString();
  } catch {
    return "(invalid or empty)";
  }
}

/** Bouw de connection string uit env, met fallbacks */
function getDatabaseUrl() {
  // 1) Volledige DSN
  const dsn =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||             // sommige hosts gebruiken deze
    process.env.RAILWAY_DATABASE_URL ||     // Railway var naam (soms)
    "";

  if (dsn && dsn.trim()) return dsn.trim();

  // 2) Losse PG_* variabelen → opbouwen
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || "5432";
  const user = process.env.PGUSER;
  const pass = process.env.PGPASSWORD;
  const db   = process.env.PGDATABASE;

  if (host && user && db) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
      pass || ""
    )}@${host}:${port}/${db}`;
  }

  return ""; // nothing found
}

const connectionString = getDatabaseUrl();
if (!connectionString) {
  // Geef direct een heldere uitleg
  throw new Error(
    "DATABASE_URL ontbreekt (of PGHOST/PGUSER/PGDATABASE). " +
      "Zet een geldige verbinding in backend/.env. " +
      "Voorbeeld: DATABASE_URL=postgresql://user:pass@host:port/dbname"
  );
}

/* ───────── SSL & pool settings ───────── */
// Railway vereist vrijwel altijd SSL. Gebruik env overrides waar nodig.
const useSsl =
  (process.env.PGSSLMODE || "").toLowerCase() === "require" ||
  /railway|amazonaws|render|supabase|neon|azure|gcp/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 8000),
  application_name: process.env.PG_APPNAME || "fuellinq-api",
});

// Optioneel: IPv4 forceren (soms nodig op macOS/VPN)
if (String(process.env.PG_FORCE_IPV4) === "1") {
  // pg library gebruikt dns.lookup intern; hiervoor zou je global patch kunnen doen,
  // maar meestal is dit niet nodig. Alleen documenteren.
}

// Log 1x gemaskeerd bij eerste import
console.log(
  `📦 DB connect → ${maskUrl(connectionString)}  SSL=${useSsl ? "on" : "off"}`
);

module.exports = {
  /** thin wrapper met duidelijke foutmeldingen */
  async query(text, params) {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error("DB QUERY ERROR:", err?.message || err);
      throw err;
    }
  },
  pool,
};
