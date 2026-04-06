import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Club, FFFClub } from "@/types/api";

export const clubKeys = {
  all: ["clubs"] as const,
  list: () => [...clubKeys.all, "list"] as const,
  detail: (id: number) => [...clubKeys.all, "detail", id] as const,
};

export function useClubs() {
  return useQuery({
    queryKey: clubKeys.list(),
    queryFn: () => api.get<Club[]>("/clubs/"),
  });
}

export function useClub(id: number) {
  return useQuery({
    queryKey: clubKeys.detail(id),
    queryFn: () => api.get<Club>(`/clubs/${id}/`),
    enabled: id > 0,
  });
}

export function useClubFFFSearch(query: string) {
  return useQuery({
    queryKey: ["clubs", "fff-search", query] as const,
    queryFn: () => api.get<FFFClub[]>("/clubs/fff-search/", { q: query }),
    enabled: query.length >= 2,
    staleTime: 60 * 60 * 1000,
  });
}
