const pool = require("./db/pool");

(async () => {
  try {
    const info = await pool.healthCheck();
    console.log("✅ DB OK:", {
      now: info.now,
      db: info.db,
      version: info.v.split("\n")[0],
    });
    process.exit(0);
  } catch (e) {
    console.error("❌ DB FAILED:", e.message);
    process.exit(1);
  }
})();
