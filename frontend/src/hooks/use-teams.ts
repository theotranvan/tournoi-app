import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TeamAdmin, PaginatedResponse } from "@/types/api";

export const teamKeys = {
  all: ["teams"] as const,
  list: (tournamentId: string, filters?: Record<string, string>) =>
    [...teamKeys.all, "list", tournamentId, filters] as const,
  detail: (tournamentId: string, id: number) =>
    [...teamKeys.all, "detail", tournamentId, id] as const,
};

export function useTeams(
  tournamentId: string,
  filters: Record<string, string> = {}
) {
  return useQuery({
    queryKey: teamKeys.list(tournamentId, filters),
    queryFn: () =>
      api.get<PaginatedResponse<TeamAdmin>>(
        `/tournaments/${tournamentId}/teams/`,
        filters
      ),
    enabled: !!tournamentId,
  });
}

export function useTeam(tournamentId: string, id: number) {
  return useQuery({
    queryKey: teamKeys.detail(tournamentId, id),
    queryFn: () =>
      api.get<TeamAdmin>(`/tournaments/${tournamentId}/teams/${id}/`),
    enabled: !!tournamentId && id > 0,
  });
}
