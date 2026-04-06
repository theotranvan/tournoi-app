"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  ExternalLink,
  Crown,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  useSubscription,
  useCustomerPortal,
  useInvalidateSubscription,
} from "@/hooks/use-subscription";

const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  monthly: "Premium Mensuel",
  yearly: "Premium Annuel",
  club_monthly: "Club Mensuel",
  club_yearly: "Club Annuel",
};

export default function AbonnementPage() {
  const { data, isLoading } = useSubscription();
  const portal = useCustomerPortal();
  const invalidate = useInvalidateSubscription();
  const searchParams = useSearchParams();

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

  const sub = data?.subscription;
  const licenses = data?.licenses ?? [];
  const isPremium = sub?.is_premium ?? false;
  const isClub = sub?.is_club ?? false;
  const currentPlan = sub?.plan ?? "free";

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Abonnement</h1>
        <p className="text-muted-foreground mt-1">
          Gère ton abonnement Footix
        </p>
      </div>

      {/* Current subscription */}
      {isPremium || isClub ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Crown className="size-6 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">
                  {PLAN_LABELS[currentPlan] ?? currentPlan} — actif
                </p>
                {sub?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    {sub.cancel_at_period_end
                      ? "Se termine le"
                      : "Prochain renouvellement le"}{" "}
                    {new Date(sub.current_period_end).toLocaleDateString("fr-FR")}
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
      ) : (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-muted-foreground">
              Tu utilises actuellement le <strong>plan gratuit</strong>.
            </p>
            <Link href="/pricing">
              <Button>
                <Crown className="size-4 mr-2" />
                Voir les offres
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Active licenses */}
      {licenses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Licences One-Shot</h2>
          {licenses.map((lic) => (
            <Card key={lic.id}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Zap className="size-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{lic.tournament_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {lic.is_valid ? "Active" : "Expirée"}
                      {lic.valid_until &&
                        ` — jusqu'au ${new Date(lic.valid_until).toLocaleDateString("fr-FR")}`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
