"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { ShareButton } from "@/components/kickoff/share-button";
import { Settings, LogOut, Trophy, Users, Copy, Check, RefreshCw, Bell, BellOff } from "lucide-react";
import { useCoachStore } from "@/stores/coach-store";
import { useAuthStore } from "@/stores/auth-store";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function CoachParametres() {
  const router = useRouter();
  const team = useCoachStore((s) => s.team);
  const clearTeam = useCoachStore((s) => s.clear);
  const logout = useAuthStore((s) => s.logout);
  const [copied, setCopied] = useState(false);
  const { permission, isSubscribed, isLoading, requestPermission, unsubscribe } = usePushNotifications();

  useEffect(() => {
    if (!team) router.replace("/coach/acces");
  }, [team, router]);

  function handleChangeTeam() {
    clearTeam();
    logout();
    router.replace("/coach/acces");
  }

  function handleLogout() {
    clearTeam();
    logout();
    router.replace("/coach/acces");
  }

  async function handleCopyCode() {
    // The access code isn't stored client-side for security, so we share the team page URL instead
    const url = window.location.origin + `/coach`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!team) return null;

  return (
    <div className="p-4 space-y-4 pb-safe">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-primary" />
        <h1 className="text-xl font-bold">Réglages</h1>
      </div>

      {/* Team info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mon équipe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <TeamAvatar name={team.name} logo={team.logo} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-lg truncate">{team.name}</p>
              {team.short_name && (
                <p className="text-sm text-muted-foreground">
                  {team.short_name}
                </p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tournoi :</span>
              <span className="font-medium">{team.tournament.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Catégorie :</span>
              <span className="font-medium">{team.category.name}</span>
            </div>
          </div>

          <Separator />

          {/* Share team link */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopyCode}
            >
              {copied ? (
                <Check className="size-4 mr-1.5 text-green-500" />
              ) : (
                <Copy className="size-4 mr-1.5" />
              )}
              {copied ? "Copié !" : "Copier le lien"}
            </Button>
            <ShareButton
              title={team.name}
              text={`Suivez ${team.name} sur Kickoff !`}
              variant="outline"
              size="sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Apparence</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* Push notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recevez une alerte quand votre match commence ou se termine.
          </p>
          {permission === "denied" ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive font-medium">
                Notifications bloquées
              </p>
              <p className="text-xs text-destructive/80">
                Autorisez les notifications dans les paramètres de votre navigateur.
              </p>
            </div>
          ) : isSubscribed ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={unsubscribe}
              disabled={isLoading}
            >
              <BellOff className="size-4 mr-2" />
              Désactiver les notifications
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={requestPermission}
              disabled={isLoading}
            >
              <Bell className="size-4 mr-2" />
              Activer les notifications
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Change team */}
      <Card>
        <CardContent className="py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleChangeTeam}
          >
            <RefreshCw className="size-4 mr-2" />
            Changer d&apos;équipe
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Rejoindre une autre équipe avec un nouveau code.
          </p>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardContent className="py-4">
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="size-4 mr-2" />
            Se déconnecter
          </Button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Vous devrez entrer à nouveau votre code d&apos;accès.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
