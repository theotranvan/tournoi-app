"use client";

import { useSubscription } from "@/hooks/use-subscription";
import Link from "next/link";
import { Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PremiumGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps content that requires a premium subscription.
 * Shows a paywall prompt when the user is on the free plan.
 */
export function PremiumGate({ children, fallback }: PremiumGateProps) {
  const { data, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data?.subscription?.is_premium) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Crown className="size-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Fonctionnalité Premium</h2>
      <p className="text-muted-foreground max-w-sm">
        Cette fonctionnalité nécessite un abonnement actif.
        Abonne-toi pour débloquer toutes les fonctionnalités de Footix.
      </p>
      <Link href="/pricing">
        <Button size="lg">
          <Crown className="size-4 mr-2" />
          Voir les offres
        </Button>
      </Link>
    </div>
  );
}
