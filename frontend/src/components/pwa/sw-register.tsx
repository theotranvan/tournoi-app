"use client";

import { useEffect } from "react";
import { requestBackgroundSync } from "@/lib/offline-scores";

/**
 * Registers the service worker on mount.
 * Triggers pending score sync when coming back online.
 * Renders nothing — just a side-effect component.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV === "development"
    ) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Check for updates periodically (every 60 min)
        const interval = setInterval(
          () => {
            reg.update().catch(() => {});
          },
          60 * 60 * 1000
        );
        return () => clearInterval(interval);
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });

    // When coming back online, trigger background sync for pending scores
    const handleOnline = () => {
      requestBackgroundSync().catch(() => {});
    };
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
