"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSocket } from "@/lib/websocket";
import { useLiveStore } from "@/stores/live-store";
import { useEventTimelineStore } from "@/stores/event-timeline-store";

/**
 * Hook that opens a WebSocket to /ws/tournaments/{slug}/
 * and invalidates relevant React Query caches on incoming events.
 */
export function useTournamentSocket(slug: string | undefined) {
  const queryClient = useQueryClient();
  const setWsConnected = useLiveStore((s) => s.setWsConnected);
  const updateScore = useLiveStore((s) => s.updateScore);
  const addEvent = useEventTimelineStore((s) => s.addEvent);

  useEffect(() => {
    if (!slug) return;

    const socket = createSocket(`/tournaments/${slug}/`, (data) => {
      const event = data.type as string;
      const now = new Date().toISOString();

      switch (event) {
        case "match.score_updated":
          // Invalidate match lists & detail
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["public", "live", slug] });
          queryClient.invalidateQueries({ queryKey: ["public", "match", slug] });
          if (data.match_id) {
            updateScore(
              String(data.match_id),
              data.score_home as number,
              data.score_away as number
            );
          }
          addEvent({
            id: `score-${data.match_id}-${now}`,
            type: "score_updated",
            timestamp: now,
            matchId: String(data.match_id ?? ""),
            description: `Score mis à jour : ${data.home_name ?? "?"} ${data.score_home ?? 0} - ${data.score_away ?? 0} ${data.away_name ?? "?"}`,
          });
          break;

        case "match.started":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["public", "live", slug] });
          queryClient.invalidateQueries({ queryKey: ["public", "matches", slug] });
          addEvent({
            id: `started-${data.match_id}-${now}`,
            type: "match_started",
            timestamp: now,
            matchId: String(data.match_id ?? ""),
            description: `Début : ${data.home_name ?? "?"} vs ${data.away_name ?? "?"}`,
          });
          break;

        case "match.finished":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["public", "live", slug] });
          queryClient.invalidateQueries({ queryKey: ["public", "matches", slug] });
          addEvent({
            id: `finished-${data.match_id}-${now}`,
            type: "match_finished",
            timestamp: now,
            matchId: String(data.match_id ?? ""),
            description: `Terminé : ${data.home_name ?? "?"} ${data.score_home ?? 0} - ${data.score_away ?? 0} ${data.away_name ?? "?"}`,
          });
          break;

        case "goal.added":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["public", "live", slug] });
          addEvent({
            id: `goal-${data.match_id}-${now}`,
            type: "goal",
            timestamp: now,
            matchId: String(data.match_id ?? ""),
            playerName: (data.player_name as string) ?? undefined,
            teamName: (data.team_name as string) ?? undefined,
            description: data.player_name
              ? `But de ${data.player_name} (${data.team_name ?? "?"})`
              : `But pour ${data.team_name ?? "?"}`,
          });
          break;

        case "standings.updated":
          queryClient.invalidateQueries({ queryKey: ["standings"] });
          queryClient.invalidateQueries({ queryKey: ["public", "standings", slug] });
          break;

        case "schedule.updated":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["schedule"] });
          queryClient.invalidateQueries({ queryKey: ["public", "matches", slug] });
          break;
      }
    });

    setWsConnected(true);
    return () => {
      socket.close();
      setWsConnected(false);
    };
  }, [slug, queryClient, setWsConnected, updateScore, addEvent]);
}
