import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import type {
  TeamAdmin,
  TeamPayload,
  GroupDetail,
  GroupPayload,
} from "@/types/api";
import { teamKeys } from "./use-teams";
import { groupKeys } from "./use-groups";

// ─── Teams ──────────────────────────────────────────────────────────────────

function teamPayloadToBody(data: TeamPayload | Partial<TeamPayload>): FormData | Record<string, unknown> {
  if (data.logo instanceof File) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        if (key === "logo" && value instanceof File) {
          fd.append("logo", value);
        } else {
          fd.append(key, String(value));
        }
      }
    }
    return fd;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { logo, ...rest } = data as TeamPayload;
  return rest as unknown as Record<string, unknown>;
}

export function useCreateTeam(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TeamPayload) =>
      api.post<TeamAdmin>(`/tournaments/${tournamentId}/teams/`, teamPayloadToBody(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) });
      toast.success("Équipe créée");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Erreur")),
  });
}

export function useUpdateTeam(tournamentId: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TeamPayload>) =>
      api.patch<TeamAdmin>(`/tournaments/${tournamentId}/teams/${id}/`, teamPayloadToBody(data)),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.list(tournamentId) });
      toast.success("Équipe supprimée");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Erreur")),
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
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: groupKeys.list(tournamentId, categoryId),
      });
      toast.success("Groupes générés");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Erreur")),
  });
}
