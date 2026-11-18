"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10"><AlertTriangle className="size-6" /></span>
      <h2 className="font-heading text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{error.message || "An unexpected error occurred while rendering this page."}</p>
      <Button variant="outline" className="mt-5" onClick={reset}><RefreshCw className="size-4" /> Try again</Button>
    </div>
  );
}
