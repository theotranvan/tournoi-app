"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  title: string;
  text?: string;
  url?: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon-sm";
}

export function ShareButton({
  title,
  text,
  url,
  className,
  variant = "ghost",
  size = "icon-sm",
}: ShareButtonProps) {
  async function handleShare() {
    const shareUrl = url ?? window.location.href;
    const shareData = { title, text, url: shareUrl };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: copy link
      await navigator.clipboard.writeText(shareUrl);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn(className)}
      title="Partager"
    >
      <Share2 className="size-4" />
    </Button>
  );
}
