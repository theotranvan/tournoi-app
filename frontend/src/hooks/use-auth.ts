"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useCoachStore } from "@/stores/coach-store";
import type { TeamAccessResponse } from "@/types/api";

interface LoginPayload {
  username: string;
  password: string;
}

interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password2: string;
  role?: string;
}

interface AuthResponse {
  access: string;
  refresh: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: "superadmin" | "organizer" | "coach" | "public";
  };
}

export function useLogin() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      api.post<AuthResponse>("/auth/login/", payload),
    onSuccess: (data) => {
      login(data.access, data.refresh, data.user);
    },
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      api.post<AuthResponse>("/auth/register/", payload),
    onSuccess: (data) => {
      login(data.access, data.refresh, data.user);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      logout();
    },
  });
}

export function useTeamAccess() {
  const authLogin = useAuthStore((s) => s.login);
  const setTeam = useCoachStore((s) => s.setTeam);

  return useMutation({
    mutationFn: (code: string) =>
      api.post<TeamAccessResponse>("/auth/team-access/", { access_code: code }),
    onSuccess: (data) => {
      authLogin(data.access, data.refresh, {
        id: 0,
        username: data.team.name,
        email: "",
        role: "coach",
      });
      setTeam(data.team);
    },
  });
}
