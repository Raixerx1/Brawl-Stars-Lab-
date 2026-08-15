"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (!cancelled) await registration.update();
      } catch {
        // La web continúa funcionando aunque el navegador rechace el service worker.
      }
    };

    void register();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
