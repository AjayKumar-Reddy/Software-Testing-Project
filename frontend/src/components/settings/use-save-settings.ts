"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiError, put } from "@/lib/api";
import type { SystemSettings } from "@/types";

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<SystemSettings>) => put<SystemSettings>("/settings", patch),
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["settings-public"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });
}
