"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  className,
}: SwitchProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        id={id}
        role="switch"
        type="button"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
