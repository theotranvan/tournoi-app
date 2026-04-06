"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type CategoryAge = "U8" | "U10" | "U11" | "U13" | "U15" | "Senior";

const categoryColors: Record<CategoryAge, string> = {
  U8: "bg-cat-u8/20 text-blue-400 border-cat-u8/40",
  U10: "bg-cat-u10/20 text-violet-400 border-cat-u10/40",
  U11: "bg-cat-u11/20 text-pink-400 border-cat-u11/40",
  U13: "bg-cat-u13/20 text-yellow-400 border-cat-u13/40",
  U15: "bg-cat-u15/20 text-teal-400 border-cat-u15/40",
  Senior: "bg-cat-senior/20 text-red-400 border-cat-senior/40",
};

interface CategoryBadgeProps {
  category: CategoryAge | string;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const colorClass =
    categoryColors[category as CategoryAge] ??
    "bg-muted text-muted-foreground border-border";

  return (
    <Badge
      variant="outline"
      className={cn("text-[0.65rem] font-semibold uppercase", colorClass, className)}
    >
      {category}
    </Badge>
  );
}

export type { CategoryAge };
