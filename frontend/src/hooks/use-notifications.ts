import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Notification } from "@/types/api";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (tournament?: string) =>
    tournament
      ? (["notifications", "list", tournament] as const)
      : (["notifications", "list"] as const),
  unreadCount: ["notifications", "unread-count"] as const,
};

export function useNotifications(tournament?: string) {
  return useQuery({
    queryKey: notificationKeys.list(tournament),
    queryFn: () => {
      const params = tournament ? `?tournament=${tournament}` : "";
      return api.get<Notification[]>(`/notifications/${params}`);
    },
    refetchInterval: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => api.get<{ count: number }>("/notifications/unread_count/"),
    refetchInterval: 15_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch<Notification>(`/notifications/${id}/read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ marked_read: number }>("/notifications/read_all/"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
