"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { Loader2, KeyRound, CheckCircle2, ShieldCheck } from "lucide-react";
import { useTeamAccess } from "@/hooks/use-auth";
import { useCoachStore } from "@/stores/coach-store";

export default function CoachAccess() {
  const [code, setCode] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const accessMut = useTeamAccess();
  const router = useRouter();
  const team = useCoachStore((s) => s.team);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    accessMut.mutate(trimmed, {
      onSuccess: () => {
        setShowSuccess(true);
        setTimeout(() => router.push("/coach"), 1200);
      },
    });
  }

  // Success state
  if (showSuccess && team) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto">
            <TeamAvatar name={team.name} logo={team.logo} size="xl" />
          </div>
          <div>
            <CheckCircle2 className="size-8 text-green-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold">{team.name}</h2>
            <p className="text-sm text-muted-foreground">{team.category.name}</p>
          </div>
          <p className="text-sm text-muted-foreground">Redirection en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Branding */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex size-20 items-center justify-center rounded-2xl bg-primary/10">
          <ShieldCheck className="size-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Espace Coach</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Accédez au suivi de votre équipe
        </p>
      </div>

      {/* Access form */}
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-center">
                Entrez votre code d&apos;accès
              </p>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="text-center text-2xl tracking-[0.3em] font-mono h-14"
                autoFocus
                autoComplete="off"
                maxLength={12}
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Code fourni par l&apos;organisateur du tournoi
              </p>
            </div>

            {accessMut.isError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-center">
                <p className="text-sm text-destructive font-medium">
                  Code invalide
                </p>
                <p className="text-xs text-destructive/80">
                  Vérifiez votre code et réessayez.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base"
              disabled={!code.trim() || accessMut.isPending}
            >
              {accessMut.isPending ? (
                <Loader2 className="size-5 mr-2 animate-spin" />
              ) : (
                <KeyRound className="size-5 mr-2" />
              )}
              Accéder
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
