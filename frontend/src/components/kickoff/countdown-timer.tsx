"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  kickoffTime: string | Date;
  className?: string;
}

function getTimeRemaining(target: Date): {
  label: string;
  isPast: boolean;
} {
  const now = new Date();
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) {
    return { label: "maintenant", isPast: true };
  }

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return { label: `dans ${days}j ${hours % 24}h`, isPast: false };
  }
  if (hours > 0) {
    return { label: `dans ${hours}h${String(minutes % 60).padStart(2, "0")}`, isPast: false };
  }
  return { label: `dans ${minutes} min`, isPast: false };
}

export function CountdownTimer({ kickoffTime, className }: CountdownTimerProps) {
  const target = useMemo(
    () => (kickoffTime instanceof Date ? kickoffTime : new Date(kickoffTime)),
    [kickoffTime]
  );
  const [remaining, setRemaining] = useState(() => getTimeRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(target));
    }, 30_000);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        remaining.isPast && "text-live font-medium",
        className
      )}
    >
      <Clock className="size-3" />
      {remaining.label}
    </span>
  );
}
