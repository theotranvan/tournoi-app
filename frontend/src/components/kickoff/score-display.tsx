"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number;
  size?: "lg" | "md" | "sm";
  className?: string;
}

const sizeClasses = {
  lg: "score-display",
  md: "score-match",
  sm: "text-3xl font-bold tabular-nums leading-none",
};

export function ScoreDisplay({
  score,
  size = "md",
  className,
}: ScoreDisplayProps) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={score}
        initial={{ scale: 1.15, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={cn(sizeClasses[size], className)}
      >
        {score}
      </motion.span>
    </AnimatePresence>
  );
}
