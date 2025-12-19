// src/lib/klaviyo.js
const API_BASE =
  (typeof window !== "undefined" && (window.API_BASE || "")) ||
  (import.meta?.env?.VITE_API_URL || "http://localhost:3000");

/** Onsite identify/track (werkt met public key/snippet) */
export function klIdentify({ email, first_name, last_name, phone, external_id }) {
  try {
    window._klOnsite = window._klOnsite || [];
    const profile = { $email: email };
    if (first_name) profile.$first_name = first_name;
    if (last_name)  profile.$last_name  = last_name;
    if (phone)      profile.$phone_number = phone;
    if (external_id) profile.$id = String(external_id);
    window._klOnsite.push(["identify", profile]);
  } catch {}
}

export function klTrack(eventName, properties = {}) {
  try {
    window._klOnsite = window._klOnsite || [];
    window._klOnsite.push(["track", eventName, properties]);
  } catch {}
}

/** Backend calls (private key veilig op server) */
export async function klSubscribe({ email, first_name, last_name, phone, consent, properties }) {
  const r = await fetch(`${API_BASE}/api/klaviyo/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, first_name, last_name, phone, consent, properties }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "Subscribe failed");
  return data;
}

export async function klEvent({ email, external_id, event, properties, time }) {
  const r = await fetch(`${API_BASE}/api/klaviyo/event`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, external_id, event, properties, time }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "Event failed");
  return data;
}
