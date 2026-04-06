"use client";

import { cn } from "@/lib/utils";

interface Standing {
  rank: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: ("W" | "D" | "L")[];
}

interface StandingsTableProps {
  standings: Standing[];
  highlightTeam?: string;
  className?: string;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const FORM_COLORS = {
  W: "bg-green-500",
  D: "bg-amber-500",
  L: "bg-red-500",
};

function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
  return (
    <div className="flex gap-0.5 justify-center">
      {form.slice(-5).map((r, i) => (
        <span
          key={i}
          className={cn("size-2 rounded-full", FORM_COLORS[r])}
          title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
        />
      ))}
    </div>
  );
}

export function StandingsTable({
  standings,
  highlightTeam,
  className,
}: StandingsTableProps) {
  const hasForm = standings.some((s) => s.form && s.form.length > 0);

  return (
    <div className={cn("overflow-x-auto", className)} role="region" aria-label="Classement" tabIndex={0}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="py-2 pl-3 pr-1 text-left w-8" aria-label="Rang">#</th>
            <th scope="col" className="py-2 px-2 text-left">Équipe</th>
            <th scope="col" className="py-2 px-1 text-center w-8" aria-label="Matchs joués">MJ</th>
            <th scope="col" className="py-2 px-1 text-center w-8" aria-label="Victoires">V</th>
            <th scope="col" className="py-2 px-1 text-center w-8" aria-label="Nuls">N</th>
            <th scope="col" className="py-2 px-1 text-center w-8" aria-label="Défaites">D</th>
            <th scope="col" className="py-2 px-1 text-center w-10" aria-label="Buts pour">BP</th>
            <th scope="col" className="py-2 px-1 text-center w-10" aria-label="Buts contre">BC</th>
            <th scope="col" className="py-2 px-1 text-center w-10" aria-label="Différence de buts">DB</th>
            <th scope="col" className="py-2 px-2 text-center w-10 font-semibold" aria-label="Points">Pts</th>
            {hasForm && <th scope="col" className="py-2 px-1 text-center w-16" aria-label="Forme récente">Forme</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const isHighlighted = highlightTeam === row.teamName;
            const medal = MEDALS[row.rank];
            return (
              <tr
                key={row.rank}
                className={cn(
                  "border-b border-border/50 transition-colors",
                  isHighlighted && "bg-primary/10 font-medium",
                  row.rank <= 3 && !isHighlighted && "bg-primary/5"
                )}
              >
                <td className="py-2 pl-3 pr-1 tabular-nums">
                  {medal ? <span className="text-sm" role="img" aria-label={`${row.rank}${row.rank === 1 ? 'er' : 'e'}`}>{medal}</span> : row.rank}
                </td>
                <td className="py-2 px-2 truncate max-w-[140px]">
                  {row.teamName}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.played}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.won}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.drawn}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.lost}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.goalsFor}
                </td>
                <td className="py-2 px-1 text-center tabular-nums text-muted-foreground">
                  {row.goalsAgainst}
                </td>
                <td className="py-2 px-1 text-center tabular-nums">
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                <td className="py-2 px-2 text-center tabular-nums font-bold text-primary">
                  {row.points}
                </td>
                {hasForm && (
                  <td className="py-2 px-1">
                    {row.form && row.form.length > 0 ? (
                      <FormDots form={row.form} />
                    ) : null}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { Standing };
