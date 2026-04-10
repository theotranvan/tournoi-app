"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Smart back button that uses browser history when available,
 * and falls back to a default href when there's no history.
 */
export function BackButton({
  fallbackHref = "/start",
  className = "",
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className={`flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <ArrowLeft className="size-4" />
      Retour
    </button>
  );
}
