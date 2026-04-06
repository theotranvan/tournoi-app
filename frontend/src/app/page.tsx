import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, Users, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-16">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-2">
          <span className="text-5xl">⚽</span>
          <h1 className="text-3xl font-bold">Kickoff</h1>
          <p className="text-muted-foreground">
            Organisez et suivez vos tournois de football
          </p>
        </div>

        {/* Entry points */}
        <div className="space-y-3">
          <Link href="/admin" className="block">
            <Card className="hover:ring-primary/30 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="size-5 text-primary" />
                  <div className="text-left">
                    <CardTitle>Espace Organisateur</CardTitle>
                    <CardDescription>Gérer vos tournois</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/coach" className="block">
            <Card className="hover:ring-primary/30 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-primary" />
                  <div className="text-left">
                    <CardTitle>Espace Coach</CardTitle>
                    <CardDescription>Suivre votre équipe</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/tournoi/demo" className="block">
            <Card className="hover:ring-primary/30 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Globe className="size-5 text-primary" />
                  <div className="text-left">
                    <CardTitle>Page publique</CardTitle>
                    <CardDescription>Voir les résultats en direct</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="pt-4">
          <Link href="/admin">
            <Button className="w-full h-12 text-base font-semibold">
              Commencer
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
