"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#0a0a0a] text-white">
        <div className="text-center max-w-md">
          <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="size-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Erreur inattendue</h1>
          <p className="text-gray-400 mb-6">
            Une erreur critique s&apos;est produite. Veuillez réessayer.
          </p>
          {error.digest && (
            <p className="text-xs text-gray-500 mb-4 font-mono">
              Réf : {error.digest}
            </p>
          )}
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
        </div>
      </body>
    </html>
  );
}
