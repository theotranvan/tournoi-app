"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

const DISMISSED_KEY = "push-prompt-dismissed";

/**
 * One-time bottom-sheet that prompts the coach to enable push notifications.
 * Shows only once after team access, never again after dismiss.
 */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const { permission, isSubscribed, requestPermission } =
    usePushNotifications();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (permission === "denied" || permission === "granted") return;
    if (isSubscribed) return;

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;

    // Show after a short delay for better UX
    const timer = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(timer);
  }, [permission, isSubscribed]);

  function handleDismiss() {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function handleEnable() {
    await requestPermission();
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleDismiss}
      />
      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-card border-t border-border rounded-t-2xl shadow-2xl p-5 pb-safe animate-in slide-in-from-bottom duration-300">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="size-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">
              Rester informé de vos matchs ?
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Recevez une notification quand votre match commence ou se termine.
              Vous pourrez désactiver à tout moment dans les réglages.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDismiss}>
            Plus tard
          </Button>
          <Button className="flex-1" onClick={handleEnable}>
            <Bell className="size-4 mr-1.5" />
            Activer
          </Button>
        </div>
      </div>
    </div>
  );
}
