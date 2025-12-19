// backend/routes/testKlaviyo.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const KLAVIYO_PUBLIC_KEY = process.env.KLAVIYO_PUBLIC_KEY; // bijv. TXqUaR

router.post("/klaviyo/bootstrap", async (req, res) => {
  try {
    const { email = "test@fuellinq.app", event = "Wallet Confirmed" } = req.body;

    if (!KLAVIYO_PUBLIC_KEY) throw new Error("KLAVIYO_PUBLIC_KEY ontbreekt in .env");

    // stuur een legacy event om metric aan te maken
    const r = await axios.post("https://a.klaviyo.com/api/track", {
      token: KLAVIYO_PUBLIC_KEY,
      event,
      customer_properties: { $email: email },
      properties: { test: true },
    });

    res.json({ ok: true, data: r.data });
  } catch (e) {
    console.error("bootstrap error", e.response?.data || e.message);
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

module.exports = router;
