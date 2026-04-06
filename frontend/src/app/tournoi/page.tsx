"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Search, Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { triggerHaptic } from "@/lib/haptics";

interface TournamentLookup {
  slug: string;
  name: string;
}

export default function TournoiAccess() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setError("");
    setIsPending(true);

    try {
      const data = await api.get<TournamentLookup>(
        `/public/tournaments/by-code/${trimmed}/`
      );
      triggerHaptic("medium");
      router.push(`/tournoi/${data.slug}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Code introuvable. Vérifie et réessaie.");
      } else {
        setError("Erreur de connexion. Réessaie dans un instant.");
      }
      triggerHaptic("heavy");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Back button */}
      <Link
        href="/start"
        onClick={() => triggerHaptic("light")}
        className="absolute top-4 left-4 z-10 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors animate-fade-in"
      >
        <ArrowLeft className="size-4" />
        Retour
      </Link>

      {/* Branding */}
      <div className="text-center mb-8 animate-fade-in-up">
        <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-2xl bg-primary/10 animate-glow-pulse">
          <Trophy className="size-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Suivre un tournoi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Entre le code du tournoi pour voir les scores en direct
        </p>
      </div>

      {/* Access form */}
      <Card className="w-full max-w-sm animate-scale-in stagger-2">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">
                Code du tournoi
              </p>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.3em] font-mono h-14"
                autoFocus
                autoComplete="off"
                maxLength={6}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Demande le code à l&apos;organisateur du tournoi
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-center animate-fade-in-down">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={!code.trim() || isPending}
            >
              {isPending ? (
                <Loader2 className="size-5 mr-2 animate-spin" />
              ) : (
                <Search className="size-5 mr-2" />
              )}
              Accéder au tournoi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
