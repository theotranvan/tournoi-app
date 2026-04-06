"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore } from "@/stores/theme-store";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light" as const, icon: Sun, label: "Clair" },
  { value: "dark" as const, icon: Moon, label: "Sombre" },
  { value: "system" as const, icon: Monitor, label: "Système" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useThemeStore();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted p-1",
        className
      )}
    >
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            theme === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={label}
        >
          <Icon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
