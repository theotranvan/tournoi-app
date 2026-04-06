import { create } from "zustand";

interface LiveState {
  /** Set of match IDs currently live-tracked via WebSocket */
  liveMatchIds: Set<string>;
  /** Latest score events keyed by match ID */
  scores: Record<string, { home: number; away: number }>;
  /** Connection status */
  wsConnected: boolean;

  addLiveMatch: (id: string) => void;
  removeLiveMatch: (id: string) => void;
  updateScore: (id: string, home: number, away: number) => void;
  setWsConnected: (connected: boolean) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  liveMatchIds: new Set(),
  scores: {},
  wsConnected: false,

  addLiveMatch: (id) =>
    set((s) => ({ liveMatchIds: new Set(s.liveMatchIds).add(id) })),

  removeLiveMatch: (id) =>
    set((s) => {
      const next = new Set(s.liveMatchIds);
      next.delete(id);
      return { liveMatchIds: next };
    }),

  updateScore: (id, home, away) =>
    set((s) => ({
      scores: { ...s.scores, [id]: { home, away } },
    })),

  setWsConnected: (connected) => set({ wsConnected: connected }),
}));
