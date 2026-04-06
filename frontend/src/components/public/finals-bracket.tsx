"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { MatchList, MatchPhase } from "@/types/api";

/* ── Types ───────────────────────────────────────── */

interface BracketMatch {
  id: string;
  phase: MatchPhase;
  homeTeam: string;
  awayTeam: string;
  scoreHome: number | null;
  scoreAway: number | null;
  status: string;
  penaltyHome: number | null;
  penaltyAway: number | null;
}

/* ── Constants ───────────────────────────────────── */

const PHASE_ORDER: MatchPhase[] = ["r16", "quarter", "semi", "final"];
const PHASE_LABELS: Record<string, string> = {
  r16: "8es",
  quarter: "Quarts",
  semi: "Demis",
  third: "3e place",
  final: "Finale",
};

const CARD_WIDTH = 180;
const CARD_HEIGHT = 56;
const ROUND_GAP = 48;
const MATCH_GAP = 16;

/* ── Small match card ────────────────────────────── */

function BracketMatchCard({
  match,
  x,
  y,
}: {
  match: BracketMatch;
  x: number;
  y: number;
}) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";

  const homeWon =
    isFinished &&
    (match.scoreHome ?? 0) > (match.scoreAway ?? 0) ||
    (isFinished && (match.scoreHome ?? 0) === (match.scoreAway ?? 0) && (match.penaltyHome ?? 0) > (match.penaltyAway ?? 0));
  const awayWon =
    isFinished &&
    (match.scoreAway ?? 0) > (match.scoreHome ?? 0) ||
    (isFinished && (match.scoreHome ?? 0) === (match.scoreAway ?? 0) && (match.penaltyAway ?? 0) > (match.penaltyHome ?? 0));

  return (
    <g>
      {/* Card background */}
      <rect
        x={x}
        y={y}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx={6}
        className={`${
          isLive
            ? "fill-red-500/10 stroke-red-500/50"
            : "fill-card stroke-border"
        }`}
        strokeWidth={1}
      />

      {/* Live indicator */}
      {isLive && (
        <circle cx={x + 10} cy={y + CARD_HEIGHT / 2} r={3} className="fill-red-500">
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Divider */}
      <line
        x1={x}
        y1={y + CARD_HEIGHT / 2}
        x2={x + CARD_WIDTH}
        y2={y + CARD_HEIGHT / 2}
        className="stroke-border"
        strokeWidth={0.5}
      />

      {/* Home team */}
      <text
        x={x + (isLive ? 20 : 8)}
        y={y + 18}
        className={`text-[10px] ${homeWon ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}
      >
        {truncate(match.homeTeam, 16)}
      </text>

      {/* Home score */}
      {(isLive || isFinished) && (
        <text
          x={x + CARD_WIDTH - 8}
          y={y + 18}
          textAnchor="end"
          className={`text-[11px] font-bold tabular-nums ${homeWon ? "fill-foreground" : "fill-muted-foreground"}`}
        >
          {match.scoreHome ?? 0}
          {match.penaltyHome != null && ` (${match.penaltyHome})`}
        </text>
      )}

      {/* Away team */}
      <text
        x={x + (isLive ? 20 : 8)}
        y={y + CARD_HEIGHT - 10}
        className={`text-[10px] ${awayWon ? "fill-foreground font-semibold" : "fill-muted-foreground"}`}
      >
        {truncate(match.awayTeam, 16)}
      </text>

      {/* Away score */}
      {(isLive || isFinished) && (
        <text
          x={x + CARD_WIDTH - 8}
          y={y + CARD_HEIGHT - 10}
          textAnchor="end"
          className={`text-[11px] font-bold tabular-nums ${awayWon ? "fill-foreground" : "fill-muted-foreground"}`}
        >
          {match.scoreAway ?? 0}
          {match.penaltyAway != null && ` (${match.penaltyAway})`}
        </text>
      )}
    </g>
  );
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/* ── Connector lines ─────────────────────────────── */

function ConnectorLine({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) {
  const midX = (fromX + toX) / 2;
  return (
    <path
      d={`M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`}
      fill="none"
      className="stroke-border"
      strokeWidth={1}
    />
  );
}

/* ── Main bracket component ──────────────────────── */

export function FinalsBracket({
  matches,
  slug,
}: {
  matches: MatchList[];
  slug: string;
}) {
  const bracketMatches = useMemo(() => {
    return matches
      .filter((m) => m.phase !== "group")
      .map(
        (m): BracketMatch => ({
          id: m.id,
          phase: m.phase,
          homeTeam: m.display_home || "À déterminer",
          awayTeam: m.display_away || "À déterminer",
          scoreHome: m.score_home,
          scoreAway: m.score_away,
          penaltyHome: m.penalty_score_home,
          penaltyAway: m.penalty_score_away,
          status: m.status,
        })
      );
  }, [matches]);

  // Group by phase
  const byPhase = useMemo(() => {
    const map = new Map<MatchPhase, BracketMatch[]>();
    for (const m of bracketMatches) {
      const arr = map.get(m.phase) ?? [];
      arr.push(m);
      map.set(m.phase, arr);
    }
    return map;
  }, [bracketMatches]);

  // Determine which rounds exist
  const rounds = PHASE_ORDER.filter((p) => byPhase.has(p));

  // Also include 3rd place if it exists
  const thirdPlace = byPhase.get("third");

  if (rounds.length === 0 && !thirdPlace) return null;

  // Compute positions
  const maxMatchesInRound = Math.max(
    ...rounds.map((r) => byPhase.get(r)?.length ?? 0)
  );
  const svgHeight = Math.max(
    maxMatchesInRound * (CARD_HEIGHT + MATCH_GAP) + 60,
    250
  );
  const svgWidth =
    rounds.length * (CARD_WIDTH + ROUND_GAP) + 40;

  // Build layout
  type MatchPos = { match: BracketMatch; x: number; y: number };
  const allPositions: MatchPos[] = [];
  const roundPositions: MatchPos[][] = [];

  for (let ri = 0; ri < rounds.length; ri++) {
    const phase = rounds[ri];
    const roundMatches = byPhase.get(phase) ?? [];
    const x = 20 + ri * (CARD_WIDTH + ROUND_GAP);
    const totalHeight =
      roundMatches.length * CARD_HEIGHT +
      (roundMatches.length - 1) * MATCH_GAP;
    const startY = (svgHeight - totalHeight) / 2;

    const positions: MatchPos[] = roundMatches.map((m, mi) => {
      const y = startY + mi * (CARD_HEIGHT + MATCH_GAP);
      return { match: m, x, y };
    });

    roundPositions.push(positions);
    allPositions.push(...positions);
  }

  // Connector lines between rounds
  const connectors: { fromX: number; fromY: number; toX: number; toY: number }[] = [];
  for (let ri = 0; ri < roundPositions.length - 1; ri++) {
    const current = roundPositions[ri];
    const next = roundPositions[ri + 1];
    for (let ni = 0; ni < next.length; ni++) {
      const m1 = current[ni * 2];
      const m2 = current[ni * 2 + 1];
      const target = next[ni];
      if (m1) {
        connectors.push({
          fromX: m1.x + CARD_WIDTH,
          fromY: m1.y + CARD_HEIGHT / 2,
          toX: target.x,
          toY: target.y + CARD_HEIGHT / 4,
        });
      }
      if (m2) {
        connectors.push({
          fromX: m2.x + CARD_WIDTH,
          fromY: m2.y + CARD_HEIGHT / 2,
          toX: target.x,
          toY: target.y + (CARD_HEIGHT * 3) / 4,
        });
      }
    }
  }

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Trophy className="size-4 text-primary" />
          Phases finales
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pb-3">
        {/* Round labels */}
        <div className="flex gap-0 mb-2" style={{ paddingLeft: 20 }}>
          {rounds.map((phase, ri) => (
            <div
              key={phase}
              className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider"
              style={{
                width: CARD_WIDTH,
                marginRight: ROUND_GAP,
              }}
            >
              {PHASE_LABELS[phase] ?? phase}
            </div>
          ))}
        </div>

        {/* SVG bracket */}
        <svg
          width={svgWidth}
          height={svgHeight}
          className="min-w-0"
        >
          {/* Connectors */}
          {connectors.map((c, i) => (
            <ConnectorLine key={i} {...c} />
          ))}

          {/* Match cards */}
          {allPositions.map((p) => (
            <BracketMatchCard
              key={p.match.id}
              match={p.match}
              x={p.x}
              y={p.y}
            />
          ))}
        </svg>

        {/* 3rd place match separately */}
        {thirdPlace && thirdPlace.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
              {PHASE_LABELS.third}
            </p>
            <svg width={CARD_WIDTH + 40} height={CARD_HEIGHT + 20}>
              {thirdPlace.map((m) => (
                <BracketMatchCard
                  key={m.id}
                  match={m}
                  x={20}
                  y={10}
                />
              ))}
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
