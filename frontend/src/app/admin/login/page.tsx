"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/use-auth";

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
    <div className="flex items-center justify-center min-h-full px-4 pb-safe">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold">Kickoff</h1>
          <p className="text-sm text-muted-foreground">
            Espace organisateur
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nom d&apos;utilisateur</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="h-11 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive text-center">
                    Identifiants incorrects. Veuillez réessayer.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={login.isPending}
              >
                {login.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Se connecter"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
