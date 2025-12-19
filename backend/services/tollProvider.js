const fs = require("fs");
const path = require("path");
const turf = require("@turf/turf");

const PROV = String(process.env.TOLL_PROVIDER || "geojson").toLowerCase();

async function loadGeojsonZones() {
  const p = path.join(__dirname, "..", "backend", "data", "tollzones.geojson");
  const raw = fs.readFileSync(p, "utf8");
  const fc = JSON.parse(raw);
  return fc.features.map(f => ({
    id: f.properties.id,
    name: f.properties.name,
    country: f.properties.country,
    price: f.properties.price,
    currency: f.properties.currency || "EUR",
    geometry: f.geometry
  }));
}

module.exports = {
  async listZones() {
    if (PROV === "geojson") return loadGeojsonZones();
    // TODO: tollguru/here/google implementaties
    return [];
  },

  /**
   * Vind dichtstbijzijnde tolzone binnen d meters van [lng,lat]
   */
  async matchPositionToZone(lng, lat, dMeters = 150) {
    const pt = turf.point([lng, lat]);
    const zones = await this.listZones();
    let best = null;

    for (const z of zones) {
      const line = turf.feature(z.geometry);
      const snapped = turf.nearestPointOnLine(line, pt);
      const dist = snapped.properties.dist * 1000; // km→m
      if (dist <= dMeters && (!best || dist < best.dist)) {
        best = { zone: z, dist };
      }
    }
    return best; // { zone, dist } of null
  }
};
