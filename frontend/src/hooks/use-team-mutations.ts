import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  TeamAdmin,
  TeamPayload,
  GroupDetail,
  GroupPayload,
} from "@/types/api";
import { teamKeys } from "./use-teams";
import { groupKeys } from "./use-groups";

// ─── Teams ──────────────────────────────────────────────────────────────────

export function useCreateTeam(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TeamPayload) =>
      api.post<TeamAdmin>(`/tournaments/${tournamentId}/teams/`, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
  });
}

export function useUpdateTeam(tournamentId: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TeamPayload>) =>
      api.patch<TeamAdmin>(`/tournaments/${tournamentId}/teams/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: teamKeys.detail(tournamentId, id) });
    },
  });
}

export function useDeleteTeam(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/tournaments/${tournamentId}/teams/${id}/`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
  });
}

export function useRegenerateTeamCode(tournamentId: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<TeamAdmin>(
        `/tournaments/${tournamentId}/teams/${id}/regenerate-code/`
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: teamKeys.detail(tournamentId, id) }),
  });
}

export function useBulkImportTeams(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<{ created: number; errors: Record<string, string>[] }>(
        `/tournaments/${tournamentId}/teams/bulk-import/`,
        formData
      );
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
  });
}

// ─── Groups ─────────────────────────────────────────────────────────────────

export function useCreateGroup(tournamentId: string, categoryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: GroupPayload) =>
      api.post<GroupDetail>(
        `/tournaments/${tournamentId}/categories/${categoryId}/groups/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: groupKeys.list(tournamentId, categoryId),
      }),
  });
}

export function useUpdateGroup(
  tournamentId: string,
  categoryId: number,
  id: number
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<GroupPayload>) =>
      api.patch<GroupDetail>(
        `/tournaments/${tournamentId}/categories/${categoryId}/groups/${id}/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: groupKeys.list(tournamentId, categoryId),
      }),
  });
}

export function useGenerateGroups(tournamentId: string, categoryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { num_groups: number; strategy?: string }) =>
      api.post<GroupDetail[]>(
        `/tournaments/${tournamentId}/categories/${categoryId}/groups/generate-balanced/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: groupKeys.list(tournamentId, categoryId),
      }),
  });
}
