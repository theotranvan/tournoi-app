"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Global handler for query/mutation errors.
 * - On 401: show "session expired" toast, logout & redirect once.
 * - Never wipes React state on transient network errors.
 */
let sessionExpiredToasted = false;

function handleGlobalError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    // Only show the toast + redirect once per session
    if (!sessionExpiredToasted) {
      sessionExpiredToasted = true;
      toast.error("Session expirée — reconnexion nécessaire", {
        duration: 5000,
      });
      // Gracefully clear auth state and redirect
      const { logout } = useAuthStore.getState();
      logout();
      // Small delay so toast is visible
      setTimeout(() => {
        if (window.location.pathname !== "/admin/login") {
          window.location.href = "/admin/login";
        }
        sessionExpiredToasted = false;
      }, 1500);
    }
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000, // 30 seconds
            gcTime: 5 * 60_000, // 5 minutes
            retry: (failureCount, error) => {
              // Don't retry on auth errors or client errors
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
              }
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            onError: handleGlobalError,
          },
        },
      })
  );

  // Also handle query-level errors
  queryClient.getQueryCache().config.onError = handleGlobalError;

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
