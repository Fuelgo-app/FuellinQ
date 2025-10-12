// backend/routes/index.js
const express = require("express");
const router = express.Router();

const {
  requireAuth,
  optionalAuth,
  requireRole,
  requireStation,
} = require("./services/auth");

// Dummy handlers → vervang met jouw echte
async function listStations(req, res) { res.json({ items: [] }); }
async function updateBranding(req, res) { res.json({ ok: true }); }
async function listOffers(req, res) { res.json({ items: [] }); }

router.get("/me", requireAuth, (req, res) => res.json({ user: req.user }));

// Let op: jij gebruikt publiek vaak onder /partner/public/*
router.get("/partner/public/stations", optionalAuth, listStations);

router.post(
  "/admin/branding",
  requireAuth,
  requireRole("admin"),
  updateBranding
);

router.get(
  "/partner/stations/:stationId/offers",
  requireAuth,
  requireRole("partner", "admin"),
  requireStation("stationId"),
  listOffers
);

module.exports = router;
