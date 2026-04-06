"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import Link from "next/link";

function getContextualHelp(pathname: string, message: string): { title: string; hint: string; backHref: string; backLabel: string } {
  const lower = message.toLowerCase();
  const isAuth = lower.includes("token") || lower.includes("401") || lower.includes("403") || lower.includes("authentif");
  if (isAuth) {
    return {
      title: "Session expirée",
      hint: "Votre session a expiré. Reconnectez-vous pour continuer.",
      backHref: "/admin/login",
      backLabel: "Se reconnecter",
    };
  }

  if (pathname.includes("/tournois/") && pathname.split("/").length >= 4) {
    return {
      title: "Erreur de chargement",
      hint: "Vérifiez que le tournoi existe et que vous avez les droits d'accès. Si le problème persiste, retournez à la liste des tournois.",
      backHref: "/admin/tournois",
      backLabel: "Retour aux tournois",
    };
  }

  if (pathname.includes("/admin/")) {
    return {
      title: "Erreur de chargement",
      hint: "Une erreur est survenue. Essayez de rafraîchir la page ou retournez au tableau de bord.",
      backHref: "/admin/tournois",
      backLabel: "Tableau de bord",
    };
  }

  if (pathname.includes("/coach/")) {
    return {
      title: "Erreur de chargement",
      hint: "Vérifiez que votre code d'accès est toujours valide ou reconnectez-vous.",
      backHref: "/coach/acces",
      backLabel: "Retour accès coach",
    };
  }

  return {
    title: "Quelque chose s'est mal passé",
    hint: "Une erreur est survenue lors du chargement de cette page.",
    backHref: "/",
    backLabel: "Accueil",
  };
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[Error Boundary]", error);
  }, [error]);

  const ctx = useMemo(() => getContextualHelp(pathname, error.message), [pathname, error.message]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="size-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="size-8 text-red-500" />
      </div>
      <h2 className="text-xl font-bold mb-2">{ctx.title}</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        {ctx.hint}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground mb-4 font-mono">
          Réf : {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} variant="default" className="gap-2">
          <RefreshCw className="size-4" />
          Réessayer
        </Button>
        <Link href={ctx.backHref}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            {ctx.backLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}
