"use client";

import { useState, useCallback, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 60;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!pulling || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.5, threshold * 1.5));
      }
    },
    [pulling, refreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling) return;
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pulling, pullDistance, refreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200"
        style={{ height: pulling || refreshing ? Math.max(pullDistance, refreshing ? 40 : 0) : 0 }}
      >
        <Loader2
          className={cn(
            "size-5 text-primary transition-transform",
            refreshing && "animate-spin",
            !refreshing && pullDistance >= threshold && "text-primary scale-110"
          )}
          style={{
            transform: !refreshing ? `rotate(${pullDistance * 3}deg)` : undefined,
          }}
        />
      </div>
      {children}
    </div>
  );
}
