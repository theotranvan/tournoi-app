import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "danger";
}

const heightClasses = { sm: "h-1", md: "h-2", lg: "h-3" };

const barColorClasses = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function Progress({
  value,
  size = "md",
  variant = "default",
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        heightClasses[size],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          barColorClasses[variant]
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
