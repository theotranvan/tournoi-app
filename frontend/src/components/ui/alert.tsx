import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm flex items-start gap-3",
  {
    variants: {
      variant: {
        default: "bg-muted/50 border-border text-foreground",
        success: "bg-green-500/10 border-green-500/30 text-green-400",
        warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
        destructive: "bg-red-500/10 border-red-500/30 text-red-400",
        info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

const iconMap: Record<string, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  info: Info,
};

interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: LucideIcon;
}

export function Alert({
  className,
  variant = "default",
  icon,
  children,
  ...props
}: AlertProps) {
  const Icon = icon ?? iconMap[variant ?? "default"];
  return (
    <div className={cn(alertVariants({ variant }), className)} role="alert" {...props}>
      <Icon className="size-4 mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
