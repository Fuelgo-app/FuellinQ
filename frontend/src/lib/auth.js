// backend/routes/auth.js
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const pool = require("../db/pool");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

// POST /api/auth/login  -> { token }
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

    const { rows } = await pool.query(
      `SELECT id, email, password_hash, role, first_name, last_name
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "invalid_login" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid_login" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "login_failed" });
  }
});

module.exports = router;
