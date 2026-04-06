"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, LogOut, User, Palette } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuthStore } from "@/stores/auth-store";

export default function AdminParametres() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.replace("/admin/login");
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-safe">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Paramètres</h1>
          <p className="text-sm text-muted-foreground">
            Configuration de votre espace organisateur
          </p>
        </div>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <CardTitle>Profil</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Utilisateur</span>
                <span className="font-medium">{user.username}</span>
              </div>
              {user.email && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{user.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Rôle</span>
                <span className="font-medium capitalize">{user.role}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Informations de profil non disponibles.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <CardTitle>Apparence</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choisissez le thème de l&apos;interface.
          </p>
          <ThemeToggle />
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
            Vous serez redirigé vers la page de connexion.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
