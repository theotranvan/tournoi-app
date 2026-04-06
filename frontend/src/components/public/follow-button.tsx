"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollowedTeamsStore } from "@/stores/followed-teams-store";
import { cn } from "@/lib/utils";

export function FollowButton({
  teamId,
  className,
}: {
  teamId: number;
  className?: string;
}) {
  const { teamIds, toggle } = useFollowedTeamsStore();
  const isFollowed = teamIds.has(teamId);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "size-8 shrink-0",
        isFollowed && "text-yellow-500",
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(teamId);
      }}
      aria-label={isFollowed ? "Ne plus suivre" : "Suivre cette équipe"}
    >
      <Star
        className={cn(
          "size-4 transition-all",
          isFollowed && "fill-yellow-500"
        )}
      />
    </Button>
  );
}
