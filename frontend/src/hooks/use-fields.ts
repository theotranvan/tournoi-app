import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TournamentField, PaginatedResponse } from "@/types/api";

export const fieldKeys = {
  all: ["fields"] as const,
  list: (tournamentId: string) =>
    [...fieldKeys.all, "list", tournamentId] as const,
};

export function useFields(tournamentId: string) {
  return useQuery({
    queryKey: fieldKeys.list(tournamentId),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<TournamentField>>(
        `/tournaments/${tournamentId}/fields/`
      );
      return res.results;
    },
    enabled: !!tournamentId,
  });
}
