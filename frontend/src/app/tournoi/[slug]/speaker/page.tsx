"use client";

import { use, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Mic2,
  MapPin,
  Clock,
  Trophy,
  Maximize,
  Minimize,
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
  const upcomingMatches = live?.upcoming_matches?.slice(0, 6) ?? [];
  const recentResults = live?.recent_results?.slice(0, 4) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 lg:p-10">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black">
            {tournament?.name ?? "Chargement…"}
          </h1>
          {tournament && (
            <p className="text-blue-200 flex items-center gap-2 mt-1">
              <MapPin className="size-4" />
              {tournament.location}
            </p>
          )}
        </div>

        <div className="flex items-center gap-6">
          <LiveClock />
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? <Minimize className="size-6" /> : <Maximize className="size-6" />}
          </button>
        </div>
      </header>

      {/* Live matches */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Mic2 className="size-5 text-red-400" />
            <span className="text-red-400">EN DIRECT</span>
            <span className="relative flex size-3 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-red-500" />
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {liveMatches.map((m) => (
                <ScoreCard key={m.id} match={m} large />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Upcoming */}
        <section>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-blue-300">
            <Clock className="size-5" />
            À VENIR
          </h2>
          {upcomingMatches.length === 0 ? (
            <p className="text-blue-300/60">Aucun match à venir</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {upcomingMatches.map((m) => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center justify-between rounded-xl bg-white/5 backdrop-blur p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="bg-blue-600 text-white border-0">
                        {formatTime(m.start_time)}
                      </Badge>
                      <span className="text-sm text-blue-200">{m.category_name}</span>
                    </div>
                    <div className="text-center font-medium">
                      {m.display_home}
                      <span className="text-muted-foreground mx-2">vs</span>
                      {m.display_away}
                    </div>
                    <span className="text-xs text-blue-300/60">{m.field_name}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Recent results */}
        <section>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-green-300">
            <Trophy className="size-5" />
            DERNIERS RÉSULTATS
          </h2>
          {recentResults.length === 0 ? (
            <p className="text-green-300/60">Pas encore de résultats</p>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {recentResults.map((m) => (
                  <ScoreCard key={m.id} match={m} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="mt-10 text-center text-xs text-blue-300/40">
        Propulsé par Kickoff · Se rafraîchit automatiquement
      </footer>
    </div>
  );
}
