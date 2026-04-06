"use client";

import { type RefObject } from "react";
import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimelineContentProps {
  animationNum: number;
  timelineRef: RefObject<HTMLDivElement | null>;
  customVariants?: Variants;
  className?: string;
  children?: React.ReactNode;
  as?: React.ElementType;
}

export function TimelineContent({
  animationNum,
  customVariants,
  className,
  children,
  as: Component = "div",
}: TimelineContentProps) {
  const defaultVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: "blur(10px)" },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { delay: i * 0.3, duration: 0.5 },
    }),
  };

  const variants = customVariants || defaultVariants;
  const MotionComponent = motion.create(Component);

  return (
    <MotionComponent
      custom={animationNum}
      initial="hidden"
      animate="visible"
      variants={variants}
      className={cn(className)}
    >
      {children}
    </MotionComponent>
  );
}
