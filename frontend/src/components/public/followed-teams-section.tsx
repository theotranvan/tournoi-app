"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { FollowButton } from "./follow-button";
import { useFollowedTeamsStore } from "@/stores/followed-teams-store";
import { Star, ChevronRight } from "lucide-react";
import type { MatchList } from "@/types/api";

const PHASE_LABEL: Record<string, string> = {
  group: "Poule",
  r16: "8e",
  quarter: "Quart",
  semi: "Demi",
  third: "3e place",
  final: "Finale",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FollowedTeamsSection({
  allMatches,
  slug,
}: {
  allMatches: MatchList[];
  slug: string;
}) {
  const { teamIds } = useFollowedTeamsStore();

  if (teamIds.size === 0) return null;

  // Find upcoming / live matches for followed teams
  const followedMatches = allMatches
    .filter(
      (m) =>
        (m.status === "scheduled" || m.status === "live") &&
        ((m.team_home !== null && teamIds.has(m.team_home)) ||
          (m.team_away !== null && teamIds.has(m.team_away)))
    )
    .sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    )
    .slice(0, 6);

  if (followedMatches.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Star className="size-4 text-yellow-500 fill-yellow-500" />
        <span className="text-sm font-bold">Vos équipes suivies</span>
      </div>
      <div className="space-y-2">
        {followedMatches.map((m) => (
          <Link key={m.id} href={`/tournoi/${slug}/match/${m.id}`}>
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium truncate">
                        {m.display_home}
                      </span>
                      {m.status === "live" ? (
                        <span className="text-xs font-bold text-red-500 tabular-nums">
                          {m.score_home ?? 0} - {m.score_away ?? 0}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">vs</span>
                      )}
                      <span className="font-medium truncate">
                        {m.display_away}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1">
                        {PHASE_LABEL[m.phase] ?? m.phase}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(m.start_time)}
                        {m.field_name && ` • ${m.field_name}`}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
