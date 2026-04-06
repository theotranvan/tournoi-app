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
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const { hasSeenOnboarding } = useOnboardingStore.getState();
    if (hasSeenOnboarding) {
      router.replace("/start");
    } else {
      router.replace("/bienvenue");
    }
  }, [mounted, router]);

  return <Splash />;
}
