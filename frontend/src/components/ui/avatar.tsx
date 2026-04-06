import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({
  src,
  alt = "",
  fallback,
  size = "md",
  className,
  ...props
}: AvatarProps) {
  const initials = fallback ? getInitials(fallback) : "?";

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-semibold text-primary",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={alt || fallback || ""}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
