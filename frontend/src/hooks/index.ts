// Auth
export { useLogin, useRegister, useLogout, useTeamAccess } from "./use-auth";

// Queries
export { useClubs, useClub, clubKeys } from "./use-clubs";
export { useTournaments, useTournament, tournamentKeys } from "./use-tournaments";
export { useCategories, categoryKeys } from "./use-categories";
export { useFields, fieldKeys } from "./use-fields";
export { useTeams, useTeam, teamKeys } from "./use-teams";
export { useGroups, groupKeys } from "./use-groups";
export { useMatches, useMatch, matchKeys } from "./use-matches";
export { useCategoryStandings, useGroupStandings, standingsKeys } from "./use-standings";
export { useSchedule, useScheduleConflicts, useScheduleTask, scheduleKeys } from "./use-schedule";
export {
  usePublicTournament,
  usePublicCategories,
  usePublicMatches,
  usePublicStandings,
  usePublicTeam,
  usePublicLive,
  publicKeys,
} from "./use-public";

// Mutations — Tournaments, Categories, Fields, Scheduling
export {
  useCreateTournament,
  useUpdateTournament,
  useDeleteTournament,
  usePublishTournament,
  useStartTournament,
  useFinishTournament,
  useDuplicateTournament,
  useCreateCategory,
  useBulkCreateCategories,
  useUpdateCategory,
  useDeleteCategory,
  useCreateField,
  useUpdateField,
  useGenerateSchedule,
  useRecalculateSchedule,
} from "./use-mutations";

// Mutations — Teams & Groups
export {
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useRegenerateTeamCode,
  useBulkImportTeams,
  useCreateGroup,
  useUpdateGroup,
  useGenerateGroups,
} from "./use-team-mutations";

// Mutations — Matches
export {
  useUpdateMatch,
  useStartMatch,
  useSubmitScore,
  useDeleteMatch,
} from "./use-match-mutations";

// WebSocket
export { useTournamentSocket } from "./use-tournament-socket";

