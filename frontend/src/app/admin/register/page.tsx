"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useRegister } from "@/hooks/use-auth";
import { triggerHaptic } from "@/lib/haptics";

export default function AdminRegister() {
  const router = useRouter();
  const register = useRegister();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError("");

    if (password !== password2) {
      setLocalError("Les mots de passe ne correspondent pas.");
      return;
    }

    register.mutate(
      { username, email, password, password2 },
      {
        onSuccess: () => router.replace("/admin"),
      }
    );
  }

  const errorMessage =
    localError ||
    (register.isError
      ? (() => {
          const err = register.error as { detail?: string; errors?: Record<string, string[]> };
          if (err.errors) {
            return Object.values(err.errors).flat().join(" ");
          }
          return err.detail || "Erreur lors de l\u2019inscription. Veuillez r\u00e9essayer.";
        })()
      : "");

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
            <h1 className="text-2xl font-bold gradient-text">Crée ton espace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Inscris-toi pour organiser tes tournois
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
                  placeholder="Choisis un pseudo"
                  autoComplete="username"
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  required
                />
              </div>

              <div className="space-y-2 animate-fade-in-up stagger-4">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  autoComplete="email"
                  className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 animate-fade-in-up stagger-5">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="8+ caractères"
                      autoComplete="new-password"
                      className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors pr-10"
                      minLength={8}
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

                <div className="space-y-2 animate-fade-in-up stagger-6">
                  <Label htmlFor="password2" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Confirmer
                  </Label>
                  <Input
                    id="password2"
                    type={showPassword ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-12 rounded-xl bg-muted/50 border-border/50 focus:bg-background transition-colors"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 animate-fade-in-down">
                  <p className="text-sm text-destructive text-center">
                    {errorMessage}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all animate-fade-in-up stagger-7"
                disabled={register.isPending}
              >
                {register.isPending ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground animate-fade-in stagger-8">
              Déjà inscrit ?{" "}
              <Link
                href="/admin/login"
                className="text-primary hover:underline font-medium"
              >
                Se connecter
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
