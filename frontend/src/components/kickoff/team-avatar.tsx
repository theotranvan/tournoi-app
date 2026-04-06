import { cn } from "@/lib/utils";

interface TeamAvatarProps {
  name: string;
  logo?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "size-8 text-[10px]",
  md: "size-10 text-xs",
  lg: "size-12 text-sm",
  xl: "size-16 text-lg",
};

// Deterministic color from team name
const colors = [
  "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",
  "bg-pink-500/20 text-pink-400",
  "bg-amber-500/20 text-amber-400",
  "bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400",
  "bg-green-500/20 text-green-400",
  "bg-indigo-500/20 text-indigo-400",
  "bg-orange-500/20 text-orange-400",
  "bg-cyan-500/20 text-cyan-400",
];

function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeamAvatar({ name, logo, size = "md", className }: TeamAvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden flex items-center justify-center font-bold",
        sizeClasses[size],
        !logo && hashColor(name),
        className
      )}
    >
      {logo ? (
        <img
          src={logo}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}
