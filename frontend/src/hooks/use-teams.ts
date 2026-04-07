import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TeamAdmin, PaginatedResponse } from "@/types/api";

export const teamKeys = {
  all: ["teams"] as const,
  list: (tournamentId: string, filters?: Record<string, string>) =>
    filters && Object.keys(filters).length > 0
      ? ([...teamKeys.all, "list", tournamentId, filters] as const)
      : ([...teamKeys.all, "list", tournamentId] as const),
  detail: (tournamentId: string, id: number) =>
    [...teamKeys.all, "detail", tournamentId, id] as const,
  suggestions: (tournamentId: string, search: string, excludeCategory?: string) =>
    [...teamKeys.all, "suggestions", tournamentId, search, excludeCategory] as const,
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

export function useTeamSuggestions(
  tournamentId: string,
  search: string,
  excludeCategory?: string
) {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (excludeCategory) params.exclude_category = excludeCategory;

  return useQuery({
    queryKey: teamKeys.suggestions(tournamentId, search, excludeCategory),
    queryFn: () =>
      api.get<string[]>(
        `/tournaments/${tournamentId}/teams/suggestions/`,
        params
      ),
    enabled: !!tournamentId && search.length >= 1,
    staleTime: 10_000,
  });
}
