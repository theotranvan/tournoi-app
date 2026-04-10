"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-yellow-500 text-xs font-semibold",
        className,
      )}
    >
      🏆 Pro
    </span>
  );
}

export function ProFeatureButton({
  children,
  className,
  variant = "outline",
  size = "sm",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "lg" | "icon-sm";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("text-yellow-600 dark:text-yellow-400 hover:text-yellow-700", className)}
        onClick={() => setOpen(true)}
      >
        {children}
        <ProBadge className="ml-1.5" />
      </Button>
      <ProUpgradeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProUpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex justify-center mb-3">
            <div className="size-16 rounded-full bg-yellow-100 dark:bg-yellow-950/30 flex items-center justify-center">
              <Crown className="size-8 text-yellow-500" />
            </div>
          </div>
          <DialogTitle className="text-lg">Fonctionnalité Pro</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cette fonctionnalité est réservée aux abonnés Pro. Passez au forfait
          supérieur pour en profiter.
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => {
              onOpenChange(false);
              router.push("/pricing");
            }}
            className="w-full"
          >
            <Crown className="size-4 mr-1.5" />
            Voir les forfaits
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Plus tard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
