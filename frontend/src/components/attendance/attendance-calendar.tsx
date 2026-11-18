"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, isAfter, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChartSkeleton, ErrorState } from "@/components/shared/states";
import { get } from "@/lib/api";
import { cn, pct, titleCase } from "@/lib/utils";
import type { AttendanceRecord, AttendanceStats } from "@/types";

const CELL: Record<string, string> = {
  present: "bg-emerald-500/90 text-white",
  late: "bg-amber-400 text-amber-950",
  absent: "bg-rose-500/90 text-white",
  on_leave: "bg-blue-500/90 text-white",
};

interface CalendarData {
  month: string;
  workingDays: number[];
  records: AttendanceRecord[];
  stats: AttendanceStats;
  faculty: { fullName: string };
}

/** Monthly attendance calendar for one faculty member (defaults to the signed-in user). */
export function AttendanceCalendar({ facultyId }: { facultyId?: string }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const key = format(month, "yyyy-MM");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["attendance", "calendar", facultyId ?? "me", key],
    queryFn: () => get<CalendarData>("/attendance/calendar", { faculty: facultyId, month: key }),
  });

  const days = useMemo(() => eachDayOfInterval({ start: month, end: endOfMonth(month) }), [month]);
  const byDate = useMemo(() => Object.fromEntries((data?.records ?? []).map((r) => [r.date.slice(0, 10), r])), [data]);
  const lead = (getDay(month) + 6) % 7; // Monday-first grid
  const today = new Date();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
          <p className="w-36 text-center font-heading text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} disabled={isAfter(addMonths(month, 1), today)} aria-label="Next month"><ChevronRight className="size-4" /></Button>
        </div>
        {data && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-semibold">{pct(data.stats.percentage)} attendance</span>
            <span className="text-muted-foreground">P {data.stats.present} · L {data.stats.late} · A {data.stats.absent} · Leave {data.stats.onLeave}</span>
          </div>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <ChartSkeleton height={280} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{d}</div>
            ))}
            {Array.from({ length: lead }).map((_, i) => <div key={`l${i}`} />)}
            {days.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const rec = byDate[k];
              const working = data?.workingDays.includes(getDay(d));
              const future = isAfter(d, today);
              const cell = (
                <div
                  className={cn(
                    "flex aspect-square min-h-9 flex-col items-center justify-center rounded-lg text-xs font-medium transition",
                    rec ? CELL[rec.status] : working && !future ? "bg-muted text-muted-foreground" : "text-muted-foreground/40",
                    format(today, "yyyy-MM-dd") === k && "ring-2 ring-blue-500 ring-offset-1 ring-offset-background",
                  )}
                >
                  <span>{format(d, "d")}</span>
                  {rec?.checkIn && <span className="hidden text-[9px] opacity-80 sm:block">{rec.checkIn}</span>}
                </div>
              );
              return rec ? (
                <Tooltip key={k}>
                  <TooltipTrigger render={<div />}>{cell}</TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{format(d, "EEE, d MMM")} · {titleCase(rec.status)}</p>
                    {(rec.checkIn || rec.checkOut) && <p>In {rec.checkIn ?? "—"} · Out {rec.checkOut ?? "—"}</p>}
                    <p className="opacity-80">{rec.source === "self" ? "Self-reported" : rec.source === "leave" ? "Approved leave" : "Marked by staff"}</p>
                    {rec.remarks && <p className="opacity-80">{rec.remarks}</p>}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={k}>{cell}</div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {Object.entries(CELL).map(([s, c]) => (
              <span key={s} className="flex items-center gap-1.5"><span className={cn("size-3 rounded", c)} />{titleCase(s)}</span>
            ))}
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-muted" />Not recorded</span>
          </div>
        </>
      )}
    </div>
  );
}
