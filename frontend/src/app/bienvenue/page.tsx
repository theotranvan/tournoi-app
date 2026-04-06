"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OnboardingSlide } from "@/components/onboarding/onboarding-slide";
import { OnboardingDots } from "@/components/onboarding/onboarding-dots";
import { PublicIllustration } from "@/components/onboarding/illustrations/public-illustration";
import { CoachIllustration } from "@/components/onboarding/illustrations/coach-illustration";
import { OrganizerIllustration } from "@/components/onboarding/illustrations/organizer-illustration";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { triggerHaptic } from "@/lib/haptics";

const SLIDES = [
  {
    illustration: <PublicIllustration />,
    title: "Vis chaque tournoi en direct",
    description:
      "Scores en temps réel, classements animés, suis tes équipes favorites. Aucune inscription, zéro friction.",
  },
  {
    illustration: <CoachIllustration />,
    title: "Toute ton équipe dans ta poche",
    description:
      "Scanne ton QR code et retrouve tes matchs, horaires, terrains et classements en temps réel. Pas de compte à créer.",
  },
  {
    illustration: <OrganizerIllustration />,
    title: "Organise ton tournoi en quelques minutes",
    description:
      "Planning intelligent automatique, poules et phases finales gérées pour toi, saisie des scores en direct. De l'inscription à la finale, tout est fluide.",
  },
] as const;

const SWIPE_THRESHOLD = 50;

export default function BienvenuePage() {
  const router = useRouter();
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const prefersReducedMotion = useReducedMotion();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const isLast = currentSlide === SLIDES.length - 1;

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= SLIDES.length || index === currentSlide)
        return;
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide]
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      markSeen();
      triggerHaptic("medium");
      router.push("/start");
    } else {
      setDirection(1);
      setCurrentSlide((prev) => prev + 1);
      triggerHaptic("light");
    }
  }, [isLast, markSeen, router]);

  const handleSkip = useCallback(() => {
    markSeen();
    router.push("/start");
  }, [markSeen, router]);

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft" && currentSlide > 0) {
        setDirection(-1);
        setCurrentSlide((prev) => prev - 1);
      } else if (e.key === "Enter") {
        handleNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentSlide, handleNext]);

  const duration = prefersReducedMotion ? 0 : 0.35;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-[100dvh] flex flex-col pt-safe pb-safe bg-background">
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-sm text-muted-foreground"
          onClick={handleSkip}
        >
          Passer
        </Button>
      </div>

      {/* Carousel */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden"
        role="region"
        aria-label="Présentation de Kickoff"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration, ease: "easeInOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -SWIPE_THRESHOLD && !isLast) {
                setDirection(1);
                setCurrentSlide((prev) => prev + 1);
                triggerHaptic("light");
              } else if (
                info.offset.x > SWIPE_THRESHOLD &&
                currentSlide > 0
              ) {
                setDirection(-1);
                setCurrentSlide((prev) => prev - 1);
                triggerHaptic("light");
              }
            }}
            className="w-full"
          >
            <OnboardingSlide
              illustration={SLIDES[currentSlide].illustration}
              title={SLIDES[currentSlide].title}
              description={SLIDES[currentSlide].description}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom controls */}
      <div className="px-6 pb-6 space-y-6">
        <OnboardingDots
          total={SLIDES.length}
          current={currentSlide}
          onDotClick={goTo}
        />
        <Button
          className="h-14 w-full text-base font-semibold"
          onClick={handleNext}
        >
          {isLast ? "Commencer" : "Suivant →"}
        </Button>
      </div>
    </div>
  );
}
