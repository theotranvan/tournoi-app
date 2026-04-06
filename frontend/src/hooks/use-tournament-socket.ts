"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSocket } from "@/lib/websocket";
import { useLiveStore } from "@/stores/live-store";

/**
 * Hook that opens a WebSocket to /ws/tournaments/{slug}/
 * and invalidates relevant React Query caches on incoming events.
 */
export function useTournamentSocket(slug: string | undefined) {
  const queryClient = useQueryClient();
  const setWsConnected = useLiveStore((s) => s.setWsConnected);
  const updateScore = useLiveStore((s) => s.updateScore);

  useEffect(() => {
    if (!slug) return;

    const socket = createSocket(`/tournaments/${slug}/`, (data) => {
      const event = data.type as string;

      switch (event) {
        case "match.score_updated":
          // Invalidate match lists & detail
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          if (data.match_id) {
            updateScore(
              String(data.match_id),
              data.score_home as number,
              data.score_away as number
            );
          }
          break;

        case "match.started":
        case "match.finished":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
          queryClient.invalidateQueries({ queryKey: ["public", "live", slug] });
          queryClient.invalidateQueries({ queryKey: ["public", "matches", slug] });
          break;

        case "goal.added":
          queryClient.invalidateQueries({ queryKey: ["matches"] });
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
  }, [slug, queryClient, setWsConnected, updateScore]);
}
