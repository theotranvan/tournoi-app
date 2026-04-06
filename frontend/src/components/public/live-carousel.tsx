"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveIndicator } from "@/components/kickoff/live-indicator";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { triggerHaptic } from "@/lib/haptics";
import { useLiveStore } from "@/stores/live-store";
import { Volume2, VolumeX } from "lucide-react";
import type { MatchList } from "@/types/api";

/* ── Sound management ────────────────────────────── */

let audioContext: AudioContext | null = null;

function playDing() {
  try {
    if (!audioContext) audioContext = new AudioContext();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.25
    );
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.25);
  } catch {
    // Silently ignore — sound is nice-to-have
  }
}

/* ── Elapsed time ────────────────────────────────── */

function useElapsedMinutes(startTime: string) {
  const [minutes, setMinutes] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 60000))
  );
  useEffect(() => {
    const iv = setInterval(
      () =>
        setMinutes(
          Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 60000))
        ),
      10_000
    );
    return () => clearInterval(iv);
  }, [startTime]);
  return minutes;
}

/* ── Single live card ────────────────────────────── */

function LiveScoreCard({
  match,
  slug,
  soundEnabled,
}: {
  match: MatchList;
  slug: string;
  soundEnabled: boolean;
}) {
  const storeScore = useLiveStore((s) => s.scores[match.id]);
  const home = storeScore?.home ?? match.score_home ?? 0;
  const away = storeScore?.away ?? match.score_away ?? 0;
  const elapsed = useElapsedMinutes(match.start_time);
  const prevScoreRef = useRef(`${home}-${away}`);

  // On score change → haptic + sound
  useEffect(() => {
    const key = `${home}-${away}`;
    if (prevScoreRef.current !== key) {
      prevScoreRef.current = key;
      triggerHaptic("medium");
      if (soundEnabled) playDing();
    }
  }, [home, away, soundEnabled]);

  const scoreKey = `${match.id}-${home}-${away}`;

  return (
    <Link
      href={`/tournoi/${slug}/match/${match.id}`}
      className="snap-start shrink-0 w-[260px]"
    >
      <motion.div
        key={scoreKey}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 0.4 }}
      >
        <Card className="ring-1 ring-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all">
          <CardContent className="p-3 space-y-1.5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <LiveIndicator size="sm" />
              <span className="text-[10px] text-muted-foreground truncate ml-2">
                {match.category_name} • {match.field_name}
              </span>
            </div>

            {/* Home */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <TeamAvatar name={match.display_home || "?"} size="sm" />
                <span className="text-sm font-medium truncate">
                  {match.display_home}
                </span>
              </div>
              <motion.span
                key={`h-${home}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.35 }}
                className="text-xl font-bold tabular-nums min-w-[24px] text-right"
              >
                {home}
              </motion.span>
            </div>

            {/* Away */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <TeamAvatar name={match.display_away || "?"} size="sm" />
                <span className="text-sm font-medium truncate">
                  {match.display_away}
                </span>
              </div>
              <motion.span
                key={`a-${away}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.35 }}
                className="text-xl font-bold tabular-nums min-w-[24px] text-right"
              >
                {away}
              </motion.span>
            </div>

            {/* Elapsed */}
            <div className="text-center">
              <Badge variant="secondary" className="text-[10px] px-1.5 font-mono">
                {elapsed}&apos;
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}

/* ── Carousel ────────────────────────────────────── */

export function LiveCarousel({
  matches,
  slug,
}: {
  matches: MatchList[];
  slug: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const scores = useLiveStore((s) => s.scores);

  // Auto-scroll to updated match
  const scrollToMatch = useCallback(
    (matchId: string) => {
      if (!scrollRef.current) return;
      const idx = matches.findIndex((m) => m.id === matchId);
      if (idx < 0) return;
      const cardWidth = 260 + 12; // width + gap
      scrollRef.current.scrollTo({
        left: idx * cardWidth - scrollRef.current.clientWidth / 2 + cardWidth / 2,
        behavior: "smooth",
      });
    },
    [matches]
  );

  // Watch for score changes to auto-scroll
  const prevScoresRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(scores);
    if (prevScoresRef.current && prevScoresRef.current !== key) {
      // Find which match changed
      for (const matchId of Object.keys(scores)) {
        scrollToMatch(matchId);
        break; // scroll to the first changed one
      }
    }
    prevScoresRef.current = key;
  }, [scores, scrollToMatch]);

  if (matches.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <span className="relative flex size-2.5">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-bold uppercase tracking-wide text-red-500">
              En direct
            </span>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {matches.length} match{matches.length > 1 ? "s" : ""}
          </Badge>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
        >
          {soundEnabled ? (
            <Volume2 className="size-4" />
          ) : (
            <VolumeX className="size-4" />
          )}
        </button>
      </div>

      <div className="-mx-4 px-4">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
        >
          <AnimatePresence mode="popLayout">
            {matches.map((m) => (
              <LiveScoreCard
                key={m.id}
                match={m}
                slug={slug}
                soundEnabled={soundEnabled}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
