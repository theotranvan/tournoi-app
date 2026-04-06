"use client";

import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw } from "lucide-react";

export default function Offline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 text-center">
      <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Hors connexion</h1>
      <p className="text-muted-foreground max-w-sm mb-6">
        Vous êtes actuellement hors ligne. Vérifiez votre connexion internet et
        réessayez.
      </p>
      <Button onClick={() => window.location.reload()} className="gap-2">
        <RefreshCw className="size-4" />
        Réessayer
      </Button>
    </div>
  );
}
