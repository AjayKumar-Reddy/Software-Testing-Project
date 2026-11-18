"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiError, download } from "@/lib/api";

/** Download a server-generated report in PDF / Excel / CSV. */
export function ExportMenu({ report, params = {}, label = "Export", size = "default" }: { report: string; params?: Record<string, unknown>; label?: string; size?: "default" | "sm" }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (format: "pdf" | "xlsx" | "csv") => {
    setBusy(format);
    try {
      await download(`/reports/${report}`, { ...params, format }, `${report}.${format}`);
      toast.success(`${format.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size={size} />}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Download as</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run("pdf")}>
            <FileText className="size-4 text-rose-500" /> PDF document
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("xlsx")}>
            <FileSpreadsheet className="size-4 text-emerald-600" /> Excel workbook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run("csv")}>
            <Sheet className="size-4 text-sky-600" /> CSV file
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
