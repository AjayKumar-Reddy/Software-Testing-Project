import Link from "next/link";
import { AlertTriangle, Inbox, Lock, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/70 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-700">
        <Icon className="size-6 text-slate-400" />
      </div>
      <p className="font-heading text-[15px] font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100 dark:bg-red-500/10 dark:ring-red-500/20">
        <AlertTriangle className="size-6 text-red-500" />
      </div>
      <p className="font-heading text-[15px] font-semibold">Couldn&apos;t load this data</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{apiError(error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function AccessDenied() {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access to this page"
      description="This area is restricted to other roles. If you think this is a mistake, contact your administrator."
      action={<Button render={<Link href="/dashboard" />}>Back to dashboard</Button>}
      className="py-24"
    />
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-9 rounded-full" />
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-card">
          <Skeleton className="mb-4 h-3.5 w-24" />
          <Skeleton className="mb-2 h-7 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="flex items-end gap-2 px-2" style={{ height }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
      ))}
    </div>
  );
}
