import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PublicTournament,
  PublicCategory,
  PublicLive,
  CategoryStandings,
  MatchList,
  MatchDetail,
  TeamBrief,
} from "@/types/api";

export const publicKeys = {
  all: ["public"] as const,
  tournament: (slug: string) =>
    [...publicKeys.all, "tournament", slug] as const,
  categories: (slug: string) =>
    [...publicKeys.all, "categories", slug] as const,
  matches: (slug: string, filters?: Record<string, string>) =>
    [...publicKeys.all, "matches", slug, filters] as const,
  match: (slug: string, matchId: string) =>
    [...publicKeys.all, "match", slug, matchId] as const,
  standings: (slug: string) =>
    [...publicKeys.all, "standings", slug] as const,
  team: (slug: string, teamId: number) =>
    [...publicKeys.all, "team", slug, teamId] as const,
  live: (slug: string) => [...publicKeys.all, "live", slug] as const,
};

export function usePublicTournament(slug: string) {
  return useQuery({
    queryKey: publicKeys.tournament(slug),
    queryFn: () =>
      api.get<PublicTournament>(`/public/tournaments/${slug}/`),
    enabled: !!slug,
  });
}

export function usePublicCategories(slug: string) {
  return useQuery({
    queryKey: publicKeys.categories(slug),
    queryFn: () =>
      api.get<PublicCategory[]>(`/public/tournaments/${slug}/categories/`),
    enabled: !!slug,
  });
}

export function usePublicMatches(
  slug: string,
  filters: Record<string, string> = {}
) {
  return useQuery({
    queryKey: publicKeys.matches(slug, filters),
    queryFn: () =>
      api.get<MatchList[]>(`/public/tournaments/${slug}/matches/`, filters),
    enabled: !!slug,
  });
}

export function usePublicMatch(slug: string, matchId: string) {
  return useQuery({
    queryKey: publicKeys.match(slug, matchId),
    queryFn: () =>
      api.get<MatchDetail>(
        `/public/tournaments/${slug}/matches/${matchId}/`
      ),
    enabled: !!slug && !!matchId,
  });
}

export function usePublicStandings(slug: string) {
  return useQuery({
    queryKey: publicKeys.standings(slug),
    queryFn: () =>
      api.get<CategoryStandings[]>(`/public/tournaments/${slug}/standings/`),
    enabled: !!slug,
  });
}

export function usePublicTeam(slug: string, teamId: number) {
  return useQuery({
    queryKey: publicKeys.team(slug, teamId),
    queryFn: () =>
      api.get<{ team: TeamBrief; matches: MatchList[] }>(
        `/public/tournaments/${slug}/teams/${teamId}/`
      ),
    enabled: !!slug && teamId > 0,
  });
}

export function usePublicLive(slug: string) {
  return useQuery({
    queryKey: publicKeys.live(slug),
    queryFn: () =>
      api.get<PublicLive>(`/public/tournaments/${slug}/live/`),
    enabled: !!slug,
    refetchInterval: 30_000, // auto-refresh every 30s as fallback
  });
}
