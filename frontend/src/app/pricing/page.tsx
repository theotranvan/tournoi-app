"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Crown,
  Loader2,
  Zap,
  Trophy,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useCheckout, useSubscription } from "@/hooks/use-subscription";

const FREE_FEATURES = [
  "1 tournoi actif",
  "Jusqu'à 16 équipes",
  "2 catégories, 3 terrains",
  "Planification intelligente",
  "Classement temps réel",
  "Accès public + QR code coach",
  "Saisie de scores en direct",
];

const ONE_SHOT_FEATURES = [
  "Tout du Gratuit +",
  "Équipes illimitées",
  "Phases finales automatiques",
  "Kit PDF imprimable",
  "Insights / bilan fin de tournoi",
  "Notifications push",
  "Mode multi-jours",
  "Mode haut-parleur + affichage terrain",
  "Assistance email 48h",
];

const CLUB_FEATURES = [
  "Tout du One-Shot +",
  "Tournois illimités",
  "Catégories et terrains illimités",
  "Historique pluriannuel",
  "Personnalisation logo + couleurs club",
  "Export complet Excel/PDF",
  "Assistance prioritaire 24h",
  "Formation offerte",
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const { data, isLoading } = useSubscription();
  const checkout = useCheckout();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "true";

  const isClub = data?.subscription?.is_club ?? false;
  const isPremium = data?.subscription?.is_premium ?? false;

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold">
            <span className="gradient-text">Choisis ton plan Footix</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Organise, planifie et suis tes tournois. Commence gratuitement, 
            monte en puissance quand tu veux.
          </p>
        </div>

        {canceled && (
          <div className="text-center text-sm text-yellow-500">
            Paiement annulé. Tu peux réessayer quand tu veux.
          </div>
        )}

        {/* Toggle mensuel/annuel */}
        <div className="flex items-center justify-center gap-3">
          <span className={annual ? "text-muted-foreground" : "font-medium"}>
            Mensuel
          </span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={annual ? "font-medium" : "text-muted-foreground"}>
            Annuel
          </span>
          {annual && (
            <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">
              2 mois offerts
            </Badge>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* ─── FREE ──────────────────────────────────────────── */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="size-5 text-muted-foreground" />
                <CardTitle>Gratuit</CardTitle>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold">0 €</span>
                <span className="text-muted-foreground ml-1">pour toujours</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Aucune carte bancaire requise
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant="outline"
                disabled
              >
                {isPremium || isClub ? "Plan actuel" : "Plan actuel"}
              </Button>
            </CardContent>
          </Card>

          {/* ─── ONE-SHOT ──────────────────────────────────────── */}
          <Card className="border-primary ring-1 ring-primary/20 relative">
            <Badge className="absolute -top-2.5 right-4 bg-primary text-primary-foreground">
              Populaire
            </Badge>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-primary" />
                <CardTitle>One-Shot</CardTitle>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold">49 €</span>
                <span className="text-muted-foreground ml-1">par tournoi</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Paiement unique · Valide 30j avant/après
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {ONE_SHOT_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={() => {
                  // Redirect to tournament selection or checkout
                  router.push("/admin?upgrade=one_shot");
                }}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Acheter pour un tournoi"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ─── CLUB ──────────────────────────────────────────── */}
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="size-5 text-yellow-500" />
                <CardTitle>Club</CardTitle>
              </div>
              <div className="mt-3">
                {annual ? (
                  <>
                    <span className="text-3xl font-bold">199 €</span>
                    <span className="text-muted-foreground ml-1">/an</span>
                    <p className="text-sm text-primary mt-1">
                      soit 16,58 €/mois — 2 mois offerts
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold">19 €</span>
                    <span className="text-muted-foreground ml-1">/mois</span>
                    <p className="text-sm text-muted-foreground mt-1">
                      Engagement 12 mois
                    </p>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {CLUB_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isClub ? (
                <Button className="w-full" variant="outline" disabled>
                  <Trophy className="size-4 mr-2" />
                  Plan actuel
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="default"
                  onClick={() =>
                    checkout.mutate({
                      plan: annual ? "club_yearly" : "club_monthly",
                    })
                  }
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "S'abonner"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* FAQ / notes */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Paiement sécurisé par Stripe. Annulation possible à tout moment.</p>
          <p>
            Les prix incluent la TVA.{" "}
            <a href="/legal/mentions" className="underline">
              Mentions légales
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
