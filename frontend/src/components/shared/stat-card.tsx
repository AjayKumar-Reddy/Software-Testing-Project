import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONES = {
  blue: "from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-300",
  navy: "from-indigo-500/15 to-indigo-500/5 text-indigo-700 dark:text-indigo-300",
  green: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-300",
  amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-300",
  red: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-300",
  violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-300",
  sky: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-300",
  slate: "from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-300",
} as const;

export type Tone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  hint,
  href,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  href?: string;
  loading?: boolean;
}) {
  const body = (
    <div className={cn("group relative h-full overflow-hidden rounded-xl border bg-card p-5 shadow-card transition-all duration-200", href && "hover:-translate-y-0.5 hover:shadow-card-hover")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          {loading ? <Skeleton className="mt-2 h-8 w-20" /> : <p className="tabular mt-1.5 font-heading text-[28px] font-bold leading-none tracking-tight">{value}</p>}
        </div>
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br", TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      {hint && <div className="mt-3 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
