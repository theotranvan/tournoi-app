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
    <div className="min-h-[100dvh] flex flex-col pt-safe pb-safe bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        {/* Gradient orbs */}
        <div className="orb orb-green size-72 -top-20 -right-20" />
        <div className="orb orb-blue size-56 bottom-32 -left-16" />
        <div className="orb orb-green size-40 bottom-10 right-10 opacity-10" />

        {/* Floating shapes */}
        <motion.div
          className="absolute top-[15%] left-[8%] size-3 rounded-full bg-primary/20"
          animate={prefersReducedMotion ? {} : { y: [0, -12, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[25%] right-[12%] size-2 rounded-full bg-blue-500/20"
          animate={prefersReducedMotion ? {} : { y: [0, 10, 0], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-[60%] left-[15%] size-2.5 rotate-45 rounded-sm bg-primary/15"
          animate={prefersReducedMotion ? {} : { y: [0, -8, 0], rotate: [45, 90, 45] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute top-[45%] right-[6%] size-2 rounded-full bg-blue-400/15"
          animate={prefersReducedMotion ? {} : { y: [0, 14, 0], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-[25%] left-[50%] size-1.5 rounded-full bg-primary/20"
          animate={prefersReducedMotion ? {} : { y: [0, -10, 0], x: [0, 5, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute top-[80%] right-[25%] size-2 rotate-12 rounded-sm bg-blue-500/10"
          animate={prefersReducedMotion ? {} : { y: [0, -6, 0], rotate: [12, -12, 12] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />

        {/* Subtle dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

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
        aria-label="Présentation de Footix"
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
