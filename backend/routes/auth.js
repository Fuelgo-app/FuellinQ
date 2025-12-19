// routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db/pool");

const router = express.Router();

/* ---------- helpers ---------- */
function signToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, stationId: user.station_id || null },
    process.env.JWT_SECRET || "devsecret",
    { expiresIn: "7d" }
  );
}

function cookieOptions() {
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  return {
    httpOnly: true,
    secure: isProd,                 // vereist bij SameSite=None (HTTPS)
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dagen
  };
}

// Klein hulpmiddel om token uit header of cookie te halen
function readBearerOrCookie(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return req.cookies?.token || req.cookies?.accessToken || req.cookies?.jwt || null;
}

/* ---------- POST /api/auth/register ---------- */
router.post("/register", async (req, res) => {
  try {
    const { email, password, first_name = "", last_name = "" } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

    const { rows: exists } = await pool.query(
      `SELECT 1 FROM users WHERE lower(email)=lower($1) LIMIT 1`,
      [String(email).toLowerCase()]
    );
    if (exists.length) return res.status(409).json({ error: "email_in_use" });

    // simpele company aanmaken (matcht server.js)
    const c = await pool.query(`INSERT INTO companies(name) VALUES ($1) RETURNING id`, ["Mijn Bedrijf"]);
    const companyId = c.rows[0].id;

    const hash = await bcrypt.hash(password, 10);
    const ins = await pool.query(
      `INSERT INTO users (company_id, email, password_hash, role, first_name, last_name)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, company_id, email, role, first_name, last_name, station_id`,
      [companyId, email, hash, "user", first_name, last_name]
    );
    const u = ins.rows[0];

    const token = signToken(u);
    res.cookie("token", token, cookieOptions());

    return res.status(201).json({
      token,
      user: {
        id: u.id,
        company_id: u.company_id,
        email: u.email,
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      },
    });
  } catch (e) {
    console.error("auth/register error:", e);
    res.status(500).json({ error: "server_error" });
  }
});

/* ---------- POST /api/auth/login ---------- */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

    const { rows } = await pool.query(
      `SELECT id, company_id, email, password_hash, role, first_name, last_name, station_id
         FROM users
        WHERE lower(email)=lower($1)
        LIMIT 1`,
      [String(email).toLowerCase()]
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: "invalid_login" });

    const ok = await bcrypt.compare(password, u.password_hash || "");
    if (!ok) return res.status(401).json({ error: "invalid_login" });

    const token = signToken(u);
    res.cookie("token", token, cookieOptions());

    return res.json({
      token,
      user: {
        id: u.id,
        company_id: u.company_id,
        email: u.email,
        role: u.role,
        first_name: u.first_name,
        last_name: u.last_name,
      },
    });
  } catch (e) {
    console.error("auth/login error:", e);
    res.status(500).json({ error: "server_error" });
  }
});

/* ---------- POST /api/auth/logout ---------- */
router.post("/logout", (req, res) => {
  const opts = cookieOptions();
  res.clearCookie("token", { path: opts.path, sameSite: opts.sameSite, secure: opts.secure });
  res.json({ ok: true });
});



module.exports = router;
