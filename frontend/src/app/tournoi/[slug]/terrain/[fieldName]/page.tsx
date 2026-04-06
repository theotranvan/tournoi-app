"use client";

import { use, useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { usePublicTournament, usePublicLive, usePublicMatches } from "@/hooks/use-public";
import { useTournamentSocket } from "@/hooks/use-tournament-socket";
import { useLiveStore } from "@/stores/live-store";
import { Maximize, Minimize } from "lucide-react";
import type { MatchList } from "@/types/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="font-mono text-3xl font-bold tabular-nums">
      {now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}

function BigMatchCard({ match }: { match: MatchList }) {
  const storeScore = useLiveStore((s) => s.scores[match.id]);
  const home = storeScore?.home ?? match.score_home ?? 0;
  const away = storeScore?.away ?? match.score_away ?? 0;
  const isLive = match.status === "live";
  const scoreKey = `${match.id}-${home}-${away}`;

  return (
    <motion.div
      layout
      className={`rounded-2xl p-8 ${
        isLive
          ? "bg-red-500/10 ring-2 ring-red-500/30"
          : "bg-card ring-1 ring-border"
      }`}
    >
      {isLive && (
        <div className="flex justify-center mb-4">
          <LiveIndicator size="lg" />
        </div>
      )}
      {!isLive && match.status === "scheduled" && (
        <div className="text-center mb-4 text-lg text-muted-foreground">
          {formatTime(match.start_time)}
        </div>
      )}

      <div className="flex items-center justify-center gap-8">
        {/* Home */}
        <div className="flex flex-col items-center gap-3 flex-1">
          <TeamAvatar name={match.display_home || "?"} size="xl" />
          <span className="text-xl font-bold text-center truncate max-w-[200px]">
            {match.display_home}
          </span>
        </div>

        {/* Score */}
        <motion.div
          key={scoreKey}
          initial={{ scale: 1 }}
          animate={isLive ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4 shrink-0"
        >
          {isLive || match.status === "finished" ? (
            <>
              <span className="text-7xl font-black tabular-nums">{home}</span>
              <span className="text-4xl font-light text-muted-foreground">–</span>
              <span className="text-7xl font-black tabular-nums">{away}</span>
            </>
          ) : (
            <span className="text-4xl font-light text-muted-foreground">VS</span>
          )}
        </motion.div>

        {/* Away */}
        <div className="flex flex-col items-center gap-3 flex-1">
          <TeamAvatar name={match.display_away || "?"} size="xl" />
          <span className="text-xl font-bold text-center truncate max-w-[200px]">
            {match.display_away}
          </span>
        </div>
      </div>

      {/* Category + field */}
      <div className="text-center mt-4 text-sm text-muted-foreground">
        {match.category_name}
      </div>
    </motion.div>
  );
}

export default function FieldDisplayPage({
  params,
}: {
  params: Promise<{ slug: string; fieldName: string }>;
}) {
  const { slug, fieldName } = use(params);
  const decodedField = decodeURIComponent(fieldName);
  const { data: tournament } = usePublicTournament(slug);
  const { data: liveData } = usePublicLive(slug);
  const { data: allMatches } = usePublicMatches(slug);

  useTournamentSocket(slug);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const fieldMatches = useMemo(() => {
    const all = [
      ...(liveData?.live_matches ?? []),
      ...(liveData?.upcoming_matches ?? []),
      ...(allMatches ?? []),
    ];
    // Deduplicate
    const seen = new Set<string>();
    const unique: MatchList[] = [];
    for (const m of all) {
      if (!seen.has(m.id) && m.field_name === decodedField) {
        seen.add(m.id);
        unique.push(m);
      }
    }
    return unique.sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [liveData, allMatches, decodedField]);

  const currentMatch = fieldMatches.find((m) => m.status === "live");
  const nextMatches = fieldMatches
    .filter((m) => m.status === "scheduled")
    .slice(0, 3);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black">{decodedField}</h1>
          <p className="text-lg text-muted-foreground">
            {tournament?.name ?? "Tournoi"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {isFullscreen ? (
              <Minimize className="size-6" />
            ) : (
              <Maximize className="size-6" />
            )}
          </button>
        </div>
      </div>

      {/* Current match — big */}
      {currentMatch ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-3xl">
            <BigMatchCard match={currentMatch} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl text-muted-foreground">
            Aucun match en cours
          </p>
        </div>
      )}

      {/* Upcoming */}
      {nextMatches.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3 text-muted-foreground">
            Prochains matchs
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnimatePresence mode="popLayout">
              {nextMatches.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-card ring-1 ring-border p-4"
                >
                  <div className="text-center text-sm text-muted-foreground mb-2">
                    {formatTime(m.start_time)} • {m.category_name}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate flex-1 text-right">
                      {m.display_home}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">VS</span>
                    <span className="text-sm font-medium truncate flex-1">
                      {m.display_away}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
