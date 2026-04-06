"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface SubscriptionData {
  plan: "free" | "monthly" | "yearly";
  status: "active" | "past_due" | "canceled" | "incomplete" | "trialing";
  is_premium: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["subscription"],
    queryFn: () => api.get("/subscriptions/status/"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: (plan: "monthly" | "yearly") =>
      api.post<{ checkout_url: string }>("/subscriptions/checkout/", { plan }),
    onSuccess: (data) => {
      window.location.href = data.checkout_url;
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
