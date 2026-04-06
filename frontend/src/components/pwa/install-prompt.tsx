"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function getIsIOS() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!isIOSDevice || isStandalone) return false;
  const dismissedAt = localStorage.getItem("pwa-dismissed");
  if (dismissedAt) {
    const daysAgo =
      (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
    if (daysAgo < 7) return false;
  }
  return true;
}

const subscribeNoop = () => () => {};

/**
 * PWA install banner — shows on mobile/desktop when the app is installable.
 * Auto-hides after dismiss and remembers choice for 7 days.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if user dismissed recently
    const dismissedAt = localStorage.getItem("pwa-dismissed");
    if (dismissedAt) {
      const daysAgo =
        (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysAgo < 7) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS detection via useSyncExternalStore (no setState in effects)
  const isIOS = useSyncExternalStore(subscribeNoop, getIsIOS, () => false);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("pwa-dismissed", String(Date.now()));
  }

  if ((dismissed && !isIOS) || (!deferredPrompt && !isIOS)) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-lg overflow-hidden shrink-0">
            <img src="/logo-footix.png" alt="Footix" className="h-10 w-auto" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Installer Footix</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIOS
                ? "Appuyez sur Partager puis « Sur l'écran d'accueil »"
                : "Accédez aux résultats hors ligne et plus rapidement."}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X className="size-4" />
          </button>
        </div>

        {!isIOS && (
          <Button
            onClick={handleInstall}
            className="w-full mt-3 h-9"
            size="sm"
          >
            <Download className="size-3.5 mr-1.5" />
            Installer
          </Button>
        )}
      </div>
    </div>
  );
}
