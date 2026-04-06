"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check initial state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);

    if ("serviceWorker" in navigator && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const { key } = await api.get<{ key: string }>(
        "/notifications/vapid-public-key/"
      );
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key).buffer as ArrayBuffer,
      });
      await api.post("/notifications/subscribe/", sub.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.warn("[Push] Subscribe failed:", err);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        await subscribe();
      }
    } finally {
      setIsLoading(false);
    }
  }, [subscribe]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.delete("/notifications/unsubscribe/");
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.warn("[Push] Unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, requestPermission, unsubscribe };
}
