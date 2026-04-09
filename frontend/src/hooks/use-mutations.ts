import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  TournamentDetail,
  TournamentPayload,
  Category,
  CategoryPayload,
  TournamentField,
  FieldPayload,
  Day,
  DayPayload,
  GenerateResult,
  FinalsResult,
  AutoPoolsResult,
} from "@/types/api";
import { tournamentKeys } from "./use-tournaments";
import { categoryKeys } from "./use-categories";
import { fieldKeys } from "./use-fields";
import { dayKeys } from "./use-days";
import { scheduleKeys } from "./use-schedule";
import { matchKeys } from "./use-matches";
import { groupKeys } from "./use-groups";

interface SuggestSwapResult {
  description: string;
  applied: boolean;
  swap_with_match_id: string;
  swap_with_display: string;
  swap_with_time: string;
  swap_with_field: string;
  improvement: number;
}

// ─── Tournaments ────────────────────────────────────────────────────────────

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: TournamentPayload) =>
      api.post<TournamentDetail>("/tournaments/", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.lists() }),
  });
}

export function useUpdateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<TournamentPayload>) =>
      api.patch<TournamentDetail>(`/tournaments/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tournaments/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.lists() }),
  });
}

export function usePublishTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tournaments/${id}/publish/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useStartTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tournaments/${id}/start/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useFinishTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/tournaments/${id}/finish/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tournamentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: tournamentKeys.lists() });
    },
  });
}

export function useDuplicateTournament(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<TournamentDetail>(`/tournaments/${id}/duplicate/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: tournamentKeys.lists() }),
  });
}

// ─── Categories ─────────────────────────────────────────────────────────────

export function useCreateCategory(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryPayload) =>
      api.post<Category>(`/tournaments/${tournamentId}/categories/`, data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: categoryKeys.list(tournamentId) }),
  });
}

export function useBulkCreateCategories(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categories: Record<string, unknown>[]) =>
      api.post(`/tournaments/${tournamentId}/categories/bulk-create/`, {
        categories,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: categoryKeys.list(tournamentId) }),
  });
}

export function useUpdateCategory(tournamentId: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CategoryPayload>) =>
      api.patch<Category>(
        `/tournaments/${tournamentId}/categories/${id}/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: categoryKeys.list(tournamentId) }),
  });
}

export function useDeleteCategory(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/tournaments/${tournamentId}/categories/${id}/`),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: categoryKeys.list(tournamentId) }),
  });
}

// ─── Fields ─────────────────────────────────────────────────────────────────

export function useCreateField(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FieldPayload) =>
      api.post<TournamentField>(
        `/tournaments/${tournamentId}/fields/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: fieldKeys.list(tournamentId) }),
  });
}

export function useUpdateField(tournamentId: string, id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<FieldPayload>) =>
      api.patch<TournamentField>(
        `/tournaments/${tournamentId}/fields/${id}/`,
        data
      ),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: fieldKeys.list(tournamentId) }),
  });
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

export function useGenerateSchedule(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: Record<string, unknown>) =>
      api.post<GenerateResult>(
        `/tournaments/${tournamentId}/schedule/generate/`,
        options
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
    },
  });
}

export function useRecalculateSchedule(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matchIds: number[]) =>
      api.post(`/tournaments/${tournamentId}/schedule/recalculate/`, {
        match_ids: matchIds,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: scheduleKeys.list(tournamentId) }),
  });
}

export function useSuggestSwap(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matchId,
      apply,
    }: {
      matchId: string;
      apply?: boolean;
    }) =>
      api.post<SuggestSwapResult>(
        `/tournaments/${tournamentId}/schedule/suggest-swap/${matchId}/${apply ? "?apply=true" : ""}`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scheduleKeys.list(tournamentId) });
      qc.invalidateQueries({
        queryKey: scheduleKeys.diagnostics(tournamentId),
      });
    },
  });
}

// ─── Days ───────────────────────────────────────────────────────────────────

export function useCreateDay(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DayPayload) =>
      api.post<Day>(`/tournaments/${tournamentId}/days/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dayKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
    },
  });
}

export function useUpdateDay(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: DayPayload & { id: number }) =>
      api.patch<Day>(`/tournaments/${tournamentId}/days/${id}/`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dayKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
    },
  });
}

export function useDeleteDay(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`/tournaments/${tournamentId}/days/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dayKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
    },
  });
}

// ─── Auto Pools & Finals ────────────────────────────────────────────────────

export function useAutoGeneratePools(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: number) =>
      api.post<AutoPoolsResult>(
        `/tournaments/${tournamentId}/categories/${categoryId}/auto-pools/`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKeys.all });
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
    },
  });
}

export function useGenerateFinals(tournamentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: number) =>
      api.post<FinalsResult>(
        `/tournaments/${tournamentId}/categories/${categoryId}/finals/`
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.list(tournamentId) });
      qc.invalidateQueries({ queryKey: scheduleKeys.feasibility(tournamentId) });
    },
  });
}
