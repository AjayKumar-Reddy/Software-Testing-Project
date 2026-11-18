import { cn, titleCase } from "@/lib/utils";

const STYLES: Record<string, string> = {
  // employment
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  probation: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300",
  on_sabbatical: "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300",
  inactive: "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300",
  resigned: "bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/10 dark:text-orange-300",
  retired: "bg-stone-100 text-stone-600 ring-stone-500/15 dark:bg-stone-500/10 dark:text-stone-300",
  archived: "bg-slate-100 text-slate-500 ring-slate-500/15",
  // attendance
  present: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  absent: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
  late: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  on_leave: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300",
  // leave
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-400",
  // workload
  overloaded: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
  optimal: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  underutilized: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  // priority / misc
  urgent: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
  important: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  normal: "bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-500/10 dark:text-slate-300",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  scheduled: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300",
  expired: "bg-slate-100 text-slate-500 ring-slate-500/15",
  allocated: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300",
  partial: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300",
  unallocated: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300",
};

const DOTS: Record<string, string> = {
  present: "bg-emerald-500", active: "bg-emerald-500", approved: "bg-emerald-500", optimal: "bg-emerald-500", published: "bg-emerald-500", allocated: "bg-emerald-500",
  absent: "bg-rose-500", rejected: "bg-rose-500", overloaded: "bg-rose-500", urgent: "bg-rose-500", unallocated: "bg-rose-500",
  late: "bg-amber-500", pending: "bg-amber-500", underutilized: "bg-amber-500", important: "bg-amber-500", partial: "bg-amber-500",
  on_leave: "bg-blue-500", probation: "bg-sky-500", scheduled: "bg-sky-500",
};

export function StatusBadge({ status, label, className, dot = true }: { status: string; label?: string; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap ring-1 ring-inset", STYLES[status] ?? STYLES.normal, className)}>
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[status] ?? "bg-slate-400")} />}
      {label ?? titleCase(status)}
    </span>
  );
}
