import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { GroupDetail, PaginatedResponse } from "@/types/api";

export const groupKeys = {
  all: ["groups"] as const,
  list: (tournamentId: string, categoryId: number) =>
    [...groupKeys.all, "list", tournamentId, categoryId] as const,
  detail: (tournamentId: string, categoryId: number, id: number) =>
    [...groupKeys.all, "detail", tournamentId, categoryId, id] as const,
};

export function useGroups(tournamentId: string, categoryId: number) {
  return useQuery({
    queryKey: groupKeys.list(tournamentId, categoryId),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<GroupDetail>>(
        `/tournaments/${tournamentId}/categories/${categoryId}/groups/`
      );
      return res.results;
    },
    enabled: !!tournamentId && categoryId > 0,
  });
}
