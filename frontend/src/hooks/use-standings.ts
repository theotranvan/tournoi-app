import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CategoryStandings, GroupStandings } from "@/types/api";

export const standingsKeys = {
  all: ["standings"] as const,
  category: (categoryId: number) =>
    [...standingsKeys.all, "category", categoryId] as const,
  group: (groupId: number) =>
    [...standingsKeys.all, "group", groupId] as const,
};

export function useCategoryStandings(categoryId: number) {
  return useQuery({
    queryKey: standingsKeys.category(categoryId),
    queryFn: () =>
      api.get<CategoryStandings>(`/categories/${categoryId}/standings/`),
    enabled: categoryId > 0,
  });
}

export function useGroupStandings(groupId: number) {
  return useQuery({
    queryKey: standingsKeys.group(groupId),
    queryFn: () =>
      api.get<{ group: { id: number; name: string }; standings: GroupStandings["standings"] }>(
        `/groups/${groupId}/standings/`
      ),
    enabled: groupId > 0,
  });
}
