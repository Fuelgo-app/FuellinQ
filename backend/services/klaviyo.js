// backend/services/klaviyo.js
// Klaviyo JSON:API + fallback bootstrap naar legacy /identify & /track
// Vereist .env: 
//   KLAVIYO_PRIVATE_KEY (pk_...)
//   KLAVIYO_PUBLIC_KEY  (Site ID, bijv. PK_... of XXXXXXXXXXXXXXXXXXXXXXXXX)
//   KLAVIYO_LIST_ID     (optioneel)

const axios = require("axios");

// ─────────── Config ───────────
const KLAVIYO_PRIVATE = process.env.KLAVIYO_PRIVATE_KEY || "";
const KLAVIYO_PUBLIC  = process.env.KLAVIYO_PUBLIC_KEY || "";
const KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID || "";
const KLAVIYO_BASE    = process.env.KLAVIYO_BASE_URL || "https://a.klaviyo.com/api";
// host zonder /api voor legacy GET-endpoints
const KLAVIYO_HOST    = KLAVIYO_BASE.replace(/\/api\/?$/, "");

if (!KLAVIYO_PRIVATE) console.warn("[klaviyo] KLAVIYO_PRIVATE_KEY ontbreekt");
if (!KLAVIYO_PUBLIC)  console.warn("[klaviyo] KLAVIYO_PUBLIC_KEY ontbreekt (nodig voor legacy bootstrap)");

const client = axios.create({
  baseURL: KLAVIYO_BASE,
  timeout: 12000,
  headers: {
    Authorization: `Klaviyo-API-Key ${KLAVIYO_PRIVATE}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    Revision: "2024-07-15",
  },
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function asError(e) {
  if (e?.response) return { status: e.response.status, data: e.response.data };
  return { message: e?.message || String(e) };
}

// ─────────── Legacy helpers (bootstrap) ───────────
function b64(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}

/** Identify profiel via legacy GET /api/identify?data= */
async function legacyIdentify(email, props = {}) {
  if (!KLAVIYO_PUBLIC || !email) return { skipped: true };
  const payload = {
    token: KLAVIYO_PUBLIC,
    properties: { $email: email, ...props },
  };
  try {
    await axios.get(`${KLAVIYO_HOST}/api/identify`, {
      params: { data: b64(payload) },
      timeout: 8000,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[klaviyo.legacyIdentify] warn:", asError(e));
    return { ok: false, error: asError(e) };
  }
}

/** Track event via legacy GET /api/track?data=  (maakt metric aan als die nog niet bestaat) */
async function legacyTrack(eventName, email, properties = {}) {
  if (!KLAVIYO_PUBLIC || !eventName) return { skipped: true };
  const payload = {
    token: KLAVIYO_PUBLIC,
    event: eventName,
    customer_properties: email ? { $email: email } : {},
    properties: properties || {},
  };
  try {
    await axios.get(`${KLAVIYO_HOST}/api/track`, {
      params: { data: b64(payload) },
      timeout: 8000,
    });
    return { ok: true };
  } catch (e) {
    console.warn("[klaviyo.legacyTrack] warn:", asError(e));
    return { ok: false, error: asError(e) };
  }
}

/** Gebruik legacy identify + track om metric te “bootstrappen” */
async function bootstrapMetricViaLegacyTrack({ eventName, email, properties = {} }) {
  // Identify eerst (maakt/actualiseert profiel aan Klaviyo-kant)
  await legacyIdentify(email, {});
  // Track het event één keer zodat de metric onder "Track API" verschijnt
  await legacyTrack(eventName, email, properties);
}

// ─────────────────── Profiles ───────────────────
async function upsertProfileByEmail({ email, firstName, lastName, phone, properties = {} }) {
  if (!email) throw new Error("Email is verplicht");
  try {
    // find
    const q = `equals(email,"${email}")`;
    const found = await client.get(`/profiles`, { params: { filter: q } });
    const existing = found?.data?.data?.[0];
    if (existing) {
      const id = existing.id;
      // patch (best effort)
      try {
        await client.patch(`/profiles/${id}`, {
          data: {
            type: "profile",
            id,
            attributes: {
              email,
              first_name: firstName,
              last_name: lastName,
              phone_number: phone,
              properties,
            },
          },
        });
      } catch {}
      return { id, email };
    }
    // create
    const created = await client.post(`/profiles/`, {
      data: {
        type: "profile",
        attributes: {
          email,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          properties,
        },
      },
    });
    return { id: created?.data?.data?.id, email };
  } catch (e) {
    console.error("[klaviyo.upsertProfileByEmail] error:", asError(e));
    throw e;
  }
}

// ─────────────────── Lists ───────────────────
async function subscribeToList({ profileId, email, listId = KLAVIYO_LIST_ID }) {
  if (!listId) throw new Error("KLAVIYO_LIST_ID ontbreekt of listId niet meegegeven");
  if (!profileId && !email) throw new Error("profileId of email vereist");
  try {
    let id = profileId;
    if (!id && email) {
      const q = `equals(email,"${email}")`;
      const found = await client.get(`/profiles`, { params: { filter: q } });
      id = found?.data?.data?.[0]?.id;
      if (!id) throw new Error("Kan profiel niet vinden op email");
    }
    await client.post(`/lists/${listId}/relationships/profiles/`, {
      data: [{ type: "profile", id }],
    });
    return { ok: true, listId, profileId: id };
  } catch (e) {
    const err = asError(e);
    if (err?.status === 409) return { ok: true, alreadyInList: true, listId, profileId };
    console.error("[klaviyo.subscribeToList] error:", err);
    throw e;
  }
}

// ─────────────── Metrics (ID-resolver met paging) ───────────────
async function findMetricIdByName(name) {
  const integrationFilter = `equals(integration.name,"Track API")`;
  let cursor = undefined;
  let guard = 0;

  while (guard++ < 10) {
    const params = cursor ? { filter: integrationFilter, "page[cursor]": cursor }
                          : { filter: integrationFilter };
    const res = await client.get(`/metrics`, { params });
    const items = res?.data?.data || [];

    const hit = items.find((m) => m?.attributes?.name === name);
    if (hit?.id) return hit.id;

    cursor = res?.data?.links?.next ? res.data.links.next.split("page[cursor]=")[1] : null;
    if (!cursor) break;
  }
  return null;
}

async function resolveMetricId({ eventName, email }) {
  // 1) probeer direct te vinden
  let id = await findMetricIdByName(eventName);
  if (id) return id;

  // 2) bootstrap via legacy track en probeer opnieuw
  await bootstrapMetricViaLegacyTrack({ eventName, email });
  for (let i = 0; i < 6; i++) {
    await sleep(1000);
    id = await findMetricIdByName(eventName);
    if (id) return id;
  }
  return null;
}

// ─────────────────── Events ───────────────────
async function trackEvent({ eventName, email, profileId, properties = {}, time = new Date() }) {
  if (!eventName) throw new Error("eventName is verplicht");
  if (!email && !profileId) throw new Error("email of profileId vereist");

  try {
    let pid = profileId;
    if (!pid && email) {
      const profile = await upsertProfileByEmail({ email });
      pid = profile.id;
    }

    const metricId = await resolveMetricId({ eventName, email });
    if (!metricId) {
      throw new Error(`Metric "${eventName}" niet gevonden (integration.name)`);
    }

    const res = await client.post(`/events/`, {
      data: {
        type: "event",
        attributes: {
          properties: properties || {},
          time: new Date(time).toISOString(),
        },
        relationships: {
          metric: { data: { type: "metric", id: metricId } },
          profile: { data: { type: "profile", id: pid } },
        },
      },
    });

    return { ok: true, eventId: res?.data?.data?.id, metricId };
  } catch (e) {
    console.error("[klaviyo.trackEvent] error:", asError(e));
    throw e;
  }
}

// ────────────── High-level helper ──────────────
async function subscribeUser({ email, firstName, lastName, phone, properties, listId }) {
  const profile = await upsertProfileByEmail({ email, firstName, lastName, phone, properties });
  if (listId || KLAVIYO_LIST_ID) await subscribeToList({ profileId: profile.id, listId, email });
  return profile;
}

module.exports = {
  upsertProfileByEmail,
  subscribeToList,
  trackEvent,
  subscribeUser,
  // optioneel exporteren voor debuggen:
  _legacyIdentify: legacyIdentify,
  _legacyTrack: legacyTrack,
  _bootstrap: bootstrapMetricViaLegacyTrack,
};
