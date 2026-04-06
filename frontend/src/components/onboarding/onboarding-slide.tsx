"use client";
import { motion } from "framer-motion";

interface OnboardingSlideProps {
  illustration: React.ReactNode;
  title: string;
  description: string;
}

export function OnboardingSlide({
  illustration,
  title,
  description,
}: OnboardingSlideProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-8 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center"
        style={{ height: "40vh", minHeight: 180, maxHeight: 280 }}
      >
        {illustration}
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-3xl font-bold"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-base text-muted-foreground max-w-sm mx-auto"
      >
        {description}
      </motion.p>
    </div>
  );
}
