import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MatchDetail, MatchUpdatePayload, ScoreInput } from "@/types/api";
import { matchKeys } from "./use-matches";
import { standingsKeys } from "./use-standings";

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
    mutationFn: (data: ScoreInput) =>
      api.post<MatchDetail>(
        `/tournaments/${tournamentId}/matches/${id}/score/`,
        data
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.detail(tournamentId, id) });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: standingsKeys.all });
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
