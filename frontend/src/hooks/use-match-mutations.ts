import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { MatchDetail, MatchUpdatePayload, ScoreInput } from "@/types/api";
import { matchKeys } from "./use-matches";
import { standingsKeys } from "./use-standings";
import {
  savePendingScore,
  requestBackgroundSync,
  type PendingScore,
} from "@/lib/offline-scores";

export function useUpdateMatch(tournamentId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MatchUpdatePayload) =>
      api.patch<MatchDetail>(
        `/tournaments/${tournamentId}/matches/${id}/`,
        data
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.detail(tournamentId, id) });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
    },
  });
}

export function useStartMatch(tournamentId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<MatchDetail>(
        `/tournaments/${tournamentId}/matches/${id}/start/`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.detail(tournamentId, id) });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
    },
  });
}

export function useSubmitScore(tournamentId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ScoreInput) => {
      try {
        return await api.post<MatchDetail>(
          `/tournaments/${tournamentId}/matches/${id}/score/`,
          data
        );
      } catch (err) {
        // If network error (not an API error), store offline
        if (!(err instanceof ApiError)) {
          const pending: PendingScore = {
            id: `${id}-${Date.now()}`,
            tournamentId,
            matchId: id,
            data: data as Record<string, unknown>,
            url: `/api/v1/tournaments/${tournamentId}/matches/${id}/score/`,
            token: typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
            createdAt: Date.now(),
          };
          await savePendingScore(pending);
          await requestBackgroundSync();
          // Return a synthetic response to signal offline save
          return { _offline: true } as unknown as MatchDetail;
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: matchKeys.detail(tournamentId, id) });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
      if (!(result as unknown as Record<string, boolean>)?._offline) {
        qc.invalidateQueries({ queryKey: standingsKeys.all });
      }
    },
  });
}

export function useDeleteMatch(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/tournaments/${tournamentId}/matches/${id}/`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) }),
  });
}
