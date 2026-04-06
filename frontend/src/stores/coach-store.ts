import { create } from "zustand";

interface CoachTeam {
  id: number;
  name: string;
  short_name: string;
  logo: string | null;
  category: { id: number; name: string };
  tournament: { id: string; name: string; slug: string };
}

interface CoachState {
  team: CoachTeam | null;
  setTeam: (team: CoachTeam) => void;
  clear: () => void;
}

export const useCoachStore = create<CoachState>((set) => ({
  team:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("coach_team") ?? "null")
      : null,

  setTeam: (team) => {
    localStorage.setItem("coach_team", JSON.stringify(team));
    set({ team });
  },

  clear: () => {
    localStorage.removeItem("coach_team");
    set({ team: null });
  },
}));
