import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeClasses = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

export function LiveIndicator({
  className,
  size = "md",
  label = "En direct",
}: LiveIndicatorProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="status"
      aria-live="polite"
      aria-label={label || "En direct"}
    >
      <span className="relative flex" aria-hidden="true">
        <span
          className={cn(
            "absolute inline-flex rounded-full bg-red-500 opacity-75 animate-ping",
            sizeClasses[size]
          )}
        />
        <span
          className={cn("relative inline-flex rounded-full bg-red-500", sizeClasses[size])}
        />
      </span>
      {label && <span className="text-xs font-medium text-red-400">{label}</span>}
    </span>
  );
}
