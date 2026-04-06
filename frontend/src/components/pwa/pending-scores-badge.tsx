"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, Check } from "lucide-react";
import { getPendingScoreCount } from "@/lib/offline-scores";

/**
 * Displays a badge showing how many score submissions are pending (offline).
 * Listens for the SW "SCORES_SYNCED" message and shows a toast.
 */
export function PendingScoresBadge() {
  const [count, setCount] = useState(0);
  const [synced, setSynced] = useState<number | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const c = await getPendingScoreCount();
      setCount(c);
    } catch {
      // IndexedDB not available
    }
  }, []);

  useEffect(() => {
    refreshCount();

    // Refresh count on online event
    const onOnline = () => {
      refreshCount();
    };
    window.addEventListener("online", onOnline);

    // Listen for SW sync messages
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SCORES_SYNCED") {
        setSynced(event.data.count);
        refreshCount();
        // Hide synced message after 4s
        setTimeout(() => setSynced(null), 4000);
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);

    // Periodic refresh (every 10s)
    const interval = setInterval(refreshCount, 10_000);

    return () => {
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
      clearInterval(interval);
    };
  }, [refreshCount]);

  return (
    <>
      {count > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm">
          <CloudOff className="size-4 text-amber-500 shrink-0" />
          <span className="text-amber-700 dark:text-amber-400">
            {count} saisie{count > 1 ? "s" : ""} en attente de synchronisation
          </span>
        </div>
      )}
      {synced !== null && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm animate-in slide-in-from-bottom fade-in duration-300">
          <Check className="size-4 text-green-500 shrink-0" />
          <span className="text-green-700 dark:text-green-400">
            {synced} score{synced > 1 ? "s" : ""} synchronisé{synced > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </>
  );
}
