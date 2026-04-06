"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamAvatar } from "@/components/kickoff/team-avatar";
import { Trophy, ChevronDown, ChevronRight } from "lucide-react";
import { useCoachStore } from "@/stores/coach-store";
import { useCategoryStandings } from "@/hooks/use-standings";
import { useGroups } from "@/hooks/use-groups";
import type { TeamStanding } from "@/types/api";

const FORM_COLOR: Record<string, string> = {
  W: "bg-green-500",
  D: "bg-amber-500",
  L: "bg-red-500",
};

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function StandingsTable({
  standings,
  highlightTeamId,
}: {
  standings: TeamStanding[];
  highlightTeamId: number;
}) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase text-muted-foreground border-b">
            <th className="text-left py-2 pr-1 w-7">#</th>
            <th className="text-left py-2">Équipe</th>
            <th className="text-center py-2 w-8">MJ</th>
            <th className="text-center py-2 w-8">V</th>
            <th className="text-center py-2 w-8">N</th>
            <th className="text-center py-2 w-8">D</th>
            <th className="text-center py-2 w-10">Diff</th>
            <th className="text-center py-2 w-8 font-bold">Pts</th>
            <th className="text-center py-2 w-16">Forme</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => {
            const isMe = s.team_id === highlightTeamId;
            const medal = MEDALS[s.rank];
            return (
              <tr
                key={s.team_id}
                className={
                  isMe
                    ? "bg-primary/10 font-semibold"
                    : "border-b border-border/40"
                }
              >
                <td className="py-2 pr-1">
                  {medal ? <span className="text-sm">{medal}</span> : <span className="text-muted-foreground tabular-nums">{s.rank}</span>}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-1.5">
                    <TeamAvatar name={s.team_name} size="sm" />
                    <span className="truncate max-w-[100px]">{s.team_name}</span>
                  </div>
                </td>
                <td className="text-center py-2 tabular-nums">{s.played}</td>
                <td className="text-center py-2 tabular-nums">{s.won}</td>
                <td className="text-center py-2 tabular-nums">{s.drawn}</td>
                <td className="text-center py-2 tabular-nums">{s.lost}</td>
                <td className="text-center py-2 tabular-nums">
                  {s.goal_difference > 0
                    ? `+${s.goal_difference}`
                    : s.goal_difference}
                </td>
                <td className="text-center py-2 font-bold tabular-nums text-primary">{s.points}</td>
                <td className="py-2">
                  <div className="flex justify-center gap-0.5">
                    {s.form.slice(-5).map((f, i) => (
                      <span
                        key={i}
                        className={`size-3.5 rounded-full ${FORM_COLOR[f]} inline-flex items-center justify-center text-[8px] font-bold text-white`}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CollapsibleGroup({
  name,
  standings,
  teamId,
  defaultOpen,
}: {
  name: string;
  standings: TeamStanding[];
  teamId: number;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="pb-2 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{name}</CardTitle>
          {open ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pb-3">
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun classement disponible.
            </p>
          ) : (
            <StandingsTable standings={standings} highlightTeamId={teamId} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function CoachClassements() {
  const router = useRouter();
  const team = useCoachStore((s) => s.team);

  useEffect(() => {
    if (!team) router.replace("/coach/acces");
  }, [team, router]);

  const tournamentId = team?.tournament.id ?? "";
  const categoryId = team?.category.id ?? 0;
  const { data, isLoading } = useCategoryStandings(categoryId);
  const { data: groups } = useGroups(tournamentId, categoryId);

  if (!team) return null;

  // Find which group the team belongs to
  const myGroupId = groups?.find((g) =>
    g.teams.some((t) => t.id === team.id)
  )?.id;

  return (
    <div className="p-4 space-y-4 pb-safe">
      <div className="flex items-center gap-2">
        <Trophy className="size-5 text-primary" />
        <h1 className="text-xl font-bold">Classements</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      ) : data && data.groups && data.groups.length > 0 ? (
        <div className="space-y-3">
          {/* My group first, always open */}
          {data.groups
            .sort((a, b) => {
              const aIsMine = a.group.id === myGroupId ? -1 : 1;
              const bIsMine = b.group.id === myGroupId ? -1 : 1;
              return aIsMine - bIsMine;
            })
            .map((g) => (
              <CollapsibleGroup
                key={g.group.id}
                name={g.group.name}
                standings={g.standings}
                teamId={team.id}
                defaultOpen={g.group.id === myGroupId}
              />
            ))}
        </div>
      ) : (
        <EmptyState
          icon={Trophy}
          title="Classements non disponibles"
          description="Les classements apparaîtront une fois les matchs commencés."
        />
      )}
    </div>
  );
}
