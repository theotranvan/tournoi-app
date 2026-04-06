import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Users, Globe, ChevronRight } from "lucide-react";

const ROLES = [
  {
    href: "/admin",
    icon: Shield,
    title: "Organisateur",
    description: "Créez et gérez vos tournois, équipes, matchs et plannings.",
    cta: "Accéder à l\u2019espace",
    primary: true,
  },
  {
    href: "/coach",
    icon: Users,
    title: "Coach",
    description: "Suivez votre équipe, consultez les matchs et les classements.",
    cta: "Espace coach",
  },
  {
    href: "/tournoi/demo",
    icon: Globe,
    title: "Spectateur",
    description: "Résultats en direct, classements et scores en temps réel.",
    cta: "Voir les résultats",
  },
] as const;

export default function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-full px-4 py-12 pb-safe overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="orb orb-green size-72 -top-20 -left-20 fixed" />
      <div className="orb orb-blue size-56 -bottom-16 -right-16 fixed" />

      <div className="relative max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-3 animate-fade-in-up">
          <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto animate-glow-pulse">
            <span className="text-4xl">⚽</span>
          </div>
          <h1 className="text-3xl font-bold gradient-text">Kickoff</h1>
          <p className="text-muted-foreground">
            Organisez et suivez vos tournois de football
          </p>
        </div>

        {/* Role cards */}
        <div className="space-y-3 text-left">
          {ROLES.map((role, i) => {
            const { href, icon: Icon, title, description } = role;
            const primary = "primary" in role && role.primary;
            return (
            <Link key={href} href={href} className="block">
              <Card className={`card-hover hover:ring-1 hover:ring-primary/30 transition-all cursor-pointer active:scale-[0.98] animate-fade-in-up stagger-${i + 2}`}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      primary ? "bg-primary/10" : "bg-muted"
                    }`}>
                      <Icon className={`size-5 ${primary ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{title}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {description}
                      </CardDescription>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
            );
          })}
        </div>

        {/* CTA */}
        <div className="space-y-3 pt-2 animate-fade-in-up stagger-6">
          <Link href="/admin/register" className="block">
            <Button className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
              Créer un compte organisateur
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href="/admin/login" className="text-primary hover:underline font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
