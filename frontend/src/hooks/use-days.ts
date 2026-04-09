import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Day, PaginatedResponse } from "@/types/api";

export const dayKeys = {
  all: ["days"] as const,
  list: (tournamentId: string) =>
    [...dayKeys.all, "list", tournamentId] as const,
};

export function useDays(tournamentId: string) {
  return useQuery({
    queryKey: dayKeys.list(tournamentId),
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<Day>>(
        `/tournaments/${tournamentId}/days/`
      );
      return res.results;
    },
    enabled: !!tournamentId,
  });
}
