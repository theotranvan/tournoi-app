"use client";

import { useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { CategoryStandings, TeamStanding } from "@/types/api";

/* ── Small helpers ───────────────────────────────── */

function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  if (!form || form.length === 0) return null;
  const colors = { W: "bg-green-500", D: "bg-amber-500", L: "bg-red-500" };
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span key={i} className={`size-2 rounded-full ${colors[r]}`} />
      ))}
    </div>
  );
}

/* ── Single row ──────────────────────────────────── */

function StandingRow({
  s,
  slug,
  rankChange,
}: {
  s: TeamStanding;
  slug: string;
  rankChange: number;
}) {
  const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

  return (
    <motion.tr
      layout
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="border-b border-border/50 last:border-0"
    >
      <td className="py-2 pl-2 pr-1 text-center w-8">
        {medals[s.rank] ?? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {s.rank}
          </span>
        )}
      </td>
      <td className="py-2 px-1">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/tournoi/${slug}/equipe/${s.team_id}`}
            className="text-sm font-medium truncate hover:underline"
          >
            {s.team_name}
          </Link>
          {/* Rank change arrow */}
          <AnimatePresence>
            {rankChange > 0 && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-green-500"
              >
                <ArrowUp className="size-3" />
              </motion.span>
            )}
            {rankChange < 0 && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-red-500"
              >
                <ArrowDown className="size-3" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </td>
      <td className="py-2 px-1 text-center text-xs tabular-nums text-muted-foreground">
        {s.played}
      </td>
      <td className="py-2 px-1 text-center text-xs tabular-nums font-semibold">
        {s.points}
      </td>
      <td className="py-2 px-1 text-center text-xs tabular-nums text-muted-foreground">
        {s.goals_for}-{s.goals_against}
      </td>
      <td className="py-2 pr-2">
        <FormDots form={s.form} />
      </td>
    </motion.tr>
  );
}

/* ── Animated standings table ────────────────────── */

export function AnimatedStandings({
  data,
  slug,
  selectedCategory,
}: {
  data: CategoryStandings[];
  slug: string;
  selectedCategory: string;
}) {
  // Track previous ranks for change arrows
  const prevRanks = useRef<Record<string, number>>({});
  const rankChanges = useRef<Record<string, number>>({});

  // Build current rank map & compute changes
  const currentRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of data) {
      for (const g of cat.groups ?? []) {
        for (const s of g.standings) {
          const key = `${cat.category.id}-${g.group.id}-${s.team_id}`;
          map[key] = s.rank;
        }
      }
    }
    return map;
  }, [data]);

  useEffect(() => {
    const changes: Record<string, number> = {};
    for (const [key, rank] of Object.entries(currentRankMap)) {
      const prev = prevRanks.current[key];
      if (prev !== undefined && prev !== rank) {
        // Positive = moved UP (rank decreased)
        changes[key] = prev - rank;
      }
    }
    rankChanges.current = changes;
    prevRanks.current = currentRankMap;

    // Clear arrows after 2 seconds
    if (Object.keys(changes).length > 0) {
      const timer = setTimeout(() => {
        rankChanges.current = {};
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentRankMap]);

  const filtered =
    selectedCategory === "all"
      ? data
      : data.filter((c) => String(c.category.id) === selectedCategory);

  return (
    <div className="space-y-4">
      {filtered.map((cat) => (
        <section key={cat.category.id}>
          <h2 className="text-base font-bold mb-3">{cat.category.name}</h2>
          {(cat.groups ?? []).length === 0 ? (
            <Card className="mb-3">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun groupe créé pour cette catégorie.
                </p>
              </CardContent>
            </Card>
          ) : (
            (cat.groups ?? []).map((g) => (
              <Card key={g.group.id} className="mb-3 overflow-hidden">
                <CardHeader className="pb-1">
                  <CardTitle className="text-sm">{g.group.name}</CardTitle>
                </CardHeader>
                <CardContent className="pb-2 px-0">
                  {g.standings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center">
                      Aucun classement disponible.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-muted-foreground uppercase tracking-wider border-b border-border">
                          <th className="py-1 pl-2 pr-1 text-center w-8">
                            #
                          </th>
                          <th className="py-1 px-1 text-left">Équipe</th>
                          <th className="py-1 px-1 text-center">MJ</th>
                          <th className="py-1 px-1 text-center">Pts</th>
                          <th className="py-1 px-1 text-center">Buts</th>
                          <th className="py-1 pr-2">Forme</th>
                        </tr>
                      </thead>
                      <AnimatePresence>
                        <tbody>
                          {g.standings.map((s) => {
                            const key = `${cat.category.id}-${g.group.id}-${s.team_id}`;
                            return (
                              <StandingRow
                                key={s.team_id}
                                s={s}
                                slug={slug}
                                rankChange={rankChanges.current[key] ?? 0}
                              />
                            );
                          })}
                        </tbody>
                      </AnimatePresence>
                    </table>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      ))}
    </div>
  );
}
