"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Users, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/onboarding/role-card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { triggerHaptic } from "@/lib/haptics";

export default function StartPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center px-5 pt-safe pb-safe bg-background">
      <div className="w-full max-w-md flex-1 flex flex-col py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-lg">⚽</span>
            </div>
            <span className="font-bold text-lg gradient-text">Kickoff</span>
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
          <h1 className="text-4xl font-bold">Salut 👋</h1>
          <p className="text-xl text-muted-foreground mt-1">Qui es-tu ?</p>
        </motion.div>

        {/* Role cards */}
        <div className="space-y-4">
          <RoleCard
            icon={Eye}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            title="Je suis spectateur"
            description="Voir un tournoi en direct"
            href="/tournoi"
            delay={0.15}
          />
          <RoleCard
            icon={Users}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
            title="Je suis coach"
            description="Accéder à l'espace de mon équipe"
            href="/coach/acces"
            delay={0.25}
          />
          <RoleCard
            icon={LayoutDashboard}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            title="Je suis organisateur"
            description="Gérer mes tournois"
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
            ✨ Envie de créer ton propre tournoi&nbsp;?
          </p>
          <Link href="/admin/register">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 font-semibold"
              onClick={() => triggerHaptic("light")}
            >
              Créer un compte
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
