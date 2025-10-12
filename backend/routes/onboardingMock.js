// backend/routes/onboardingMock.js (CommonJS)
const express = require("express");
const router = express.Router();

/* ────────────────────────────────────────────────────────────
   Onboarding Mock — bank → kyc → wallet → (optioneel) station
   - Per Bearer token houden we een "sessie" in-memory bij.
   - Auto-progress met timers (config via .env of querystring).
   - Endpoints onder /api/* (mount in server: app.use("/api", router))
────────────────────────────────────────────────────────────── */

const sessions = new Map();

/* ---- Config & helpers ---- */
const FAST = String(process.env.ONBOARDING_MOCK_FAST || "").toLowerCase() === "1";
function ms(base, req) {
  // snellere flow als ?instant=1 of ONBOARDING_MOCK_FAST=1
  if (FAST) return 100;
  if (req?.query?.instant == "1") return 100;
  return base;
}
function tokenFrom(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "anon";
}
function getOrInit(token) {
  if (!sessions.has(token)) {
    sessions.set(token, {
      createdAt: Date.now(),
      bank: { name: null, linked: false, startedAt: null, linkedAt: null },
      kyc: { started: false, status: "idle", level: null, startedAt: null, decidedAt: null }, // idle|pending|approved|rejected
      wallet: { issued: false, appleUrl: null, googleUrl: null, installed: false, issuedAt: null, installedAt: null },
      station: { claimed: false, stationId: null, approved: false, claimedAt: null, approvedAt: null },
    });
  }
  return sessions.get(token);
}
function nextAction(state) {
  if (!state.bank.linked) return { key: "bank", label: "Koppel je bank" };
  if (state.kyc.status !== "approved") {
    if (!state.kyc.started) return { key: "kyc_start", label: "Start identiteitscheck" };
    return { key: "kyc_wait", label: "Wacht op KYC" };
  }
  if (!state.wallet.issued) return { key: "wallet_issue", label: "Voeg pas aan wallet toe" };
  if (!state.wallet.installed) return { key: "wallet_install", label: "Installeer wallet pas" };
  // station claim is optioneel; toon als laatste stap
  if (!state.station.approved) {
    if (!state.station.claimed) return { key: "station_claim", label: "Claim je station (optioneel)" };
    return { key: "station_wait", label: "Wacht op station-goedkeuring" };
  }
  return { key: "done", label: "Onboarding voltooid" };
}

/* ────────────────────────────────────────────────────────────
   Bank
────────────────────────────────────────────────────────────── */
/** POST /api/bank/link  -> start koppeling (mock) */
router.post("/bank/link", (req, res) => {
  const token = tokenFrom(req);
  const bank = (req.body?.bank || "").toLowerCase();
  if (!bank) return res.status(400).json({ error: "Bank ontbreekt" });

  const s = getOrInit(token);
  s.bank = { name: bank, linked: false, startedAt: Date.now(), linkedAt: null };
  // Automatisch 'linked' na delay
  setTimeout(() => {
    const cur = sessions.get(token);
    if (cur && !cur.bank.linked) {
      cur.bank.linked = true;
      cur.bank.linkedAt = Date.now();
      sessions.set(token, cur);
    }
  }, ms(2000, req)); // 2s of instant

  res.json({ started: true, bank });
});

/** GET /api/bank/status -> { linked, bank } */
router.get("/bank/status", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  res.json({ linked: !!s.bank.linked, bank: s.bank.name, startedAt: s.bank.startedAt, linkedAt: s.bank.linkedAt });
});

/* ────────────────────────────────────────────────────────────
   KYC
────────────────────────────────────────────────────────────── */
/** POST /api/kyc/start -> start KYC (mock) */
router.post("/kyc/start", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  if (!s.bank.linked) return res.status(400).json({ error: "Bank niet gekoppeld" });

  s.kyc.started = true;
  s.kyc.status = "pending";
  s.kyc.level = req.body?.level || "basic";
  s.kyc.startedAt = Date.now();
  s.kyc.decidedAt = null;

  // Auto-approve na delay
  setTimeout(() => {
    const cur = sessions.get(token);
    if (cur && cur.kyc.status === "pending") {
      cur.kyc.status = "approved";
      cur.kyc.decidedAt = Date.now();
      sessions.set(token, cur);
    }
  }, ms(2000, req));

  res.json({ started: true, status: s.kyc.status, level: s.kyc.level });
});

/** GET /api/kyc/status -> { status, level } */
router.get("/kyc/status", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  res.json({
    status: s.kyc.status, // idle|pending|approved|rejected
    level: s.kyc.level,
    startedAt: s.kyc.startedAt,
    decidedAt: s.kyc.decidedAt,
  });
});

/* ────────────────────────────────────────────────────────────
   Wallet Pass
────────────────────────────────────────────────────────────── */
/** POST /api/wallet/pass -> maak deeplinks (mock) */
router.post("/wallet/pass", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  if (s.kyc.status !== "approved") return res.status(400).json({ error: "KYC niet afgerond" });

  // Genereer “unieke” (mock) urls per token
  const suffix = Buffer.from(token).toString("base64").slice(0, 12);
  s.wallet.issued = true;
  s.wallet.issuedAt = Date.now();
  s.wallet.appleUrl = `https://example.com/mock/apple-wallet/${suffix}`;
  s.wallet.googleUrl = `https://pay.google.com/gp/v/save/MOCK_${suffix}`;

  res.json({ appleUrl: s.wallet.appleUrl, googleUrl: s.wallet.googleUrl });
});

/** GET /api/wallet/status -> { issued, installed } */
router.get("/wallet/status", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  res.json({
    issued: s.wallet.issued,
    installed: s.wallet.installed,
    issuedAt: s.wallet.issuedAt,
    installedAt: s.wallet.installedAt,
    appleUrl: s.wallet.appleUrl,
    googleUrl: s.wallet.googleUrl,
  });
});

/** POST /api/wallet/installed -> markeer als geïnstalleerd (frontend na klik) */
router.post("/wallet/installed", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  if (!s.wallet.issued) return res.status(400).json({ error: "Wallet pas nog niet uitgegeven" });
  s.wallet.installed = true;
  s.wallet.installedAt = Date.now();
  res.json({ ok: true, installedAt: s.wallet.installedAt });
});

/* ────────────────────────────────────────────────────────────
   (Optioneel) Station claim
────────────────────────────────────────────────────────────── */
/** POST /api/station/claim -> claim een stationId */
router.post("/station/claim", (req, res) => {
  const token = tokenFrom(req);
  const stationId = String(req.body?.stationId || "").trim();
  if (!stationId) return res.status(400).json({ error: "stationId ontbreekt" });

  const s = getOrInit(token);
  s.station.claimed = true;
  s.station.stationId = stationId;
  s.station.approved = false;
  s.station.claimedAt = Date.now();
  s.station.approvedAt = null;

  // Auto-approve na delay
  setTimeout(() => {
    const cur = sessions.get(token);
    if (cur && cur.station.claimed && !cur.station.approved) {
      cur.station.approved = true;
      cur.station.approvedAt = Date.now();
      sessions.set(token, cur);
    }
  }, ms(1500, req));

  res.json({ claimed: true, stationId });
});

/** GET /api/station/status -> { claimed, approved, stationId } */
router.get("/station/status", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  res.json({
    claimed: s.station.claimed,
    approved: s.station.approved,
    stationId: s.station.stationId,
    claimedAt: s.station.claimedAt,
    approvedAt: s.station.approvedAt,
  });
});

/* ────────────────────────────────────────────────────────────
   Overzicht & Reset
────────────────────────────────────────────────────────────── */
/** GET /api/onboarding/summary -> alles + suggested nextAction */
router.get("/onboarding/summary", (req, res) => {
  const token = tokenFrom(req);
  const s = getOrInit(token);
  res.json({
    bank: s.bank,
    kyc: s.kyc,
    wallet: s.wallet,
    station: s.station,
    next: nextAction(s),
    createdAt: s.createdAt,
  });
});

/** DELETE /api/mock/reset -> handig tijdens dev */
router.delete("/mock/reset", (req, res) => {
  const token = tokenFrom(req);
  sessions.delete(token);
  res.json({ ok: true });
});

module.exports = router;
