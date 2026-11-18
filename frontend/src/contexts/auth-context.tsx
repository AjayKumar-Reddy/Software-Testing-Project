"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, refreshSession, setAccessToken, SESSION_EXPIRED_EVENT } from "@/lib/api";
import type { ApiResponse, AuthUser, Role } from "@/types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  role: Role | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
  reloadUser: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const router = useRouter();
  const queryClient = useQueryClient();

  // Restore the session from the httpOnly refresh cookie on first load.
  useEffect(() => {
    refreshSession()
      .then(({ user }) => {
        setUser(user);
        setStatus("authenticated");
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus("unauthenticated");
      queryClient.clear();
      toast.error("Your session has expired. Please sign in again.");
      router.replace("/login?reason=expired");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [router, queryClient]);

  const setSession = useCallback((token: string, u: AuthUser) => {
    setAccessToken(token);
    setUser(u);
    setStatus("authenticated");
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<ApiResponse<{ accessToken: string; user: AuthUser }>>("/auth/login", { email, password });
      setSession(res.data.data.accessToken, res.data.data.user);
      return res.data.data.user;
    },
    [setSession],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore network errors on logout */
    }
    setAccessToken(null);
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
    router.replace("/login");
  }, [router, queryClient]);

  const reloadUser = useCallback(async () => {
    const res = await api.get<ApiResponse<AuthUser>>("/auth/me");
    setUser(res.data.data);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      role: user?.role ?? null,
      login,
      logout,
      setSession,
      reloadUser,
      hasRole: (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    }),
    [user, status, login, logout, setSession, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
