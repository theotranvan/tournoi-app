"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles as SparklesComp } from "@/components/ui/sparkles";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Check, Shield, Zap, Crown, Loader2, Trophy, Calendar, MapPin } from "lucide-react";
import { useCheckout, useSubscription } from "@/hooks/use-subscription";
import { useTournaments } from "@/hooks/use-tournaments";
import { useRouter } from "next/navigation";

const plans = [
  {
    name: "Gratuit",
    icon: Shield,
    description: "Idéal pour découvrir Footix et organiser ton premier tournoi",
    price: 0,
    yearlyPrice: 0,
    priceLabel: "pour toujours",
    buttonText: "Plan actuel",
    buttonVariant: "outline" as const,
    includes: [
      "Inclus :",
      "1 tournoi actif",
      "Jusqu'à 16 équipes",
      "2 catégories, 3 terrains",
      "Planification intelligente",
      "Classement temps réel",
      "Accès public + QR code coach",
      "Saisie de scores en direct",
    ],
  },
  {
    name: "One-Shot",
    icon: Zap,
    description:
      "Tout ce qu'il faut pour un tournoi réussi, sans compromis",
    price: 49,
    yearlyPrice: 49,
    priceLabel: "par tournoi",
    buttonText: "Acheter pour un tournoi",
    buttonVariant: "default" as const,
    popular: true,
    includes: [
      "Tout du Gratuit +",
      "Équipes illimitées",
      "Phases finales automatiques",
      "Kit PDF imprimable",
      "Insights / bilan fin de tournoi",
      "Notifications push",
      "Mode multi-jours",
      "Mode haut-parleur + affichage terrain",
      "Assistance email 48h",
    ],
  },
  {
    name: "Club",
    icon: Crown,
    description:
      "Tous tes tournois de la saison gérés d'un seul endroit",
    price: 19,
    yearlyPrice: 199,
    priceLabel: "/mois",
    yearlyPriceLabel: "/an",
    buttonText: "S'abonner",
    buttonVariant: "default" as const,
    includes: [
      "Tout du One-Shot +",
      "Tournois illimités",
      "Catégories et terrains illimités",
      "Historique pluriannuel",
      "Personnalisation logo + couleurs club",
      "Export complet Excel/PDF",
      "Assistance prioritaire 24h",
      "Formation offerte",
    ],
  },
];

const PricingSwitch = ({
  onSwitch,
}: {
  onSwitch: (value: string) => void;
}) => {
  const [selected, setSelected] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = [useRef<HTMLButtonElement>(null), useRef<HTMLButtonElement>(null)];
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = btnRefs[selected].current;
      if (el) {
        setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
      }
    };
    measure();
    // Re-measure after fonts load (can shift button widths)
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [selected]);

  const handleSwitch = (idx: number) => {
    setSelected(idx);
    onSwitch(String(idx));
  };

  return (
    <div className="flex justify-center">
      <div ref={containerRef} className="relative z-10 mx-auto flex w-fit rounded-full bg-neutral-900 border border-neutral-700 p-1">
        {indicator && (
          <motion.div
            className="absolute top-1 bottom-1 rounded-full border-2 shadow-sm shadow-green-600 border-green-500 bg-gradient-to-t from-green-600 to-green-500"
            initial={false}
            animate={{ left: indicator.left, width: indicator.width }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}

        <button
          ref={btnRefs[0]}
          type="button"
          onClick={() => handleSwitch(0)}
          className={cn(
            "relative z-10 w-fit h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === 0 ? "text-white" : "text-gray-200"
          )}
        >
          Mensuel
        </button>

        <button
          ref={btnRefs[1]}
          type="button"
          onClick={() => handleSwitch(1)}
          className={cn(
            "relative z-10 w-fit h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === 1 ? "text-white" : "text-gray-200"
          )}
        >
          <span className="flex items-center gap-2">
            Annuel
            <span className="text-xs bg-green-500/20 text-green-300 rounded-full px-2 py-0.5">
              -13%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const pricingRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Only fetch subscription if user is logged in (avoids 401 → redirect)
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("access_token");
  const { data } = useSubscription({ enabled: hasToken });
  const { data: tournamentsData, isLoading: tournamentsLoading } = useTournaments();
  const checkout = useCheckout();

  const canceled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("canceled") === "true";

  const isClub = data?.subscription?.is_club ?? false;

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      transition: {
        delay: i * 0.4,
        duration: 0.5,
      },
    }),
    hidden: {
      filter: "blur(10px)",
      y: -20,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  const handleAction = (planName: string) => {
    if (planName === "One-Shot") {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!token) {
        router.push("/admin/login?next=/pricing");
        return;
      }
      setShowTournamentPicker(true);
    } else if (planName === "Club") {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      if (!token) {
        router.push("/admin/login?next=/pricing");
        return;
      }
      checkout.mutate({
        plan: isYearly ? "club_yearly" : "club_monthly",
      });
    }
  };

  const handleOneShotCheckout = (tournamentId: string) => {
    setShowTournamentPicker(false);
    checkout.mutate({
      plan: "one_shot",
      tournament_id: tournamentId,
    });
  };

  return (
    <div
      className="min-h-screen mx-auto relative bg-black overflow-x-hidden"
      ref={pricingRef}
    >
      {/* Sparkles background */}
      <TimelineContent
        animationNum={4}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute top-0 h-96 w-screen overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]"
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#ffffff2c_1px,transparent_1px),linear-gradient(to_bottom,#3a3a3a01_1px,transparent_1px)] bg-[size:70px_80px]" />
        <SparklesComp
          density={1800}
          direction="bottom"
          speed={1}
          color="#FFFFFF"
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
        />
      </TimelineContent>

      {/* Green glow ellipse */}
      <TimelineContent
        animationNum={5}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute left-0 top-[-114px] w-full h-[113.625vh] flex flex-col items-start justify-start content-start flex-none flex-nowrap gap-2.5 overflow-hidden p-0 z-0"
      >
        <div className="relative w-full h-full">
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #15803d",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
            }}
          />
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{
              border: "200px solid #15803d",
              filter: "blur(92px)",
              WebkitFilter: "blur(92px)",
            }}
          />
        </div>
      </TimelineContent>

      {/* Header */}
      <article className="text-center mb-4 sm:mb-6 pt-20 sm:pt-32 max-w-3xl mx-auto space-y-2 relative z-50 px-4">
        <h2 className="text-2xl sm:text-4xl font-medium text-white">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.15}
            staggerFrom="first"
            reverse={true}
            containerClassName="justify-center"
            transition={{
              type: "spring",
              stiffness: 250,
              damping: 40,
              delay: 0,
            }}
          >
            Choisis ton plan Footix
          </VerticalCutReveal>
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-gray-300 text-sm sm:text-base"
        >
          Organise, planifie et suis tes tournois. Commence gratuitement,
          monte en puissance quand tu veux.
        </TimelineContent>

        {canceled && (
          <p className="text-yellow-400 text-sm">
            Paiement annulé. Tu peux réessayer quand tu veux.
          </p>
        )}

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} />
          <p className="text-xs text-gray-500 mt-2">
            Le toggle s&apos;applique au plan Club uniquement
          </p>
        </TimelineContent>
      </article>

      {/* Green radial glow */}
      <div
        className="absolute top-0 left-[10%] right-[10%] w-[80%] h-full z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, #16a34a 0%, transparent 70%)",
          opacity: 0.15,
          mixBlendMode: "screen",
        }}
      />

      {/* Cards grid */}
      <div className="flex flex-col md:grid md:grid-cols-3 max-w-5xl gap-6 sm:gap-4 py-4 sm:py-6 mx-auto px-5 sm:px-4">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isOneShot = plan.name === "One-Shot";
          const isClubPlan = plan.name === "Club";
          const isFree = plan.name === "Gratuit";

          return (
            <TimelineContent
              key={plan.name}
              as="div"
              animationNum={2 + index}
              timelineRef={pricingRef}
              customVariants={revealVariants}
            >
              <div className={cn("relative", plan.popular && "mt-3")}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
                    <span className="bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg shadow-green-900/50">
                      Populaire
                    </span>
                  </div>
                )}
              <Card
                className={cn(
                  "relative text-white border-neutral-800 rounded-xl overflow-visible",
                  plan.popular
                    ? "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 shadow-[0px_-13px_300px_0px_#16a34a80] z-20"
                    : "bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 z-10"
                )}
              >

                <CardHeader className="text-left pb-2 sm:pb-4">
                  <div className="flex items-center gap-2 mb-1 sm:mb-2">
                    <Icon
                      className={cn(
                        "size-4 sm:size-5",
                        plan.popular
                          ? "text-green-400"
                          : isClubPlan
                            ? "text-yellow-500"
                            : "text-gray-400"
                      )}
                    />
                    <h3 className="text-2xl sm:text-3xl">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline">
                    {isFree ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-semibold">0 €</span>
                        <span className="text-gray-300 ml-1 text-sm sm:text-base">
                          pour toujours
                        </span>
                      </>
                    ) : isOneShot ? (
                      <>
                        <span className="text-3xl sm:text-4xl font-semibold">
                          <NumberFlow value={49} className="text-3xl sm:text-4xl font-semibold" />
                          <span className="text-3xl sm:text-4xl font-semibold ml-1">€</span>
                        </span>
                        <span className="text-gray-300 ml-1 text-sm sm:text-base">par tournoi</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl sm:text-4xl font-semibold">
                          <NumberFlow
                            value={isYearly ? 199 : 19}
                            className="text-3xl sm:text-4xl font-semibold"
                          />
                          <span className="text-3xl sm:text-4xl font-semibold ml-1">€</span>
                        </span>
                        <span className="text-gray-300 ml-1 text-sm sm:text-base">
                          /{isYearly ? "an" : "mois"}
                        </span>
                      </>
                    )}
                  </div>
                  {isClubPlan && isYearly && (
                    <p className="text-sm text-green-400 mt-1">
                      soit 16,58 €/mois — 2 mois offerts
                    </p>
                  )}
                  <p className="text-sm text-gray-300 mt-1">
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="pt-0">
                  {isFree ? (
                    <button
                      type="button"
                      disabled
                      className="w-full mb-4 sm:mb-6 p-3 sm:p-4 text-base sm:text-xl rounded-xl bg-gradient-to-t from-neutral-950 to-neutral-700 shadow-lg shadow-neutral-900 border border-neutral-700 text-gray-400 cursor-not-allowed"
                    >
                      Plan actuel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(plan.name)}
                      disabled={
                        checkout.isPending || (isClubPlan && isClub)
                      }
                      className={cn(
                        "w-full mb-4 sm:mb-6 p-3 sm:p-4 text-base sm:text-xl rounded-xl transition-all",
                        isClubPlan && isClub
                          ? "bg-gradient-to-t from-neutral-950 to-neutral-700 shadow-lg shadow-neutral-900 border border-neutral-700 text-gray-400 cursor-not-allowed"
                          : plan.popular
                            ? "bg-gradient-to-t from-green-700 to-green-500 shadow-lg shadow-green-900 border border-green-500 text-white hover:from-green-600 hover:to-green-400"
                            : "bg-gradient-to-t from-neutral-950 to-neutral-600 shadow-lg shadow-neutral-900 border border-neutral-800 text-white hover:from-neutral-900 hover:to-neutral-500"
                      )}
                    >
                      {checkout.isPending && isClubPlan ? (
                        <Loader2 className="size-5 animate-spin mx-auto" />
                      ) : isClubPlan && isClub ? (
                        <span className="flex items-center justify-center gap-2">
                          <Trophy className="size-5" />
                          Plan actuel
                        </span>
                      ) : (
                        plan.buttonText
                      )}
                    </button>
                  )}

                  <div className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 border-t border-neutral-700">
                    <h4 className="font-medium text-sm sm:text-base mb-2 sm:mb-3">
                      {plan.includes[0]}
                    </h4>
                    <ul className="space-y-2">
                      {plan.includes.slice(1).map((feature, featureIndex) => (
                        <li
                          key={featureIndex}
                          className="flex items-center gap-2"
                        >
                          <Check
                            className={cn(
                              "size-3.5 sm:size-4 shrink-0",
                              plan.popular
                                ? "text-green-400"
                                : "text-neutral-400"
                            )}
                          />
                          <span className="text-xs sm:text-sm text-gray-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
              </div>
            </TimelineContent>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs sm:text-sm text-gray-500 pb-8 sm:pb-12 relative z-10 space-y-1 px-4">
        <p>Paiement sécurisé par Stripe. Annulation possible à tout moment.</p>
        <p>
          Les prix incluent la TVA.{" "}
          <a href="/legal/mentions" className="underline hover:text-gray-300">
            Mentions légales
          </a>
        </p>
      </div>

      {/* Tournament picker dialog for One-Shot */}
      <Dialog open={showTournamentPicker} onOpenChange={setShowTournamentPicker}>
        <DialogContent
          className="bg-neutral-900 border-neutral-700 text-white max-h-[80vh] overflow-y-auto"
          onClose={() => setShowTournamentPicker(false)}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Choisis un tournoi</DialogTitle>
            <DialogDescription className="text-gray-400">
              Sélectionne le tournoi pour lequel tu veux acheter la licence One-Shot (49 €).
            </DialogDescription>
          </DialogHeader>

          {tournamentsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-green-500" />
            </div>
          ) : !tournamentsData?.results?.length ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-400">Tu n&apos;as pas encore de tournoi.</p>
              <button
                type="button"
                onClick={() => router.push("/admin/tournois/nouveau")}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition-colors"
              >
                Créer un tournoi
              </button>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {tournamentsData.results.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleOneShotCheckout(t.id)}
                  disabled={checkout.isPending}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-neutral-700 hover:border-green-500 hover:bg-neutral-800 transition-all text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate group-hover:text-green-400 transition-colors">
                      {t.name}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      {t.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(t.start_date).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {t.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />
                          {t.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0">
                    {t.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
