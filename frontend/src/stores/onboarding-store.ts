import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface OnboardingState {
  hasSeenOnboarding: boolean;
  markSeen: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      markSeen: () => set({ hasSeenOnboarding: true }),
      reset: () => set({ hasSeenOnboarding: false }),
    }),
    {
      name: "kickoff-onboarding",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
