import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category, PaginatedResponse } from "@/types/api";

export const categoryKeys = {
  all: ["categories"] as const,
  list: (tournamentId: string) =>
    [...categoryKeys.all, "list", tournamentId] as const,
  detail: (tournamentId: string, id: number) =>
    [...categoryKeys.all, "detail", tournamentId, id] as const,
};

export function useCategories(tournamentId: string) {
  return useQuery({
    queryKey: categoryKeys.list(tournamentId),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Category>>(
        `/tournaments/${tournamentId}/categories/`
      );
      return res.results;
    },
    enabled: !!tournamentId,
  });
}
