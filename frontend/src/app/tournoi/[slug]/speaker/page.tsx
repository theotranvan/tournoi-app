"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Mic2,
  MapPin,
  Clock,
  Trophy,
  Maximize,
  Minimize,
  ArrowLeft,
} from "lucide-react";
import { usePublicTournament, usePublicLive } from "@/hooks/use-public";
import { motion, AnimatePresence } from "framer-motion";
import type { MatchList } from "@/types/api";

function matchMinute(startTime: string) {
  const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 60000);
  return Math.max(0, diff);
}

function ScoreCard({ match, large }: { match: MatchList; large?: boolean }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`rounded-2xl border-2 p-4 ${large ? "p-6" : ""} ${
        isLive
          ? "border-red-500 bg-red-50 dark:bg-red-950/30"
          : isFinished
            ? "border-green-500 bg-green-50 dark:bg-green-950/30"
            : "border-border bg-card"
      }`}
    >
      {/* Match metadata */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge
            variant={isLive ? "destructive" : isFinished ? "default" : "secondary"}
            className={isLive ? "animate-pulse" : ""}
          >
            {isLive ? `⏱ ${matchMinute(match.start_time)}'` : isFinished ? "Terminé" : formatTime(match.start_time)}
          </Badge>
          <span className={`font-medium ${large ? "text-lg" : "text-sm"}`}>
            {match.category_name}
          </span>
        </div>
        {match.field_name && (
          <span className={`flex items-center gap-1 text-muted-foreground ${large ? "text-base" : "text-xs"}`}>
            <MapPin className="size-3" />
            {match.field_name}
          </span>
        )}
      </div>

      {/* Score display */}
      <div className="flex items-center justify-between">
        <span
          className={`font-bold text-right flex-1 truncate ${
            large ? "text-3xl" : "text-xl"
          }`}
        >
          {match.display_home}
        </span>

        <div className={`mx-4 flex items-center gap-2 ${large ? "text-5xl" : "text-3xl"} font-black`}>
          <span>{match.score_home ?? "–"}</span>
          <span className="text-muted-foreground text-lg">:</span>
          <span>{match.score_away ?? "–"}</span>
        </div>

        <span
          className={`font-bold flex-1 truncate ${
            large ? "text-3xl" : "text-xl"
          }`}
        >
          {match.display_away}
        </span>
      </div>
    </motion.div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="tabular-nums font-mono text-5xl font-bold">
      {now.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}

export default function SpeakerPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = use(props.params);
  const router = useRouter();
  const { data: tournament } = usePublicTournament(slug);
  const { data: live } = usePublicLive(slug);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const liveMatches = live?.live_matches ?? [];
  const upcomingMatches = live?.upcoming_matches?.slice(0, 4) ?? [];
  const recentResults = live?.recent_results?.slice(0, 4) ?? [];

  // Determine next match
  const nextMatch = upcomingMatches[0] ?? null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white flex flex-col">
      {/* Header - compact */}
      <header className="flex items-center justify-between px-6 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl lg:text-3xl font-black truncate">
            {tournament?.name ?? "Chargement..."}
          </h1>
          {tournament && (
            <span className="text-blue-200/60 text-sm flex items-center gap-1 hidden lg:flex">
              <MapPin className="size-3" />
              {tournament.location}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <LiveClock />
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Retour"
          >
            <ArrowLeft className="size-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
        </div>
      </header>

      {/* Main content grid - fills remaining space */}
      <div className="flex-1 grid grid-cols-3 grid-rows-1 gap-4 px-6 pb-4 min-h-0">
        {/* Left column: Live matches */}
        <section className="flex flex-col min-h-0">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3 shrink-0">
            <Mic2 className="size-4 text-red-400" />
            <span className="text-red-400">EN DIRECT</span>
            {liveMatches.length > 0 && (
              <span className="relative flex size-2.5 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-red-500" />
              </span>
            )}
          </h2>
          <div className="flex-1 overflow-hidden space-y-3">
            {liveMatches.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/30 text-sm">Aucun match en cours</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {liveMatches.slice(0, 4).map((m) => (
                  <ScoreCard key={m.id} match={m} large />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Center column: Next match spotlight + upcoming */}
        <section className="flex flex-col min-h-0">
          {nextMatch && (
            <div className="mb-4 shrink-0">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-amber-300">
                <Clock className="size-4" />
                PROCHAIN MATCH
              </h2>
              <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-950/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="bg-amber-600 text-white border-0">
                    {formatTime(nextMatch.start_time)}
                  </Badge>
                  <span className="text-sm text-amber-200">{nextMatch.category_name}</span>
                  {nextMatch.field_name && (
                    <span className="text-xs text-amber-300/60 flex items-center gap-1">
                      <MapPin className="size-3" />
                      {nextMatch.field_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-center">
                  <span className="text-xl font-bold flex-1 truncate text-right">
                    {nextMatch.display_home}
                  </span>
                  <span className="text-2xl font-black mx-3 text-amber-300">VS</span>
                  <span className="text-xl font-bold flex-1 truncate text-left">
                    {nextMatch.display_away}
                  </span>
                </div>
              </div>
            </div>
          )}

          <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-blue-300 shrink-0">
            <Clock className="size-4" />
            A VENIR
          </h2>
          <div className="flex-1 overflow-hidden space-y-2">
            {upcomingMatches.slice(nextMatch ? 1 : 0, 5).length === 0 ? (
              <p className="text-blue-300/40 text-sm">Aucun match a venir</p>
            ) : (
              <AnimatePresence mode="popLayout">
                {upcomingMatches.slice(nextMatch ? 1 : 0, 5).map((m) => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between rounded-xl bg-white/5 backdrop-blur px-3 py-2"
                  >
                    <Badge variant="secondary" className="bg-blue-600 text-white border-0 text-xs">
                      {formatTime(m.start_time)}
                    </Badge>
                    <span className="text-xs text-blue-200">{m.category_name}</span>
                    <span className="font-medium text-sm truncate max-w-[40%] text-center">
                      {m.display_home} vs {m.display_away}
                    </span>
                    <span className="text-xs text-blue-300/60">{m.field_name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Right column: Recent results */}
        <section className="flex flex-col min-h-0">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3 text-green-300 shrink-0">
            <Trophy className="size-4" />
            DERNIERS RESULTATS
          </h2>
          <div className="flex-1 overflow-hidden space-y-3">
            {recentResults.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-white/30 text-sm">Pas encore de resultats</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {recentResults.map((m) => (
                  <ScoreCard key={m.id} match={m} />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>
      </div>

      {/* Footer - minimal */}
      <footer className="text-center text-[10px] text-blue-300/30 py-1 shrink-0">
        Footix
      </footer>
    </div>
  );
}
