"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useLogin } from "@/hooks/use-auth";
import Link from "next/link";
import { triggerHaptic } from "@/lib/haptics";

export default function AdminLogin() {
  const router = useRouter();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate(
      { username, password },
      {
        onSuccess: () => router.replace("/admin"),
      }
    );
  }

  return (
    <div className="relative flex items-center justify-center min-h-[100dvh] px-5 py-safe overflow-hidden">
      {/* Back button */}
      <Link
        href="/start"
        onClick={() => triggerHaptic("light")}
        className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Link>

      {/* Decorative gradient orbs */}
      <div className="orb orb-green size-72 -top-20 -right-20 fixed" />
      <div className="orb orb-blue size-56 bottom-16 -left-16 fixed" />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3 animate-fade-in-up">
          <div className="mx-auto size-20 rounded-2xl bg-card/80 backdrop-blur border border-border/50 flex items-center justify-center shadow-lg shadow-primary/5 animate-glow-pulse">
            <img src="/logo-footix.png" alt="Footix" className="h-12 w-auto" />
          </div>
          <div>
            <h1 className="text-2xl font-bold gradient-text">Content de te revoir</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connecte-toi pour gérer tes tournois
            </p>
          </div>
        </div>

        <Card className="animate-scale-in stagger-2 border-border/50 shadow-xl shadow-black/5">
          <CardContent className="pt-6 pb-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 animate-fade-in-up stagger-3">
                <Label htmlFor="username" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Nom d&apos;utilisateur
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ton identifiant"
                  autoComplete="username"
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  required
                />
              </div>
              <div className="space-y-2 animate-fade-in-up stagger-4">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {login.isError && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in-down">
                  <p className="text-sm text-destructive text-center">
                    Identifiants incorrects. Vérifie et réessaie.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all animate-fade-in-up stagger-5"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs text-muted-foreground/60">ou</span>
              </div>
            </div>

            <Link href="/admin/register" className="block">
              <Button
                variant="ghost"
                className="w-full h-11 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground animate-fade-in stagger-6"
              >
                Créer un compte organisateur
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
