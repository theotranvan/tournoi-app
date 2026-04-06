import type { MatchList, ScheduleDay } from "@/types/api";

export interface ClientConflict {
  matchId: string;
  type: "team_overlap" | "field_overflow";
  detail: string;
}

/**
 * Client-side conflict detection.
 * Detects team overlaps and field overflow across all matches in the schedule.
 */
export function detectConflicts(schedule: ScheduleDay[]): ClientConflict[] {
  const allMatches: (MatchList & { fieldId: number })[] = [];
  for (const day of schedule) {
    for (const fs of day.fields) {
      for (const m of fs.matches) {
        if (m.status === "cancelled" || m.status === "postponed") continue;
        allMatches.push({ ...m, fieldId: fs.field.id });
      }
    }
  }

  const conflicts: ClientConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < allMatches.length; i++) {
    const a = allMatches[i];
    const aStart = new Date(a.start_time).getTime();
    const aEnd = aStart + a.duration_minutes * 60_000;

    for (let j = i + 1; j < allMatches.length; j++) {
      const b = allMatches[j];
      const bStart = new Date(b.start_time).getTime();
      const bEnd = bStart + b.duration_minutes * 60_000;

      const overlaps = aStart < bEnd && aEnd > bStart;
      if (!overlaps) continue;

      // Same field overlap
      if (a.fieldId === b.fieldId) {
        const key = `field:${a.id}:${b.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          conflicts.push({
            matchId: a.id,
            type: "field_overflow",
            detail: `Chevauchement sur le même terrain avec ${b.display_home} vs ${b.display_away}`,
          });
          conflicts.push({
            matchId: b.id,
            type: "field_overflow",
            detail: `Chevauchement sur le même terrain avec ${a.display_home} vs ${a.display_away}`,
          });
        }
      }

      // Team overlap
      const sharedTeams: number[] = [];
      if (a.team_home && (b.team_home === a.team_home || b.team_away === a.team_home))
        sharedTeams.push(a.team_home);
      if (a.team_away && (b.team_home === a.team_away || b.team_away === a.team_away))
        sharedTeams.push(a.team_away);

      for (const teamId of sharedTeams) {
        const key = `team:${teamId}:${a.id}:${b.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          const teamName =
            a.team_home === teamId ? a.display_home : a.display_away;
          conflicts.push({
            matchId: a.id,
            type: "team_overlap",
            detail: `${teamName} joue aussi à ce créneau (${b.display_home} vs ${b.display_away})`,
          });
          conflicts.push({
            matchId: b.id,
            type: "team_overlap",
            detail: `${teamName} joue aussi à ce créneau (${a.display_home} vs ${a.display_away})`,
          });
        }
      }
    }
  }

  return conflicts;
}
