import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { MatchList, MatchDetail, PaginatedResponse } from "@/types/api";

export const matchKeys = {
  all: ["matches"] as const,
  list: (tournamentId: string, filters?: Record<string, string>) =>
    [...matchKeys.all, "list", tournamentId, filters] as const,
  detail: (tournamentId: string, id: string) =>
    [...matchKeys.all, "detail", tournamentId, id] as const,
};

export function useMatches(
  tournamentId: string,
  filters: Record<string, string> = {}
) {
  return useQuery({
    queryKey: matchKeys.list(tournamentId, filters),
    queryFn: () =>
      api.get<PaginatedResponse<MatchList>>(
        `/tournaments/${tournamentId}/matches/`,
        filters
      ),
    enabled: !!tournamentId,
  });
}

export function useMatch(tournamentId: string, id: string) {
  return useQuery({
    queryKey: matchKeys.detail(tournamentId, id),
    queryFn: () =>
      api.get<MatchDetail>(`/tournaments/${tournamentId}/matches/${id}/`),
    enabled: !!tournamentId && !!id,
  });
}
