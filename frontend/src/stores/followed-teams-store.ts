import { create } from "zustand";

interface FollowedTeamsState {
  /** Set of followed team IDs */
  teamIds: Set<number>;
  /** Toggle follow for a team */
  toggle: (teamId: number) => void;
  /** Check if a team is followed */
  isFollowed: (teamId: number) => boolean;
}

function loadFromStorage(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("kickoff_followed_teams");
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveToStorage(ids: Set<number>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    "kickoff_followed_teams",
    JSON.stringify([...ids])
  );
}

export const useFollowedTeamsStore = create<FollowedTeamsState>((set, get) => ({
  teamIds: loadFromStorage(),

  toggle: (teamId) =>
    set((s) => {
      const next = new Set(s.teamIds);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      saveToStorage(next);
      return { teamIds: next };
    }),

  isFollowed: (teamId) => get().teamIds.has(teamId),
}));
