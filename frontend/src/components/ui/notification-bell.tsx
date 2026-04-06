"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/api";

const TYPE_ICON: Record<NotificationType, string> = {
  match_started: "🟢",
  match_finished: "🏁",
  score_updated: "⚽",
  planning_generated: "📋",
  field_change: "🏟️",
  tournament_published: "📢",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: countData } = useUnreadCount();
  const { data: notifications } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const count = countData?.count ?? 0;

  function handleClick(n: Notification) {
    if (!n.is_read) {
      markRead.mutate(n.id);
    }
    if (n.link) {
      router.push(n.link);
      setOpen(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(!open)}
        className="relative"
        aria-label={`Notifications${count > 0 ? ` (${count} non lues)` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive text-[10px] font-bold text-white flex items-center justify-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
            role="region"
            aria-label="Notifications"
            onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-semibold">Notifications</span>
              {count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => markAllRead.mutate()}
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  Tout lire
                </Button>
              )}
            </div>

            {!notifications || notifications.length === 0 ? (
              <div className="py-8 text-center">
                <Bell className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune notification
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 20).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors flex gap-2.5",
                      !n.is_read && "bg-primary/5"
                    )}
                  >
                    <span className="text-base shrink-0 mt-0.5">
                      {TYPE_ICON[n.type] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm truncate",
                          !n.is_read && "font-semibold"
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground truncate">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="size-2 rounded-full bg-primary shrink-0 mt-2" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
