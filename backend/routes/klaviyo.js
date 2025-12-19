// routes/klaviyo.js — FuelLinq x Klaviyo
const express = require("express");
const router = express.Router();

const KL_KEY  = process.env.KLAVIYO_PRIVATE_KEY;
const LIST_ID = process.env.KLAVIYO_LIST_ID;
const API_REV = "2023-12-15"; // Klaviyo v2 API revision

if (!KL_KEY) console.warn("[Klaviyo] Missing KLAVIYO_PRIVATE_KEY");
if (!LIST_ID) console.warn("[Klaviyo] Missing KLAVIYO_LIST_ID");

async function kfetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://a.klaviyo.com${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Klaviyo-API-Key ${KL_KEY}`,
      "Revision": API_REV,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.message || `Klaviyo ${method} ${path} failed`;
    const code = data?.errors?.[0]?.code || res.status;
    const err = new Error(msg);
    err.status = code;
    err.data = data;
    throw err;
  }
  return data;
}

/** POST /api/klaviyo/subscribe
 * body: { email, first_name?, last_name?, phone?, properties?, consent?: 'email'|'sms'|'both' }
 * Tip: zet consent alleen als de gebruiker expliciet akkoord gaf.
 */
router.post("/subscribe", async (req, res) => {
  try {
    const { email, first_name, last_name, phone, properties = {}, consent } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });

    const profiles = [{
      email,
      first_name,
      last_name,
      phone_number: phone,
      properties: {
        source: "fuellinq.app",
        ...properties,
        ...(consent ? { consent_source: "fuellinq.app", consent_type: consent } : {}),
      },
    }];

    const payload = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          list_id: LIST_ID,
          custom_source: "fuellinq.app",
          profiles,
        },
      },
    };

    const resp = await kfetch("/api/profile-subscriptions/", { method: "POST", body: payload });
    return res.json({ ok: true, job_id: resp?.data?.id || null });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

/** POST /api/klaviyo/event
 * body: { email OR external_id, event: string, properties?: {}, time?: ISO }
 */
router.post("/event", async (req, res) => {
  try {
    const { email, external_id, event, properties = {}, time } = req.body || {};
    if (!event) return res.status(400).json({ error: "event required" });
    if (!email && !external_id) return res.status(400).json({ error: "email or external_id required" });

    const profile = external_id ? { external_id: String(external_id) } : { email };

    const payload = {
      data: {
        type: "event",
        attributes: {
          metric: { name: event },
          properties,
          profile,
          time: time || new Date().toISOString(),
        },
      },
    };

    const resp = await kfetch("/api/events/", { method: "POST", body: payload });
    return res.json({ ok: true, id: resp?.data?.id || null });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

/** (Optioneel) POST /api/klaviyo/identify
 * Upsert een profiel zonder te subscriben.
 * body: { email, first_name?, last_name?, phone?, properties? }
 */
router.post("/identify", async (req, res) => {
  try {
    const { email, first_name, last_name, phone, properties = {} } = req.body || {};
    if (!email) return res.status(400).json({ error: "email required" });

    const payload = {
      data: {
        type: "profile",
        attributes: {
          email,
          first_name,
          last_name,
          phone_number: phone,
          properties: { source: "fuellinq.app", ...properties },
        },
      },
    };

    const resp = await kfetch("/api/profiles/", { method: "POST", body: payload });
    return res.json({ ok: true, id: resp?.data?.id || null });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, details: e.data });
  }
});

module.exports = router;
