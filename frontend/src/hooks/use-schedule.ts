import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  ScheduleDay,
  ScheduleConflict,
  ScheduleTaskStatus,
  FeasibilityResult,
  DiagnosticsResult,
} from "@/types/api";

export const scheduleKeys = {
  all: ["schedule"] as const,
  list: (tournamentId: string) =>
    [...scheduleKeys.all, "list", tournamentId] as const,
  conflicts: (tournamentId: string) =>
    [...scheduleKeys.all, "conflicts", tournamentId] as const,
  task: (taskId: string) =>
    [...scheduleKeys.all, "task", taskId] as const,
  feasibility: (tournamentId: string) =>
    [...scheduleKeys.all, "feasibility", tournamentId] as const,
  diagnostics: (tournamentId: string) =>
    [...scheduleKeys.all, "diagnostics", tournamentId] as const,
};

export function useSchedule(tournamentId: string) {
  return useQuery({
    queryKey: scheduleKeys.list(tournamentId),
    queryFn: () =>
      api.get<ScheduleDay[]>(`/tournaments/${tournamentId}/schedule/`),
    enabled: !!tournamentId,
  });
}

export function useScheduleConflicts(tournamentId: string) {
  return useQuery({
    queryKey: scheduleKeys.conflicts(tournamentId),
    queryFn: () =>
      api.get<ScheduleConflict[]>(
        `/tournaments/${tournamentId}/schedule/conflicts/`
      ),
    enabled: !!tournamentId,
  });
}

export function useScheduleTask(taskId: string | null, tournamentId: string) {
  return useQuery({
    queryKey: scheduleKeys.task(taskId ?? ""),
    queryFn: () =>
      api.get<ScheduleTaskStatus>(
        `/tournaments/${tournamentId}/schedule/task/${taskId}/`
      ),
    enabled: !!taskId && !!tournamentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "SUCCESS" || status === "FAILURE") return false;
      return 1000; // poll every second while pending
    },
  });
}

export function useFeasibility(tournamentId: string) {
  return useQuery({
    queryKey: scheduleKeys.feasibility(tournamentId),
    queryFn: () =>
      api.get<FeasibilityResult>(
        `/tournaments/${tournamentId}/schedule/feasibility/`
      ),
    enabled: !!tournamentId,
  });
}

export function useDiagnostics(tournamentId: string, enabled: boolean) {
  return useQuery({
    queryKey: scheduleKeys.diagnostics(tournamentId),
    queryFn: () =>
      api.get<DiagnosticsResult>(
        `/tournaments/${tournamentId}/schedule/diagnostics/`
      ),
    enabled: !!tournamentId && enabled,
  });
}
