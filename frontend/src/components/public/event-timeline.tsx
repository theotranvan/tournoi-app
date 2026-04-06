"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventTimelineStore, type TimelineEvent } from "@/stores/event-timeline-store";
import { Newspaper } from "lucide-react";

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽",
  match_started: "▶️",
  match_finished: "🏁",
  score_updated: "📊",
};

function EventRow({ event }: { event: TimelineEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="flex gap-2.5 py-1.5 border-b border-border/30 last:border-0"
    >
      <span className="text-base shrink-0">{EVENT_ICONS[event.type] ?? "📢"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{event.description}</p>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 pt-0.5">
        {formatEventTime(event.timestamp)}
      </span>
    </motion.div>
  );
}

export function EventTimeline() {
  const events = useEventTimelineStore((s) => s.events);

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Newspaper className="size-4 text-primary" />
          Journal du tournoi
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
