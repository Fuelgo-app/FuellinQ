import React from "react";
import { Link } from "react-router-dom";

function centsToEUR(c) {
  if (typeof c !== "number") return "";
  return `€ ${(c/100).toFixed(2).replace(".", ",")}`;
}

export default function OffersBoard({ offers = [], compact = false }) {
  if (!offers?.length) return <div className="text-sm text-gray-500">Geen aanbiedingen.</div>;

  return (
    <div className={compact ? "grid gap-3" : "grid gap-4"}>
      {offers.map(o => (
        <div key={o.id} className="border rounded-2xl p-3 flex gap-3 items-center">
          {o.image_url ? (
            <img src={o.image_url} alt={o.title} className="w-16 h-16 object-cover rounded-xl" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-100 grid place-items-center text-xs">Offer</div>
          )}
          <div className="flex-1">
            <div className="font-medium">{o.title}</div>
            {o.description ? (
              <div className="text-sm text-gray-600 line-clamp-2">{o.description}</div>
            ) : null}
            <div className="text-sm mt-1">
              <span className="font-semibold">{centsToEUR(o.price_cents)}</span>
              <span className="text-gray-500"> • {o.station_title} — {o.city || o.postcode}</span>
            </div>
          </div>
          <Link
            to={`/station/${o.station_id}`}
            className="px-3 py-1 rounded-xl bg-black text-white text-sm"
          >
            Naar station
          </Link>
        </div>
      ))}
    </div>
  );
}
