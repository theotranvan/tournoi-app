"use client";

import { cn } from "@/lib/utils";

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}

export function DropdownMenu({
  open,
  onClose,
  children,
  className,
  align = "right",
}: DropdownMenuProps) {
  if (!open) return null;

  return (
    <>
      {/* Invisible backdrop to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className={cn(
          "absolute z-50 mt-1 min-w-[160px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95",
          align === "right" ? "right-0" : "left-0",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  destructive?: boolean;
}

export function DropdownItem({
  children,
  className,
  destructive = false,
  ...props
}: DropdownItemProps) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-popover-foreground hover:bg-accent",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
