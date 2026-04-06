import { create } from "zustand";

interface User {
  id: number;
  username: string;
  email: string;
  role: "superadmin" | "organizer" | "coach" | "public";
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (access: string, refresh: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated:
    typeof window !== "undefined"
      ? !!localStorage.getItem("access_token")
      : false,

  login: (access, refresh, user) => {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user, isAuthenticated: true }),
}));
