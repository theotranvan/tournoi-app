import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Club } from "@/types/api";

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
