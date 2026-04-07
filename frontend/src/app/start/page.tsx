"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Eye, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/onboarding/role-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { triggerHaptic } from "@/lib/haptics";

export default function StartPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-5 pt-safe pb-safe bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0" aria-hidden="true">
        {/* Gradient orbs */}
        <div className="orb orb-green size-72 -top-20 -left-20" />
        <div className="orb orb-blue size-56 top-1/3 -right-16" />
        <div className="orb orb-green size-40 bottom-16 right-8 opacity-10" />

        {/* Floating shapes */}
        <motion.div
          className="absolute top-[12%] right-[10%] size-3 rounded-full bg-purple-500/20"
          animate={prefersReducedMotion ? {} : { y: [0, -10, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[30%] left-[6%] size-2 rounded-full bg-blue-500/20"
          animate={prefersReducedMotion ? {} : { y: [0, 12, 0], opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-[55%] right-[15%] size-2.5 rotate-45 rounded-sm bg-primary/15"
          animate={prefersReducedMotion ? {} : { y: [0, -8, 0], rotate: [45, 90, 45] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.div
          className="absolute top-[70%] left-[12%] size-2 rounded-full bg-blue-400/15"
          animate={prefersReducedMotion ? {} : { y: [0, 14, 0], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-[20%] right-[40%] size-1.5 rounded-full bg-purple-400/20"
          animate={prefersReducedMotion ? {} : { y: [0, -10, 0], x: [0, 5, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        <motion.div
          className="absolute top-[85%] left-[30%] size-2 rotate-12 rounded-sm bg-primary/10"
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

      <div className="w-full max-w-md flex-1 flex flex-col py-8 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <img src="/logo-footix.png" alt="Footix" className="h-9 w-auto" />
            <span className="font-bold text-lg gradient-text">Footix</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold">Bienvenue 👋</h1>
          <p className="text-lg text-muted-foreground mt-2">Choisis ton rôle pour commencer</p>
        </motion.div>

        {/* Role cards */}
        <div className="space-y-3">
          <RoleCard
            icon={Eye}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            title="Je suis spectateur"
            description="Suivre les scores et classements en direct"
            href="/tournoi"
            delay={0.15}
          />
          <RoleCard
            icon={Users}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            title="Je suis coach"
            description="Consulter le planning et les résultats de mon équipe"
            href="/coach/acces"
            delay={0.25}
          />
          <RoleCard
            icon={LayoutDashboard}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            title="Je suis organisateur"
            description="Créer et piloter mes tournois de A à Z"
            href="/admin/login"
            delay={0.35}
          />
        </div>

        {/* Separator */}
        <div className="relative py-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/50" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">
              ou
            </span>
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="text-center space-y-3"
        >
          <p className="text-sm text-muted-foreground">
            Pas encore de compte organisateur&nbsp;?
          </p>
          <Link href="/admin/register">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 font-semibold rounded-xl"
              onClick={() => triggerHaptic("light")}
            >
              Créer un compte gratuitement
            </Button>
          </Link>
        </motion.div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="pt-6 pb-safe text-center"
        >
          <p className="text-xs text-muted-foreground/60 space-x-3">
            <Link
              href="/legal/mentions"
              className="hover:text-muted-foreground"
            >
              Mentions légales
            </Link>
            <span>·</span>
            <Link
              href="/legal/confidentialite"
              className="hover:text-muted-foreground"
            >
              Confidentialité
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
