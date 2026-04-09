"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/stores/onboarding-store";

function Splash() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <img src="/logo-footix.png" alt="Footix" className="h-16 w-auto" />
        <span className="text-xl font-bold gradient-text">Footix</span>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready || typeof window === "undefined") return;

    const persistApi = useOnboardingStore.persist;
    if (!persistApi) return;

    if (persistApi.hasHydrated()) {
      const frame = window.requestAnimationFrame(() => setReady(true));
      return () => window.cancelAnimationFrame(frame);
    }

    // Wait for zustand persist to finish hydrating from localStorage.
    return persistApi.onFinishHydration(() => setReady(true));
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const { hasSeenOnboarding } = useOnboardingStore.getState();
    if (hasSeenOnboarding) {
      router.replace("/start");
    } else {
      router.replace("/bienvenue");
    }
  }, [ready, router]);

  return <Splash />;
}
