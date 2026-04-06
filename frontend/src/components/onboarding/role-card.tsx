"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

interface RoleCardProps {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  href: string;
  delay?: number;
}

export function RoleCard({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  href,
  delay,
}: RoleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay ?? 0, duration: 0.4 }}
    >
      <Link
        href={href}
        onClick={() => triggerHaptic("light")}
        className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5
                   active:scale-[0.98] transition-all
                   hover:border-primary/50 hover:bg-primary/5
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div
          className={`size-14 rounded-2xl flex items-center justify-center ${iconBg}`}
        >
          <Icon className={`size-7 ${iconColor}`} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-lg leading-tight">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
        <ChevronRight
          className="size-5 text-muted-foreground group-hover:translate-x-1 transition-transform"
          aria-hidden="true"
        />
      </Link>
    </motion.div>
  );
}
