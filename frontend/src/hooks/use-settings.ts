"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import type { SystemSettings } from "@/types";

export function useSettings() {
  const { status } = useAuth();
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => get<SystemSettings>("/settings"),
    enabled: status === "authenticated",
    staleTime: 5 * 60_000,
  });
}
