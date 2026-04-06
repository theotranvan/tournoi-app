"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  Check,
  Loader2,
  ExternalLink,
  Crown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useSubscription,
  useCheckout,
  useCustomerPortal,
  useInvalidateSubscription,
} from "@/hooks/use-subscription";

const PLANS = [
  {
    id: "monthly" as const,
    name: "Mensuel",
    price: "9,99 €",
    period: "/mois",
    features: [
      "Tournois illimités",
      "Gestion des équipes",
      "Matchs en temps réel",
      "Notifications",
      "Export des résultats",
    ],
  },
  {
    id: "yearly" as const,
    name: "Annuel",
    price: "89,99 €",
    period: "/an",
    badge: "Économisez 30 €",
    features: [
      "Tout le mensuel",
      "Tournois illimités",
      "Support prioritaire",
      "Statistiques avancées",
      "2 mois offerts",
    ],
    recommended: true,
  },
];

export default function AbonnementPage() {
  const { data: subscription, isLoading } = useSubscription();
  const checkout = useCheckout();
  const portal = useCustomerPortal();
  const invalidate = useInvalidateSubscription();
  const searchParams = useSearchParams();

  // Refresh subscription status when returning from Stripe
  useEffect(() => {
    if (searchParams.get("canceled") === "true") {
      invalidate();
    }
  }, [searchParams, invalidate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPremium = subscription?.is_premium ?? false;
  const currentPlan = subscription?.plan ?? "free";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="text-muted-foreground mt-1">
          Gérez votre abonnement Kickoff
        </p>
      </div>

      {/* Current Status */}
      {isPremium && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Crown className="size-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">
                  Abonnement {currentPlan === "yearly" ? "Annuel" : "Mensuel"}{" "}
                  actif
                </p>
                {subscription?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancel_at_period_end
                      ? "Se termine le"
                      : "Prochain renouvellement le"}{" "}
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString("fr-FR")}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => portal.mutate()}
                disabled={portal.isPending}
              >
                {portal.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Gérer <ExternalLink className="size-3 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      {!isPremium && (
        <div className="grid gap-4 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.recommended
                  ? "border-primary ring-1 ring-primary/20 relative"
                  : ""
              }
            >
              {plan.badge && (
                <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground">
                  {plan.badge}
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="size-5" />
                  {plan.name}
                </CardTitle>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="size-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.recommended ? "default" : "outline"}
                  onClick={() => checkout.mutate(plan.id)}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "S'abonner"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Free tier note */}
      {!isPremium && (
        <p className="text-sm text-muted-foreground text-center">
          Vous utilisez actuellement le plan gratuit. Abonnez-vous pour accéder à
          toutes les fonctionnalités.
        </p>
      )}
    </div>
  );
}
