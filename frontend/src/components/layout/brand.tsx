"use client";

import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-900/30", className)}>
      <GraduationCap className="size-5" />
    </div>
  );
}
