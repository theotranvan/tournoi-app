"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SubscriptionStatusResponse,
  TournamentPlanResponse,
} from "@/types/api";

/**
 * Fetch current user subscription + active licenses.
 * Response shape: { subscription: SubscriptionData, licenses: TournamentLicenseData[] }
 */
export function useSubscription(options?: { enabled?: boolean }) {
  return useQuery<SubscriptionStatusResponse>({
    queryKey: ["subscription"],
    queryFn: () => api.get("/subscriptions/status/"),
    staleTime: 60_000,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Get effective plan for a specific tournament (FREE / ONE_SHOT / CLUB).
 */
export function useTournamentPlan(tournamentId: string | undefined) {
  return useQuery<TournamentPlanResponse>({
    queryKey: ["tournament-plan", tournamentId],
    queryFn: () =>
      api.get<TournamentPlanResponse>(
        `/subscriptions/tournament/${tournamentId}/plan/`
      ),
    enabled: !!tournamentId,
    staleTime: 60_000,
  });
}

type CheckoutPlan = "monthly" | "yearly" | "club_monthly" | "club_yearly" | "one_shot";

interface CheckoutParams {
  plan: CheckoutPlan;
  tournament_id?: string;
}

export function useCheckout() {
  return useMutation({
    mutationFn: (params: CheckoutParams) =>
      api.post<{ checkout_url: string }>("/subscriptions/checkout/", params),
    onSuccess: (data) => {
      window.location.href = data.checkout_url;
    },
    onError: (error) => {
      console.error("Checkout failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Erreur lors de la création du paiement. Réessaie."
      );
    },
  });
}

export function useCustomerPortal() {
  return useMutation({
    mutationFn: () =>
      api.post<{ portal_url: string }>("/subscriptions/portal/"),
    onSuccess: (data) => {
      window.location.href = data.portal_url;
    },
  });
}

export function useInvalidateSubscription() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["subscription"] });
}
