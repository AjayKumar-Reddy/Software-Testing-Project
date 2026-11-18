"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/types";
import { EmptyState, ErrorState, TableSkeleton } from "./states";
import type { LucideIcon } from "lucide-react";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
  sortKey?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  sort?: string;
  onSortChange?: (sort: string) => void;
  empty?: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode };
  className?: string;
}

export function DataTable<T>({ columns, data, loading, error, onRetry, rowKey, onRowClick, meta, onPageChange, sort, onSortChange, empty, className }: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !data) return <TableSkeleton cols={Math.min(columns.length, 5)} />;
  if (!data?.length) return <EmptyState {...(empty ?? { title: "No records found" })} />;

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange(sort === key ? `-${key}` : key);
  };

  return (
    <div className={cn("relative", loading && "opacity-60 transition-opacity", className)}>
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/40 hover:bg-muted/40">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn("h-10 px-4 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase", c.headClassName)}>
                  {c.sortKey && onSortChange ? (
                    <button type="button" className="inline-flex items-center gap-1 uppercase hover:text-foreground" onClick={() => toggleSort(c.sortKey!)}>
                      {c.header}
                      {sort === c.sortKey ? <ArrowUp className="size-3" /> : sort === `-${c.sortKey}` ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors", onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("px-4 py-3 text-[13px]", c.className)}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {meta && onPageChange && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}

export function Pagination({ meta, onPageChange }: { meta: PageMeta; onPageChange: (p: number) => void }) {
  const { page, totalPages, total, limit } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="no-print flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–<span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </Button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
          ) : (
            <Button key={p} variant={p === page ? "default" : "ghost"} size="icon-sm" onClick={() => onPageChange(p)} aria-current={p === page ? "page" : undefined}>
              {p}
            </Button>
          ),
        )}
        <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
