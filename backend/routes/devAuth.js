// backend/routes/devAuth.js (tijdelijk!)
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

router.post("/login", (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email verplicht" });

  // Fake user payload – pas aan zodra je echte users hebt
  const payload = {
    userId: 1,
    email,
    role: "admin",
    stationId: null,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET || "dev_secret", { expiresIn: "7d" });
  res.json({ token, user: payload });
});

module.exports = router;
