import { useRef } from "react";
import api from "@/api/base";

// call this met elke GPS update (lng,lat)
export default function useTollDetector() {
  const lastSentRef = useRef(0);

  async function onPosition(lng, lat) {
    const now = Date.now();
    if (now - lastSentRef.current < 15000) return; // 15s throttle
    lastSentRef.current = now;
    try {
      const res = await api("/api/toll/detect", { method: "POST", body: { lng, lat } });
      if (res?.matched && !res.duplicate && !res.autopay) {
        // TODO: trigger UI toast “Tol gedetecteerd – nu betalen?”
        console.log("Tol gedetecteerd:", res);
      }
    } catch (e) {
      console.warn("toll detect failed", e);
    }
  }
  return { onPosition };
}
