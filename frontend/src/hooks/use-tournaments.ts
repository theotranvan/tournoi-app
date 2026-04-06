import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  TournamentList,
  TournamentDetail,
  PaginatedResponse,
} from "@/types/api";

export const tournamentKeys = {
  all: ["tournaments"] as const,
  lists: () => [...tournamentKeys.all, "list"] as const,
  list: (filters: Record<string, string>) =>
    [...tournamentKeys.lists(), filters] as const,
  details: () => [...tournamentKeys.all, "detail"] as const,
  detail: (id: string) => [...tournamentKeys.details(), id] as const,
};

export function useTournaments(filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: tournamentKeys.list(filters),
    queryFn: () =>
      api.get<PaginatedResponse<TournamentList>>("/tournaments/", filters),
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: tournamentKeys.detail(id),
    queryFn: () => api.get<TournamentDetail>(`/tournaments/${id}/`),
    enabled: !!id,
  });
}
