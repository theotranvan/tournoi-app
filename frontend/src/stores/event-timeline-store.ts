import { create } from "zustand";

export type TimelineEventType =
  | "goal"
  | "match_started"
  | "match_finished"
  | "score_updated";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string; // ISO
  matchId?: string;
  teamName?: string;
  playerName?: string;
  scoreLine?: string;
  description: string;
}

interface EventTimelineState {
  events: TimelineEvent[];
  addEvent: (event: TimelineEvent) => void;
  clear: () => void;
}

const MAX_EVENTS = 50;

export const useEventTimelineStore = create<EventTimelineState>((set) => ({
  events: [],

  addEvent: (event) =>
    set((s) => ({
      events: [event, ...s.events].slice(0, MAX_EVENTS),
    })),

  clear: () => set({ events: [] }),
}));
